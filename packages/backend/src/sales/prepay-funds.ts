import { ConflictException } from "@nestjs/common";
import { Prisma } from "@evflow/database";

type Tx = Prisma.TransactionClient;
type BatchRef = { id: string; salesOrderId: string; currency: string };
const zero = () => new Prisma.Decimal(0);

function receiptWhere(companyId: string, batch: BatchRef) {
  return {
    companyId,
    state: "POSTED" as const,
    currency: batch.currency,
    OR: [
      { fulfillmentBatchId: batch.id },
      { salesOrderId: batch.salesOrderId, fulfillmentBatchId: null },
    ],
  };
}

/** Verified posted funds available for one PREPAY batch, without double-counting SO-level receipts. */
export async function availablePrepayFunds(tx: Tx, companyId: string, batch: BatchRef) {
  const result = await tx.customerReceipt.aggregate({
    where: receiptWhere(companyId, batch),
    _sum: { unallocatedAmount: true },
  });
  return result._sum.unallocatedAmount ?? zero();
}

/** Binds SO-level verified receipts to one batch after the PREPAY requirement passes. */
export async function bindOrderAdvancesToBatch(
  tx: Tx,
  companyId: string,
  batch: BatchRef,
  required: Prisma.Decimal,
) {
  if (required.lte(0)) return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${companyId}:prepay:${batch.salesOrderId}`}, 0))::text`;
  const available = await availablePrepayFunds(tx, companyId, batch);
  if (available.lt(required)) throw new ConflictException("PREPAYMENT_REQUIRED");
  const alreadyBound = await tx.customerReceipt.aggregate({
    where: { companyId, fulfillmentBatchId: batch.id, state: "POSTED", currency: batch.currency },
    _sum: { unallocatedAmount: true },
  });
  let remaining = required.sub(alreadyBound._sum.unallocatedAmount ?? zero());
  if (remaining.lte(0)) return;
  const candidates = await tx.customerReceipt.findMany({
    where: {
      companyId,
      salesOrderId: batch.salesOrderId,
      fulfillmentBatchId: null,
      state: "POSTED",
      currency: batch.currency,
      unallocatedAmount: { gt: 0 },
    },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
  });
  for (const receipt of candidates) {
    if (remaining.lte(0)) break;
    await tx.$queryRaw`SELECT id FROM customer_receipts WHERE id=${receipt.id}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;
    await tx.customerReceipt.update({
      where: { id: receipt.id },
      data: { fulfillmentBatchId: batch.id },
    });
    remaining = remaining.sub(receipt.unallocatedAmount);
  }
  if (remaining.gt(0)) throw new ConflictException("PREPAYMENT_REQUIRED");
}
