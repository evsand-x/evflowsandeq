import { ConflictException, NotFoundException } from "@nestjs/common";
import { numberingDefaults, prisma, type Prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "./transaction-command";
import { AuditService } from "./audit.service";

export type YearFormat = "YYYY" | "YY";
export type ResetPeriod = "YEARLY" | "MONTHLY";
type FormatRule = { prefix: string; yearFormat: YearFormat; digits: number };

function dayOf(timezone: string, at: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Counter key: one counter per year, or per calendar month when the rule resets monthly. */
export function sequenceKey(kind: string, resetPeriod: ResetPeriod, day: string) {
  return resetPeriod === "MONTHLY" ? `${kind}:${day.slice(0, 7)}` : `${kind}:${day.slice(0, 4)}`;
}

export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  c: string,
  kind: string,
  at: Date = new Date(),
) {
  const company = await tx.company.findUniqueOrThrow({ where: { id: c } }),
    day = dayOf(company.timezone, at);
  const rules = await tx.documentNumberRule.findMany({
    where: {
      companyId: c,
      documentKind: kind,
      effectiveFrom: { lte: new Date(day) },
      effectiveTo: { gt: new Date(day) },
    },
  });
  if (rules.length !== 1)
    throw new ConflictException(`NUMBERING_RULE_REQUIRED_OR_CONFLICTING:${kind}`);
  const rule = rules[0]!,
    entity = sequenceKey(kind, rule.resetPeriod as ResetPeriod, day);
  const seq = await tx.masterCodeSequence.upsert({
    where: { companyId_entityType: { companyId: c, entityType: entity } },
    create: { companyId: c, entityType: entity, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return formatDocumentNumber(rule as FormatRule, day, seq.nextValue - 1n);
}

/** `Prefix.Year.Month.Sequence`; `day` is the company-timezone date (YYYY-MM-DD). */
export function formatDocumentNumber(rule: FormatRule, day: string, value: bigint) {
  const digits = value.toString();
  if (digits.length > rule.digits) throw new ConflictException("DOCUMENT_NUMBER_EXHAUSTED");
  const year = rule.yearFormat === "YY" ? day.slice(2, 4) : day.slice(0, 4);
  return `${rule.prefix}.${year}.${day.slice(5, 7)}.${digits.padStart(rule.digits, "0")}`;
}

export async function configureNumbering(c: string, a: string, body: unknown, key: string) {
  const i = z
    .object({
      document_kind: z
        .string()
        .regex(/^[a-zA-Z_]+$/)
        .max(100),
      prefix: z.string().trim().min(1).max(40),
      digits: z.number().int().min(1).max(18),
      year_format: z.enum(["YYYY", "YY"]).default("YYYY"),
      reset_period: z.enum(["YEARLY", "MONTHLY"]).default("YEARLY"),
      effective_from: z.string().date(),
      effective_to: z.string().date(),
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, "numbering-rules", key, i, async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${c}::uuid FOR UPDATE`;
    const from = new Date(i.effective_from),
      to = new Date(i.effective_to);
    if (
      to <= from ||
      (await tx.documentNumberRule.count({
        where: {
          companyId: c,
          documentKind: i.document_kind,
          effectiveFrom: { lt: to },
          effectiveTo: { gt: from },
        },
      }))
    )
      throw new ConflictException("NUMBERING_RULE_DATES_OR_OVERLAP");
    const row = await tx.documentNumberRule.create({
      data: {
        companyId: c,
        documentKind: i.document_kind,
        prefix: i.prefix,
        digits: i.digits,
        yearFormat: i.year_format,
        resetPeriod: i.reset_period,
        effectiveFrom: from,
        effectiveTo: to,
        createdById: a,
      },
    });
    await new AuditService().recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "numbering_rule.created",
      resourceType: "numbering_rule",
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}

const openEnded = new Date("2999-12-31");
export const numberingRevisionSchema = z
  .object({
    prefix: z
      .string()
      .trim()
      .regex(/^[A-Z0-9/._-]{1,20}$/),
    year_format: z.enum(["YYYY", "YY"]),
    digits: z.number().int().min(3).max(10),
    reset_period: z.enum(["YEARLY", "MONTHLY"]),
  })
  .strict();

async function companyDay(client: Pick<Prisma.TransactionClient, "company">, c: string) {
  const company = await client.company.findUniqueOrThrow({ where: { id: c } });
  return dayOf(company.timezone, new Date());
}

/** Start of the target period (next month for MONTHLY, next 1 January for YEARLY) in the company timezone. */
function nextPeriodStart(resetPeriod: ResetPeriod, day: string) {
  const y = Number(day.slice(0, 4)),
    m = Number(day.slice(5, 7));
  if (resetPeriod === "YEARLY" || m === 12) return `${y + 1}-01-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function numberingDefault(kind: string) {
  const entry = numberingDefaults.find((d) => d.document_kind === kind);
  if (!entry) throw new NotFoundException("Jenis dokumen tidak dikenal.");
  return entry;
}

/**
 * Prefix, year format and length apply from today and the running counter continues (IAM-06).
 * A reset-period change waits for the start of the next period so a month never gets two counters.
 */
export async function reviseNumbering(
  c: string,
  a: string,
  kind: string,
  body: unknown,
  key: string,
) {
  numberingDefault(kind);
  const i = numberingRevisionSchema.parse(body);
  return transactionCommand(c, a, `settings/numbering/${kind}`, key, i, async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${c}::uuid FOR UPDATE`;
    const day = await companyDay(tx, c),
      today = new Date(day);
    const open = await tx.documentNumberRule.findMany({
      where: { companyId: c, documentKind: kind, effectiveTo: { gt: today } },
    });
    const active = open.filter((r) => r.effectiveFrom <= today);
    const scheduled = open.filter((r) => r.effectiveFrom > today);
    const current = active.length === 1 ? active[0]! : null;
    const currentPeriod = (current?.resetPeriod ?? i.reset_period) as ResetPeriod;
    const counter = await tx.masterCodeSequence.findUnique({
      where: {
        companyId_entityType: { companyId: c, entityType: sequenceKey(kind, currentPeriod, day) },
      },
    });
    if (String(counter?.nextValue ?? 1n).length > i.digits)
      throw new ConflictException("NUMBERING_DIGITS_TOO_SHORT");
    // A scheduled reset change to the same target period is kept; any other one is replaced.
    const kept = scheduled.find(
      (r) => r.resetPeriod === i.reset_period && r.resetPeriod !== currentPeriod,
    );
    const dropped = scheduled.filter((r) => r !== kept);
    if (dropped.length)
      await tx.documentNumberRule.deleteMany({ where: { id: { in: dropped.map((r) => r.id) } } });
    const data = {
      prefix: i.prefix,
      yearFormat: i.year_format,
      digits: i.digits,
      resetPeriod: currentPeriod,
    };
    const changed =
      !current ||
      current.prefix !== i.prefix ||
      current.yearFormat !== i.year_format ||
      current.digits !== i.digits;
    let row = current;
    if (!row || changed) {
      if (row && row.effectiveFrom.getTime() === today.getTime()) {
        row = await tx.documentNumberRule.update({
          where: { id: row.id },
          data: { ...data, effectiveTo: openEnded },
        });
      } else {
        for (const rule of active)
          await tx.documentNumberRule.update({
            where: { id: rule.id },
            data: { effectiveTo: today },
          });
        row = await tx.documentNumberRule.create({
          data: {
            companyId: c,
            documentKind: kind,
            ...data,
            effectiveFrom: today,
            effectiveTo: openEnded,
            createdById: a,
          },
        });
      }
    } else if (row.effectiveTo.getTime() !== openEnded.getTime()) {
      row = await tx.documentNumberRule.update({
        where: { id: row.id },
        data: { effectiveTo: openEnded },
      });
    }
    let result = row;
    if (row.resetPeriod !== i.reset_period) {
      const from = kept?.effectiveFrom ?? new Date(nextPeriodStart(i.reset_period, day));
      await tx.documentNumberRule.update({ where: { id: row.id }, data: { effectiveTo: from } });
      const pending = { ...data, resetPeriod: i.reset_period };
      result = kept
        ? await tx.documentNumberRule.update({ where: { id: kept.id }, data: pending })
        : await tx.documentNumberRule.create({
            data: {
              companyId: c,
              documentKind: kind,
              ...pending,
              effectiveFrom: from,
              effectiveTo: openEnded,
              createdById: a,
            },
          });
    }
    await new AuditService().recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "numbering_rule.revised",
      resourceType: "numbering_rule",
      resourceId: result.id,
      before: open,
      after: result,
    });
    return { ...result, effective_from: result.effectiveFrom.toISOString().slice(0, 10) };
  });
}

/** Active rule, scheduled reset change and next-number preview per known document kind; reading takes no number. */
export async function listNumberingSettings(c: string) {
  const day = await companyDay(prisma, c),
    today = new Date(day);
  const rules = await prisma.documentNumberRule.findMany({
    where: { companyId: c, effectiveTo: { gt: today } },
    orderBy: { effectiveFrom: "asc" },
  });
  return Promise.all(
    numberingDefaults.map(async (d) => {
      const base = { document_kind: d.document_kind, label: d.label };
      const ofKind = rules.filter((r) => r.documentKind === d.document_kind);
      const rule = ofKind.find((r) => r.effectiveFrom <= today);
      if (!rule)
        return {
          ...base,
          prefix: null,
          year_format: null,
          digits: null,
          reset_period: null,
          effective_from: null,
          next_preview: null,
          pending: null,
          active: false,
        };
      const later = ofKind.find((r) => r.effectiveFrom > today);
      const seq = await prisma.masterCodeSequence.findUnique({
        where: {
          companyId_entityType: {
            companyId: c,
            entityType: sequenceKey(d.document_kind, rule.resetPeriod as ResetPeriod, day),
          },
        },
      });
      let next_preview: string | null = null;
      try {
        next_preview = formatDocumentNumber(rule as FormatRule, day, seq?.nextValue ?? 1n);
      } catch {
        next_preview = null;
      }
      return {
        ...base,
        prefix: rule.prefix,
        year_format: rule.yearFormat,
        digits: rule.digits,
        reset_period: rule.resetPeriod,
        effective_from: rule.effectiveFrom.toISOString().slice(0, 10),
        next_preview,
        pending: later
          ? {
              prefix: later.prefix,
              year_format: later.yearFormat,
              digits: later.digits,
              reset_period: later.resetPeriod,
              effective_from: later.effectiveFrom.toISOString().slice(0, 10),
            }
          : null,
        active: true,
      };
    }),
  );
}
