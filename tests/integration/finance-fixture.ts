import { prisma, LedgerEntryKind } from "../../packages/database/src";
export async function financeFixture(companyId: string, actorId: string) {
  const mappings: Record<string, string> = {};
  for (const kind of Object.values(LedgerEntryKind)) {
    const account = await prisma.financeAccount.create({
      data: {
        companyId,
        code: `TEST-${kind}`,
        name: `SYNTHETIC ${kind}`,
        category: "ASSET",
        controlKind: kind === "CASH_RECEIPT" ? "BANK" : kind,
      },
    });
    mappings[kind] = account.id;
  }
  await prisma.financePeriod.create({
    data: { companyId, startsOn: new Date("2000-01-01"), endsOn: new Date("2099-12-31") },
  });
  await prisma.financePostingProfile.create({
    data: {
      companyId,
      effectiveFrom: new Date("2000-01-01"),
      effectiveTo: new Date("2100-01-01"),
      mappings,
      createdById: actorId,
    },
  });
  return prisma.financeBankAccount.create({
    data: {
      companyId,
      code: "TEST-BANK",
      name: "Synthetic bank",
      bankName: "TEST ONLY",
      lastFour: "0000",
      currency: "IDR",
      accountId: mappings.CASH_RECEIPT!,
    },
  });
}
export async function cleanFinanceTransactions(companyId: string) {
  await prisma.$executeRaw`DELETE FROM bank_statement_matches WHERE company_id=${companyId}::uuid`;
  await prisma.officialTaxDocument.deleteMany({ where: { companyId } });
  await prisma.advanceTax.deleteMany({ where: { companyId } });
  await prisma.bankStatementLine.deleteMany({ where: { companyId } });
  await prisma.bankStatement.deleteMany({ where: { companyId } });
  await prisma.receiptTaxComponent.deleteMany({ where: { companyId } });
  await prisma.ledgerEntry.deleteMany({ where: { companyId } });
  await prisma.financeJournalLine.deleteMany({ where: { companyId } });
  await prisma.financeJournal.deleteMany({ where: { companyId } });
}
export async function cleanFinanceConfiguration(companyId: string) {
  await prisma.receiptTaxRule.deleteMany({ where: { companyId } });
  await prisma.financeBankAccount.deleteMany({ where: { companyId } });
  await prisma.financePostingProfile.deleteMany({ where: { companyId } });
  await prisma.financePeriod.deleteMany({ where: { companyId } });
  await prisma.financeAccount.deleteMany({ where: { companyId } });
}
