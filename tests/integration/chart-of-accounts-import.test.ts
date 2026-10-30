import { randomUUID } from "node:crypto";
import { chartOfAccounts as chart, prisma } from "@evflow/database";
import { importChartOfAccounts } from "../../packages/backend/src/finance/chart-of-accounts-import";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const rollback = new Error("rollback chart import test");

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
  const company = await tx.company.create({ data: { name: `Chart test ${randomUUID()}` } });
  const user = await tx.user.create({
    data: { email: `chart-${randomUUID()}@evflow.local`, displayName: "Chart", passwordHash: "x" },
  });
  return { companyId: company.id, actorId: user.id };
}

describe("chart of accounts import", () => {
  it("restores the exported chart exactly", async () => {
    await inRollback(async (tx) => {
      const { companyId, actorId } = await freshCompany(tx);
      const result = await importChartOfAccounts(tx, companyId, actorId);
      expect(result.created).toBe(156);
      const rows = await tx.financeAccount.findMany({
        where: { companyId },
        orderBy: { code: "asc" },
      });
      const codeById = new Map(rows.map((r) => [r.id, r.code]));
      expect(
        rows.map((r) => ({
          code: r.code,
          name: r.name,
          category: r.category,
          category_label: r.categoryLabel,
          account_type: r.accountType,
          normal_balance: r.normalBalance,
          parent_code: r.parentId ? codeById.get(r.parentId) : null,
          psak118_category: r.psak118Category,
          description: r.description,
          control_kind: r.controlKind,
          active: r.active,
        })),
      ).toEqual(chart.accounts);
    });
  });

  it("maps posting accounts to the imported codes", async () => {
    await inRollback(async (tx) => {
      const { companyId, actorId } = await freshCompany(tx);
      await importChartOfAccounts(tx, companyId, actorId);
      const profile = await tx.financePostingProfile.findFirstOrThrow({ where: { companyId } });
      const revenue = await tx.financeAccount.findUniqueOrThrow({
        where: { companyId_code: { companyId, code: "4-40000" } },
      });
      expect((profile.mappings as Record<string, string>).SALE_REVENUE).toBe(revenue.id);
      expect(Object.keys(profile.mappings as object).sort()).toEqual(
        Object.keys(chart.posting_accounts).sort(),
      );
    });
  });

  it("is idempotent", async () => {
    await inRollback(async (tx) => {
      const { companyId, actorId } = await freshCompany(tx);
      await importChartOfAccounts(tx, companyId, actorId);
      const second = await importChartOfAccounts(tx, companyId, actorId);
      expect(second.created).toBe(0);
      expect(await tx.financePostingProfile.count({ where: { companyId } })).toBe(1);
      expect(
        await tx.auditEvent.count({ where: { companyId, action: "chart_of_accounts.imported" } }),
      ).toBe(1);
    });
  });
});
