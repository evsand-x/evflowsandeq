/** One-time export of the imported chart of accounts before the development reset. Read-only. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../packages/database/src";

const companyId = "00000000-0000-4000-8000-000000000001";

async function main() {
  const accounts = await prisma.financeAccount.findMany({
    where: { companyId, active: true },
    orderBy: { code: "asc" },
  });
  const byId = new Map(accounts.map((a) => [a.id, a.code]));
  const now = new Date();
  const profile = await prisma.financePostingProfile.findFirst({
    where: { companyId, effectiveFrom: { lte: now }, effectiveTo: { gt: now } },
  });
  const posting_accounts = Object.fromEntries(
    Object.entries((profile?.mappings ?? {}) as Record<string, string>)
      .map(([kind, id]) => [kind, byId.get(id)])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const data = {
    accounts: accounts.map((a) => ({
      code: a.code,
      name: a.name,
      category: a.category,
      category_label: a.categoryLabel,
      account_type: a.accountType,
      normal_balance: a.normalBalance,
      parent_code: a.parentId ? (byId.get(a.parentId) ?? null) : null,
      psak118_category: a.psak118Category,
      description: a.description,
      control_kind: a.controlKind,
      active: a.active,
    })),
    posting_accounts,
  };
  const missingParent = data.accounts.filter(
    (a) => a.parent_code === null && accounts.find((x) => x.code === a.code)?.parentId,
  );
  if (missingParent.length)
    throw new Error(`PARENT_NOT_EXPORTED:${missingParent.map((a) => a.code)}`);
  const file = resolve(__dirname, "../packages/database/prisma/data/chart-of-accounts.json");
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`accounts=${data.accounts.length} posting=${Object.keys(posting_accounts).length}`);
}

main().finally(() => prisma.$disconnect());
