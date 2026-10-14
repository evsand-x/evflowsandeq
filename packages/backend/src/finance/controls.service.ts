import { createHash } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";
import { lockFinance, postLedger } from "./posting";
import { lockCustomer } from "../sales/transaction-controls";
import { requireEvidence } from "../sales/document-controls";
import { reconcileEconomicO2c } from "./economic-reconciliation";

const uuid = z.string().uuid(),
  date = z.string().date();
const amount = z.string().regex(/^-?\d+(\.\d{1,8})?$/);
const positive = amount.refine((v) => new Prisma.Decimal(v).gt(0));
const currency = z.string().regex(/^[A-Z]{3}$/);
const d = (v: string | Prisma.Decimal) => new Prisma.Decimal(v);
const audit = new AuditService();
type Tx = Prisma.TransactionClient;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export const financeSchemas = {
  account: z
    .object({
      code: z.string().trim().min(1).max(30),
      name: z.string().trim().min(1).max(200),
      category: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
      control_kind: z.string().max(60).optional(),
    })
    .strict(),
  period: z.object({ starts_on: date, ends_on: date }).strict(),
  profile: z
    .object({ effective_from: date, effective_to: date, mappings: z.record(z.string(), uuid) })
    .strict(),
  bank: z
    .object({
      code: z.string().trim().min(1).max(30),
      name: z.string().trim().min(1).max(200),
      bank_name: z.string().min(1).max(200),
      last_four: z.string().regex(/^\d{4}$/),
      currency,
      account_id: uuid,
    })
    .strict(),
  taxRule: z
    .object({
      customer_id: uuid,
      kind: z.enum(["vat_collected_by_customer", "income_tax_withheld"]),
      tax_type: z.string().trim().min(1).max(60),
      rate: amount,
      dpp_factor: positive,
      decimal_places: z.number().int().min(0).max(8),
      rounding: z.enum(["HALF_UP", "HALF_EVEN", "DOWN"]),
      legal_reference: z.string().trim().min(1).max(500),
      effective_from: date,
      effective_to: date,
    })
    .strict(),
  taxComponent: z
    .object({
      invoice_id: uuid,
      rule_id: uuid,
      number: z.string().trim().min(1).max(100),
      document_date: date,
      tax_period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      dpp: positive,
      evidence_id: uuid,
    })
    .strict(),
  statement: z
    .object({
      bank_account_id: uuid,
      starts_on: date,
      ends_on: date,
      opening_balance: amount,
      closing_balance: amount,
      lines: z
        .array(
          z
            .object({
              external_id: z.string().trim().min(1).max(150),
              reference: z.string().max(150),
              value_date: date,
              amount,
              description: z.string().max(500),
            })
            .strict(),
        )
        .min(0)
        .max(1000),
    })
    .strict(),
};

