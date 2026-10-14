import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "../common/transaction-command";
import { requireEvidence } from "../sales/document-controls";
import { lockCustomer } from "../sales/transaction-controls";
import { requestPolicy } from "./remediation";
import { lockFinance, postLedger } from "./posting";
import { AuditService } from "../common/audit.service";
import type { TaxSnapshot } from "../sales/pricing-controls";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const inputSchema = z
  .object({
    receipt_id: z.string().uuid(),
    bank_account_id: z.string().uuid(),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,8})?$/)
      .refine((v) => new Prisma.Decimal(v).gt(0)),
    evidence_id: z.string().uuid(),
    tax_evidence_id: z.string().uuid().optional(),
    bank_reference: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export async function requestAdvanceRefund(c: string, a: string, body: unknown, key: string) {
  const input = inputSchema.parse(body);
  return transactionCommand(c, a, "finance/advance-refund-requests", key, input, async (tx) => {
    const receipt = await tx.customerReceipt.findFirst({
      where: { companyId: c, id: input.receipt_id, state: "POSTED" },
      include: { fulfillmentBatch: true },
    });
    if (!receipt) throw new NotFoundException();
    await lockCustomer(tx, c, receipt.customerId);
    await lockFinance(tx, c);
    if (
      receipt.fulfillmentBatch &&
      !["CANCELLED", "DELIVERED"].includes(receipt.fulfillmentBatch.state)
    )
      throw new ConflictException("ADVANCE_STILL_COMMITTED");
    if (new Prisma.Decimal(input.amount).gt(receipt.unallocatedAmount))
      throw new ConflictException("ADVANCE_REFUND_EXCEEDED");
    await requireEvidence(tx, c, input.evidence_id, "PAYMENT");
    const tax = await tx.advanceTax.findFirst({ where: { companyId: c, receiptId: receipt.id } });
    if (tax && tax.amount.sub(tax.appliedAmount).sub(tax.reversedAmount).gt(0)) {
      await requireEvidence(tx, c, input.tax_evidence_id, "TAX");
      if (
        !(await tx.officialTaxDocument.count({
          where: { companyId: c, sourceType: "ADVANCE_TAX", sourceId: tax.id, state: "VERIFIED" },
        }))
      )
        throw new ConflictException("VERIFIED_ADVANCE_TAX_DOCUMENT_REQUIRED");
    }
    if (
      !(await tx.financeBankAccount.findFirst({
        where: {
          companyId: c,
          id: input.bank_account_id,
          active: true,
          currency: receipt.currency,
        },
      }))
    )
      throw new ConflictException("BANK_ACCOUNT_REQUIRED");
    const policy = await requestPolicy(
      tx,
      c,
      a,
      "ADVANCE_REFUND",
      receipt.currency,
      new Prisma.Decimal(input.amount),
    );
    const row = await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "ADVANCE_REFUND",
        sourceId: receipt.id,
        kind: "REQUEST",
        snapshot: json({ input, policy }),
      },
    });
    await new AuditService().recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "advance_refund.requested",
      resourceType: "customer_receipt",
      resourceId: receipt.id,
      after: row,
    });
    return row;
  });
}
export async function postAdvanceRefund(c: string, a: string, id: string, key: string) {
  return transactionCommand(
    c,
    a,
    `finance/advance-refund-requests/${id}/post`,
    key,
    { id },
    async (tx) => {
      const request = await tx.o2cControlEvent.findFirst({
        where: { companyId: c, id, sourceType: "ADVANCE_REFUND", kind: "REQUEST" },
      });
      if (!request) throw new NotFoundException();
      const input = inputSchema.parse((request.snapshot as { input: unknown }).input);
      const ref = await tx.customerReceipt.findFirstOrThrow({
        where: { companyId: c, id: input.receipt_id },
      });
      await lockCustomer(tx, c, ref.customerId);
      await lockFinance(tx, c);
      const receipt = await tx.customerReceipt.findUniqueOrThrow({
        where: { id: ref.id },
        include: { fulfillmentBatch: true },
      });
      if (
        !(await tx.o2cControlEvent.count({
          where: { companyId: c, sourceId: id, kind: "APPROVED" },
        }))
      )
        throw new ConflictException("APPROVAL_REQUIRED");
      if (await tx.o2cControlEvent.count({ where: { companyId: c, sourceId: id, kind: "POSTED" } }))
        throw new ConflictException("REQUEST_ALREADY_POSTED");
      const amount = new Prisma.Decimal(input.amount);
      if (
        receipt.state !== "POSTED" ||
        amount.gt(receipt.unallocatedAmount) ||
        (receipt.fulfillmentBatch &&
          !["CANCELLED", "DELIVERED"].includes(receipt.fulfillmentBatch.state))
      )
        throw new ConflictException("ADVANCE_REFUND_SOURCE_CHANGED");
      if (
        receipt.fulfillmentBatchId &&
        (await tx.deliveryReceipt.count({
          where: {
            fulfillmentBatchId: receipt.fulfillmentBatchId,
            acceptedQuantity: { gt: 0 },
            invoices: { none: { state: "POSTED" } },
          },
        }))
      )
        throw new ConflictException("INVOICE_PENDING_ADVANCE_SETTLEMENT");
      const tax = await tx.advanceTax.findFirst({
        where: { companyId: c, receiptId: receipt.id },
        include: { lines: true },
      });
      let taxAmount = new Prisma.Decimal(0);
      if (tax) {
        if (tax.amount.sub(tax.appliedAmount).sub(tax.reversedAmount).gt(0) && !tax.lines.length)
          throw new ConflictException("LEGACY_ADVANCE_TAX_RECONCILIATION_REQUIRED");
        for (const l of tax.lines) {
          const outstanding = l.amount.sub(l.appliedAmount).sub(l.reversedAmount);
          const allocation = await tx.fulfillmentAllocation.findFirstOrThrow({
            where: { id: l.allocationId, fulfillmentBatch: { companyId: c } },
            include: { salesOrderLine: true },
          });
          const snapshot = allocation.salesOrderLine.taxSnapshot as TaxSnapshot;
          const rounding = {
            HALF_UP: Prisma.Decimal.ROUND_HALF_UP,
            HALF_EVEN: Prisma.Decimal.ROUND_HALF_EVEN,
            DOWN: Prisma.Decimal.ROUND_DOWN,
          }[snapshot.rounding];
          const returned = amount.eq(receipt.unallocatedAmount)
            ? outstanding
            : Prisma.Decimal.min(
                outstanding,
                outstanding
                  .mul(amount)
                  .div(receipt.unallocatedAmount)
                  .toDecimalPlaces(snapshot.decimal_places, rounding),
              );
          if (returned.lte(0)) continue;
          await requireEvidence(tx, c, input.tax_evidence_id, "TAX");
          await tx.advanceTaxLine.update({
            where: { id: l.id },
            data: { reversedAmount: { increment: returned } },
          });
          taxAmount = taxAmount.add(returned);
        }
        if (taxAmount.gt(0))
          await tx.advanceTax.update({
            where: { id: tax.id },
            data: { reversedAmount: { increment: taxAmount } },
          });
      }
      if (taxAmount.gt(amount)) throw new ConflictException("ADVANCE_TAX_REFUND_EXCEEDS_CASH");
      if (
        taxAmount.gt(0) &&
        !(await tx.officialTaxDocument.count({
          where: { companyId: c, sourceType: "ADVANCE_TAX", sourceId: tax!.id, state: "VERIFIED" },
        }))
      )
        throw new ConflictException("VERIFIED_ADVANCE_TAX_DOCUMENT_REQUIRED");
      const bank = await tx.financeBankAccount.findFirst({
        where: {
          companyId: c,
          id: input.bank_account_id,
          active: true,
          currency: receipt.currency,
        },
      });
      if (!bank) throw new ConflictException("BANK_ACCOUNT_REQUIRED");
      await tx.customerReceipt.update({
        where: { id: receipt.id },
        data: { unallocatedAmount: { decrement: amount }, refundedAmount: { increment: amount } },
      });
      const profiles = await tx.financePostingProfile.findMany({
        where: {
          companyId: c,
          effectiveFrom: { lte: new Date() },
          effectiveTo: { gt: new Date() },
        },
      });
      if (profiles.length !== 1)
        throw new ConflictException("POSTING_PROFILE_REQUIRED_OR_CONFLICTING");
      const mapping = profiles[0]!.mappings as Record<string, string>;
      if (!mapping.CUSTOMER_ADVANCE || !mapping.SALES_TAX)
        throw new ConflictException("POSTING_MAPPING_REQUIRED");
      const source = {
        companyId: c,
        sourceType: "ADVANCE_REFUND",
        sourceId: id,
        currency: receipt.currency,
      };
      await postLedger(tx, a, {
        accountIds: [mapping.CUSTOMER_ADVANCE, mapping.SALES_TAX, bank.accountId],
        data: [
          { ...source, kind: "CUSTOMER_ADVANCE", debit: amount.sub(taxAmount), credit: "0" },
          { ...source, kind: "SALES_TAX", debit: taxAmount, credit: "0" },
          { ...source, kind: "CASH_REFUND", debit: "0", credit: amount },
        ],
      });
      const event = await tx.o2cControlEvent.create({
        data: {
          companyId: c,
          actorId: a,
          sourceType: "ADVANCE_REFUND",
          sourceId: id,
          kind: "POSTED",
          snapshot: json({ receipt_id: receipt.id, amount, taxAmount }),
        },
      });
      await new AuditService().recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "advance_refund.posted",
        resourceType: "customer_receipt",
        resourceId: receipt.id,
        after: event,
      });
      return event;
    },
  );
}
