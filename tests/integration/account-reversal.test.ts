import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { postLedger } from "../../packages/backend/src/finance/posting";

it("inactive historical accounts permit only an exact reversal, never new or altered postings", async () => {
  const rollback = new Error("ROLLBACK_FIXTURE");
  try {
    await prisma.$transaction(async (tx) => {
      const c = randomUUID(),
        actor = randomUUID();
      await tx.company.create({ data: { id: c, name: "Account reversal fixture" } });
      await tx.user.create({
        data: {
          id: actor,
          email: `${actor}@example.invalid`,
          displayName: "Test",
          passwordHash: "disabled",
        },
      });
      await tx.companyMembership.create({ data: { companyId: c, userId: actor } });
      const debit = await tx.financeAccount.create({
        data: { companyId: c, code: "A", name: "Asset", category: "ASSET" },
      });
      const credit = await tx.financeAccount.create({
        data: { companyId: c, code: "E", name: "Equity", category: "EQUITY" },
      });
      await tx.financePeriod.create({
        data: { companyId: c, startsOn: new Date("2020-01-01"), endsOn: new Date("2099-12-31") },
      });
      await tx.financePostingProfile.create({
        data: {
          companyId: c,
          effectiveFrom: new Date("2020-01-01"),
          effectiveTo: new Date("2100-01-01"),
          createdById: actor,
          mappings: { INVENTORY: debit.id, OPENING_STOCK: credit.id },
        },
      });
      const sourceId = randomUUID();
      const data = [
        {
          companyId: c,
          sourceId,
          sourceType: "OPENING_STOCK",
          kind: "INVENTORY" as const,
          debit: "10",
          credit: "0",
        },
        {
          companyId: c,
          sourceId,
          sourceType: "OPENING_STOCK",
          kind: "OPENING_STOCK" as const,
          debit: "0",
          credit: "10",
        },
      ];
      const original = await postLedger(tx, actor, { data });
      await tx.financeAccount.updateMany({ where: { companyId: c }, data: { active: false } });
      const newSource = randomUUID();
      await expect(
        postLedger(tx, actor, { data: data.map((l) => ({ ...l, sourceId: newSource })) }),
      ).rejects.toThrow("POSTING_ACCOUNT_INVALID");
      const reversalId = randomUUID();
      const reversed = data.map((l) => ({
        ...l,
        sourceId: reversalId,
        sourceType: "SOURCE_REVERSAL",
        debit: l.credit,
        credit: l.debit,
      }));
      const input = {
        data: reversed,
        accountIds: [debit.id, credit.id],
        reversalOfJournalId: original.id,
      };
      await expect(
        postLedger(tx, actor, { ...input, data: reversed.map((l) => ({ ...l, debit: "99" })) }),
      ).rejects.toThrow("REVERSAL_LINES_MISMATCH");
      const reversal = await postLedger(tx, actor, input);
      expect(await tx.financeJournalLine.count({ where: { journalId: reversal.id } })).toBe(2);
      expect(await tx.financeJournalLine.count({ where: { journalId: original.id } })).toBe(2);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
});
