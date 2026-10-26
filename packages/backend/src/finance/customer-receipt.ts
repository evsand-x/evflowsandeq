import { Prisma } from "@evflow/database";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { AuditService } from "../common/audit.service";
import { lockCustomer } from "../sales/transaction-controls";
import { requireEvidence } from "../sales/document-controls";
import { postLedger } from "./posting";
import { postAdvanceTax } from "./advance-tax";
const d = (v: string | Prisma.Decimal) => new Prisma.Decimal(v);
/** Shared posting core. Caller owns transaction and command replay. */
export async function postCustomerReceiptTx(
  tx: Prisma.TransactionClient,
  c: string,
  a: string,
  input: {
    customerId: string;
    salesOrderId?: string;
    fulfillmentBatchId?: string;
    amount: string | Prisma.Decimal;
    receivedAt: Date;
    bankAccountId: string;
    bankReference?: string;
    evidenceId: string;
    idempotencyKey: string;
    currency?: string;
    externalReference?: string;
  },
) {
  const customerId = input.customerId,
    key = input.idempotencyKey;
  const i = {
    amount: input.amount,
    received_at: input.receivedAt,
    currency: input.currency ?? "IDR",
    sales_order_id: input.salesOrderId,
    fulfillment_batch_id: input.fulfillmentBatchId,
    bank_account_id: input.bankAccountId,
    bank_reference: input.bankReference,
    evidence_id: input.evidenceId,
    external_reference: input.externalReference,
  };
  if (d(i.amount).lte(0)) throw new ConflictException("RECEIPT_AMOUNT_INVALID");
  if (input.salesOrderId) {
    const order = await tx.salesOrder.findFirst({
      where: { id: input.salesOrderId, companyId: c, customerId },
    });
    if (!order || order.currency !== i.currency)
      throw new ConflictException("RECEIPT_ORDER_MISMATCH");
  }
  await lockCustomer(tx, c, customerId);
  await requireEvidence(tx, c, i.evidence_id, "PAYMENT");

  const existing = await tx.customerReceipt.findUnique({
    where: { companyId_idempotencyKey: { companyId: c, idempotencyKey: key } },
    include: { allocations: true },
  });
  if (existing) return existing;
  const customer = await tx.customer.findFirst({
    where: { id: customerId, companyId: c, state: "ACTIVE" },
  });
  if (!customer) throw new NotFoundException("Pelanggan tidak ditemukan.");
  if (i.fulfillment_batch_id) {
    const batch = await tx.fulfillmentBatch.findFirst({
      where: { id: i.fulfillment_batch_id ?? null, companyId: c, salesOrder: { customerId } },
      include: { salesOrder: true },
    });
    if (!batch) throw new ConflictException("FULFILLMENT_CUSTOMER_MISMATCH");
    if (batch.salesOrder.currency !== i.currency)
      throw new ConflictException("FULFILLMENT_CURRENCY_MISMATCH");
    if (["CANCELLED", "CLOSED"].includes(batch.salesOrder.state) || batch.state === "CANCELLED")
      throw new ConflictException("FULFILLMENT_NOT_OPEN");
  }
  const receipt = await tx.customerReceipt.create({
    data: {
      companyId: c,
      customerId,
      salesOrderId: i.sales_order_id ?? null,
      fulfillmentBatchId: i.fulfillment_batch_id ?? null,
      externalReference: i.external_reference ?? null,
      bankReference: i.bank_reference ?? null,
      bankAccountId: i.bank_account_id,
      evidenceId: i.evidence_id,
      receivedAt: i.received_at ? new Date(i.received_at) : new Date(),
      amount: d(i.amount),
      unallocatedAmount: d(i.amount),
      currency: i.currency,
      idempotencyKey: key,
      createdById: a,
    },
  });
  await postLedger(tx, a, {
    data: [
      {
        companyId: c,
        kind: "CASH_RECEIPT",
        sourceType: "CUSTOMER_RECEIPT",
        sourceId: receipt.id,
        currency: receipt.currency,
        debit: receipt.amount,
        credit: d("0"),
      },
      {
        companyId: c,
        kind: "CUSTOMER_ADVANCE",
        sourceType: "CUSTOMER_RECEIPT",
        sourceId: receipt.id,
        currency: receipt.currency,
        debit: d("0"),
        credit: receipt.amount,
      },
    ],
  });
  await new AuditService().recordWith(tx, {
    companyId: c,
    actorId: a,
    action: "customer_receipt.posted",
    resourceType: "customer_receipt",
    resourceId: receipt.id,
    after: receipt,
  });
  await postAdvanceTax(tx, c, a, receipt.id);
  return receipt;
}
