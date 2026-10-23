import { ConflictException, NotFoundException } from "@nestjs/common";
import { numberingDefaults, prisma, type Prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "./transaction-command";
import { AuditService } from "./audit.service";
export async function nextDocumentNumber(tx: Prisma.TransactionClient, c: string, kind: string) {
  const company = await tx.company.findUniqueOrThrow({ where: { id: c } }),
    day = new Intl.DateTimeFormat("en-CA", {
      timeZone: company.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
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
    year = day.slice(0, 4),
    entity = rule.resetYearly ? `${kind}:${year}` : kind;
  const seq = await tx.masterCodeSequence.upsert({
    where: { companyId_entityType: { companyId: c, entityType: entity } },
    create: { companyId: c, entityType: entity, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
  });
  return formatDocumentNumber(rule, year, seq.nextValue - 1n);
}

export function formatDocumentNumber(
  rule: { prefix: string; digits: number; resetYearly: boolean },
  year: string,
  value: bigint,
) {
  const digits = value.toString();
  if (digits.length > rule.digits) throw new ConflictException("DOCUMENT_NUMBER_EXHAUSTED");
  return `${rule.prefix}${rule.resetYearly ? `${year}-` : ""}${digits.padStart(rule.digits, "0")}`;
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
      reset_yearly: z.boolean(),
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
        resetYearly: i.reset_yearly,
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
    digits: z.number().int().min(3).max(10),
    reset_yearly: z.boolean(),
  })
  .strict();

async function companyDay(client: Pick<Prisma.TransactionClient, "company">, c: string) {
  const company = await client.company.findUniqueOrThrow({ where: { id: c } });
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function numberingDefault(kind: string) {
  const entry = numberingDefaults.find((d) => d.document_kind === kind);
  if (!entry) throw new NotFoundException("Jenis dokumen tidak dikenal.");
  return entry;
}

/** New format from today; the running counter continues and issued numbers stay as they are (IAM-06). */
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
    const today = new Date(await companyDay(tx, c));
    const active = await tx.documentNumberRule.findMany({
      where: {
        companyId: c,
        documentKind: kind,
        effectiveFrom: { lte: today },
        effectiveTo: { gt: today },
      },
    });
    const data = { prefix: i.prefix, digits: i.digits, resetYearly: i.reset_yearly };
    const sameDay = active.length === 1 && active[0]!.effectiveFrom.getTime() === today.getTime();
    let row;
    if (sameDay) {
      row = await tx.documentNumberRule.update({ where: { id: active[0]!.id }, data });
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
    await new AuditService().recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "numbering_rule.revised",
      resourceType: "numbering_rule",
      resourceId: row.id,
      before: active,
      after: row,
    });
    return row;
  });
}

/** Active rule and next-number preview per known document kind; reading takes no number. */
export async function listNumberingSettings(c: string) {
  const day = await companyDay(prisma, c),
    today = new Date(day),
    year = day.slice(0, 4);
  const rules = await prisma.documentNumberRule.findMany({
    where: { companyId: c, effectiveFrom: { lte: today }, effectiveTo: { gt: today } },
  });
  return Promise.all(
    numberingDefaults.map(async (d) => {
      const base = { document_kind: d.document_kind, label: d.label };
      const rule = rules.find((r) => r.documentKind === d.document_kind);
      if (!rule)
        return {
          ...base,
          prefix: null,
          digits: null,
          reset_yearly: null,
          effective_from: null,
          next_preview: null,
          active: false,
        };
      const seq = await prisma.masterCodeSequence.findUnique({
        where: {
          companyId_entityType: {
            companyId: c,
            entityType: rule.resetYearly ? `${d.document_kind}:${year}` : d.document_kind,
          },
        },
      });
      let next_preview: string | null = null;
      try {
        next_preview = formatDocumentNumber(rule, year, seq?.nextValue ?? 1n);
      } catch {
        next_preview = null;
      }
      return {
        ...base,
        prefix: rule.prefix,
        digits: rule.digits,
        reset_yearly: rule.resetYearly,
        effective_from: rule.effectiveFrom.toISOString().slice(0, 10),
        next_preview,
        active: true,
      };
    }),
  );
}
