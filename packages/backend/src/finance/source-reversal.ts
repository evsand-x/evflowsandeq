import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "../common/transaction-command";
import { requireEvidence } from "../sales/document-controls";
import { lockCustomer } from "../sales/transaction-controls";
import { AuditService } from "../common/audit.service";
import { lockFinance, postLedger } from "./posting";
import { requestPolicy } from "./remediation";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const supported = [
  "CUSTOMER_RECEIPT",
  "CUSTOMER_RECEIPT_ALLOCATION",
  "CUSTOMER_REFUND",
  "SALES_INVOICE",
  "BANK_TRANSACTION",
];

export async function requestReversal(c: string, a: string, body: unknown, key: string) {
  const input = z
    .object({
      journal_id: z.string().uuid(),
      occurred_at: z.string().datetime(),
      evidence_id: z.string().uuid(),
      reason: z.string().trim().min(1).max(1000),
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, "finance/reversal-requests", key, input, async (tx) => {
    await lockFinance(tx, c);
    await requireEvidence(tx, c, input.evidence_id, "PAYMENT");
    const journal = await tx.financeJournal.findFirst({
      where: { companyId: c, id: input.journal_id },
      include: { lines: true },
    });
    if (!journal) throw new NotFoundException();
    if (!supported.includes(journal.sourceType))
      throw new ConflictException("USE_SOURCE_DOMAIN_CORRECTION");
    const value = journal.lines.reduce((s, l) => s.add(l.debit), new Prisma.Decimal(0));
    const policy = await requestPolicy(tx, c, a, "SOURCE_REVERSAL", journal.currency, value);
    return tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "SOURCE_REVERSAL",
        sourceId: journal.id,
        kind: "REQUEST",
        snapshot: json({ input, policy, original: journal }),
      },
    });
  });
}