export async function financeConfigure(
  c: string,
  a: string,
  kind: "account" | "period" | "profile" | "bank" | "taxRule",
  input: unknown,
  key: string,
) {
  const i = financeSchemas[kind].parse(input);
  return transactionCommand(c, a, `finance/configure/${kind}`, key, i, async (tx) => {
    await lockFinance(tx, c);
    let row: { id: string };
    if (kind === "account") {
      const v = financeSchemas.account.parse(i);
      row = await tx.financeAccount.create({
        data: {
          companyId: c,
          code: v.code,
          name: v.name,
          category: v.category,
          controlKind: v.control_kind ?? null,
        },
      });
    } else if (kind === "period") {
      const v = financeSchemas.period.parse(i),
        startsOn = new Date(v.starts_on),
        endsOn = new Date(v.ends_on);
      if (
        endsOn < startsOn ||
        (await tx.financePeriod.count({
          where: { companyId: c, startsOn: { lte: endsOn }, endsOn: { gte: startsOn } },
        }))
      )
        throw new ConflictException("FINANCE_PERIOD_OVERLAP");
      row = await tx.financePeriod.create({ data: { companyId: c, startsOn, endsOn } });
    } else if (kind === "profile") {
      const v = financeSchemas.profile.parse(i),
        from = new Date(v.effective_from),
        to = new Date(v.effective_to);
      if (
        to <= from ||
        (await tx.financePostingProfile.count({
          where: { companyId: c, effectiveFrom: { lt: to }, effectiveTo: { gt: from } },
        }))
      )
        throw new ConflictException("POSTING_PROFILE_OVERLAP");
      const ids = [...new Set(Object.values(v.mappings))];
      if (
        !ids.length ||
        (await tx.financeAccount.count({
          where: { companyId: c, id: { in: ids }, active: true },
        })) !== ids.length
      )
        throw new ConflictException("POSTING_ACCOUNT_INVALID");
      row = await tx.financePostingProfile.create({
        data: {
          companyId: c,
          effectiveFrom: from,
          effectiveTo: to,
          mappings: v.mappings,
          createdById: a,
        },
      });
    } else if (kind === "bank") {
      const v = financeSchemas.bank.parse(i);
      if (
        !(await tx.financeAccount.findFirst({
          where: {
            id: v.account_id,
            companyId: c,
            active: true,
            category: "ASSET",
            controlKind: "BANK",
          },
        }))
      )
        throw new ConflictException("BANK_GL_ACCOUNT_INVALID");
      if (await tx.financeBankAccount.count({ where: { companyId: c, accountId: v.account_id } }))
        throw new ConflictException("BANK_GL_ACCOUNT_ALREADY_LINKED");
      row = await tx.financeBankAccount.create({
        data: {
          companyId: c,
          code: v.code,
          name: v.name,
          bankName: v.bank_name,
          lastFour: v.last_four,
          currency: v.currency,
          accountId: v.account_id,
        },
      });
    } else {
      const v = financeSchemas.taxRule.parse(i),
        from = new Date(v.effective_from),
        to = new Date(v.effective_to);
      if (to <= from || d(v.rate).lt(0) || d(v.rate).gt(1))
        throw new ConflictException("TAX_POLICY_INVALID");
      if (
        !(await tx.customer.findFirst({
          where: { companyId: c, id: v.customer_id, state: "ACTIVE" },
        }))
      )
        throw new NotFoundException();
      if (
        await tx.receiptTaxRule.count({
          where: {
            companyId: c,
            customerId: v.customer_id,
            kind: v.kind,
            taxType: v.tax_type,
            effectiveFrom: { lt: to },
            effectiveTo: { gt: from },
          },
        })
      )
        throw new ConflictException("TAX_POLICY_OVERLAP");
      row = await tx.receiptTaxRule.create({
        data: {
          companyId: c,
          customerId: v.customer_id,
          kind: v.kind,
          taxType: v.tax_type,
          rate: v.rate,
          dppFactor: v.dpp_factor,
          decimalPlaces: v.decimal_places,
          rounding: v.rounding,
          legalReference: v.legal_reference,
          effectiveFrom: from,
          effectiveTo: to,
        },
      });
    }
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: `finance.${kind}.created`,
      resourceType: `finance_${kind}`,
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}

export async function createTaxComponent(c: string, a: string, input: unknown, key: string) {
  const i = financeSchemas.taxComponent.parse(input);
  return transactionCommand(c, a, "finance/tax-components", key, i, async (tx) => {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: i.invoice_id, companyId: c, state: "POSTED" },
    });
    if (!invoice) throw new NotFoundException();
    await lockCustomer(tx, c, invoice.customerId);
    await requireEvidence(tx, c, i.evidence_id, "TAX");
    const at = new Date(i.document_date);
    const rule = await tx.receiptTaxRule.findFirst({
      where: {
        state: "ACTIVE",
        id: i.rule_id,
        companyId: c,
        customerId: invoice.customerId,
        effectiveFrom: { lte: at },
        effectiveTo: { gt: at },
      },
    });
    if (!rule) throw new ConflictException("TAX_POLICY_REQUIRED");
    if (d(i.dpp).gt(invoice.subtotal.mul(rule.dppFactor)))
      throw new ConflictException("TAX_BASE_EXCEEDED");
    const rounding = {
      HALF_UP: Prisma.Decimal.ROUND_HALF_UP,
      HALF_EVEN: Prisma.Decimal.ROUND_HALF_EVEN,
      DOWN: Prisma.Decimal.ROUND_DOWN,
    }[rule.rounding];
    if (rounding === undefined) throw new ConflictException("TAX_ROUNDING_REQUIRED");
    const tax = d(i.dpp).mul(rule.rate).toDecimalPlaces(rule.decimalPlaces, rounding);
    if (
      tax.lte(0) ||
      tax.gt(invoice.total ?? invoice.subtotal) ||
      (rule.kind === "vat_collected_by_customer" && tax.gt(invoice.taxAmount))
    )
      throw new ConflictException("TAX_AMOUNT_EXCEEDED");
    const row = await tx.receiptTaxComponent.create({
      data: {
        companyId: c,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        ruleId: rule.id,
        kind: rule.kind,
        taxType: rule.taxType,
        amount: tax,
        dpp: i.dpp,
        snapshot: json(rule),
        number: i.number,
        documentDate: at,
        taxPeriod: i.tax_period,
        evidenceId: i.evidence_id,
        createdById: a,
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "tax_component.submitted",
      resourceType: "sales_invoice",
      resourceId: invoice.id,
      after: row,
    });
    return row;
  });
}

