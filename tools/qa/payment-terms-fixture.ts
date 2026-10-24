import { operationalPolicyCatalog, type Prisma } from "@evflow/database";

type Db = Pick<Prisma.TransactionClient, "systemPolicy" | "policyVersion">;

/**
 * Test/QA companies only: makes sure the company has an active OPS-FLX-03 term list (the catalog
 * default, as provisioning would create it) so customer default terms can be resolved.
 */
export async function ensureTestTermList(db: Db, companyId: string, actorId: string) {
  const definition = operationalPolicyCatalog.find((p) => p.code === "OPS-FLX-03");
  if (!definition) throw new Error("OPS-FLX-03 tidak ada di katalog kebijakan.");
  const policy = await db.systemPolicy.upsert({
    where: { companyId_code: { companyId, code: definition.code } },
    update: {},
    create: {
      companyId,
      code: definition.code,
      name: definition.name,
      ownerDomain: definition.domain,
      policyGroup: definition.group,
      scope: "company",
      valueType: definition.type,
      validationSchema: definition.schema as Prisma.InputJsonValue,
      defaultValueSnapshot: definition.default as Prisma.InputJsonValue,
    },
  });
  if (await db.policyVersion.count({ where: { policyId: policy.id, state: "ACTIVE" } })) return;
  await db.policyVersion.create({
    data: {
      policyId: policy.id,
      versionNo: (await db.policyVersion.count({ where: { policyId: policy.id } })) + 1,
      valueSnapshot: definition.default as Prisma.InputJsonValue,
      state: "ACTIVE",
      savedById: actorId,
    },
  });
}