export async function postReversal(c: string, a: string, id: string, key: string) {
  return transactionCommand(
    c,
    a,
    `finance/reversal-requests/${id}/post`,
    key,
    { id },
    async (tx) => {
      const request = await tx.o2cControlEvent.findFirst({
        where: { companyId: c, id, sourceType: "SOURCE_REVERSAL", kind: "REQUEST" },
      });
      if (!request) throw new NotFoundException();
      const s = request.snapshot as { input: { occurred_at: string; reason: string } };
      const journal = await tx.financeJournal.findFirstOrThrow({
        where: { companyId: c, id: request.sourceId },
        include: { lines: true },
      });
      let customerId: string | undefined;
      if (journal.sourceType === "CUSTOMER_RECEIPT")
        customerId = (
          await tx.customerReceipt.findUniqueOrThrow({ where: { id: journal.sourceId } })
        ).customerId;
      if (journal.sourceType === "CUSTOMER_RECEIPT_ALLOCATION")
        customerId = (
          await tx.customerReceiptAllocation.findUniqueOrThrow({
            where: { id: journal.sourceId },
            include: { receipt: true },
          })
        ).receipt.customerId;
      if (journal.sourceType === "CUSTOMER_REFUND")
        customerId = (
          await tx.customerRefund.findUniqueOrThrow({
            where: { id: journal.sourceId },
            include: { creditNote: { include: { salesInvoice: true } } },
          })
        ).creditNote.salesInvoice.customerId;
      if (journal.sourceType === "SALES_INVOICE")
        customerId = (await tx.salesInvoice.findUniqueOrThrow({ where: { id: journal.sourceId } }))
          .customerId;
      if (customerId) await lockCustomer(tx, c, customerId);
      await lockFinance(tx, c);
      if (
        !(await tx.o2cControlEvent.count({
          where: { companyId: c, sourceId: id, kind: "APPROVED" },
        }))
      )
        throw new ConflictException("APPROVAL_REQUIRED");
      if (
        await tx.o2cControlEvent.count({
          where: { companyId: c, sourceType: "JOURNAL", sourceId: journal.id, kind: "REVERSED" },
        })
      )
        throw new ConflictException("SOURCE_ALREADY_REVERSED");
      if (
        await tx.bankStatementMatch.count({
          where: {
            companyId: c,
            journalLineId: { in: journal.lines.map((l) => l.id) },
            reversedAt: null,
          },
        })
      )
        throw new ConflictException("UNMATCH_BANK_BEFORE_REVERSAL");
      if (journal.sourceType === "CUSTOMER_RECEIPT") {
        const receipt = await tx.customerReceipt.findUniqueOrThrow({
          where: { id: journal.sourceId },
          include: { fulfillmentBatch: true },
        });
        if (receipt.state !== "POSTED" || !receipt.amount.eq(receipt.unallocatedAmount))
          throw new ConflictException("REVERSE_ALLOCATIONS_FIRST");
        if (
          receipt.fulfillmentBatch &&
          !["ALLOCATED", "CANCELLED"].includes(receipt.fulfillmentBatch.state)
        )
          throw new ConflictException("DISPATCHED_ADVANCE_REQUIRES_SETTLEMENT");
        if (await tx.advanceTax.count({ where: { receiptId: receipt.id, amount: { gt: 0 } } }))
          throw new ConflictException("ADVANCE_TAX_CORRECTION_REQUIRED");
        await tx.customerReceipt.update({ where: { id: receipt.id }, data: { state: "REVERSED" } });
      } else if (journal.sourceType === "CUSTOMER_RECEIPT_ALLOCATION") {
        const allocation = await tx.customerReceiptAllocation.findUniqueOrThrow({
          where: { id: journal.sourceId },
          include: { receipt: true, invoice: true },
        });
        if (allocation.receipt.state !== "POSTED" || allocation.invoice.state !== "POSTED")
          throw new ConflictException("ALLOCATION_SOURCE_NOT_POSTED");
        await tx.customerReceipt.update({
          where: { id: allocation.receiptId },
          data: { unallocatedAmount: { increment: allocation.amount } },
        });
        await tx.salesInvoice.update({
          where: { id: allocation.invoiceId },
          data: { outstandingAmount: { increment: allocation.amount } },
        });
      } else if (journal.sourceType === "CUSTOMER_REFUND") {
        await tx.customerRefund.update({
          where: { id: journal.sourceId },
          data: { state: "VOID" },
        });
      } else if (journal.sourceType === "SALES_INVOICE") {
        const invoice = await tx.salesInvoice.findUniqueOrThrow({
          where: { id: journal.sourceId },
        });
        if (
          invoice.state !== "POSTED" ||
          !invoice.outstandingAmount.eq(invoice.total ?? invoice.subtotal.add(invoice.taxAmount))
        )
          throw new ConflictException("REVERSE_INVOICE_SETTLEMENT_FIRST");
        if (
          (await tx.creditNote.count({ where: { salesInvoiceId: invoice.id, state: "POSTED" } })) ||
          (await tx.officialTaxDocument.count({
            where: {
              companyId: c,
              sourceType: "SALES_INVOICE",
              sourceId: invoice.id,
              state: { not: "REJECTED" },
            },
          }))
        )
          throw new ConflictException("INVOICE_CORRECTION_DEPENDENCIES_EXIST");
        await tx.salesInvoice.update({
          where: { id: invoice.id },
          data: { state: "VOID", outstandingAmount: 0 },
        });
      } else if (journal.sourceType === "BANK_TRANSACTION") {
        const bankRequest = await tx.o2cControlEvent.findFirstOrThrow({
          where: {
            companyId: c,
            id: journal.sourceId,
            sourceType: "BANK_TRANSACTION",
            kind: "REQUEST",
          },
        });
        const basis = bankRequest.snapshot as {
          input: { kind: string; payable_id?: string; amount: string };
        };
        if (basis.input.kind === "SUPPLIER_PAYMENT") {
          const payable = await tx.payableOpenItem.findFirstOrThrow({
            where: { companyId: c, id: basis.input.payable_id! },
          });
          await tx.payableOpenItem.update({
            where: { id: payable.id },
            data: {
              outstandingAmount: { increment: new Prisma.Decimal(basis.input.amount) },
              state: "OPEN",
            },
          });
        }
      } else throw new ConflictException("USE_SOURCE_DOMAIN_CORRECTION");
      const entries = await tx.ledgerEntry.findMany({
        where: { companyId: c, journalId: journal.id },
      });
      const reversal = await postLedger(tx, a, {
        businessDate: new Date(s.input.occurred_at),
        accountIds: journal.lines.map((l) => l.accountId),
        data: journal.lines.map((l) => {
          const kind = entries.find((e) => e.kind === l.ledgerKind)?.kind;
          if (!kind) throw new ConflictException("REVERSAL_LEDGER_KIND_MISSING");
          return {
            companyId: c,
            sourceType: "SOURCE_REVERSAL",
            sourceId: id,
            currency: journal.currency,
            kind,
            debit: l.credit,
            credit: l.debit,
          };
        }),
      });
      const event = await tx.o2cControlEvent.create({
        data: {
          companyId: c,
          actorId: a,
          sourceType: "JOURNAL",
          sourceId: journal.id,
          kind: "REVERSED",
          snapshot: json({
            request_id: id,
            original: journal,
            reversal_id: reversal.id,
            reason: s.input.reason,
          }),
        },
      });
      await tx.o2cControlEvent.create({
        data: {
          companyId: c,
          actorId: a,
          sourceType: "SOURCE_REVERSAL",
          sourceId: id,
          kind: "POSTED",
          snapshot: { reversal_id: reversal.id },
        },
      });
      await new AuditService().recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "source.reversed",
        resourceType: journal.sourceType,
        resourceId: journal.sourceId,
        reason: s.input.reason,
        after: event,
      });
      return reversal;
    },
  );
}
