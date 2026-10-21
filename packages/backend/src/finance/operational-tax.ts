import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";
import { requireEvidence } from "../sales/document-controls";

export const taxInput = z
  .object({
    name: z.string().trim().min(1).max(150),
    kind: z.enum(["PPN", "PPH"]),
    usage: z.enum(["SALES", "PURCHASE", "BOTH"]).optional(),
    effect: z.enum(["ADD", "DEDUCT"]),
    account_id: z.string().uuid(),
    percentage: z
      .string()
      .regex(/^\d{1,3}(\.\d{1,8})?$/)
      .refine((v) => new Prisma.Decimal(v).lte(100)),
    decimal_places: z.number().int().min(0).max(8),
    rounding: z.enum(["HALF_UP", "HALF_EVEN", "DOWN"]),
    active: z.boolean(),
    effective_from: z.string().datetime(),
  })
  .strict();
export function parsed<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function saveTax(
  c: string,
  actor: string,
  input: unknown,
  key: string,
  id?: string,
  version?: number,
) {
  const data = parsed(taxInput, input);
  return transactionCommand(
    c,
    actor,
    `tax/master/${id ?? "new"}`,
    key,
    { data, version },
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${c}::uuid FOR UPDATE`;
      if (new Date(data.effective_from) > new Date())
        throw new ConflictException("TAX_FUTURE_EFFECTIVE_DATE_UNSUPPORTED");
      const before = id ? await tx.operationalTax.findFirst({ where: { id, companyId: c } }) : null;
      if (id && !before) throw new NotFoundException();
      if (before && before.version !== version) throw new ConflictException("TAX_VERSION_CONFLICT");
      if (before && new Date(data.effective_from) < before.effectiveFrom)
        throw new ConflictException("TAX_EFFECTIVE_DATE_ORDER");
      if (
        !(await tx.financeAccount.findFirst({
          where: { id: data.account_id, companyId: c, active: true, accountType: "DETAIL" },
        }))
      )
        throw new ConflictException("TAX_ACCOUNT_INVALID");
      if (
        await tx.operationalTax.findFirst({
          where: {
            companyId: c,
            name: { equals: data.name, mode: "insensitive" },
            ...(id ? { id: { not: id } } : {}),
          },
        })
      )
        throw new ConflictException("TAX_NAME_EXISTS");
      const values = {
        companyId: c,
        name: data.name,
        kind: data.kind,
        usage: data.usage ?? before?.usage ?? "BOTH",
        effect: data.effect,
        accountId: data.account_id,
        percentage: new Prisma.Decimal(data.percentage),
        decimalPlaces: data.decimal_places,
        rounding: data.rounding,
        active: data.active,
        effectiveFrom: new Date(data.effective_from),
        version: (before?.version ?? 0) + 1,
      };
      const row = id
        ? await tx.operationalTax.update({ where: { id }, data: values })
        : await tx.operationalTax.create({ data: values });
      await tx.operationalTaxRevision.create({
        data: {
          companyId: c,
          taxId: row.id,
          version: row.version,
          snapshot: json(row),
          actorId: actor,
        },
      });
      await new AuditService().recordWith(tx, {
        companyId: c,
        actorId: actor,
        action: before ? "operational_tax.updated" : "operational_tax.created",
        resourceType: "operational_tax",
        resourceId: row.id,
        ...(before ? { before: json(before) } : {}),
        after: json(row),
      });
      return row;
    },
  );
}

export async function operationalTaxSnapshot(
  tx: Prisma.TransactionClient,
  c: string,
  id: string,
  at = new Date(),
  usage?: "SALES" | "PURCHASE",
) {
  const current = await tx.operationalTax.findFirst({
    where: { id, companyId: c },
  });
  if (!current) throw new ConflictException("TAX_NOT_EFFECTIVE");
  const revisions = await tx.operationalTaxRevision.findMany({
    where: { taxId: id, companyId: c },
    orderBy: { version: "desc" },
  });
  const historical = revisions
    .map((revision) => revision.snapshot as unknown as typeof current)
    .find((revision) => new Date(revision.effectiveFrom) <= at);
  if (!historical?.active) throw new ConflictException("TAX_NOT_EFFECTIVE");
  if (usage && historical.usage && historical.usage !== "BOTH" && historical.usage !== usage)
    throw new ConflictException("TAX_USAGE_MISMATCH");
  const row = { ...historical, percentage: new Prisma.Decimal(historical.percentage.toString()) };
  const account = await tx.financeAccount.findFirst({
    where: { id: row.accountId, companyId: c, active: true, accountType: "DETAIL" },
  });
  if (!account) throw new ConflictException("TAX_ACCOUNT_INVALID");
  return {
    rule_id: row.id,
    version: row.version,
    name: row.name,
    kind: row.kind,
    usage: row.usage ?? "BOTH",
    effect: row.effect,
    account_id: account.id,
    account_code: account.code,
    rate: row.percentage.div(100).toString(),
    percentage: row.percentage.toString(),
    dpp_factor: "1",
    decimal_places: row.decimalPlaces,
    rounding: row.rounding as "HALF_UP" | "HALF_EVEN" | "DOWN",
    taxable_event: "POD",
    legal_reference: "Master pajak operasional",
  };
}
export function calculateOperationalTax(
  base: string | Prisma.Decimal,
  snapshot: { rate: string; effect: string; decimal_places: number; rounding: string },
) {
  const rounding = {
    HALF_UP: Prisma.Decimal.ROUND_HALF_UP,
    HALF_EVEN: Prisma.Decimal.ROUND_HALF_EVEN,
    DOWN: Prisma.Decimal.ROUND_DOWN,
  }[snapshot.rounding];
  if (rounding === undefined) throw new ConflictException("TAX_ROUNDING_REQUIRED");
  const amount = new Prisma.Decimal(base)
    .mul(snapshot.rate)
    .toDecimalPlaces(snapshot.decimal_places, rounding);
  return snapshot.effect === "DEDUCT" ? amount.neg() : amount;
}

export async function recordTaxInvoice(
  c: string,
  actor: string,
  direction: "OUTPUT" | "INPUT",
  sourceId: string,
  input: unknown,
  key: string,
) {
  const data = parsed(
    z
      .object({
        number: z.string().trim().min(1).max(100),
        document_date: z.string().date(),
        evidence_id: z.string().uuid(),
        version: z.number().int().min(0),
      })
      .strict(),
    input,
  );
  return transactionCommand(c, actor, `tax/${direction}/${sourceId}`, key, data, async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${c}::uuid FOR UPDATE`;
    const source =
      direction === "OUTPUT"
        ? await tx.salesInvoice.findFirst({ where: { id: sourceId, companyId: c } })
        : await tx.supplierInvoice.findFirst({ where: { id: sourceId, companyId: c } });
    if (!source) throw new NotFoundException();
    if (source.state !== "POSTED") throw new ConflictException("TAX_SOURCE_NOT_POSTED");
    const legacy =
      direction === "OUTPUT"
        ? await tx.officialTaxDocument.findFirst({
            where: {
              companyId: c,
              sourceType: "SALES_INVOICE",
              sourceId,
              evidenceId: data.evidence_id,
            },
          })
        : null;
    if (!legacy) await requireEvidence(tx, c, data.evidence_id, `TAX_${direction}`);
    const partyId = "customerId" in source ? source.customerId : source.supplierId;
    const before = await tx.operationalTaxInvoice.findUnique({
      where: { companyId_direction_sourceId: { companyId: c, direction, sourceId } },
    });
    if ((before?.version ?? 0) !== data.version)
      throw new ConflictException("TAX_VERSION_CONFLICT");
    const duplicate = await tx.operationalTaxInvoice.findFirst({
      where: { companyId: c, direction, partyId, number: data.number, sourceId: { not: sourceId } },
    });
    if (duplicate) throw new ConflictException("TAX_INVOICE_NUMBER_EXISTS");
    if (
      direction === "OUTPUT" &&
      (await tx.officialTaxDocument.findFirst({
        where: { companyId: c, number: data.number, sourceId: { not: sourceId } },
      }))
    )
      throw new ConflictException("TAX_INVOICE_NUMBER_EXISTS");
    const values = {
      companyId: c,
      direction,
      sourceId,
      partyId,
      number: data.number,
      documentDate: new Date(data.document_date),
      evidenceId: data.evidence_id,
      version: data.version + 1,
    };
    const row = before
      ? await tx.operationalTaxInvoice.update({ where: { id: before.id }, data: values })
      : await tx.operationalTaxInvoice.create({ data: values });
    await new AuditService().recordWith(tx, {
      companyId: c,
      actorId: actor,
      action: "tax_invoice.recorded",
      resourceType: "tax_invoice",
      resourceId: row.id,
      ...(before ? { before: json(before) } : {}),
      after: json(row),
    });
    return row;
  });
}
