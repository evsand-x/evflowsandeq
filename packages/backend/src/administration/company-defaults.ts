import {
  deductionTypeDefaults,
  numberingDefaults,
  operationalPolicyCatalog,
  taxDefaults,
  Prisma,
} from "@evflow/database";
import { AuditService } from "../common/audit.service";

export { numberingDefaults };

/** Policies outside the catalog (removed from the product) stay stored for audit but are never shown or served. */
export const catalogPolicyCodes: string[] = operationalPolicyCatalog.map((policy) => policy.code);

const openEnded = new Date("2999-12-31");

function companyDay(timezone: string, at: Date) {
  return new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at),
  );
}

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/**
 * Creates missing editable defaults (policies, numbering rules, default taxes, deduction types); never changes
 * existing ones. A default tax whose account is not in the imported chart is skipped, so the
 * documents that need it stay blocked until the tax is set in Setting > Pajak.
 */
export async function provisionCompanyDefaults(
  tx: Prisma.TransactionClient,
  companyId: string,
  actorId: string,
  today = new Date(),
) {
  await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
  const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
  const day = companyDay(company.timezone, today);
  const policies_created: string[] = [];
  for (const definition of operationalPolicyCatalog) {
    const metadata = {
      name: definition.name,
      ownerDomain: definition.domain,
      policyGroup: definition.group,
      scope: "company",
      valueType: definition.type,
      unit: definition.unit ?? null,
      validationSchema: definition.schema as Prisma.InputJsonValue,
      defaultValueSnapshot: definition.default as Prisma.InputJsonValue,
    };
    const policy = await tx.systemPolicy.upsert({
      where: { companyId_code: { companyId, code: definition.code } },
      update: metadata,
      create: { companyId, code: definition.code, ...metadata },
    });
    if (await tx.policyVersion.count({ where: { policyId: policy.id } })) continue;
    await tx.policyVersion.create({
      data: {
        policyId: policy.id,
        versionNo: 1,
        valueSnapshot: definition.default as Prisma.InputJsonValue,
        state: "ACTIVE",
        savedById: actorId,
      },
    });
    policies_created.push(definition.code);
  }
  const numbering_created: string[] = [];
  for (const rule of numberingDefaults) {
    const active = await tx.documentNumberRule.count({
      where: {
        companyId,
        documentKind: rule.document_kind,
        effectiveFrom: { lte: day },
        effectiveTo: { gt: day },
      },
    });
    if (active) continue;
    await tx.documentNumberRule.create({
      data: {
        companyId,
        documentKind: rule.document_kind,
        prefix: rule.prefix,
        digits: rule.digits,
        yearFormat: rule.year_format,
        resetPeriod: rule.reset_period,
        effectiveFrom: day,
        effectiveTo: openEnded,
        createdById: actorId,
      },
    });
    numbering_created.push(rule.document_kind);
  }
  const taxes_created: string[] = [];
  for (const definition of taxDefaults) {
    const column = definition.default_for === "SALES" ? "isDefaultSales" : "isDefaultPurchase";
    const existing = await tx.operationalTax.count({
      where: { companyId, name: { equals: definition.name, mode: "insensitive" } },
    });
    if (existing) continue;
    const account = await tx.financeAccount.findFirst({
      where: { companyId, code: definition.account_code, active: true, accountType: "DETAIL" },
    });
    if (!account) continue;
    const hasDefault =
      definition.default_for !== null &&
      (await tx.operationalTax.count({ where: { companyId, [column]: true } })) > 0;
    const row = await tx.operationalTax.create({
      data: {
        companyId,
        name: definition.name,
        kind: definition.kind,
        usage: definition.usage,
        effect: definition.effect,
        accountId: account.id,
        percentage: new Prisma.Decimal(definition.percentage),
        dppFactor: new Prisma.Decimal(definition.dpp_factor),
        decimalPlaces: definition.decimal_places,
        rounding: definition.rounding,
        active: true,
        effectiveFrom: today,
        ...(definition.default_for && !hasDefault ? { [column]: true } : {}),
      },
    });
    await tx.operationalTaxRevision.create({
      data: { companyId, taxId: row.id, version: row.version, snapshot: json(row), actorId },
    });
    taxes_created.push(definition.name);
  }
  const deduction_types_created: string[] = [];
  for (const definition of deductionTypeDefaults) {
    const existing = await tx.deductionType.count({
      where: { companyId, name: { equals: definition.name, mode: "insensitive" } },
    });
    if (existing) continue;
    const account = await tx.financeAccount.findFirst({
      where: { companyId, code: definition.account_code, active: true, accountType: "DETAIL" },
    });
    if (!account) continue;
    await tx.deductionType.create({
      data: {
        companyId,
        name: definition.name,
        settleAccountId: account.id,
        proofType: definition.proof_type,
        proofRequired: definition.proof_required,
      },
    });
    deduction_types_created.push(definition.name);
  }
  if (
    policies_created.length ||
    numbering_created.length ||
    taxes_created.length ||
    deduction_types_created.length
  )
    await new AuditService().recordWith(tx, {
      companyId,
      actorId,
      action: "company_defaults.provisioned",
      resourceType: "company",
      resourceId: companyId,
      after: { policies_created, numbering_created, taxes_created, deduction_types_created },
    });
  return { policies_created, numbering_created, taxes_created, deduction_types_created };
}
