import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "@evflow/database";

describe("posted finance journal immutability", () => {
  it("rejects appending a balanced line after the journal transaction commits", async () => {
    const companyId = randomUUID();
    const userId = randomUUID();
    const accountId = randomUUID();
    const periodId = randomUUID();
    const profileId = randomUUID();
    const sourceId = randomUUID();
    const journalId = randomUUID();
    try {
      await prisma.$transaction(async (tx) => {
        await tx.company.create({ data: { id: companyId, name: `IMMUTABILITY ${companyId}` } });
        await tx.user.create({
          data: { id: userId, email: `${companyId}@test.invalid`, displayName: "Journal tester", passwordHash: "disabled" },
        });
        await tx.companyMembership.create({ data: { companyId, userId } });
        await tx.financeAccount.create({
          data: { id: accountId, companyId, code: `IMM-${companyId.slice(0, 8)}`, name: "Immutability", category: "ASSET" },
        });
        await tx.financePeriod.create({
          data: { id: periodId, companyId, startsOn: new Date("2000-01-01"), endsOn: new Date("2999-12-31"), state: "OPEN" },
        });
        await tx.financePostingProfile.create({
          data: { id: profileId, companyId, effectiveFrom: new Date("2000-01-01"), effectiveTo: new Date("2999-12-31"), mappings: {}, createdById: userId },
        });
        await tx.financeJournal.create({
          data: {
            id: journalId,
            companyId,
            sourceType: "IMMUTABILITY_TEST",
            sourceId,
            businessDate: new Date("2026-10-29"),
            periodId,
            profileId,
            currency: "IDR",
            actorId: userId,
            lines: {
              create: [
                { companyId, accountId, ledgerKind: "DEBIT", debit: new Prisma.Decimal("1"), credit: new Prisma.Decimal("0"), snapshot: {} },
                { companyId, accountId, ledgerKind: "CREDIT", debit: new Prisma.Decimal("0"), credit: new Prisma.Decimal("1"), snapshot: {} },
              ],
            },
          },
        });
      });

      await expect(
        prisma.financeJournalLine.create({
          data: {
            id: randomUUID(),
            companyId,
            journalId,
            accountId,
            ledgerKind: "APPEND_ATTEMPT",
            debit: new Prisma.Decimal("1"),
            credit: new Prisma.Decimal("1"),
            snapshot: {},
          },
        }),
      ).rejects.toThrow("POSTED_FINANCE_IMMUTABLE");
    } finally {
      // Posted finance rows are deliberately immutable, including deletes.
      // Keep the committed fixture isolated; cleanup is attempted only for
      // non-posted dependencies and must not weaken those database guards.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
        await tx.financeJournalLine.deleteMany({ where: { journalId } });
        await tx.financeJournal.deleteMany({ where: { id: journalId } });
        await tx.financePostingProfile.deleteMany({ where: { id: profileId } });
        await tx.financePeriod.deleteMany({ where: { id: periodId } });
        await tx.companyMembership.deleteMany({ where: { companyId } });
        await tx.financeAccount.deleteMany({ where: { id: accountId } });
        await tx.user.deleteMany({ where: { id: userId } });
        await tx.company.deleteMany({ where: { id: companyId } });
      }).catch(() => undefined);
    }
  });
});
