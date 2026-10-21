/** One-time, local-only master/configuration migration. Never edits journal balances. */
import "../packages/backend/node_modules/reflect-metadata";
import { createHash } from "node:crypto";
import { prisma, type Prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { transactionCommand } from "../packages/backend/src/common/transaction-command";
import { AuditService } from "../packages/backend/src/common/audit.service";
import { isCompanyAdministrator } from "../packages/backend/src/identity/administrator";
import { financeDate, lockFinance } from "../packages/backend/src/finance/posting";
import { accountReferences } from "../packages/backend/src/finance/accounts";

const companyId = "00000000-0000-4000-8000-000000000001";
const route = "accounts/migrate-imported-reference-20261016";
// Approved: combine transit/quarantine and WAPU into the imported accounts; cash is Mandiri.
const targets: Record<string, string> = {
  AP: "2-20100",
  AR: "1-10100",
  UNBILLED_AR: "1-10101",
  GRNI: "2-20101",
  INVENTORY: "1-10200",
  INVENTORY_TRANSIT: "1-10200",
  INVENTORY_QUARANTINE: "1-10200",
  PURCHASE_RECEIPT: "1-10200",
  PURCHASE_TAX: "1-10500",
  WAPU_TAX: "1-10500",
  WITHHELD_TAX: "1-10502",
  SALES_TAX: "2-20500",
  SALE_COGS: "5-50000",
  SALE_REVENUE: "4-40000",
  SALES_RETURN: "4-40200",
  SALE_FREIGHT_REVENUE: "7-70099",
  CASH_RECEIPT: "1-10001",
  CASH_REFUND: "1-10001",
  CUSTOMER_ADVANCE: "2-20203",
  OPENING_STOCK: "3-30999",
  BANK_ADJUSTMENT: "8-80999",
};
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function main() {
  assertDevelopmentSeed();
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: "demo.admin@evflow.local" },
  });
  if (!(await isCompanyAdministrator(prisma, companyId, actor.id)))
    throw new Error("ADMIN_REQUIRED");
  const result = await transactionCommand(
    companyId,
    actor.id,
    route,
    "approved-migration-v1",
    targets,
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
      await lockFinance(tx, companyId);
      const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
      if (!company.name.includes("DATA UJI FIKTIF")) throw new Error("LOCAL_TEST_COMPANY_REQUIRED");
      const at = await financeDate(tx, companyId);
      const accounts = await tx.financeAccount.findMany({ where: { companyId } });
      const old = accounts.filter((a) => a.code.startsWith("DEV-E2E-"));
      if (old.length !== 21) throw new Error("EXPECTED_21_TEST_ACCOUNTS");
      const replacements = new Map<string, string>();
      const mappings: Record<string, string> = {};
      for (const a of old) {
        const kind = a.code.slice("DEV-E2E-".length);
        const target = accounts.find(
          (t) => t.code === targets[kind] && t.active && t.accountType === "DETAIL",
        );
        if (!target) throw new Error(`TARGET_REQUIRED:${kind}`);
        if (a.category !== target.category && kind !== "SALE_FREIGHT_REVENUE")
          throw new Error(`CATEGORY_MISMATCH:${kind}`);
        replacements.set(a.id, target.id);
        mappings[kind] = target.id;
      }
      const beforeJournals = await tx.financeJournal.findMany({
        where: { companyId },
        include: { lines: { orderBy: { id: "asc" } } },
        orderBy: { id: "asc" },
      });
      const audit = new AuditService();
      const record = async (
        action: string,
        resourceType: string,
        resourceId: string,
        before: unknown,
        after: unknown,
      ) =>
        audit.recordWith(tx, {
          companyId,
          actorId: actor.id,
          action,
          resourceType,
          resourceId,
          before: json(before),
          after: json(after),
          metadata: {
            reason: "Migrasi akun data uji ke master akun impor yang disetujui pengguna",
            route,
          },
        });
      const profiles = await tx.financePostingProfile.findMany({
        where: { companyId, effectiveTo: { gt: at } },
      });
      if (profiles.length !== 1 || profiles[0]!.effectiveFrom >= at)
        throw new Error("EXPECTED_SINGLE_PRIOR_PROFILE");
      const profile = profiles[0]!;
      const nextMappings = Object.fromEntries(
        Object.entries(profile.mappings as Record<string, string>).map(([k, id]) => [
          k,
          replacements.get(id) ?? id,
        ]),
      );
      nextMappings.SALE_FREIGHT_REVENUE = mappings.SALE_FREIGHT_REVENUE!;
      const closed = await tx.financePostingProfile.update({
        where: { id: profile.id },
        data: { effectiveTo: at },
      });
      const nextProfile = await tx.financePostingProfile.create({
        data: {
          companyId,
          effectiveFrom: at,
          effectiveTo: profile.effectiveTo,
          mappings: nextMappings,
          createdById: actor.id,
        },
      });
      await record("account_migration.profile_versioned", "posting_profile", profile.id, profile, {
        closed,
        replacement: nextProfile,
      });
      for (const bank of await tx.financeBankAccount.findMany({
        where: { companyId, accountId: { in: [...replacements.keys()] } },
      })) {
        const next = await tx.financeBankAccount.update({
          where: { id: bank.id },
          data: { accountId: replacements.get(bank.accountId)! },
        });
        await record("account_migration.bank_remapped", "bank_account", bank.id, bank, next);
      }
      for (const tax of await tx.operationalTax.findMany({
        where: { companyId, accountId: { in: [...replacements.keys()] } },
      })) {
        const next = await tx.operationalTax.update({
          where: { id: tax.id },
          data: {
            accountId: replacements.get(tax.accountId)!,
            effectiveFrom: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.operationalTaxRevision.create({
          data: {
            companyId,
            taxId: tax.id,
            version: next.version,
            snapshot: json(next),
            actorId: actor.id,
          },
        });
        await record("operational_tax.updated", "operational_tax", tax.id, tax, next);
      }
      const controlKinds: Record<string, string> = {
        "1-10001": "BANK",
        "1-10100": "AR",
        "1-10101": "UNBILLED_AR",
        "1-10200": "INVENTORY",
        "1-10500": "PURCHASE_TAX",
        "1-10502": "WITHHELD_TAX",
        "2-20100": "AP",
        "2-20101": "GRNI",
        "2-20203": "CUSTOMER_ADVANCE",
        "2-20500": "SALES_TAX",
        "3-30999": "OPENING_STOCK",
      };
      for (const [code, controlKind] of Object.entries(controlKinds)) {
        const account = accounts.find((a) => a.code === code)!;
        if (account.controlKind && account.controlKind !== controlKind)
          throw new Error(`CONTROL_CONFLICT:${code}`);
        const next = await tx.financeAccount.update({
          where: { id: account.id },
          data: { controlKind, version: { increment: 1 } },
        });
        await record("account.updated", "account", account.id, account, next);
      }
      let removed = 0,
        deactivated = 0;
      for (const a of old) {
        const refs = await accountReferences(tx, companyId, a.id);
        if (refs.activeReferences) throw new Error(`ACTIVE_REFERENCE_REMAINS:${a.code}`);
        if (!refs.used && !refs.children) {
          await tx.financeAccount.delete({ where: { id: a.id } });
          await record("account.deleted", "account", a.id, a, {
            replacementId: replacements.get(a.id),
          });
          removed++;
        } else {
          const next = await tx.financeAccount.update({
            where: { id: a.id },
            data: { active: false, version: { increment: 1 } },
          });
          await record("account.deactivated", "account", a.id, a, {
            ...next,
            replacementId: replacements.get(a.id),
          });
          deactivated++;
        }
      }
      const afterJournals = await tx.financeJournal.findMany({
        where: { companyId },
        include: { lines: { orderBy: { id: "asc" } } },
        orderBy: { id: "asc" },
      });
      if (digest(beforeJournals) !== digest(afterJournals))
        throw new Error("JOURNAL_HISTORY_CHANGED");
      const report = {
        removed,
        deactivated,
        active: await tx.financeAccount.count({ where: { companyId, active: true } }),
        effectiveFrom: at,
        profileId: nextProfile.id,
        journalHash: digest(afterJournals),
        journalLines: afterJournals.reduce((n, j) => n + j.lines.length, 0),
        mappings: targets,
      };
      await record(
        "account_migration.completed",
        "company",
        companyId,
        { journalHash: digest(beforeJournals) },
        report,
      );
      return report;
    },
  );
  console.log(JSON.stringify(result, null, 2));
}
main().finally(() => prisma.$disconnect());
