import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@evflow/database";
import { activePolicyValue } from "../../packages/backend/src/common/policy-value";
import {
  assertFinancePeriodOpen,
  isFinancePeriodClosed,
} from "../../packages/backend/src/finance/period-guard";

async function fixture(
  run: (tx: Prisma.TransactionClient, companyId: string, actorId: string) => Promise<void>,
) {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("Helper fixtures require local non-production PostgreSQL");
  const rollback = new Error("HELPER_FIXTURE_ROLLBACK");
  await expect(
    prisma.$transaction(async (tx) => {
      const companyId = randomUUID(),
        actorId = randomUUID();
      await tx.company.create({ data: { id: companyId, name: "ROLLBACK HELPER TEST" } });
      await tx.user.create({
        data: {
          id: actorId,
          email: `${actorId}@test.local`,
          displayName: "Test",
          passwordHash: "disabled",
        },
      });
      await run(tx, companyId, actorId);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
}

async function policy(tx: Prisma.TransactionClient, companyId: string, actorId: string) {
  return tx.systemPolicy.create({
    data: {
      companyId,
      code: "TEST-HELPER",
      name: "Rollback test",
      ownerDomain: "administration",
      policyGroup: "general",
      scope: "company",
      valueType: "object",
      validationSchema: {},
      defaultValueSnapshot: {},
      versions: {
        create: [
          { versionNo: 1, state: "RETIRED", savedById: actorId, valueSnapshot: { value: "old" } },
          {
            versionNo: 2,
            state: "ACTIVE",
            savedById: actorId,
            effectiveFrom: new Date("2000-01-01"),
            valueSnapshot: { value: "current" },
          },
          {
            versionNo: 3,
            state: "RETIRED",
            savedById: actorId,
            valueSnapshot: { value: "retired" },
          },
          {
            versionNo: 4,
            state: "SCHEDULED",
            savedById: actorId,
            effectiveFrom: new Date("2099-01-01"),
            valueSnapshot: { value: "future" },
          },
        ],
      },
    },
  });
}

describe("shared policy value", () => {
  it("excludes an ACTIVE version before its effective date and accepts an undated one", async () =>
    fixture(async (tx, companyId, actorId) => {
      const row = await policy(tx, companyId, actorId);
      await tx.policyVersion.update({
        where: { policyId_versionNo: { policyId: row.id, versionNo: 2 } },
        data: { effectiveFrom: new Date("2099-01-01") },
      });
      expect(await activePolicyValue(tx, companyId, "TEST-HELPER")).toBeNull();
      await tx.policyVersion.update({
        where: { policyId_versionNo: { policyId: row.id, versionNo: 2 } },
        data: { effectiveFrom: null },
      });
      expect(await activePolicyValue(tx, companyId, "TEST-HELPER")).toEqual({ value: "current" });
    }));
  it("reads the latest effective ACTIVE version and excludes retired/future values", async () =>
    fixture(async (tx, companyId, actorId) => {
      await policy(tx, companyId, actorId);
      expect(await activePolicyValue(tx, companyId, "TEST-HELPER")).toEqual({ value: "current" });
    }));
  it("returns null for missing or another company's policy", async () =>
    fixture(async (tx, companyId, actorId) => {
      await policy(tx, companyId, actorId);
      expect(await activePolicyValue(tx, companyId, "MISSING")).toBeNull();
      expect(await activePolicyValue(tx, randomUUID(), "TEST-HELPER")).toBeNull();
    }));
  it("preserves false and JSON null rather than inventing a default", async () =>
    fixture(async (tx, companyId, actorId) => {
      const row = await policy(tx, companyId, actorId);
      await tx.policyVersion.update({
        where: { policyId_versionNo: { policyId: row.id, versionNo: 2 } },
        data: { valueSnapshot: false },
      });
      expect(await activePolicyValue(tx, companyId, "TEST-HELPER")).toBe(false);
      await tx.policyVersion.update({
        where: { policyId_versionNo: { policyId: row.id, versionNo: 2 } },
        data: { valueSnapshot: Prisma.JsonNull },
      });
      expect(await activePolicyValue(tx, companyId, "TEST-HELPER")).toBeNull();
    }));
});

describe("finance period guards", () => {
  it("allows dates within exactly one OPEN period including both boundaries", async () =>
    fixture(async (tx, companyId) => {
      const period = await tx.financePeriod.create({
        data: {
          companyId,
          startsOn: new Date("2026-10-01"),
          endsOn: new Date("2026-10-31"),
          state: "OPEN",
        },
      });
      for (const date of ["2026-10-01", "2026-10-15", "2026-10-31"]) {
        expect((await assertFinancePeriodOpen(tx, companyId, new Date(date))).id).toBe(period.id);
        expect(await isFinancePeriodClosed(tx, companyId, new Date(date))).toBe(false);
      }
    }));
  it("rejects CLOSED periods and reports their warning state", async () =>
    fixture(async (tx, companyId) => {
      await tx.financePeriod.create({
        data: {
          companyId,
          startsOn: new Date("2026-10-01"),
          endsOn: new Date("2026-10-31"),
          state: "CLOSED",
        },
      });
      await expect(assertFinancePeriodOpen(tx, companyId, new Date("2026-10-15"))).rejects.toThrow(
        "FINANCE_PERIOD_NOT_OPEN",
      );
      expect(await isFinancePeriodClosed(tx, companyId, new Date("2026-10-15"))).toBe(true);
    }));
  it("rejects missing periods and ignores another company's period", async () =>
    fixture(async (tx, companyId) => {
      const other = await tx.company.create({ data: { name: "OTHER ROLLBACK COMPANY" } });
      await tx.financePeriod.create({
        data: {
          companyId: other.id,
          startsOn: new Date("2026-10-01"),
          endsOn: new Date("2026-10-31"),
        },
      });
      await expect(assertFinancePeriodOpen(tx, companyId, new Date("2026-10-15"))).rejects.toThrow(
        "FINANCE_PERIOD_NOT_OPEN",
      );
      expect(await isFinancePeriodClosed(tx, companyId, new Date("2026-10-15"))).toBe(false);
    }));
  it("rejects overlapping periods even when both are OPEN", async () =>
    fixture(async (tx, companyId) => {
      await tx.financePeriod.createMany({
        data: [
          { companyId, startsOn: new Date("2026-10-01"), endsOn: new Date("2026-10-31") },
          { companyId, startsOn: new Date("2026-10-10"), endsOn: new Date("2026-10-20") },
        ],
      });
      await expect(assertFinancePeriodOpen(tx, companyId, new Date("2026-10-15"))).rejects.toThrow(
        "FINANCE_PERIOD_NOT_OPEN",
      );
    }));
});