export async function taxComponentCommand(
  c: string,
  a: string,
  id: string,
  action: "verify" | "reject" | "post",
  reason: string,
  key: string,
) {
  return transactionCommand(
    c,
    a,
    `finance/tax-components/${id}/${action}`,
    key,
    { reason },
    async (tx) => {
      const ref = await tx.receiptTaxComponent.findFirst({ where: { companyId: c, id } });
      if (!ref) throw new NotFoundException();
      await lockCustomer(tx, c, ref.customerId);
      await tx.$queryRaw`SELECT id FROM receipt_tax_components WHERE id=${id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id=${ref.invoiceId}::uuid FOR UPDATE`;
      const row = await tx.receiptTaxComponent.findUniqueOrThrow({ where: { id } });
      const invoice = await tx.salesInvoice.findUniqueOrThrow({ where: { id: row.invoiceId } });
      if (action !== "post") {
        if (row.state !== "PENDING") throw new ConflictException("TAX_COMPONENT_NOT_PENDING");
        const after = await tx.receiptTaxComponent.update({
          where: { id },
          data: {
            state: action === "verify" ? "VERIFIED" : "REJECTED",
            verifiedById: a,
            verifiedAt: new Date(),
          },
        });
        await audit.recordWith(tx, {
          companyId: c,
          actorId: a,
          action: `tax_component.${action}`,
          resourceType: "sales_invoice",
          resourceId: invoice.id,
          before: row,
          after,
          reason,
        });
        return after;
      }
      if (row.state !== "VERIFIED" || !row.verifiedById)
        throw new ConflictException("TAX_EVIDENCE_NOT_VERIFIED");
      if (invoice.state !== "POSTED" || row.amount.gt(invoice.outstandingAmount))
        throw new ConflictException("TAX_SETTLEMENT_EXCEEDED");
      const previous = await tx.receiptTaxComponent.aggregate({
        where: {
          companyId: c,
          invoiceId: invoice.id,
          kind: row.kind,
          ...(row.kind === "income_tax_withheld" ? { taxType: row.taxType } : {}),
          state: "POSTED",
        },
        _sum: { amount: true, dpp: true },
      });
      const rule = row.snapshot as { dppFactor: string };
      if (
        (previous._sum.dpp ?? d("0")).add(row.dpp).gt(invoice.subtotal.mul(rule.dppFactor)) ||
        (row.kind === "vat_collected_by_customer" &&
          (previous._sum.amount ?? d("0")).add(row.amount).gt(invoice.taxAmount))
      )
        throw new ConflictException("TAX_SETTLEMENT_EXCEEDED");
      const source = {
        companyId: c,
        sourceType: "TAX_SETTLEMENT",
        sourceId: id,
        currency: invoice.currency,
      };
      await postLedger(tx, a, {
        data: [
          {
            ...source,
            kind: row.kind === "vat_collected_by_customer" ? "WAPU_TAX" : "WITHHELD_TAX",
            debit: row.amount,
            credit: "0",
          },
          { ...source, kind: "AR", debit: "0", credit: row.amount },
        ],
      });
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { outstandingAmount: { decrement: row.amount } },
      });
      const after = await tx.receiptTaxComponent.update({
        where: { id },
        data: { state: "POSTED", postedAt: new Date() },
      });
      await audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "tax_component.posted",
        resourceType: "sales_invoice",
        resourceId: invoice.id,
        before: row,
        after,
        reason,
      });
      return after;
    },
  );
}

