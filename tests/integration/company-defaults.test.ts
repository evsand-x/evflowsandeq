import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { provisionCompanyDefaults } from "../../packages/backend/src/administration/company-defaults";
import { nextDocumentNumber } from "../../packages/backend/src/common/document-number";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const rollback = new Error("rollback company defaults test");
const today = new Date("2026-10-24T03:00:00Z");

async function inRollback(run: (tx: Tx) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local test database required");
  let completed = false;
  await prisma
    .$transaction(
      async (tx) => {
        await run(tx);
        completed = true;
        throw rollback;
      },
      { timeout: 60_000 },
    )
    .catch((error) => {
      if (error !== rollback) throw error;
    });
  expect(completed).toBe(true);
}

async function freshCompany(tx: Tx) {
  const company = await tx.company.create({ data: { name: `Defaults test ${randomUUID()}` } });
  const user = await tx.user.create({
    data: { email: `defaults-${randomUUID()}@evflow.local`, displayName: "D", passwordHash: "x" },
  });
  return { companyId: company.id, actorId: user.id };
}

describe("company defaults provisioning", () => {
  it("creates every catalog policy and numbering kind for a new company", async () => {
    await inRollback(async (tx) => {
      const { companyId, actorId } = await freshCompany(tx);
      const result = await provisionCompanyDefaults(tx, companyId, actorId, today);
      expect(result.policies_created).toContain("OPS-FLX-03");
      expect(result.numbering_created).toContain("sales_order");
      const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" })
        .format(new Date())
        .split("-");
      expect(await nextDocumentNumber(tx, companyId, "sales_order")).toBe(
        `SO.${year}.${month}.0001`,
      );
      const terms = await tx.systemPolicy.findUniqueOrThrow({
        where: { companyId_code: { companyId, code: "OPS-FLX-01" } },
        include: { versions: true },
      });
      expect(terms.versions[0]!.valueSnapshot).toBe("WARN");
    });
  });

  it("is idempotent", async () => {
    await inRollback(async (tx) => {
      const { companyId, actorId } = await freshCompany(tx);
      await provisionCompanyDefaults(tx, companyId, actorId, today);
      expect(await provisionCompanyDefaults(tx, companyId, actorId, today)).toEqual({
        policies_created: [],
        numbering_created: [],
      });
    });
  });

  it("skips kinds that already have an active rule", async () => {
    await inRollback(async (tx) => {
      const { companyId, actorId } = await freshCompany(tx);
      await tx.documentNumberRule.create({
        data: {
          companyId,
          documentKind: "sales_order",
          prefix: "X-",
          digits: 4,
          resetPeriod: "YEARLY",
          effectiveFrom: new Date("2020-01-01"),
          effectiveTo: new Date("2099-01-01"),
          createdById: actorId,
        },
      });
      const result = await provisionCompanyDefaults(tx, companyId, actorId, today);
      expect(result.numbering_created).not.toContain("sales_order");
      const rules = await tx.documentNumberRule.findMany({
        where: { companyId, documentKind: "sales_order" },
      });
      expect(rules.map((r) => r.prefix)).toEqual(["X-"]);
    });
  });

  it("never overwrites an edited policy", async () => {
    await inRollback(async (tx) => {
      const { companyId, actorId } = await freshCompany(tx);
      await provisionCompanyDefaults(tx, companyId, actorId, today);
      const policy = await tx.systemPolicy.findUniqueOrThrow({
        where: { companyId_code: { companyId, code: "OPS-FLX-01" } },
      });
      await tx.policyVersion.updateMany({
        where: { policyId: policy.id },
        data: { state: "RETIRED" },
      });
      await tx.policyVersion.create({
        data: {
          policyId: policy.id,
          versionNo: 2,
          valueSnapshot: "BLOCK",
          state: "ACTIVE",
          savedById: actorId,
        },
      });
      await provisionCompanyDefaults(tx, companyId, actorId, today);
      const active = await tx.policyVersion.findMany({
        where: { policyId: policy.id, state: "ACTIVE" },
      });
      expect(active.map((v) => v.valueSnapshot)).toEqual(["BLOCK"]);
    });
  });

  it("audits what it created", async () => {
    await inRollback(async (tx) => {
      const { companyId, actorId } = await freshCompany(tx);
      await provisionCompanyDefaults(tx, companyId, actorId, today);
      const events = await tx.auditEvent.findMany({
        where: { companyId, action: "company_defaults.provisioned" },
      });
      expect(events).toHaveLength(1);
      expect(events[0]!.afterHash).not.toBeNull();
    });
  });
});
