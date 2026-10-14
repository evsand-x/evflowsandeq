import { ConflictException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { lineAmounts, type TaxSnapshot } from "../sales/pricing-controls";
import { postLedger } from "./posting";
type Tx = Prisma.TransactionClient;
const zero = () => new Prisma.Decimal(0);

/** Settle delivered goods first; only funds for undelivered goods are advances. */
export async function postAdvanceTax(tx: Tx, c: string, actor: string, receiptId: string) {
  const receipt = await tx.customerReceipt.findUniqueOrThrow({ where: { id: receiptId } });
  if (!receipt.fulfillmentBatchId) return;
  const batch = await tx.fulfillmentBatch.findFirstOrThrow({
    where: { id: receipt.fulfillmentBatchId, companyId: c },
    include: { salesOrder: true, allocations: { include: { salesOrderLine: true } } },
  });
  if (receipt.currency !== batch.salesOrder.currency)
    throw new ConflictException("FULFILLMENT_CURRENCY_MISMATCH");
  const prior = await tx.advanceTax.findMany({
    where: { companyId: c, batchId: batch.id },
    include: { lines: true },
  });
  if (prior.some((p) => p.amount.gt(0) && !p.lines.length))
    throw new ConflictException("LEGACY_ADVANCE_TAX_RECONCILIATION_REQUIRED");
  const cashTotals = await tx.customerReceipt.aggregate({
    where: {
      companyId: c,
      fulfillmentBatchId: batch.id,
      state: "POSTED",
      currency: receipt.currency,
    },
    _sum: { amount: true, refundedAmount: true },
  });
  const cash = (cashTotals._sum.amount ?? zero()).sub(cashTotals._sum.refundedAmount ?? zero());
  const delivered = batch.allocations.reduce(
    (s, l) => s.add(lineAmounts(l.salesOrderLine, l.acceptedQuantity).total),
    zero(),
  );
  const remaining = batch.allocations.map((l) => ({
    allocation: l,
    amounts: lineAmounts(
      l.salesOrderLine,
      l.quantity.sub(l.acceptedQuantity).sub(l.returnedQuantity),
    ),
  }));
  const gross = remaining.reduce((s, l) => s.add(l.amounts.total), zero());
  if (gross.lte(0)) return;
  const fraction = Prisma.Decimal.min(Prisma.Decimal.max(cash.sub(delivered), zero()), gross).div(
    gross,
  );
  const entries = [];
  for (const l of remaining) {
    const snapshot = l.allocation.salesOrderLine.taxSnapshot as TaxSnapshot;
    if (snapshot.taxable_event !== "ADVANCE") continue;
    const rounding = {
      HALF_UP: Prisma.Decimal.ROUND_HALF_UP,
      HALF_EVEN: Prisma.Decimal.ROUND_HALF_EVEN,
      DOWN: Prisma.Decimal.ROUND_DOWN,
    }[snapshot.rounding];
    const outstanding = prior
      .flatMap((p) => p.lines)
      .filter((p) => p.allocationId === l.allocation.id)
      .reduce((s, p) => s.add(p.amount).sub(p.appliedAmount).sub(p.reversedAmount), zero());
    const target = l.amounts.tax.mul(fraction).toDecimalPlaces(snapshot.decimal_places, rounding);
    const additional = Prisma.Decimal.max(target.sub(outstanding), zero());
    if (additional.gt(0)) entries.push({ allocationId: l.allocation.id, amount: additional });
  }
  const tax = entries.reduce((s, l) => s.add(l.amount), zero());
  if (tax.lte(0)) return;
  const row = await tx.advanceTax.create({
    data: {
      companyId: c,
      receiptId,
      batchId: batch.id,
      amount: tax,
      snapshot: JSON.parse(
        JSON.stringify({
          cash,
          delivered,
          gross,
          fraction,
          entries,
          taxable_at: receipt.receivedAt,
        }),
      ),
      lines: { create: entries },
    },
  });
  const source = {
    companyId: c,
    sourceType: "ADVANCE_TAX",
    sourceId: row.id,
    currency: receipt.currency,
  };
  await postLedger(tx, actor, {
    data: [
      { ...source, kind: "CUSTOMER_ADVANCE", debit: tax, credit: "0" },
      { ...source, kind: "SALES_TAX", debit: "0", credit: tax },
    ],
  });
}

/** Consume only tax carrying the same fulfillment allocation lineage. */
export async function consumeAdvanceTax(
  tx: Tx,
  c: string,
  batchId: string,
  lines: { allocationId: string; tax: Prisma.Decimal }[],
) {
  const advances = await tx.advanceTax.findMany({
    where: { companyId: c, batchId },
    include: { lines: true },
    orderBy: { id: "asc" },
  });
  if (
    advances.some(
      (p) => p.amount.sub(p.appliedAmount).sub(p.reversedAmount).gt(0) && !p.lines.length,
    )
  )
    throw new ConflictException("LEGACY_ADVANCE_TAX_RECONCILIATION_REQUIRED");
  let total = zero();
  for (const source of lines) {
    let remaining = source.tax;
    for (const advance of advances) {
      const line = advance.lines.find((l) => l.allocationId === source.allocationId);
      if (!line) continue;
      const used = Prisma.Decimal.min(
        remaining,
        line.amount.sub(line.appliedAmount).sub(line.reversedAmount),
      );
      if (used.lte(0)) continue;
      await tx.advanceTaxLine.update({
        where: { id: line.id },
        data: { appliedAmount: { increment: used } },
      });
      await tx.advanceTax.update({
        where: { id: advance.id },
        data: { appliedAmount: { increment: used } },
      });
      line.appliedAmount = line.appliedAmount.add(used);
      remaining = remaining.sub(used);
      total = total.add(used);
    }
  }
  return total;
}
