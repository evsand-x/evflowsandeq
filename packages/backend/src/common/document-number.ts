import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@evflow/database";
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
  const value = (seq.nextValue - 1n).toString();
  if (value.length > rule.digits) throw new ConflictException("DOCUMENT_NUMBER_EXHAUSTED");
  return `${rule.prefix}${rule.resetYearly ? `${year}-` : ""}${value.padStart(rule.digits, "0")}`;
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
