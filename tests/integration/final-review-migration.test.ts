import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";

describe("stage 2b final-review data migration", () => {
  it("moves unedited PPh 22 to 1-10501, spares edited rows, and folds tolerance into grace", async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname))
      throw new Error("Local test database required");
    const rollback = new Error("rollback migration test");
    const sql = readFileSync(
      "packages/database/prisma/migrations/20261025100000_fix_pph22_deduction_account/migration.sql",
      "utf8",
    );
    let done = false;
    try {
      await prisma.$transaction(
        async (tx) => {
          const mk = async (name: string) =>
            (await tx.company.create({ data: { name: `${name} ${randomUUID()}` } })).id;
          const seed = async (c: string) => {
            const a = await tx.financeAccount.create({
              data: { companyId: c, code: "1-10501", name: "PPh 22", category: "ASSET" },
            });
            const b = await tx.financeAccount.create({
              data: { companyId: c, code: "1-10502", name: "PPh 23", category: "ASSET" },
            });
            return { a: a.id, b: b.id };
          };
          const c1 = await mk("fresh");
          const c2 = await mk("edited");
          const s1 = await seed(c1);
          const s2 = await seed(c2);
          const deduction = (c: string, account: string, version: number) =>
            tx.deductionType.create({
              data: {
                companyId: c,
                name: "PPh 22",
                settleAccountId: account,
                proofType: "BUKTI_POTONG",
                proofRequired: true,
                version,
              },
            });
          const d1 = await deduction(c1, s1.b, 1);
          const d2 = await deduction(c2, s2.b, 2);
          const user = await tx.user.create({
            data: { email: `${randomUUID()}@t.local`, displayName: "T", passwordHash: "x" },
          });
          const cust = (name: string, extra: object) =>
            tx.customer.create({
              data: {
                companyId: c1,
                code: randomUUID(),
                name,
                normalizedName: name + randomUUID(),
                state: "ACTIVE",
                createdById: user.id,
                updatedById: user.id,
                ...extra,
              },
            });
          const copy = await cust("copy", { paymentToleranceDays: 7 });
          const keep = await cust("keep", { paymentToleranceDays: 7, pastDueGraceDays: 3 });
          const none = await cust("none", {});
          for (const statement of sql
            .split("\n")
            .filter((l) => !l.trim().startsWith("--"))
            .join("\n")
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean))
            await tx.$executeRawUnsafe(statement);
          expect(
            (await tx.deductionType.findUniqueOrThrow({ where: { id: d1.id } })).settleAccountId,
          ).toBe(s1.a);
          expect(
            (await tx.deductionType.findUniqueOrThrow({ where: { id: d2.id } })).settleAccountId,
          ).toBe(s2.b);
          const grace = async (id: string) =>
            (await tx.customer.findUniqueOrThrow({ where: { id } })).pastDueGraceDays;
          expect(await grace(copy.id)).toBe(7);
          expect(await grace(keep.id)).toBe(3);
          expect(await grace(none.id)).toBeNull();
          done = true;
          throw rollback;
        },
        { timeout: 120_000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
    expect(done).toBe(true);
  });
});