export async function importStatement(c: string, a: string, input: unknown, key: string) {
  const i = financeSchemas.statement.parse(input);
  return transactionCommand(c, a, "finance/statements", key, i, async (tx) => {
    await lockFinance(tx, c);
    if (
      !(await tx.financeBankAccount.findFirst({
        where: { id: i.bank_account_id, companyId: c, active: true },
      }))
    )
      throw new NotFoundException();
    if (
      i.ends_on < i.starts_on ||
      i.lines.some(
        (l) => l.value_date < i.starts_on || l.value_date > i.ends_on || d(l.amount).eq(0),
      )
    )
      throw new ConflictException("STATEMENT_DATES_OR_AMOUNTS_INVALID");
    const hash = createHash("sha256").update(JSON.stringify(i)).digest("hex");
    if (
      await tx.bankStatement.count({
        where: {
          companyId: c,
          bankAccountId: i.bank_account_id,
          startsOn: { lte: new Date(i.ends_on) },
          endsOn: { gte: new Date(i.starts_on) },
        },
      })
    )
      throw new ConflictException("BANK_STATEMENT_PERIOD_OVERLAP");
    const previous = await tx.bankStatement.findFirst({
      where: {
        companyId: c,
        bankAccountId: i.bank_account_id,
        endsOn: { lt: new Date(i.starts_on) },
      },
      orderBy: { endsOn: "desc" },
    });
    if (previous) {
      const next = new Date(previous.endsOn);
      next.setUTCDate(next.getUTCDate() + 1);
      if (
        !previous.closingBalance.eq(i.opening_balance) ||
        next.getTime() !== new Date(i.starts_on).getTime()
      )
        throw new ConflictException("BANK_STATEMENT_CONTINUITY_REQUIRED");
    }
    if (
      (await tx.bankStatement.count({
        where: { companyId: c, bankAccountId: i.bank_account_id, sourceHash: hash },
      })) ||
      new Set(i.lines.map((l) => l.external_id)).size !== i.lines.length ||
      (await tx.bankStatementLine.count({
        where: {
          companyId: c,
          bankAccountId: i.bank_account_id,
          externalId: { in: i.lines.map((l) => l.external_id) },
        },
      }))
    )
      throw new ConflictException("BANK_STATEMENT_DUPLICATE");
    const row = await tx.bankStatement.create({
      data: {
        companyId: c,
        bankAccountId: i.bank_account_id,
        startsOn: new Date(i.starts_on),
        endsOn: new Date(i.ends_on),
        openingBalance: i.opening_balance,
        closingBalance: i.closing_balance,
        sourceHash: hash,
        createdById: a,
        lines: {
          create: i.lines.map((l) => ({
            companyId: c,
            bankAccountId: i.bank_account_id,
            externalId: l.external_id,
            reference: l.reference,
            valueDate: new Date(l.value_date),
            amount: l.amount,
            description: l.description,
          })),
        },
      },
      include: { lines: true },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "bank_statement.staged",
      resourceType: "bank_statement",
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}

export async function matchStatement(
  c: string,
  a: string,
  lineId: string,
  receiptId: string | undefined,
  key: string,
  matchAmount?: string,
  journalLineId?: string,
) {
  return transactionCommand(
    c,
    a,
    `finance/statement-lines/${lineId}/match`,
    key,
    { receiptId, matchAmount, journalLineId },
    async (tx) => {
      await lockFinance(tx, c);
      const line = await tx.bankStatementLine.findFirst({
        where: { companyId: c, id: lineId },
        include: { statement: true },
      });
      if (!line) throw new NotFoundException();
      if (line.statement.state === "CLOSED") throw new ConflictException("BANK_MATCH_LOCKED");
      const bank = await tx.financeBankAccount.findFirstOrThrow({
        where: { companyId: c, id: line.bankAccountId },
      });
      let target = journalLineId;
      if (receiptId) {
        const receipt = await tx.customerReceipt.findFirst({
          where: { companyId: c, id: receiptId, state: "POSTED", bankAccountId: bank.id },
        });
        if (!receipt) throw new ConflictException("BANK_MATCH_AMOUNT_OR_ACCOUNT_MISMATCH");
        const candidates = await tx.financeJournalLine.findMany({
          where: {
            companyId: c,
            accountId: bank.accountId,
            ledgerKind: "CASH_RECEIPT",
            journal: { sourceType: "CUSTOMER_RECEIPT", sourceId: receiptId },
          },
        });
        if (candidates.length !== 1)
          throw new ConflictException("BANK_MATCH_POSTED_JOURNAL_REQUIRED");
        target = candidates[0]!.id;
      }
      if (!target) throw new ConflictException("BANK_MATCH_SOURCE_REQUIRED");
      const entry = await tx.financeJournalLine.findFirst({
        where: {
          companyId: c,
          id: target,
          accountId: bank.accountId,
          journal: { currency: bank.currency },
        },
        include: { journal: true },
      });
      if (!entry) throw new ConflictException("BANK_MATCH_POSTED_JOURNAL_REQUIRED");
      const signed = entry.debit.sub(entry.credit);
      if (signed.eq(0) || signed.isPositive() !== line.amount.isPositive())
        throw new ConflictException("BANK_MATCH_DIRECTION_MISMATCH");
      if (entry.journal.businessDate > line.statement.endsOn)
        throw new ConflictException("BANK_MATCH_FUTURE_BOOK_ENTRY");
      const matches = await tx.bankStatementMatch.findMany({
        where: {
          companyId: c,
          reversedAt: null,
          OR: [{ statementLineId: lineId }, { journalLineId: target }],
        },
      });
      const lineRemaining = line.amount
        .abs()
        .sub(
          matches
            .filter((m) => m.statementLineId === lineId)
            .reduce((s, m) => s.add(m.amount), d("0")),
        );
      const sourceRemaining = signed
        .abs()
        .sub(
          matches
            .filter((m) => m.journalLineId === target)
            .reduce((s, m) => s.add(m.amount), d("0")),
        );
      const amount = matchAmount === undefined ? lineRemaining : d(positive.parse(matchAmount));
      if (amount.lte(0) || amount.gt(lineRemaining) || amount.gt(sourceRemaining))
        throw new ConflictException("BANK_MATCH_AMOUNT_OR_ACCOUNT_MISMATCH");
      const match = await tx.bankStatementMatch.create({
        data: {
          companyId: c,
          statementLineId: lineId,
          journalLineId: target,
          receiptId: receiptId ?? null,
          amount,
          actorId: a,
        },
      });
      await tx.bankStatement.update({
        where: { id: line.statementId },
        data: { state: "STAGING", version: { increment: 1 }, reviewSnapshot: Prisma.DbNull },
      });
      await audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "bank_statement.matched",
        resourceType: "bank_statement",
        resourceId: line.statementId,
        after: match,
      });
      return match;
    },
  );
}

export async function statementReview(tx: Tx, c: string, id: string) {
  const row = await tx.bankStatement.findFirst({
    where: { companyId: c, id },
    include: { lines: true },
  });
  if (!row) throw new NotFoundException();
  const bank = await tx.financeBankAccount.findFirstOrThrow({
    where: { companyId: c, id: row.bankAccountId },
  });
  const entries = await tx.financeJournalLine.findMany({
    where: {
      companyId: c,
      accountId: bank.accountId,
      journal: { currency: bank.currency, businessDate: { lte: row.endsOn } },
    },
    include: { journal: true },
  });
  const book = entries.reduce((s, l) => s.add(l.debit).sub(l.credit), d("0"));
  const previous = await tx.bankStatement.findFirst({
    where: { companyId: c, bankAccountId: bank.id, endsOn: { lt: row.startsOn } },
    orderBy: { endsOn: "desc" },
  });
  const nextDate = previous ? new Date(previous.endsOn) : null;
  if (nextDate) nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const continuity =
    !previous ||
    (previous.state === "CLOSED" &&
      previous.closingBalance.eq(row.openingBalance) &&
      nextDate!.getTime() === row.startsOn.getTime());
  const statements = await tx.bankStatement.findMany({
    where: { companyId: c, bankAccountId: bank.id, endsOn: { lte: row.endsOn } },
    select: { lines: { select: { id: true } } },
  });
  const matches = await tx.bankStatementMatch.findMany({
    where: {
      companyId: c,
      reversedAt: null,
      statementLineId: { in: statements.flatMap((s) => s.lines.map((l) => l.id)) },
    },
  });
  const lines = row.lines.map((l) => {
    const items = matches.filter((m) => m.statementLineId === l.id);
    const matchedAmount = items.reduce((s, m) => s.add(m.amount), d("0"));
    return {
      ...l,
      matches: items,
      matchedAmount,
      remainingAmount: l.amount.abs().sub(matchedAmount),
      matched: matchedAmount.eq(l.amount.abs()),
    };
  });
  const openingRequests = await tx.o2cControlEvent.findMany({
    where: {
      companyId: c,
      sourceType: "BANK_TRANSACTION",
      kind: "REQUEST",
      id: {
        in: entries
          .filter((e) => e.journal.businessDate < row.startsOn)
          .map((e) => e.journal.sourceId),
      },
    },
  });
  const openings = new Set(
    openingRequests
      .filter((r) => (r.snapshot as { input: { kind: string } }).input.kind === "OPENING")
      .map((r) => r.id),
  );
  const notInBank = entries
    .filter((l) => !openings.has(l.journal.sourceId))
    .map((l) => ({
      id: l.id,
      source_type: l.journal.sourceType,
      source_id: l.journal.sourceId,
      amount: l.debit
        .sub(l.credit)
        .abs()
        .sub(
          matches.filter((m) => m.journalLineId === l.id).reduce((s, m) => s.add(m.amount), d("0")),
        ),
    }))
    .filter((l) => l.amount.gt(0));
  const unmatched = lines.filter((l) => !l.matched),
    difference = book.sub(row.closingBalance),
    control = row.openingBalance
      .add(row.lines.reduce((s, l) => s.add(l.amount), d("0")))
      .sub(row.closingBalance);
  return {
    statement: { ...row, lines },
    book,
    difference,
    control,
    continuity,
    unmatched,
    not_in_bank: notInBank,
    ready:
      continuity && difference.eq(0) && control.eq(0) && !unmatched.length && !notInBank.length,
  };
}

export async function undoBankMatch(c: string, a: string, id: string, input: unknown, key: string) {
  const i = z
    .object({ reason: z.string().trim().min(1).max(1000) })
    .strict()
    .parse(input);
  return transactionCommand(c, a, `finance/bank-matches/${id}/unmatch`, key, i, async (tx) => {
    await lockFinance(tx, c);
    const match = await tx.bankStatementMatch.findFirst({
      where: { companyId: c, id, reversedAt: null },
    });
    if (!match) throw new NotFoundException();
    const line = await tx.bankStatementLine.findUniqueOrThrow({
      where: { id: match.statementLineId },
      include: { statement: true },
    });
    const later = await tx.bankStatement.count({
      where: {
        companyId: c,
        bankAccountId: line.bankAccountId,
        state: "CLOSED",
        endsOn: { gte: line.statement.endsOn },
      },
    });
    if (later) throw new ConflictException("BANK_MATCH_LOCKED_REOPEN_REQUIRED");
    await tx.bankStatementMatch.update({ where: { id }, data: { reversedAt: new Date() } });
    await tx.bankStatement.update({
      where: { id: line.statementId },
      data: { state: "STAGING", version: { increment: 1 }, reviewSnapshot: Prisma.DbNull },
    });
    const event = await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "BANK_MATCH",
        sourceId: id,
        kind: "UNMATCH",
        snapshot: json({ match, reason: i.reason }),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "bank_match.reversed",
      resourceType: "bank_match",
      resourceId: id,
      reason: i.reason,
      after: event,
    });
    return event;
  });
}

