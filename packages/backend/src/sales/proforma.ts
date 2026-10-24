import { createHash } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import { z } from "zod";
import { issueProformaSchema, previewProformaSchema } from "@evflow/contracts";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";
import { issueDocument } from "./document-controls";
import { lineAmounts, assertPriceGrants } from "./pricing-controls";
import { defaultSalesTaxOn } from "../finance/operational-tax";
import { lockCustomer, assertDispatchLots } from "./transaction-controls";

type Tx = Prisma.TransactionClient;
export const proformaKinds = { startsWith: "PROFORMA" } as const;

async function source(tx: Tx, companyId: string, batchId: string) {
  const batch = await tx.fulfillmentBatch.findFirst({
    where: { id: batchId, companyId },
    include: {
      salesOrder: { include: { customer: true, company: true } },
      allocations: {
        orderBy: { id: "asc" },
        include: { salesOrderLine: { include: { product: { include: { baseUom: true } } } } },
      },
    },
  });
  if (!batch) throw new NotFoundException("Tahap pemenuhan tidak ditemukan.");
  const order = batch.salesOrder;
  const allocations = batch.allocations
    .filter((a) => a.quantity.gt(0))
    .map((a) => ({
      allocation_id: a.id,
      source_order_line_id: a.salesOrderLineId,
      product: a.salesOrderLine.product.name,
      product_code: a.salesOrderLine.product.code,
      unit: a.salesOrderLine.product.baseUom.name,
      quantity: a.quantity.toString(),
      unit_price: a.salesOrderLine.unitPrice.toString(),
      tax_snapshot: a.salesOrderLine.taxSnapshot,
      amounts: lineAmounts(a.salesOrderLine, a.quantity),
    }));
  const sum = (field: "net" | "tax" | "total") =>
    allocations.reduce((total, a) => total.add(a.amounts[field]), new Prisma.Decimal(0)).toString();
  const subtotal = new Prisma.Decimal(sum("net"));
  const tax = new Prisma.Decimal(sum("tax")).add(batch.freightTaxAmount);
  const snapshot = {
    order_number: order.number,
    customer: order.customer.name,
    company: order.company.name,
    address: order.deliveryAddress,
    reference: order.customerReference,
    currency: order.currency,
    payment: order.paymentSnapshot,
    batch_number: batch.number,
    allocations,
    subtotal: subtotal.toString(),
    tax: tax.toString(),
    freight: {
      amount: batch.freightAmount.toString(),
      tax: batch.freightTaxAmount.toString(),
      tax_snapshot: batch.freightTaxSnapshot,
    },
    total: subtotal.add(batch.freightAmount).add(tax).toString(),
  };
  // Changes to display names/company profile do not invalidate an issued historical snapshot.
  const version = createHash("sha256")
    .update(
      JSON.stringify({
        batch_id: batch.id,
        order_id: order.id,
        currency: order.currency,
        address: order.deliveryAddress,
        reference: order.customerReference,
        payment: order.paymentSnapshot,
        allocations: allocations.map((a) => ({
          id: a.allocation_id,
          line_id: a.source_order_line_id,
          quantity: a.quantity,
          unit_price: a.unit_price,
          tax: a.tax_snapshot,
        })),
        freight_amount: batch.freightAmount.toString(),
        freight_tax_amount: batch.freightTaxAmount.toString(),
        freight_tax_snapshot: batch.freightTaxSnapshot,
      }),
    )
    .digest("hex");
  return { batch, snapshot, version };
}

// Legacy originals are kept and reused if their printed content still matches the allocation.
function matches(saved: Prisma.JsonValue, current: Awaited<ReturnType<typeof source>>) {
  const value = saved as Record<string, unknown> | null;
  if (typeof value?.source_version === "string") return value.source_version === current.version;
  const compact = (v: Record<string, unknown>) =>
    JSON.stringify({
      order: v.order_number,
      customer: v.customer,
      address: v.address,
      reference: v.reference,
      currency: v.currency,
      lines: Array.isArray(v.allocations)
        ? v.allocations
            .map((a) => {
              const l = a as {
                product: string;
                quantity: unknown;
                unit_price: unknown;
                amounts: { net: unknown; tax: unknown; total: unknown };
              };
              return [
                l.product,
                String(l.quantity),
                String(l.unit_price),
                String(l.amounts?.net),
                String(l.amounts?.tax),
                String(l.amounts?.total),
              ].join("|");
            })
            .sort()
        : null,
    });
  return !!value && compact(value) === compact(current.snapshot);
}

async function latest(tx: Tx, companyId: string, batchId: string) {
  return tx.fulfillmentDocument.findFirst({
    where: { companyId, batchId, kind: proformaKinds },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
  });
}

export async function freightValues(
  tx: Tx,
  companyId: string,
  input: { amount: string; tax_mode: "NON_TAXABLE" | "TAXABLE" },
) {
  const amount = new Prisma.Decimal(input.amount);
  if (input.tax_mode === "NON_TAXABLE")
    return { amount, tax: new Prisma.Decimal(0), snapshot: null };
  // Taxable freight uses the default sales tax; per-customer rules are no longer read.
  const { tax, snapshot } = await defaultSalesTaxOn(tx, companyId, amount);
  return { amount, tax, snapshot };
}

