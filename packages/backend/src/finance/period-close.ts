import { createHash } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "../common/transaction-command";
import { requireEvidence } from "../sales/document-controls";
import { lockFinance } from "./posting";
import { requestPolicy } from "./remediation";
import { reconcileEconomicO2c } from "./economic-reconciliation";
import { AuditService } from "../common/audit.service";
type Tx = Prisma.TransactionClient;
const areas = [
  "SALES",
  "AR",
  "PURCHASING",
  "BANK",
  "INVENTORY",
  "EXPENSE_ASSET_BUDGET",
  "PAYROLL",
  "TAX",
  "GL",
] as const;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

export async function periodReadiness(tx: Tx, c: string, id: string) {
  const period = await tx.financePeriod.findFirst({ where: { companyId: c, id } });
  if (!period) throw new NotFoundException();
  const economic = await reconcileEconomicO2c(tx, c),
    blockers: string[] = [];
  const currencies = await tx.financeJournal.groupBy({ by: ["currency"], where: { companyId: c } });
  if (currencies.length > 1) blockers.push("MULTICURRENCY_CLOSE_RECONCILIATION_REQUIRED");
  if (!economic.balanced) blockers.push("ECONOMIC_SUBLEDGER_DIFFERENCE");
  const unmatched = await tx.ledgerEntry.count({ where: { companyId: c, journalId: null } });
  if (unmatched) blockers.push("UNMAPPED_LEGACY_LEDGER");
  const openAr =
    (
      await tx.salesInvoice.aggregate({
        where: { companyId: c, state: "POSTED" },
        _sum: { outstandingAmount: true },
      })
    )._sum.outstandingAmount ?? new Prisma.Decimal(0);
  const ar = await tx.ledgerEntry.aggregate({
    where: { companyId: c, kind: "AR" },
    _sum: { debit: true, credit: true },
  });
  if (
    !openAr.eq(
      (ar._sum.debit ?? new Prisma.Decimal(0)).sub(ar._sum.credit ?? new Prisma.Decimal(0)),
    )
  )
    blockers.push("AR_OPEN_ITEM_DIFFERENCE");
  const openAp =
    (
      await tx.payableOpenItem.aggregate({
        where: { companyId: c },
        _sum: { outstandingAmount: true },
      })
    )._sum.outstandingAmount ?? new Prisma.Decimal(0);
  const ap = await tx.ledgerEntry.aggregate({
    where: { companyId: c, kind: "AP" },
    _sum: { debit: true, credit: true },
  });
  if (
    !openAp.eq(
      (ap._sum.credit ?? new Prisma.Decimal(0)).sub(ap._sum.debit ?? new Prisma.Decimal(0)),
    )
  )
    blockers.push("AP_OPEN_ITEM_DIFFERENCE");
  if (
    await tx.salesInvoice.count({
      where: { companyId: c, state: "ISSUED_WAITING_POD", createdAt: { lte: period.endsOn } },
    })
  )
    blockers.push("INVOICE_WAITING_POD");
  if (
    await tx.deliveryReceipt.count({
      where: {
        companyId: c,
        acceptedAt: { lte: period.endsOn },
        acceptedQuantity: { gt: 0 },
        invoices: { none: { state: "POSTED" } },
      },
    })
  )
    blockers.push("POD_NOT_INVOICED");
  if (
    await tx.salesExceptionEvaluation.count({
      where: { companyId: c, state: { in: ["PENDING", "PROCESSING", "BLOCKED"] } },
    })
  )
    blockers.push("O2C_JOBS_PENDING_OR_BLOCKED");
  if (
    await tx.officialTaxDocument.count({
      where: { companyId: c, state: "PENDING_VERIFICATION", documentDate: { lte: period.endsOn } },
    })
  )
    blockers.push("TAX_VERIFICATION_PENDING");
  const banks = await tx.financeBankAccount.findMany({ where: { companyId: c, active: true } });
  for (const bank of banks)
    if (
      !(await tx.bankStatement.count({
        where: { companyId: c, bankAccountId: bank.id, state: "CLOSED", endsOn: period.endsOn },
      }))
    )
      blockers.push(`BANK_NOT_CLOSED:${bank.id}`);
  // Current economic projections cannot silently stand in for an historical cutoff.
  if (
    await tx.financeJournal.count({ where: { companyId: c, businessDate: { gt: period.endsOn } } })
  )
    blockers.push("HISTORICAL_CUTOFF_RECONCILIATION_REQUIRED");
  const journals = await tx.financeJournal.findMany({
    where: { companyId: c, businessDate: { lte: period.endsOn } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return {
    period,
    economic,
    blockers,
    journal_ids: journals.map((j) => j.id),
    ready: !blockers.length,
  };
}

export async function requestPeriodAction(
  c: string,
  a: string,
  id: string,
  body: unknown,
  key: string,
) {
  const input = z
    .object({
      action: z.enum(["CLOSE", "REOPEN"]),
      version: z.number().int().positive(),
      reason: z.string().trim().min(1).max(1000),
      evidence: z
        .array(
          z
            .object({
              area: z.enum(areas),
              evidence_id: z.string().uuid(),
              conclusion: z.string().trim().min(1).max(2000),
            })
            .strict(),
        )
        .min(1)
        .max(9),
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, `finance/periods/${id}/request`, key, input, async (tx) => {
    await lockFinance(tx, c);
    const period = await tx.financePeriod.findFirst({ where: { companyId: c, id } });
    if (!period) throw new NotFoundException();
    if (
      period.version !== input.version ||
      period.state !== (input.action === "CLOSE" ? "OPEN" : "CLOSED")
    )
      throw new ConflictException("PERIOD_STATE_OR_VERSION_CHANGED");
    if (new Set(input.evidence.map((e) => e.area)).size !== input.evidence.length)
      throw new ConflictException("DUPLICATE_CLOSE_EVIDENCE");
    if (
      input.action === "CLOSE" &&
      areas.some((area) => !input.evidence.some((e) => e.area === area))
    )
      throw new ConflictException("COMPLETE_CLOSE_CHECKLIST_REQUIRED");
    for (const e of input.evidence)
      await requireEvidence(tx, c, e.evidence_id, e.area === "TAX" ? "TAX" : "PAYMENT");
    const report = input.action === "CLOSE" ? await periodReadiness(tx, c, id) : null;
    if (report && !report.ready)
      throw new ConflictException({ code: "FINANCE_CLOSE_BLOCKED", blockers: report.blockers });
    const company = await tx.company.findUniqueOrThrow({ where: { id: c } }),
      policy = await requestPolicy(
        tx,
        c,
        a,
        "FINANCE_CLOSE",
        company.baseCurrency,
        new Prisma.Decimal(0),
      );
    const row = await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "FINANCE_CLOSE",
        sourceId: id,
        kind: "REQUEST",
        snapshot: json({ input, policy, report, report_hash: report ? digest(report) : null }),
      },
    });
    await new AuditService().recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "period.action_requested",
      resourceType: "finance_period",
      resourceId: id,
      after: row,
    });
    return row;
  });
}