export async function reopenStatement(
  c: string,
  a: string,
  id: string,
  input: unknown,
  key: string,
) {
  const i = z
    .object({ reason: z.string().trim().min(1).max(1000), version: z.number().int().positive() })
    .strict()
    .parse(input);
  return transactionCommand(c, a, `finance/statements/${id}/reopen`, key, i, async (tx) => {
    await lockFinance(tx, c);
    const row = await tx.bankStatement.findFirst({ where: { companyId: c, id } });
    if (!row) throw new NotFoundException();
    if (row.state !== "CLOSED" || row.version !== i.version)
      throw new ConflictException("STATEMENT_STATE_OR_VERSION_CHANGED");
    if (
      await tx.bankStatement.count({
        where: {
          companyId: c,
          bankAccountId: row.bankAccountId,
          state: "CLOSED",
          endsOn: { gt: row.endsOn },
        },
      })
    )
      throw new ConflictException("REOPEN_LATER_STATEMENTS_FIRST");
    await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "BANK_STATEMENT",
        sourceId: id,
        kind: "REOPEN",
        snapshot: json({ previous: row, reason: i.reason }),
      },
    });
    const after = await tx.bankStatement.update({
      where: { id },
      data: {
        state: "STAGING",
        version: { increment: 1 },
        closedById: null,
        reviewedById: null,
        reviewSnapshot: Prisma.DbNull,
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "bank_reconciliation.reopened",
      resourceType: "bank_statement",
      resourceId: id,
      reason: i.reason,
      after,
    });
    return after;
  });
}

