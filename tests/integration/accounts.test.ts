import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import {
  accountDetail,
  saveAccount,
  importAccounts,
} from "../../packages/backend/src/finance/accounts";
import { saveTax } from "../../packages/backend/src/finance/operational-tax";

describe("account workspace", () => {
  const c = randomUUID(),
    a = randomUUID();
  const input = (code: string) => ({
    code,
    name: `Account ${code}`,
    category: "ASSET",
    category_label: "Kas & Bank",
    normal_balance: "DEBIT",
    active: true,
  });
  beforeAll(async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname))
      throw new Error("Local database required");
    await prisma.company.create({ data: { id: c, name: "Account integration" } });
    await prisma.user.create({
      data: { id: a, email: `${a}@example.invalid`, displayName: "Test", passwordHash: "disabled" },
    });
  });
  afterAll(async () => {
    await prisma.financePostingProfile.deleteMany({ where: { companyId: c } });
    await prisma.financeAccount.deleteMany({ where: { companyId: c } });
    await prisma.auditEvent.deleteMany({ where: { companyId: c } });
    await prisma.transactionCommand.deleteMany({ where: { companyId: c } });
    await prisma.company.delete({ where: { id: c } });
    await prisma.user.delete({ where: { id: a } });
  });
  it("creates and edits with version and audit; idempotent replay does not duplicate", async () => {
    const key = randomUUID(),
      r = await saveAccount(c, a, input("1-10001"), key);
    expect((await saveAccount(c, a, input("1-10001"), key)).id).toBe(r.id);
    const next = await saveAccount(
      c,
      a,
      { ...input("1-10001"), description: "Updated" },
      randomUUID(),
      r.id,
      1,
    );
    expect(next.version).toBe(2);
    await expect(saveAccount(c, a, input("1-10001"), randomUUID(), r.id, 1)).rejects.toThrow(
      "Versi akun berubah",
    );
    const detail = await accountDetail(c, r.id);
    expect(detail.history).toHaveLength(2);
    expect(detail).not.toHaveProperty("balance");
    await expect(accountDetail(randomUUID(), r.id)).rejects.toThrow("Akun tidak ditemukan");
  });
  it("rejects cycles, foreign parents and header tax accounts", async () => {
    const header = await saveAccount(
      c,
      a,
      { ...input("H1"), account_type: "HEADER" },
      randomUUID(),
    );
    const child = await saveAccount(
      c,
      a,
      { ...input("H2"), account_type: "HEADER", parent_id: header.id },
      randomUUID(),
    );
    await expect(
      saveAccount(
        c,
        a,
        { ...input("H1"), account_type: "HEADER", parent_id: child.id },
        randomUUID(),
        header.id,
        1,
      ),
    ).rejects.toThrow("siklus");
    await expect(
      saveAccount(c, a, { ...input("CH"), parent_id: randomUUID() }, randomUUID()),
    ).rejects.toThrow("Akun induk");
    await expect(
      saveTax(
        c,
        a,
        {
          name: "Invalid header",
          kind: "PPN",
          effect: "ADD",
          account_id: header.id,
          percentage: "11",
          decimal_places: 2,
          rounding: "HALF_UP",
          active: true,
          effective_from: "2020-01-01T00:00:00.000Z",
        },
        randomUUID(),
      ),
    ).rejects.toThrow("TAX_ACCOUNT_INVALID");
  });
  it("locks classification and active mapping but permits audited safe edits", async () => {
    const r = await saveAccount(c, a, input("USED"), randomUUID());
    await prisma.financePostingProfile.create({
      data: {
        companyId: c,
        effectiveFrom: new Date("2020-01-01"),
        effectiveTo: new Date("2099-01-01"),
        mappings: { AR: r.id },
        createdById: a,
      },
    });
    await expect(
      saveAccount(
        c,
        a,
        { ...input("USED"), category: "EXPENSE", reason: "Test" },
        randomUUID(),
        r.id,
        1,
      ),
    ).rejects.toThrow("reklasifikasi");
    await expect(
      saveAccount(c, a, { ...input("USED"), active: false, reason: "Test" }, randomUUID(), r.id, 1),
    ).rejects.toThrow("referensi aktif");
    await expect(
      saveAccount(c, a, { ...input("USED"), name: "Updated" }, randomUUID(), r.id, 1),
    ).rejects.toThrow("Alasan");
    expect(
      (
        await saveAccount(
          c,
          a,
          { ...input("USED"), name: "Updated", reason: "Correct name" },
          randomUUID(),
          r.id,
          1,
        )
      ).name,
    ).toBe("Updated");
  });
  it("imports atomically without balances and preserves duplicate names with distinct codes", async () => {
    const body = {
        file_name: "test.xlsx",
        sha256: "a".repeat(64),
        rows: [
          { ...input("I1"), name: "Same" },
          { ...input("I2"), name: "Same" },
        ],
      },
      key = randomUUID();
    expect((await importAccounts(c, a, body, key)).count).toBe(2);
    expect((await importAccounts(c, a, body, key)).count).toBe(2);
    await expect(
      importAccounts(c, a, { ...body, rows: [input("ROLLBACK"), input("I1")] }, randomUUID()),
    ).rejects.toThrow("Kode akun");
    expect(await prisma.financeAccount.count({ where: { companyId: c, code: "ROLLBACK" } })).toBe(
      0,
    );
    await expect(
      saveAccount(c, a, { ...input("BAL"), balance: "100" }, randomUUID()),
    ).rejects.toThrow();
    expect(await prisma.financeJournalLine.count({ where: { companyId: c } })).toBe(0);
  });
});
