import { configurationError } from "./invoice-errors";
import { businessInstant } from "./business-date";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, prisma } from "@evflow/database";
import {
  receiveInvoicePaymentSchema,
  completeInvoicePaymentDeductionProofSchema,
} from "@evflow/contracts";
import { transactionCommand } from "../common/transaction-command";
import { nextDocumentNumber } from "../common/document-number";
import { AuditService } from "../common/audit.service";
import { requireEvidence } from "../sales/document-controls";
import { lockCustomer } from "../sales/transaction-controls";
import { financeDate, lockFinance, postLedger } from "./posting";
const d = (value: string | Prisma.Decimal) => new Prisma.Decimal(value);
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
type Tx = Prisma.TransactionClient;
async function lockedInvoice(tx: Tx, c: string, id: string) {
  const found = await tx.salesInvoice.findFirst({ where: { id, companyId: c } });
  if (!found) throw new NotFoundException("INVOICE_NOT_FOUND");
  await lockCustomer(tx, c, found.customerId);
  await lockFinance(tx, c);
  await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
  const invoice = await tx.salesInvoice.findFirstOrThrow({ where: { id, companyId: c } });
  if (invoice.state !== "POSTED") throw new ConflictException("INVOICE_NOT_POSTED");
  return invoice;
}
export async function receiveInvoicePayment(
  c: string,
  a: string,
  invoiceId: string,
  body: unknown,
  key: string,
) {
  const input = receiveInvoicePaymentSchema.parse(body);
  return transactionCommand(
    c,
    a,
    `sales-invoices/${invoiceId}/payments`,
    key,
    input,
    async (tx) => {
      const invoice = await lockedInvoice(tx, c, invoiceId);
      const at = await businessInstant(tx, c, input.received_date);
      const bank = await tx.financeBankAccount.findFirst({
        where: {
          id: input.bank_account_id,
          companyId: c,
          active: true,
          currency: invoice.currency,
        },
      });
      if (!bank) throw new ConflictException("BANK_ACCOUNT_REQUIRED");
      await requireEvidence(tx, c, input.evidence_id, "PAYMENT");
      if (
        await tx.customerReceipt.findFirst({
          where: { companyId: c, bankAccountId: bank.id, bankReference: input.bank_reference },
        })
      )
        throw new ConflictException("BANK_REFERENCE_DUPLICATE");
      const deductions = [];
      const seen = new Set<string>();
      for (const line of input.deductions) {
        const identity = line.source_type + line.source_id;
        if (seen.has(identity)) throw new ConflictException("DUPLICATE_DEDUCTION");
        seen.add(identity);
        const tax =
          line.source_type === "TAX"
            ? await tx.operationalTax.findFirst({
                where: {
                  id: line.source_id,
                  companyId: c,
                  active: true,
                  effect: "DEDUCT",
                  usage: { in: ["SALES", "BOTH"] },
                  effectiveFrom: { lte: at },
                },
              })
            : null;
        const type =
          line.source_type === "DEDUCTION_TYPE"
            ? await tx.deductionType.findFirst({
                where: { id: line.source_id, companyId: c, active: true },
              })
            : null;
        if (!tax && !type) throw new ConflictException("DEDUCTION_SOURCE_INVALID");
        const accountId = tax?.accountId ?? type!.settleAccountId;
        if (
          !(await tx.financeAccount.findFirst({
            where: { id: accountId, companyId: c, active: true, accountType: "DETAIL" },
          }))
        )
          throw new ConflictException("DEDUCTION_ACCOUNT_INVALID");
        if (line.mode === "PERCENT" && d(line.value).gt("100"))
          throw new ConflictException("DEDUCTION_PERCENT_INVALID");
        const rounding = tax
          ? (
              {
                HALF_UP: Prisma.Decimal.ROUND_HALF_UP,
                HALF_EVEN: Prisma.Decimal.ROUND_HALF_EVEN,
                DOWN: Prisma.Decimal.ROUND_DOWN,
              } as const
            )[tax.rounding as "HALF_UP" | "HALF_EVEN" | "DOWN"]
          : Prisma.Decimal.ROUND_HALF_UP;
        if (rounding === undefined) throw new ConflictException("TAX_ROUNDING_REQUIRED");
        const amount = (
          line.mode === "PERCENT" ? invoice.subtotal.mul(line.value).div("100") : d(line.value)
        ).toDecimalPlaces(tax?.decimalPlaces ?? 8, rounding);
        if (amount.lte(0)) throw new ConflictException("DEDUCTION_AMOUNT_INVALID");
        const proofRequired = tax ? true : type!.proofRequired;
        if (line.evidence_id) await requireEvidence(tx, c, line.evidence_id, "TAX");
        deductions.push({
          companyId: c,
          invoiceId,
          sourceType: line.source_type,
          sourceId: line.source_id,
          mode: line.mode,
          value: d(line.value),
          baseAmount: invoice.subtotal,
          amount,
          accountId,
          snapshot: json({
            master: tax ?? type,
            proof_required: proofRequired,
            evidence_purpose: "TAX",
          }),
          state: proofRequired && !line.evidence_id ? "PENDING_PROOF" : "SETTLED",
          evidenceId: line.evidence_id ?? null,
          proofNumber: line.proof_number ?? null,
          proofDate: line.proof_date ? new Date(line.proof_date) : null,
          settledAt: proofRequired && !line.evidence_id ? null : at,
          createdById: a,
        });
      }
      const proposed = deductions.reduce((sum, line) => sum.add(line.amount), d(input.amount));
      if (proposed.gt(invoice.outstandingAmount))
        throw new ConflictException("PAYMENT_EXCEEDS_OUTSTANDING");
      const settled = deductions.filter((x) => x.state === "SETTLED");
      const applied = settled.reduce((sum, line) => sum.add(line.amount), d(input.amount));
      const receipt = await tx.customerReceipt.create({
        data: {
          companyId: c,
          customerId: invoice.customerId,
          number: await nextDocumentNumber(tx, c, "customer_receipt", at),
          invoicePayment: true,
          amount: d(input.amount),
          unallocatedAmount: d("0"),
          bankAccountId: bank.id,
          bankReference: input.bank_reference,
          evidenceId: input.evidence_id,
          externalReference: input.external_reference ?? null,
          receivedAt: at,
          currency: invoice.currency,
          idempotencyKey: key,
          createdById: a,
        },
      });
      const allocation = await tx.customerReceiptAllocation.create({
        data: { companyId: c, receiptId: receipt.id, invoiceId, amount: d(input.amount) },
      });
      const rows = [];
      for (const line of deductions)
        rows.push(
          await tx.invoicePaymentDeduction.create({ data: { ...line, receiptId: receipt.id } }),
        );
      const common = {
        companyId: c,
        sourceType: "CUSTOMER_RECEIPT",
        sourceId: receipt.id,
        currency: invoice.currency,
        salesInvoiceId: invoice.id,
      };
      await postLedger(tx, a, {
        data: [
          { ...common, kind: "CASH_RECEIPT", debit: d(input.amount), credit: d("0") },
          ...settled.map((x) => ({
            ...common,
            kind: "RECEIPT_DEDUCTION" as const,
            debit: x.amount,
            credit: d("0"),
          })),
          { ...common, kind: "AR", debit: d("0"), credit: applied },
        ],
        accountIds: [bank.accountId, ...settled.map((x) => x.accountId), undefined],
      });
      const updated = await tx.salesInvoice.update({
        where: { id: invoiceId },
        data: { outstandingAmount: { decrement: applied } },
      });
      const result = {
        receipt,
        allocation,
        deductions: rows,
        outstanding_amount: updated.outstandingAmount.toString(),
      };
      await new AuditService().recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "invoice_payment.posted",
        resourceType: "customer_receipt",
        resourceId: receipt.id,
        after: result,
      });
      await tx.outboxEvent.create({
        data: {
          companyId: c,
          aggregateId: receipt.id,
          eventType: "invoice_payment.posted",
          payload: json({ invoice_id: invoiceId, receipt_id: receipt.id }),
        },
      });
      return result;
    },
  ).catch(configurationError);
}
export async function completeInvoicePaymentDeductionProof(
  c: string,
  a: string,
  id: string,
  body: unknown,
  key: string,
) {
  const input = completeInvoicePaymentDeductionProofSchema.parse(body);
  return transactionCommand(
    c,
    a,
    `invoice-payment-deductions/${id}/proof`,
    key,
    input,
    async (tx) => {
      const found = await tx.invoicePaymentDeduction.findFirst({ where: { id, companyId: c } });
      if (!found) throw new NotFoundException("DEDUCTION_NOT_FOUND");
      const invoice = await lockedInvoice(tx, c, found.invoiceId);
      const row = await tx.invoicePaymentDeduction.findFirstOrThrow({
        where: { id, companyId: c },
      });
      if (row.state !== "PENDING_PROOF") throw new ConflictException("DEDUCTION_ALREADY_SETTLED");
      if (
        !(await tx.customerReceipt.findFirst({
          where: { id: row.receiptId, companyId: c, state: "POSTED" },
        }))
      )
        throw new ConflictException("RECEIPT_NOT_POSTED");
      await requireEvidence(tx, c, input.evidence_id, "TAX");
      if (row.amount.gt(invoice.outstandingAmount))
        throw new ConflictException("PAYMENT_EXCEEDS_OUTSTANDING");
      const at = await businessInstant(tx, c, input.settlement_date);
      const common = {
        companyId: c,
        sourceType: "INVOICE_PAYMENT_DEDUCTION",
        sourceId: id,
        currency: invoice.currency,
        salesInvoiceId: invoice.id,
      };
      await postLedger(tx, a, {
        businessDate: at,
        data: [
          { ...common, kind: "RECEIPT_DEDUCTION" as const, debit: row.amount, credit: d("0") },
          { ...common, kind: "AR", debit: d("0"), credit: row.amount },
        ],
        accountIds: [row.accountId, undefined],
      });
      const result = await tx.invoicePaymentDeduction.update({
        where: { id },
        data: {
          state: "SETTLED",
          evidenceId: input.evidence_id,
          proofNumber: input.proof_number,
          proofDate: new Date(input.proof_date),
          settledAt: at,
        },
      });
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { outstandingAmount: { decrement: row.amount } },
      });
      await new AuditService().recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "invoice_payment.deduction_settled",
        resourceType: "customer_receipt",
        resourceId: row.receiptId,
        before: row,
        after: result,
      });
      await tx.outboxEvent.create({
        data: {
          companyId: c,
          aggregateId: row.id,
          eventType: "invoice_payment.deduction_settled",
          payload: { invoice_id: invoice.id, receipt_id: row.receiptId, deduction_id: row.id },
        },
      });
      return result;
    },
  ).catch(configurationError);
}
export async function invoicePaymentForm(c: string, id: string) {
  return prisma
    .$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findFirst({
        where: { id, companyId: c, state: "POSTED" },
        select: {
          id: true,
          number: true,
          customerId: true,
          subtotal: true,
          outstandingAmount: true,
          currency: true,
          total: true,
          taxAmount: true,
          freightAmount: true,
          freightTaxAmount: true,
          invoiceDate: true,
          dueDate: true,
          postedAt: true,
          createdAt: true,
          issuedSnapshot: true,
          customer: { select: { id: true, code: true, name: true } },
        },
      });
      if (!invoice) throw new NotFoundException("INVOICE_NOT_FOUND");
      const total =
        invoice.total ??
        invoice.subtotal
          .add(invoice.taxAmount)
          .add(invoice.freightAmount)
          .add(invoice.freightTaxAmount);
      const snapshot = invoice.issuedSnapshot as {
        customer?: { code?: string; name?: string };
      } | null;
      const allocations = await tx.customerReceiptAllocation.findMany({
        where: { companyId: c, invoiceId: id, receipt: { state: "POSTED" } },
        select: { id: true, amount: true },
      });
      const allocationJournals = await tx.financeJournal.findMany({
        where: {
          companyId: c,
          sourceType: "CUSTOMER_RECEIPT_ALLOCATION",
          sourceId: { in: allocations.map((row) => row.id) },
        },
        select: { id: true, sourceId: true },
      });
      const reversed = await tx.o2cControlEvent.findMany({
        where: {
          companyId: c,
          sourceType: "JOURNAL",
          sourceId: { in: allocationJournals.map((row) => row.id) },
          kind: "REVERSED",
        },
        select: { sourceId: true },
      });
      const reversedJournals = new Set(reversed.map((row) => row.sourceId));
      const reversedAllocations = new Set(
        allocationJournals.filter((row) => reversedJournals.has(row.id)).map((row) => row.sourceId),
      );
      const paid = allocations
        .filter((row) => !reversedAllocations.has(row.id))
        .reduce((sum, row) => sum.add(row.amount), d("0"));
      const invoiceSummary = {
        id: invoice.id,
        number: invoice.number,
        customerId: invoice.customerId,
        customer: {
          id: invoice.customerId,
          code: snapshot?.customer?.code ?? invoice.customer.code,
          name: snapshot?.customer?.name ?? invoice.customer.name,
        },
        subtotal: invoice.subtotal,
        currency: invoice.currency,
        invoiceDate:
          invoice.invoiceDate ?? (await financeDate(tx, c, invoice.postedAt ?? invoice.createdAt)),
        dueDate: invoice.dueDate,
        total,
        outstandingAmount: invoice.outstandingAmount,
        cashPaidAmount: paid.toString(),
        settledAmount: total.sub(invoice.outstandingAmount).toString(),
      };
      const banks = await tx.financeBankAccount.findMany({
        where: { companyId: c, active: true, currency: invoice.currency },
        select: { id: true, name: true, bankName: true, lastFour: true },
        orderBy: { name: "asc" },
      });
      const taxes = await tx.operationalTax.findMany({
        where: {
          companyId: c,
          active: true,
          effect: "DEDUCT",
          usage: { in: ["SALES", "BOTH"] },
          effectiveFrom: { lte: new Date() },
        },
        select: {
          id: true,
          name: true,
          accountId: true,
          percentage: true,
          decimalPlaces: true,
          rounding: true,
        },
        orderBy: { name: "asc" },
      });
      const types = await tx.deductionType.findMany({
        where: { companyId: c, active: true },
        select: {
          id: true,
          name: true,
          settleAccountId: true,
          proofRequired: true,
          proofType: true,
        },
        orderBy: { name: "asc" },
      });
      const deductions = await tx.invoicePaymentDeduction.findMany({
        where: { companyId: c, invoiceId: id },
        orderBy: { createdAt: "asc" },
      });
      const pending = deductions
        .filter((row) => row.state === "PENDING_PROOF")
        .reduce((sum, row) => sum.add(row.amount), d("0"));
      const accounts = await tx.financeAccount.findMany({
        where: {
          companyId: c,
          id: { in: [...taxes.map((t) => t.accountId), ...types.map((t) => t.settleAccountId)] },
          active: true,
          accountType: "DETAIL",
        },
        select: { id: true, code: true, name: true },
      });
      return {
        invoice: invoiceSummary,
        banks,
        taxes,
        accounts,
        deduction_types: types,
        pending_proof_amount: pending.toString(),
        settleable_pending_amount: Prisma.Decimal.min(
          pending,
          invoice.outstandingAmount,
        ).toString(),
        deductions: deductions.map((row) => ({
          ...row,
          display_state:
            row.state === "PENDING_PROOF" && invoice.outstandingAmount.lt(row.amount)
              ? "NO_OUTSTANDING"
              : row.state,
        })),
      };
    })
    .catch(configurationError);
}