export async function reviewStatement(
  c: string,
  a: string,
  id: string,
  close: boolean,
  key: string,
) {
  return transactionCommand(
    c,
    a,
    `finance/statements/${id}/${close ? "close" : "review"}`,
    key,
    {},
    async (tx) => {
      await lockFinance(tx, c);
      const result = await statementReview(tx, c, id);
      if (result.statement.state === "CLOSED")
        throw new ConflictException("BANK_RECONCILIATION_CLOSED");
      if (close && (!result.ready || result.statement.state !== "READY"))
        throw new ConflictException("BANK_RECONCILIATION_BLOCKED");
      const after = await tx.bankStatement.update({
        where: { id },
        data: close
          ? { state: "CLOSED", closedById: a, version: { increment: 1 } }
          : {
              state: result.ready ? "READY" : "BLOCKED",
              reviewedById: a,
              reviewSnapshot: json(result),
              version: { increment: 1 },
            },
      });
      await audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: `bank_reconciliation.${close ? "closed" : "reviewed"}`,
        resourceType: "bank_statement",
        resourceId: id,
        after,
      });
      return { ...result, statement: after };
    },
  );
}

export async function reconcileGl(c: string) {
  return prisma.$transaction(async (tx) => {
    await lockFinance(tx, c);
    const ledger = await tx.ledgerEntry.groupBy({
      by: ["kind", "currency"],
      where: { companyId: c },
      _sum: { debit: true, credit: true },
    });
    const gl = await tx.financeJournalLine.findMany({
      where: { companyId: c },
      include: { journal: { select: { currency: true } } },
    });
    const missing = await tx.ledgerEntry.findMany({
      where: { companyId: c, journalId: null },
      select: { id: true, sourceType: true, sourceId: true, kind: true },
    });
    const keys = new Map<string, { kind: string; currency: string }>();
    for (const l of ledger)
      keys.set(`${l.kind}:${l.currency}`, { kind: l.kind, currency: l.currency });
    for (const g of gl)
      keys.set(`${g.ledgerKind}:${g.journal.currency}`, {
        kind: g.ledgerKind,
        currency: g.journal.currency,
      });
    const totals = [...keys.values()].map((l) => {
      const source = ledger.find((x) => x.kind === l.kind && x.currency === l.currency);
      const ledgerAmount = (source?._sum.debit ?? d("0")).sub(source?._sum.credit ?? d("0"));
      const glAmount = gl
        .filter((g) => g.ledgerKind === l.kind && g.journal.currency === l.currency)
        .reduce((sum, g) => sum.add(g.debit).sub(g.credit), d("0"));
      return {
        kind: l.kind,
        currency: l.currency,
        subledger: ledgerAmount,
        gl: glAmount,
        difference: ledgerAmount.sub(glAmount),
      };
    });
    const invoices = await tx.salesInvoice.groupBy({
      by: ["currency"],
      where: { companyId: c, state: "POSTED" },
      _sum: { outstandingAmount: true },
    });
    const arCurrencies = new Set([
      ...invoices.map((i) => i.currency),
      ...totals.filter((t) => t.kind === "AR").map((t) => t.currency),
    ]);
    const ar = [...arCurrencies].map((currency) => {
      const actual =
        invoices.find((i) => i.currency === currency)?._sum.outstandingAmount ?? d("0");
      const balance = totals.find((t) => t.kind === "AR" && t.currency === currency)?.gl ?? d("0");
      return {
        currency,
        open_items: actual,
        gl: balance,
        difference: actual.sub(balance),
      };
    });
    const economic = await reconcileEconomicO2c(tx, c);
    return {
      economic,
      totals,
      ar,
      unmapped_sources: missing,
      balanced:
        economic.balanced &&
        !missing.length &&
        totals.every((t) => t.difference.eq(0)) &&
        ar.every((t) => t.difference.eq(0)),
    };
  });
}

