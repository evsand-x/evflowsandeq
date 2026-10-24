import { numberingDefaults, operationalPolicyCatalog, type Prisma } from "@evflow/database";
import { AuditService } from "../common/audit.service";

export { numberingDefaults };

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

/** Creates missing editable defaults (policies, numbering rules); never changes existing ones. */
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
  if (policies_created.length || numbering_created.length)
    await new AuditService().recordWith(tx, {
      companyId,
      actorId,
      action: "company_defaults.provisioned",
      resourceType: "company",
      resourceId: companyId,
      after: { policies_created, numbering_created },
    });
  return { policies_created, numbering_created };
}