export async function postPeriodAction(c: string, a: string, id: string, key: string) {
  return transactionCommand(c, a, `finance/period-actions/${id}/post`, key, { id }, async (tx) => {
    await lockFinance(tx, c);
    const request = await tx.o2cControlEvent.findFirst({
      where: { companyId: c, id, sourceType: "FINANCE_CLOSE", kind: "REQUEST" },
    });
    if (!request) throw new NotFoundException();
    const s = request.snapshot as {
      input: { action: string; version: number };
      report_hash: string;
    };
    const period = await tx.financePeriod.findFirstOrThrow({
      where: { companyId: c, id: request.sourceId },
    });
    if (
      period.version !== s.input.version ||
      period.state !== (s.input.action === "CLOSE" ? "OPEN" : "CLOSED")
    )
      throw new ConflictException("PERIOD_STATE_OR_VERSION_CHANGED");
    if (
      !(await tx.o2cControlEvent.count({ where: { companyId: c, sourceId: id, kind: "APPROVED" } }))
    )
      throw new ConflictException("APPROVAL_REQUIRED");
    if (s.input.action === "CLOSE") {
      const report = await periodReadiness(tx, c, period.id);
      if (!report.ready || digest(report) !== s.report_hash)
        throw new ConflictException("CLOSE_REPORT_CHANGED_REVIEW_AGAIN");
    }
    const after = await tx.financePeriod.update({
      where: { id: period.id },
      data: { state: s.input.action === "CLOSE" ? "CLOSED" : "OPEN", version: { increment: 1 } },
    });
    await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "FINANCE_CLOSE",
        sourceId: id,
        kind: "POSTED",
        snapshot: json({ before: period, after }),
      },
    });
    await new AuditService().recordWith(tx, {
      companyId: c,
      actorId: a,
      action: `period.${s.input.action.toLowerCase()}`,
      resourceType: "finance_period",
      resourceId: period.id,
      before: period,
      after,
    });
    return after;
  });
}
