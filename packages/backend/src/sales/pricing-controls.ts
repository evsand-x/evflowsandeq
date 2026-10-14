import { ConflictException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { validException } from "./exception-controls";

export type TaxSnapshot = {
  rule_id: string;
  name: string;
  legal_reference: string;
  rate: string;
  dpp_factor: string;
  decimal_places: number;
  rounding: "HALF_UP" | "HALF_EVEN" | "DOWN";
  taxable_event?: string;
};
type PricedLine = { unitPrice: Prisma.Decimal; taxSnapshot: Prisma.JsonValue | null };

export async function assertPriceGrants(
  tx: Prisma.TransactionClient,
  companyId: string,
  lines: Array<{
    id: string;
    salesOrderId: string;
    unitPrice: Prisma.Decimal;
    orderedQuantity: Prisma.Decimal;
    priceSnapshot: Prisma.JsonValue | null;
  }>,
) {
  for (const line of lines) {
    const snapshot = line.priceSnapshot as { exception_id?: string; unit_price?: string } | null;
    if (!snapshot?.unit_price) throw new ConflictException("PRICE_SNAPSHOT_REQUIRED");
    if (line.unitPrice.eq(snapshot.unit_price)) continue;
    const grants = await validException(tx, companyId, line.salesOrderId, "SPECIAL_PRICE", line.id);
    if (!grants.some((g) => g.amountLimit.gte(line.unitPrice.mul(line.orderedQuantity))))
      throw new ConflictException("PRICE_EXCEPTION_APPROVAL_REQUIRED");
  }
}

export function lineAmounts(line: PricedLine, quantity: Prisma.Decimal) {
  const tax = line.taxSnapshot as TaxSnapshot | null;
  if (!tax?.rule_id) throw new ConflictException("TAX_SNAPSHOT_REQUIRED");
  const rounding = {
    HALF_UP: Prisma.Decimal.ROUND_HALF_UP,
    HALF_EVEN: Prisma.Decimal.ROUND_HALF_EVEN,
    DOWN: Prisma.Decimal.ROUND_DOWN,
  }[tax.rounding];
  if (rounding === undefined) throw new ConflictException("TAX_ROUNDING_REQUIRED");
  const net = quantity.mul(line.unitPrice).toDecimalPlaces(tax.decimal_places, rounding);
  const dpp = net.mul(tax.dpp_factor).toDecimalPlaces(tax.decimal_places, rounding);
  const vat = dpp.mul(tax.rate).toDecimalPlaces(tax.decimal_places, rounding);
  return { net, dpp, tax: vat, total: net.add(vat) };
}

export async function priceOrder(
  tx: Prisma.TransactionClient,
  companyId: string,
  customerId: string,
  currency: string,
  lines: Array<{
    id: string;
    productId: string;
    unitPrice: Prisma.Decimal;
    salesOrderId: string;
    orderedQuantity: Prisma.Decimal;
  }>,
) {
  const now = new Date();
  for (const line of lines) {
    const product = await tx.product.findFirst({
      where: { id: line.productId, companyId, state: "ACTIVE" },
    });
    if (!product) throw new ConflictException("PRODUCT_NOT_ACTIVE");
    const prices = await tx.productReferencePrice.findMany({
      where: {
        companyId,
        productId: product.id,
        uomId: product.baseUomId,
        kind: "SALE",
        currency,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
    });
    if (prices.length !== 1)
      throw new ConflictException(
        prices.length ? "PRICE_POLICY_CONFLICT" : "PRICE_POLICY_REQUIRED",
      );
    const priceGrants = !line.unitPrice.eq(prices[0]!.unitPrice)
      ? await validException(tx, companyId, line.salesOrderId, "SPECIAL_PRICE", line.id)
      : [];
    if (
      !line.unitPrice.eq(prices[0]!.unitPrice) &&
      !priceGrants.some((g) => g.amountLimit.gte(line.unitPrice.mul(line.orderedQuantity)))
    )
      throw new ConflictException("PRICE_EXCEPTION_APPROVAL_REQUIRED");
    const taxes = await tx.salesTaxRule.findMany({
      where: {
        state: "ACTIVE",
        companyId,
        customerId,
        productId: product.id,
        effectiveFrom: { lte: now },
        effectiveTo: { gt: now },
      },
    });
    if (taxes.length !== 1)
      throw new ConflictException(taxes.length ? "TAX_POLICY_CONFLICT" : "TAX_POLICY_REQUIRED");
    const rule = taxes[0]!;
    await tx.salesOrderLine.update({
      where: { id: line.id },
      data: {
        uomId: product.baseUomId,
        priceSnapshot: {
          price_id: prices[0]!.id,
          uom_id: product.baseUomId,
          currency,
          unit_price: prices[0]!.unitPrice.toString(),
          applied_unit_price: line.unitPrice.toString(),
          exception_id:
            priceGrants.find((g) => g.amountLimit.gte(line.unitPrice.mul(line.orderedQuantity)))
              ?.id ?? null,
          effective_from: prices[0]!.effectiveFrom.toISOString(),
        },
        taxSnapshot: {
          rule_id: rule.id,
          name: rule.name,
          legal_reference: rule.legalReference,
          rate: rule.rate.toString(),
          dpp_factor: rule.dppFactor.toString(),
          decimal_places: rule.decimalPlaces,
          rounding: rule.rounding,
          taxable_event: rule.taxableEvent,
        },
      },
    });
  }
}