export async function createOfficialTaxDocument(c: string, a: string, input: unknown, key: string) {
  const i = z
    .object({
      source_type: z.enum(["SALES_INVOICE", "ADVANCE_TAX"]),
      source_id: uuid,
      number: z.string().trim().min(1).max(100),
      document_date: date,
      evidence_id: uuid,
    })
    .strict()
    .parse(input);
  return transactionCommand(c, a, "finance/official-tax-documents", key, i, async (tx) => {
    await lockFinance(tx, c);
    await requireEvidence(tx, c, i.evidence_id, "TAX");
    let snapshot: unknown, customerId: string;
    if (i.source_type === "SALES_INVOICE") {
      const invoice = await tx.salesInvoice.findFirst({
        where: { companyId: c, id: i.source_id, state: "POSTED" },
      });
      if (!invoice) throw new NotFoundException();
      customerId = invoice.customerId;
      const tax = await tx.ledgerEntry.aggregate({
        where: {
          companyId: c,
          sourceType: "DELIVERY_RECEIPT",
          sourceId: invoice.deliveryReceiptId!,
          kind: "SALES_TAX",
        },
        _sum: { debit: true, credit: true },
      });
      const remainingTax = (tax._sum.credit ?? d("0")).sub(tax._sum.debit ?? d("0"));
      if (remainingTax.lte(0)) throw new ConflictException("TAX_DOCUMENT_NO_UNDOCUMENTED_TAX");
      snapshot = {
        invoice,
        tax_amount: remainingTax,
        event: "DELIVERY_RECEIPT",
        event_id: invoice.deliveryReceiptId,
      };
    } else {
      const advance = await tx.advanceTax.findFirst({ where: { companyId: c, id: i.source_id } });
      if (!advance) throw new NotFoundException();
      const receipt = await tx.customerReceipt.findFirstOrThrow({
        where: { companyId: c, id: advance.receiptId },
      });
      customerId = receipt.customerId;
      snapshot = {
        advance,
        tax_amount: advance.amount,
        event: "ADVANCE_TAX",
        event_id: advance.id,
      };
    }
    if (
      await tx.officialTaxDocument.count({
        where: {
          companyId: c,
          sourceType: i.source_type,
          sourceId: i.source_id,
          state: { not: "REJECTED" },
        },
      })
    )
      throw new ConflictException("TAX_DOCUMENT_SOURCE_ALREADY_LINKED");
    const row = await tx.officialTaxDocument.create({
      data: {
        companyId: c,
        customerId,
        sourceType: i.source_type,
        sourceId: i.source_id,
        number: i.number,
        documentDate: new Date(i.document_date),
        evidenceId: i.evidence_id,
        createdById: a,
        snapshot: json(snapshot),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "tax_document.recorded",
      resourceType: "tax_document",
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}

export async function verifyOfficialTaxDocument(
  c: string,
  a: string,
  id: string,
  input: unknown,
  key: string,
) {
  const i = z
    .object({
      decision: z.enum(["VERIFIED", "REJECTED"]),
      reason: z.string().trim().min(1).max(1000),
    })
    .strict()
    .parse(input);
  return transactionCommand(
    c,
    a,
    `finance/official-tax-documents/${id}/verify`,
    key,
    i,
    async (tx) => {
      await lockFinance(tx, c);
      const row = await tx.officialTaxDocument.findFirst({ where: { companyId: c, id } });
      if (!row) throw new NotFoundException();
      if (row.state !== "PENDING_VERIFICATION")
        throw new ConflictException("TAX_DOCUMENT_ALREADY_REVIEWED");
      const after = await tx.officialTaxDocument.update({
        where: { id },
        data: { state: i.decision, verifiedById: a, verifiedAt: new Date() },
      });
      await audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "tax_document.verified",
        resourceType: "tax_document",
        resourceId: id,
        before: row,
        after,
        reason: i.reason,
      });
      return after;
    },
  );
}
