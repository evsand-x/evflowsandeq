import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "@evflow/database";
import {
  saveTax,
  operationalTaxSnapshot,
  calculateOperationalTax,
  recordTaxInvoice,
} from "../../packages/backend/src/finance/operational-tax";
import { lineAmounts } from "../../packages/backend/src/sales/pricing-controls";

describe("operational tax master", () => {
  let companyId: string, actorId: string, accountId: string, taxId: string;
  const input = () => ({
    name: "PPN test",
    kind: "PPN",
    effect: "ADD",
    account_id: accountId,
    percentage: "11",
    decimal_places: 2,
    rounding: "HALF_UP",
    active: true,
    effective_from: "2026-01-01T00:00:00.000Z",
  });
  beforeAll(async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname))
      throw new Error("Local database required");
    companyId = (await prisma.company.create({ data: { name: `Tax integration ${randomUUID()}` } }))
      .id;
    actorId = (
      await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.invalid`,
          displayName: "Tax test",
          passwordHash: "not-a-login",
        },
      })
    ).id;
    accountId = (
      await prisma.financeAccount.create({
        data: { companyId, code: "TEST-TAX", name: "Test tax", category: "LIABILITY" },
      })
    ).id;
  });
  afterAll(async () => {
    if (!companyId) return;
    await prisma.operationalTaxRevision.deleteMany({ where: { companyId } });
    await prisma.operationalTax.deleteMany({ where: { companyId } });
    await prisma.auditEvent.deleteMany({ where: { companyId } });
    await prisma.transactionCommand.deleteMany({ where: { companyId } });
    await prisma.financeAccount.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    if (actorId) await prisma.user.delete({ where: { id: actorId } });
  });
  it("creates immediately, replays idempotently and records an audited revision", async () => {
    const key = randomUUID();
    const first = await saveTax(companyId, actorId, input(), key);
    taxId = first.id;
    expect(first.active).toBe(true);
    expect((await saveTax(companyId, actorId, input(), key)).id).toBe(first.id);
    expect(await prisma.operationalTaxRevision.count({ where: { taxId } })).toBe(1);
    expect(
      await prisma.auditEvent.count({ where: { companyId, action: "operational_tax.created" } }),
    ).toBe(1);
    await expect(
      saveTax(companyId, actorId, { ...input(), percentage: "12" }, key),
    ).rejects.toThrow("IDEMPOTENCY_PAYLOAD_MISMATCH");
  });
  it("preserves historical rates and frozen transaction snapshots after editing", async () => {
    const old = await operationalTaxSnapshot(prisma, companyId, taxId, new Date("2026-02-01"));
    await saveTax(
      companyId,
      actorId,
      { ...input(), percentage: "12", effective_from: "2026-03-01T00:00:00.000Z" },
      randomUUID(),
      taxId,
      1,
    );
    const current = await operationalTaxSnapshot(prisma, companyId, taxId, new Date("2026-04-01"));
    expect(current.rate).toBe("0.12");
    expect(
      (await operationalTaxSnapshot(prisma, companyId, taxId, new Date("2026-02-01"))).rate,
    ).toBe("0.11");
    expect(calculateOperationalTax("1000", old).toString()).toBe("110");
    expect(
      lineAmounts(
        { unitPrice: new Prisma.Decimal("1000"), taxSnapshot: old },
        new Prisma.Decimal(1),
      ).total.toString(),
    ).toBe("1110");
    expect(current.account_id).toBe(accountId);
    await expect(saveTax(companyId, actorId, input(), randomUUID(), taxId, 1)).rejects.toThrow(
      "TAX_VERSION_CONFLICT",
    );
  });
  it("rejects foreign accounts, missing source and foreign master scope", async () => {
    await expect(
      saveTax(companyId, actorId, { ...input(), account_id: randomUUID() }, randomUUID()),
    ).rejects.toThrow("TAX_ACCOUNT_INVALID");
    await expect(operationalTaxSnapshot(prisma, randomUUID(), taxId)).rejects.toThrow(
      "TAX_NOT_EFFECTIVE",
    );
    await expect(
      recordTaxInvoice(
        companyId,
        actorId,
        "INPUT",
        randomUUID(),
        { number: "TEST", document_date: "2026-10-16", evidence_id: randomUUID(), version: 0 },
        randomUUID(),
      ),
    ).rejects.toThrow();
  });
  it("enforces transaction usage, preserves it on legacy updates and rejects duplicate names", async () => {
    const row = await saveTax(
      companyId,
      actorId,
      { ...input(), name: "PPN Penjualan", usage: "SALES" },
      randomUUID(),
    );
    const sales = await operationalTaxSnapshot(prisma, companyId, row.id, new Date(), "SALES");
    expect(sales.usage).toBe("SALES");
    expect(calculateOperationalTax("100000", sales).toString()).toBe("11000");
    await expect(
      operationalTaxSnapshot(prisma, companyId, row.id, new Date(), "PURCHASE"),
    ).rejects.toThrow("TAX_USAGE_MISMATCH");
    await expect(
      saveTax(companyId, actorId, { ...input(), name: "ppn penjualan" }, randomUUID()),
    ).rejects.toThrow("TAX_NAME_EXISTS");
    const updated = await saveTax(
      companyId,
      actorId,
      { ...input(), name: "PPN Penjualan" },
      randomUUID(),
      row.id,
      1,
    );
    expect(updated.usage).toBe("SALES");
  });
  it("calculates PPh deductions with decimal arithmetic and blocks inactive rules", async () => {
    const row = await saveTax(
      companyId,
      actorId,
      { ...input(), name: "PPh test", kind: "PPH", effect: "DEDUCT", percentage: "2.5" },
      randomUUID(),
    );
    const snapshot = await operationalTaxSnapshot(prisma, companyId, row.id);
    expect(calculateOperationalTax("1234.56", snapshot).toString()).toBe("-30.86");
    expect(
      lineAmounts(
        { unitPrice: new Prisma.Decimal("1234.56"), taxSnapshot: snapshot },
        new Prisma.Decimal(1),
      ).total.toString(),
    ).toBe("1203.7");
    await saveTax(
      companyId,
      actorId,
      {
        ...input(),
        name: "PPh test",
        kind: "PPH",
        effect: "DEDUCT",
        percentage: "2.5",
        active: false,
      },
      randomUUID(),
      row.id,
      1,
    );
    await expect(operationalTaxSnapshot(prisma, companyId, row.id)).rejects.toThrow(
      "TAX_NOT_EFFECTIVE",
    );
  });
});
