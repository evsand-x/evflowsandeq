import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";
import { requireEvidence } from "../sales/document-controls";
import { lockCustomer } from "../sales/transaction-controls";
import { lineAmounts } from "../sales/pricing-controls";
import { lockFinance, postLedger } from "./posting";
import type { ApprovalSnapshot, ApprovalStep } from "../procurement/approval-controls";
type Tx = Prisma.TransactionClient;
const audit = new AuditService(),
  d = (v: string | Prisma.Decimal) => new Prisma.Decimal(v);
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const reason = z.string().trim().min(1).max(1000),
  uuid = z.string().uuid(),
  amount = z
    .string()
    .regex(/^\d+(\.\d{1,8})?$/)
    .refine((v) => d(v).gt(0));

export async function requestPolicy(
  tx: Tx,
  c: string,
  a: string,
  kind: string,
  currency: string,
  value: Prisma.Decimal,
) {
  const now = new Date(),
    policies = await tx.transactionApprovalPolicy.findMany({
      where: {
        companyId: c,
        documentKind: kind,
        currency,
        effectiveFrom: { lte: now },
        effectiveTo: { gt: now },
      },
    });
  if (policies.length !== 1) throw new ConflictException("APPROVAL_POLICY_REQUIRED_OR_CONFLICTING");
  const p = policies[0]!;
  if (value.gt(p.maximumAmount) || !(p.steps as ApprovalStep[]).length)
    throw new ConflictException("APPROVAL_LIMIT_EXCEEDED");
  return {
    policy_id: p.id,
    maximum_amount: p.maximumAmount.toString(),
    allow_self: p.allowSelf,
    steps: p.steps,
    amount: value.toString(),
    currency,
    requester_id: a,
  };
}

