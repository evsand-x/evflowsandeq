import { chartOfAccounts, type Prisma } from "@evflow/database";
import { AuditService } from "../common/audit.service";
import { financeDate, lockFinance } from "./posting";

/** Creates missing accounts from the shipped chart, then the posting profile; never edits existing rows. */
export async function importChartOfAccounts(
  tx: Prisma.TransactionClient,
  companyId: string,
  actorId: string,
) {
  await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
  await lockFinance(tx, companyId);
  const existing = await tx.financeAccount.findMany({ where: { companyId } });
  const idByCode = new Map(existing.map((a) => [a.code, a.id]));
  const pending = chartOfAccounts.accounts.filter((a) => !idByCode.has(a.code));
  const created: string[] = [];
  // Parents first: repeat passes until every pending account's parent exists.
  while (pending.length) {
    const ready = pending.filter((a) => !a.parent_code || idByCode.has(a.parent_code));
    if (!ready.length) throw new Error(`CHART_PARENT_MISSING:${pending.map((a) => a.code)}`);
    for (const account of ready) {
      const row = await tx.financeAccount.create({
        data: {
          companyId,
          code: account.code,
          name: account.name,
          category: account.category,
          categoryLabel: account.category_label,
          accountType: account.account_type,
          normalBalance: account.normal_balance,
          parentId: account.parent_code ? idByCode.get(account.parent_code)! : null,
          psak118Category: account.psak118_category,
          description: account.description,
          controlKind: account.control_kind,
          active: account.active,
        },
      });
      idByCode.set(account.code, row.id);
      created.push(account.code);
      pending.splice(pending.indexOf(account), 1);
    }
  }
  const profileExists = await tx.financePostingProfile.count({ where: { companyId } });
  let profileId: string | null = null;
  if (!profileExists) {
    const mappings = Object.fromEntries(
      Object.entries(chartOfAccounts.posting_accounts).map(([kind, code]) => {
        const id = idByCode.get(code);
        if (!id) throw new Error(`POSTING_ACCOUNT_MISSING:${kind}:${code}`);
        return [kind, id];
      }),
    );
    const profile = await tx.financePostingProfile.create({
      data: {
        companyId,
        // Start of the current year so documents dated earlier this year can still post.
        effectiveFrom: new Date(
          `${(await financeDate(tx, companyId)).toISOString().slice(0, 4)}-01-01`,
        ),
        effectiveTo: new Date("2999-12-31"),
        mappings,
        createdById: actorId,
      },
    });
    profileId = profile.id;
  }
  if (created.length || profileId)
    await new AuditService().recordWith(tx, {
      companyId,
      actorId,
      action: "chart_of_accounts.imported",
      resourceType: "chart_of_accounts",
      resourceId: companyId,
      after: { accounts: created, posting_profile_id: profileId },
    });
  return { created: created.length };
}
