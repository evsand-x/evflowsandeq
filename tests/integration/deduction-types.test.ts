import type * as Database from "@evflow/database";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@evflow/database";
import { provisionCompanyDefaults } from "../../packages/backend/src/administration/company-defaults";
import {
  createDeductionType,
  listActiveDeductionTypes,
  updateDeductionType,
} from "../../packages/backend/src/finance/deduction-types";

// Real database, all enclosed in a rollback-only transaction.
const context = vi.hoisted(() => ({ tx: null as Prisma.TransactionClient | null }));
vi.mock("@evflow/database", async (original) => {
  const module = await original<typeof Database>();
  return {
    ...module,
    prisma: new Proxy(module.prisma, {
      get(target, key) {
        if (context.tx && key === "$transaction")
          return async (action: unknown) =>
            typeof action === "function"
              ? action(context.tx)
              : Promise.all(action as Promise<unknown>[]);
        const client = context.tx ?? target;
        const value = Reflect.get(client, key);
        return typeof value === "function" ? value.bind(client) : value;
      },
    }),
  };
});

const rollback = new Error("ROLLBACK_DEDUCTION_TYPES_TEST");
type Fixture = { c: string; actor: string; accounts: Record<string, string> };

async function inRollback(run: (fixture: Fixture) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  const actual = await vi.importActual<typeof Database>("@evflow/database");
  let completed = false;
  try {
    await actual.prisma.$transaction(
      async (tx) => {
        context.tx = tx;
        await run(await setup());
        completed = true;
        throw rollback;
      },
      { timeout: 120_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    context.tx = null;
  }
  expect(completed).toBe(true);
}

async function setup(): Promise<Fixture> {
  const c = randomUUID(),
    actor = randomUUID();
  await prisma.company.create({ data: { id: c, name: "DEDUCTION TYPES TEST ONLY" } });
  await prisma.user.create({
    data: { id: actor, email: `${actor}@test.local`, displayName: "Test", passwordHash: "x" },
  });
  await prisma.companyMembership.create({ data: { companyId: c, userId: actor } });
  const accounts: Record<string, string> = {};
  for (const [code, name, category] of [
    ["2-20500", "PPN Keluaran", "LIABILITY"],
    ["1-10502", "Pajak Dibayar di Muka", "ASSET"],
    ["8-80999", "Beban Lain-lain", "EXPENSE"],
  ] as const)
    accounts[code] = (
      await prisma.financeAccount.create({ data: { companyId: c, code, name, category } })
    ).id;
  return { c, actor, accounts };
}

const input = (settle_account_id: string, extra: Record<string, unknown> = {}) => ({
  name: `Potongan ${randomUUID().slice(0, 8)}`,
  settle_account_id,
  proof_type: "BUKTI_POTONG",
  proof_required: true,
  active: true,
  ...extra,
});

describe("deduction types", () => {
  it("provisions four default deduction types", async () => {
    await inRollback(async ({ c, actor, accounts }) => {
      const first = await prisma.$transaction((tx) => provisionCompanyDefaults(tx, c, actor));
      expect(first.deduction_types_created.sort()).toEqual(
        ["Biaya transfer", "PPN dipungut", "PPh 22", "PPh 23"].sort(),
      );
      const rows = await listActiveDeductionTypes(prisma, c);
      const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
      expect(byName["PPN dipungut"]).toMatchObject({
        settleAccountId: accounts["2-20500"],
        proofType: "SSP_NTPN",
        proofRequired: true,
      });
      expect(byName["PPh 22"]).toMatchObject({
        settleAccountId: accounts["1-10502"],
        proofType: "BUKTI_POTONG",
        proofRequired: true,
      });
      expect(byName["PPh 23"]!.settleAccountId).toBe(accounts["1-10502"]);
      expect(byName["Biaya transfer"]).toMatchObject({
        settleAccountId: accounts["8-80999"],
        proofType: "NONE",
        proofRequired: false,
      });
      // Idempotent, and an edit is never overwritten.
      await updateDeductionType(c, actor, byName["PPh 22"]!.id, 1, {
        ...input(accounts["1-10502"]!, { name: "PPh 22", proof_required: false }),
      });
      const again = await prisma.$transaction((tx) => provisionCompanyDefaults(tx, c, actor));
      expect(again.deduction_types_created).toEqual([]);
      const edited = await prisma.deductionType.findFirstOrThrow({
        where: { companyId: c, name: "PPh 22" },
      });
      expect(edited.proofRequired).toBe(false);
    });
  });

  it("skips a default whose account is inactive", async () => {
    await inRollback(async ({ c, actor, accounts }) => {
      await prisma.financeAccount.update({
        where: { id: accounts["8-80999"]! },
        data: { active: false },
      });
      const result = await prisma.$transaction((tx) => provisionCompanyDefaults(tx, c, actor));
      expect(result.deduction_types_created).not.toContain("Biaya transfer");
      expect(result.deduction_types_created).toContain("PPN dipungut");
    });
  });

  it("rejects header or inactive account", async () => {
    await inRollback(async ({ c, actor, accounts }) => {
      const header = await prisma.financeAccount.create({
        data: {
          companyId: c,
          code: "8-80000",
          name: "Header",
          category: "EXPENSE",
          accountType: "HEADER",
        },
      });
      await expect(createDeductionType(c, actor, input(header.id))).rejects.toMatchObject({
        status: 409,
      });
      await prisma.financeAccount.update({
        where: { id: accounts["1-10502"]! },
        data: { active: false },
      });
      await expect(
        createDeductionType(c, actor, input(accounts["1-10502"]!)),
      ).rejects.toMatchObject({ status: 409 });
      // An account of another company is not usable either.
      const other = randomUUID();
      await prisma.company.create({ data: { id: other, name: "OTHER" } });
      const foreign = await prisma.financeAccount.create({
        data: { companyId: other, code: "8-1", name: "Asing", category: "EXPENSE" },
      });
      await expect(createDeductionType(c, actor, input(foreign.id))).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  it("requires a proof type when proof is required, and a unique name", async () => {
    await inRollback(async ({ c, actor, accounts }) => {
      await expect(
        createDeductionType(c, actor, input(accounts["8-80999"]!, { proof_type: "NONE" })),
      ).rejects.toMatchObject({ status: 400 });
      const row = await createDeductionType(
        c,
        actor,
        input(accounts["8-80999"]!, { name: "Retur" }),
      );
      await expect(
        createDeductionType(c, actor, input(accounts["8-80999"]!, { name: "retur" })),
      ).rejects.toMatchObject({ status: 409 });
      expect(row.version).toBe(1);
    });
  });

  it("stale edit returns 412 and edits are audited", async () => {
    await inRollback(async ({ c, actor, accounts }) => {
      const row = await createDeductionType(
        c,
        actor,
        input(accounts["1-10502"]!, { name: "Uji" }),
      );
      const next = await updateDeductionType(
        c,
        actor,
        row.id,
        1,
        input(accounts["1-10502"]!, { name: "Uji 2", active: false }),
      );
      expect(next.version).toBe(2);
      await expect(
        updateDeductionType(c, actor, row.id, 1, input(accounts["1-10502"]!, { name: "Uji 3" })),
      ).rejects.toMatchObject({ status: 412 });
      expect((await listActiveDeductionTypes(prisma, c)).map((r) => r.name)).not.toContain(
        "Uji 2",
      );
      const events = await prisma.auditEvent.findMany({
        where: { companyId: c, resourceType: "deduction_type", resourceId: row.id },
        orderBy: { occurredAt: "asc" },
      });
      expect(events.map((e) => e.action)).toEqual([
        "deduction_type.created",
        "deduction_type.updated",
      ]);
    });
  });
});