export async function requestBankTransaction(c: string, a: string, body: unknown, key: string) {
  const input = z
    .object({
      kind: z.enum(["FEE", "TRANSFER", "OPENING", "SUPPLIER_PAYMENT"]),
      payable_id: uuid.optional(),
      bank_account_id: uuid,
      destination_bank_id: uuid.optional(),
      offset_account_id: uuid.optional(),
      amount,
      direction: z.enum(["IN", "OUT"]),
      occurred_at: z.string().datetime(),
      evidence_id: uuid,
      reason,
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, "finance/bank-transactions", key, input, async (tx) => {
    await lockFinance(tx, c);
    await requireEvidence(tx, c, input.evidence_id, "PAYMENT");
    const bank = await tx.financeBankAccount.findFirst({
      where: { companyId: c, id: input.bank_account_id, active: true },
    });
    if (!bank) throw new NotFoundException();
    if (input.kind === "FEE" && input.direction !== "OUT")
      throw new ConflictException("BANK_FEE_DIRECTION_INVALID");
    let offset: string | null;
    if (input.kind === "SUPPLIER_PAYMENT") {
      const payable = await tx.payableOpenItem.findFirst({
        where: {
          companyId: c,
          id: input.payable_id ?? "00000000-0000-0000-0000-000000000000",
          currency: bank.currency,
        },
      });
      if (!payable || d(input.amount).gt(payable.outstandingAmount) || input.direction !== "OUT")
        throw new ConflictException("PAYABLE_PAYMENT_INVALID");
      offset = null;
    } else if (input.kind === "TRANSFER") {
      const target = await tx.financeBankAccount.findFirst({
        where: {
          companyId: c,
          id: input.destination_bank_id ?? "00000000-0000-0000-0000-000000000000",
          active: true,
        },
      });
      if (
        !target ||
        target.id === bank.id ||
        target.currency !== bank.currency ||
        input.direction !== "OUT"
      )
        throw new ConflictException("BANK_TRANSFER_INVALID");
      offset = target.accountId;
    } else {
      const target = await tx.financeAccount.findFirst({
        where: {
          companyId: c,
          id: input.offset_account_id ?? "00000000-0000-0000-0000-000000000000",
          active: true,
        },
      });
      if (
        !target ||
        target.controlKind ||
        target.category !== (input.kind === "FEE" ? "EXPENSE" : "EQUITY")
      )
        throw new ConflictException("BANK_OFFSET_ACCOUNT_INVALID");
      offset = target.id;
    }
    const policy = await requestPolicy(
      tx,
      c,
      a,
      "BANK_TRANSACTION",
      bank.currency,
      d(input.amount),
    );
    const row = await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "BANK_TRANSACTION",
        sourceId: bank.id,
        kind: "REQUEST",
        snapshot: json({
          input,
          policy,
          currency: bank.currency,
          bank_account: bank.accountId,
          offset,
        }),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "bank_transaction.requested",
      resourceType: "bank_transaction",
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}

export async function requestTaxCorrection(c: string, a: string, body: unknown, key: string) {
  const input = z
    .object({ credit_note_id: uuid, official_document_id: uuid, evidence_id: uuid, reason })
    .strict()
    .parse(body);
  return transactionCommand(c, a, "finance/tax-corrections", key, input, async (tx) => {
    const note = await tx.creditNote.findFirst({
      where: { companyId: c, id: input.credit_note_id, state: "POSTED" },
      include: {
        salesInvoice: true,
        customerReturn: {
          include: {
            lines: {
              include: {
                deliveryReceiptLine: {
                  include: { allocation: { include: { salesOrderLine: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!note) throw new NotFoundException();
    await lockCustomer(tx, c, note.salesInvoice.customerId);
    await lockFinance(tx, c);
    await requireEvidence(tx, c, input.evidence_id, "TAX");
    const official = await tx.officialTaxDocument.findFirst({
      where: {
        companyId: c,
        id: input.official_document_id,
        state: "VERIFIED",
        customerId: note.salesInvoice.customerId,
      },
    });
    if (!official) throw new ConflictException("VERIFIED_SOURCE_TAX_DOCUMENT_REQUIRED");
    const linked =
      (official.sourceType === "SALES_INVOICE" && official.sourceId === note.salesInvoiceId) ||
      (official.sourceType === "ADVANCE_TAX" &&
        Boolean(
          await tx.advanceTax.findFirst({
            where: {
              companyId: c,
              id: official.sourceId,
              batchId:
                note.salesInvoice.fulfillmentBatchId ?? "00000000-0000-0000-0000-000000000000",
            },
          }),
        ));
    if (!linked) throw new ConflictException("TAX_CORRECTION_SOURCE_MISMATCH");
    const value = note.customerReturn.lines.reduce(
      (s, l) => s.add(lineAmounts(l.deliveryReceiptLine.allocation.salesOrderLine, l.quantity).tax),
      d("0"),
    );
    if (value.lte(0)) throw new ConflictException("RETURN_TAX_NOT_APPLICABLE");
    const policy = await requestPolicy(
      tx,
      c,
      a,
      "TAX_CORRECTION",
      note.salesInvoice.currency,
      value,
    );
    const row = await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "TAX_CORRECTION",
        sourceId: note.id,
        kind: "REQUEST",
        snapshot: json({
          input,
          policy,
          amount: value,
          currency: note.salesInvoice.currency,
          invoice_id: note.salesInvoiceId,
        }),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "tax_correction.requested",
      resourceType: "tax_correction",
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}

export async function requestRefund(c: string, a: string, body: unknown, key: string) {
  const input = z
    .object({
      credit_note_id: uuid,
      bank_account_id: uuid,
      evidence_id: uuid,
      bank_reference: reason,
      amount,
      reason,
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, "finance/refund-requests", key, input, async (tx) => {
    const note = await tx.creditNote.findFirst({
      where: { companyId: c, id: input.credit_note_id, state: "POSTED" },
      include: { salesInvoice: true },
    });
    if (!note) throw new NotFoundException();
    await lockCustomer(tx, c, note.salesInvoice.customerId);
    await lockFinance(tx, c);
    await requireEvidence(tx, c, input.evidence_id, "PAYMENT");
    if (
      !(await tx.financeBankAccount.findFirst({
        where: {
          companyId: c,
          id: input.bank_account_id,
          currency: note.salesInvoice.currency,
          active: true,
        },
      }))
    )
      throw new ConflictException("BANK_ACCOUNT_REQUIRED");
    const policy = await requestPolicy(
      tx,
      c,
      a,
      "CUSTOMER_REFUND",
      note.salesInvoice.currency,
      d(input.amount),
    );
    const row = await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "CUSTOMER_REFUND",
        sourceId: note.id,
        kind: "REQUEST",
        snapshot: json({ input, policy, currency: note.salesInvoice.currency }),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "customer_refund.requested",
      resourceType: "customer_refund",
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}

export async function decideFinancialRequest(
  c: string,
  a: string,
  id: string,
  expectedKind: string,
  body: unknown,
  key: string,
) {
  const i = z
    .object({ decision: z.enum(["APPROVED", "REJECTED"]), reason })
    .strict()
    .parse(body);
  return transactionCommand(c, a, `finance/requests/${id}/decision`, key, i, async (tx) => {
    await lockFinance(tx, c);
    const row = await tx.o2cControlEvent.findFirst({
      where: { companyId: c, id, sourceType: expectedKind, kind: "REQUEST" },
    });
    if (!row) throw new NotFoundException();
    if (
      await tx.o2cControlEvent.count({
        where: { companyId: c, sourceId: id, kind: { in: ["APPROVED", "REJECTED", "POSTED"] } },
      })
    )
      throw new ConflictException("REQUEST_ALREADY_DECIDED");
    const snapshot = row.snapshot as { policy: ApprovalSnapshot },
      p = snapshot.policy;
    if (!p.allow_self && row.actorId === a) throw new ForbiddenException("SELF_APPROVAL_FORBIDDEN");
    const actions = await tx.transactionApprovalAction.findMany({
      where: { companyId: c, sourceId: id },
    });
    const done = (step: ApprovalStep, n: number, votes = actions) => {
      const ids = new Set(
        votes.filter((v) => v.step === n && v.decision === "APPROVED").map((v) => v.actorId),
      );
      return step.mode === "ALL"
        ? step.user_ids.every((u) => ids.has(u))
        : step.user_ids.some((u) => ids.has(u));
    };
    const step = p.steps.findIndex((s, n) => !done(s, n));
    if (
      step < 0 ||
      !p.steps[step]!.user_ids.includes(a) ||
      !(await tx.companyMembership.findFirst({
        where: { companyId: c, userId: a, active: true, user: { active: true } },
      }))
    )
      throw new ForbiddenException("APPROVER_NOT_ASSIGNED");
    if (actions.some((v) => v.step === step && v.actorId === a))
      throw new ConflictException("APPROVAL_ALREADY_RECORDED");
    const vote = await tx.transactionApprovalAction.create({
      data: {
        companyId: c,
        sourceId: id,
        policyId: p.policy_id,
        step,
        actorId: a,
        decision: i.decision,
        reason: i.reason,
      },
    });
    const terminal =
      i.decision === "REJECTED" || p.steps.every((s, n) => done(s, n, [...actions, vote]));
    if (terminal)
      await tx.o2cControlEvent.create({
        data: {
          companyId: c,
          actorId: a,
          sourceType: expectedKind,
          sourceId: id,
          kind: i.decision,
          snapshot: json(i),
        },
      });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "finance_request.decided",
      resourceType: expectedKind,
      resourceId: id,
      reason: i.reason,
      after: vote,
    });
    return { complete: terminal, decision: i.decision };
  });
}

export async function postFinancialRequest(
  c: string,
  a: string,
  id: string,
  expectedKind: string,
  key: string,
) {
  return transactionCommand(c, a, `finance/requests/${id}/post`, key, { id }, async (tx) => {
    const row = await tx.o2cControlEvent.findFirst({
      where: { companyId: c, id, sourceType: expectedKind, kind: "REQUEST" },
    });
    if (!row) throw new NotFoundException();
    const s = row.snapshot as unknown as {
      input: {
        kind: string;
        amount: string;
        direction: string;
        occurred_at: string;
        payable_id?: string;
        credit_note_id: string;
      };
      amount: string;
      currency: string;
      bank_account: string;
      offset: string | null;
      invoice_id: string;
    };
    if (expectedKind === "TAX_CORRECTION") {
      const invoice = await tx.salesInvoice.findFirstOrThrow({
        where: { companyId: c, id: s.invoice_id },
      });
      await lockCustomer(tx, c, invoice.customerId);
    }
    await lockFinance(tx, c);
    if (
      !(await tx.o2cControlEvent.count({ where: { companyId: c, sourceId: id, kind: "APPROVED" } }))
    )
      throw new ConflictException("APPROVAL_REQUIRED");
    if (await tx.o2cControlEvent.count({ where: { companyId: c, sourceId: id, kind: "POSTED" } }))
      throw new ConflictException("REQUEST_ALREADY_POSTED");
    const source = { companyId: c, sourceType: expectedKind, sourceId: id, currency: s.currency };
    if (expectedKind === "BANK_TRANSACTION") {
      const value = d(s.input.amount),
        incoming = s.input.direction === "IN";
      let offset = s.offset;
      if (s.input.kind === "SUPPLIER_PAYMENT") {
        const payable = await tx.payableOpenItem.findFirst({
          where: {
            companyId: c,
            id: s.input.payable_id ?? "00000000-0000-0000-0000-000000000000",
            currency: s.currency,
          },
        });
        if (!payable || value.gt(payable.outstandingAmount))
          throw new ConflictException("PAYABLE_PAYMENT_EXCEEDED");
        await tx.payableOpenItem.update({
          where: { id: payable.id },
          data: {
            outstandingAmount: { decrement: value },
            state: payable.outstandingAmount.eq(value) ? "PAID" : "OPEN",
          },
        });
        const at = new Date(s.input.occurred_at),
          profiles = await tx.financePostingProfile.findMany({
            where: { companyId: c, effectiveFrom: { lte: at }, effectiveTo: { gt: at } },
          });
        if (profiles.length !== 1)
          throw new ConflictException("POSTING_PROFILE_REQUIRED_OR_CONFLICTING");
        offset = (profiles[0]!.mappings as Record<string, string>).AP ?? null;
      }
      if (!offset) throw new ConflictException("POSTING_MAPPING_REQUIRED");
      if (
        s.input.kind === "OPENING" &&
        (await tx.financeJournalLine.count({ where: { companyId: c, accountId: s.bank_account } }))
      )
        throw new ConflictException("BANK_OPENING_REQUIRES_EMPTY_ACCOUNT");
      await postLedger(tx, a, {
        businessDate: new Date(s.input.occurred_at),
        accountIds: [s.bank_account, offset],
        data: [
          {
            ...source,
            kind: "BANK_ADJUSTMENT",
            debit: incoming ? value : d("0"),
            credit: incoming ? d("0") : value,
          },
          {
            ...source,
            kind: s.input.kind === "SUPPLIER_PAYMENT" ? "AP" : "BANK_ADJUSTMENT",
            debit: incoming ? d("0") : value,
            credit: incoming ? value : d("0"),
          },
        ],
      });
    } else if (expectedKind === "TAX_CORRECTION") {
      const note = await tx.creditNote.findFirstOrThrow({
        where: { companyId: c, id: s.input.credit_note_id },
        include: { salesInvoice: true },
      });
      const value = d(s.amount);
      if (note.taxAmount.gt(0)) throw new ConflictException("RETURN_TAX_ALREADY_CORRECTED");
      const prior =
        (
          await tx.creditNote.aggregate({
            where: { companyId: c, salesInvoiceId: note.salesInvoiceId },
            _sum: { taxAmount: true },
          })
        )._sum.taxAmount ?? d("0");
      if (value.gt(note.salesInvoice.taxAmount.sub(prior)))
        throw new ConflictException("RETURN_TAX_EXCEEDED");
      const ar = Prisma.Decimal.min(value, note.salesInvoice.outstandingAmount),
        credit = value.sub(ar);
      await tx.salesInvoice.update({
        where: { id: note.salesInvoiceId },
        data: { outstandingAmount: { decrement: ar } },
      });
      await tx.creditNote.update({ where: { id: note.id }, data: { taxAmount: value } });
      await postLedger(tx, a, {
        data: [
          { ...source, kind: "SALES_TAX", debit: value, credit: d("0") },
          { ...source, kind: "AR", debit: d("0"), credit: ar },
          { ...source, kind: "CUSTOMER_ADVANCE", debit: d("0"), credit },
        ],
      });
    } else throw new ConflictException("FINANCIAL_REQUEST_KIND_INVALID");
    const after = await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: expectedKind,
        sourceId: id,
        kind: "POSTED",
        snapshot: json({ request: row.id }),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "finance_request.posted",
      resourceType: expectedKind,
      resourceId: id,
      after,
    });
    return after;
  });
}