async function lockedSource(tx: Tx, c: string, id: string) {
  const reference = await tx.fulfillmentBatch.findFirst({
    where: { companyId: c, id },
    include: { salesOrder: true },
  });
  if (!reference) throw new NotFoundException("Tahap pemenuhan tidak ditemukan.");
  await lockCustomer(tx, c, reference.salesOrder.customerId);
  await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
  const current = await source(tx, c, id);
  if (current.batch.salesOrder.state !== "OPEN" || current.batch.state !== "ALLOCATED")
    throw new ConflictException(
      "Proforma hanya dapat diterbitkan untuk SO Open dan tahap yang masih dialokasikan.",
    );
  if (!current.snapshot.allocations.length)
    throw new ConflictException("Proforma memerlukan alokasi dengan jumlah positif.");
  if (current.batch.reservationExpiresAt && current.batch.reservationExpiresAt <= new Date()) {
    const funds = await tx.customerReceipt.aggregate({
      where: {
        companyId: c,
        fulfillmentBatchId: id,
        state: "POSTED",
        currency: current.snapshot.currency,
      },
      _sum: { unallocatedAmount: true },
    });
    if ((funds._sum.unallocatedAmount ?? new Prisma.Decimal(0)).lt(current.snapshot.total))
      throw new ConflictException("Reservasi kedaluwarsa. Evaluasi kembali tahap pemenuhan.");
  }
  await assertPriceGrants(
    tx,
    c,
    current.batch.allocations.filter((a) => a.quantity.gt(0)).map((a) => a.salesOrderLine),
  );
  await assertDispatchLots(
    tx,
    c,
    current.batch.allocations.filter((a) => a.quantity.gt(0)).map((a) => a.stockLotId),
  );
  return current;
}

export function previewProforma(c: string, id: string, body: unknown = {}) {
  const input = previewProformaSchema.parse(body);
  return prisma.$transaction(async (tx) => {
    const current = await lockedSource(tx, c, id);
    const document = await latest(tx, c, id);
    let snapshot = current.snapshot;
    if (input.freight) {
      const values = await freightValues(tx, c, input.freight);
      const tax = new Prisma.Decimal(snapshot.tax).sub(snapshot.freight.tax).add(values.tax);
      snapshot = {
        ...snapshot,
        freight: {
          amount: values.amount.toString(),
          tax: values.tax.toString(),
          tax_snapshot: values.snapshot,
        },
        tax: tax.toString(),
        total: new Prisma.Decimal(snapshot.subtotal).add(values.amount).add(tax).toString(),
      };
    }
    return {
      version: current.version,
      snapshot,
      existing:
        !input.freight && document && matches(document.snapshot, current)
          ? { id: document.id, number: document.number }
          : null,
      supersedes: document ? { id: document.id, number: document.number } : null,
    };
  });
}

export function issueProforma(c: string, a: string, id: string, body: unknown, key: string) {
  z.string().uuid().parse(id);
  const input = issueProformaSchema.parse(body);
  return transactionCommand(
    c,
    a,
    `fulfillment-batches/${id}/issue-proforma`,
    key,
    input,
    async (tx) => {
      const current = await lockedSource(tx, c, id);
      if (current.version !== input.version)
        throw new ConflictException(
          "Alokasi atau nilai berubah. Muat ulang pratinjau sebelum menerbitkan.",
        );
      if (input.freight) {
        const values = await freightValues(tx, c, input.freight);
        await tx.fulfillmentBatch.update({
          where: { id },
          data: {
            freightAmount: values.amount,
            freightTaxAmount: values.tax,
            freightTaxSnapshot: values.snapshot ?? Prisma.DbNull,
            freightVersion: { increment: 1 },
          },
        });
      }
      const effective = input.freight ? await lockedSource(tx, c, id) : current;
      const old = await latest(tx, c, id);
      if (old && matches(old.snapshot, effective)) return old;
      const document = await issueDocument(
        tx,
        c,
        a,
        id,
        old
          ? `PROFORMA_REVISION:${createHash("sha256")
              .update(old.id + effective.version)
              .digest("hex")}`
          : "PROFORMA",
        {
          ...effective.snapshot,
          source_version: effective.version,
          supersedes_id: old?.id ?? null,
        },
      );
      await new AuditService().recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "proforma.issued",
        resourceType: "proforma",
        resourceId: document.id,
        after: {
          batchId: id,
          number: document.number,
          sourceVersion: effective.version,
          supersedesId: old?.id ?? null,
        },
      });
      return document;
    },
  );
}

export async function proformaStatus(
  c: string,
  document: { id: string; batchId: string; snapshot: Prisma.JsonValue },
) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.fulfillmentBatch.findFirst({
      where: { companyId: c, id: document.batchId },
      include: { salesOrder: true },
    });
    if (!batch) throw new NotFoundException("Tahap pemenuhan tidak ditemukan.");
    if (batch.state === "CANCELLED" || batch.salesOrder.state === "CANCELLED") return "VOID";
    const last = await latest(tx, c, document.batchId);
    if (last?.id !== document.id) return "SUPERSEDED";
    try {
      const current = await source(tx, c, document.batchId);
      return matches(document.snapshot, current) ? "ISSUED" : "REVISION_REQUIRED";
    } catch (error) {
      if (error instanceof ConflictException) return "REVISION_REQUIRED";
      throw error;
    }
  });
}
