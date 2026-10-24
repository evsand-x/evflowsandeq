import type * as Database from "@evflow/database";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@evflow/database";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import {
  defaultSalesTaxSnapshot,
  saveTax,
  setDefaultTax,
} from "../../packages/backend/src/finance/operational-tax";
import { provisionCompanyDefaults } from "../../packages/backend/src/administration/company-defaults";
import { financeFixture } from "./finance-fixture";

// Real database and domain commands, all enclosed in a rollback-only transaction.
const context = vi.hoisted(() => ({ tx: null as Prisma.TransactionClient | null }));
vi.mock("@evflow/database", async (original) => {
  const module = await original<typeof Database>();
  return {
    ...module,
    prisma: new Proxy(module.prisma, {
      get(target, key) {
        if (context.tx && key === "$transaction")
          return async (action: unknown) =>
            typeof action === "function"
              ? action(context.tx)
              : Promise.all(action as Promise<unknown>[]);
        const client = context.tx ?? target;
        const value = Reflect.get(client, key);
        return typeof value === "function" ? value.bind(client) : value;
      },
    }),
  };
});

const service = new OtcPtpService(new AuditService());
const rollback = new Error("ROLLBACK_DEFAULT_TAX_TEST");
type Fixture = {
  c: string;
  actor: string;
  customerId: string;
  productId: string;
  evidenceId: string;
};

async function inRollback(run: (fixture: Fixture) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  const actual = await vi.importActual<typeof Database>("@evflow/database");
  let completed = false;
  try {
    await actual.prisma.$transaction(
      async (tx) => {
        context.tx = tx;
        await run(await setup());
        completed = true;
        throw rollback;
      },
      { timeout: 120_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    context.tx = null;
  }
  expect(completed).toBe(true);
}

async function setup(): Promise<Fixture> {
  const c = randomUUID(),
    actor = randomUUID();
  const master = () => ({
    companyId: c,
    code: randomUUID(),
    name: randomUUID(),
    normalizedName: randomUUID(),
    state: "ACTIVE" as const,
    createdById: actor,
    updatedById: actor,
  });
  await prisma.company.create({ data: { id: c, name: "DEFAULT TAX TEST ONLY" } });
  await prisma.user.create({
    data: { id: actor, email: `${actor}@test.local`, displayName: "Test", passwordHash: "x" },
  });
  await prisma.companyMembership.create({ data: { companyId: c, userId: actor } });
  await financeFixture(c, actor);
  const evidenceId = (
    await prisma.transactionEvidence.create({
      data: {
        companyId: c,
        actorId: actor,
        purpose: "SALES_ORDER",
        originalName: "fixture.png",
        objectKey: "TEST-ONLY",
        sha256: "TEST-ONLY",
        sizeBytes: 1,
      },
    })
  ).id;
  const uom = await prisma.uom.create({ data: master() });
  const category = await prisma.productCategory.create({ data: master() });
  const product = await prisma.product.create({
    data: { ...master(), categoryId: category.id, baseUomId: uom.id },
  });
  const channel = await prisma.customerChannel.create({ data: master() });
  const customer = await prisma.customer.create({ data: { ...master(), channelId: channel.id } });
  const warehouse = await prisma.warehouse.create({
    data: { ...master(), timezone: "Asia/Makassar" },
  });
  const locator = await prisma.locator.create({
    data: { ...master(), warehouseId: warehouse.id, locatorType: "STORAGE" },
  });
  await prisma.systemPolicy.create({
    data: {
      companyId: c,
      code: "OPS-WH-02",
      name: "Test strategy",
      ownerDomain: "warehouse",
      policyGroup: "warehouse",
      scope: "company",
      valueType: "object",
      validationSchema: {},
      defaultValueSnapshot: {},
      versions: {
        create: {
          versionNo: 1,
          state: "ACTIVE",
          savedById: actor,
          valueSnapshot: { with_expiry: "FEFO", without_expiry: "FIFO" },
        },
      },
    },
  });
  await prisma.productReferencePrice.create({
    data: {
      companyId: c,
      productId: product.id,
      uomId: uom.id,
      kind: "SALE",
      currency: "IDR",
      unitPrice: "1000000",
      effectiveFrom: new Date("2020-01-01"),
      createdById: actor,
    },
  });
  await prisma.stockLot.create({
    data: {
      companyId: c,
      productId: product.id,
      warehouseId: warehouse.id,
      locatorId: locator.id,
      batchNo: randomUUID(),
      expiryDate: new Date("2090-01-01"),
      quantityOnHand: "10",
      unitCost: "3",
      qualityState: "AVAILABLE",
    },
  });
  await prisma.documentNumberRule.createMany({
    data: ["sales_order", "fulfillment", "document_PICKING"].map((documentKind) => ({
      companyId: c,
      documentKind,
      prefix: `${documentKind}-`,
      digits: 6,
      resetPeriod: "YEARLY",
      effectiveFrom: new Date("2020-01-01"),
      effectiveTo: new Date("2099-01-01"),
      createdById: actor,
    })),
  });
  await service.setPaymentPolicy(c, actor, customer.id, {
    mode: "TEMPO",
    top_days: 30,
    credit_limit: "100000000",
    past_due_grace_days: 0,
  });
  return { c, actor, customerId: customer.id, productId: product.id, evidenceId };
}

async function taxAccount(c: string, code: string) {
  return prisma.financeAccount.create({
    data: { companyId: c, code, name: `Akun ${code}`, category: "LIABILITY" },
  });
}

async function submitOrder(f: Fixture) {
  const so = await service.createSalesOrder(
    f.c,
    f.actor,
    {
      customer_id: f.customerId,
      customer_reference: randomUUID(),
      delivery_address: "Test",
      evidence_id: f.evidenceId,
      currency: "IDR",
      lines: [{ product_id: f.productId, quantity: "1", unit_price: "1000000" }],
    },
    randomUUID(),
  );
  await service.submitSalesOrder(f.c, f.actor, so.id, randomUUID());
  return prisma.salesOrderLine.findFirstOrThrow({ where: { salesOrderId: so.id } });
}

const ppnInput = (accountId: string) => ({
  name: "PPN Penjualan",
  kind: "PPN",
  usage: "SALES",
  effect: "ADD",
  account_id: accountId,
  percentage: "12",
  dpp_factor: "0.9166666667",
  decimal_places: 2,
  rounding: "HALF_UP",
  active: true,
  effective_from: "2020-01-01T00:00:00.000Z",
});

describe("default sales tax", () => {
  it("uses the default sales tax without a per-pair rule", async () => {
    await inRollback(async (f) => {
      const account = await taxAccount(f.c, "2-20500");
      await expect(
        prisma.$transaction((tx) => defaultSalesTaxSnapshot(tx, f.c, new Date())),
      ).rejects.toThrow("DEFAULT_SALES_TAX_REQUIRED");
      const tax = await saveTax(f.c, f.actor, ppnInput(account.id), randomUUID());
      await setDefaultTax(f.c, f.actor, tax.id, "SALES", tax.version, randomUUID());
      expect(await prisma.salesTaxRule.count({ where: { companyId: f.c } })).toBe(0);
      const line = await submitOrder(f);
      const snapshot = line.taxSnapshot as Record<string, unknown>;
      expect(snapshot).toMatchObject({
        rule_id: tax.id,
        rate: "0.12",
        dpp_factor: "0.9166666667",
        account_id: account.id,
        decimal_places: 2,
        rounding: "HALF_UP",
      });
      expect(snapshot.operational_tax_id).toBeUndefined();
      const order = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: line.salesOrderId },
      });
      // 1.000.000 x 11/12 = 916.666,67 (DPP) x 12% = 110.000,00 (PPN, effective 11%)
      expect(order.state).not.toBe("DRAFT");
      const { lineAmounts } = await import("../../packages/backend/src/sales/pricing-controls");
      const amounts = lineAmounts(line, line.orderedQuantity);
      expect(amounts.dpp.toFixed(2)).toBe("916666.67");
      expect(amounts.tax.toFixed(2)).toBe("110000.00");
    });
  });

  it("only one default sales tax", async () => {
    await inRollback(async (f) => {
      const account = await taxAccount(f.c, "2-20500");
      const first = await saveTax(f.c, f.actor, ppnInput(account.id), randomUUID());
      const second = await saveTax(
        f.c,
        f.actor,
        { ...ppnInput(account.id), name: "PPN Penjualan Baru", percentage: "11", dpp_factor: "1" },
        randomUUID(),
      );
      const firstDefault = await setDefaultTax(
        f.c,
        f.actor,
        first.id,
        "SALES",
        first.version,
        randomUUID(),
      );
      await expect(
        setDefaultTax(f.c, f.actor, second.id, "SALES", second.version + 5, randomUUID()),
      ).rejects.toThrow("TAX_VERSION_CONFLICT");
      await setDefaultTax(f.c, f.actor, second.id, "SALES", second.version, randomUUID());
      const defaults = await prisma.operationalTax.findMany({
        where: { companyId: f.c, isDefaultSales: true },
      });
      expect(defaults.map((t) => t.id)).toEqual([second.id]);
      const old = await prisma.operationalTax.findUniqueOrThrow({ where: { id: first.id } });
      expect(old.version).toBe(firstDefault.version + 1);
      await expect(
        prisma.operationalTax.update({ where: { id: first.id }, data: { isDefaultSales: true } }),
      ).rejects.toThrow();
    });
  });

  it("refuses a default sales tax that cannot apply to sales and keeps the default active", async () => {
    await inRollback(async (f) => {
      const account = await taxAccount(f.c, "2-20500");
      const purchase = await saveTax(
        f.c,
        f.actor,
        { ...ppnInput(account.id), name: "PPN Masukan", usage: "PURCHASE" },
        randomUUID(),
      );
      await expect(
        setDefaultTax(f.c, f.actor, purchase.id, "SALES", purchase.version, randomUUID()),
      ).rejects.toThrow("TAX_DEFAULT_INVALID");
      const sales = await saveTax(f.c, f.actor, ppnInput(account.id), randomUUID());
      const marked = await setDefaultTax(
        f.c,
        f.actor,
        sales.id,
        "SALES",
        sales.version,
        randomUUID(),
      );
      await expect(
        saveTax(
          f.c,
          f.actor,
          { ...ppnInput(account.id), active: false, effective_from: new Date().toISOString() },
          randomUUID(),
          sales.id,
          marked.version,
        ),
      ).rejects.toThrow("TAX_DEFAULT_REQUIRED_ACTIVE");
    });
  });

  it("snapshot survives rate change", async () => {
    await inRollback(async (f) => {
      const account = await taxAccount(f.c, "2-20500");
      const tax = await saveTax(f.c, f.actor, ppnInput(account.id), randomUUID());
      const marked = await setDefaultTax(f.c, f.actor, tax.id, "SALES", tax.version, randomUUID());
      const before = await submitOrder(f);
      await saveTax(
        f.c,
        f.actor,
        { ...ppnInput(account.id), percentage: "15", effective_from: new Date().toISOString() },
        randomUUID(),
        tax.id,
        marked.version,
      );
      const still = await prisma.salesOrderLine.findUniqueOrThrow({ where: { id: before.id } });
      expect((still.taxSnapshot as { rate: string }).rate).toBe("0.12");
      const after = await submitOrder(f);
      expect((after.taxSnapshot as { rate: string }).rate).toBe("0.15");
      const changed = await prisma.operationalTax.findUniqueOrThrow({ where: { id: tax.id } });
      expect(changed.isDefaultSales).toBe(true);
    });
  });

  it("provisions PPN Penjualan and PPN Masukan from the imported chart, idempotently", async () => {
    await inRollback(async (f) => {
      await taxAccount(f.c, "2-20500");
      await prisma.financeAccount.create({
        data: { companyId: f.c, code: "1-10500", name: "PPN Masukan", category: "ASSET" },
      });
      const first = await prisma.$transaction((tx) => provisionCompanyDefaults(tx, f.c, f.actor));
      expect(first.taxes_created.sort()).toEqual(["PPN Masukan", "PPN Penjualan"]);
      const again = await prisma.$transaction((tx) => provisionCompanyDefaults(tx, f.c, f.actor));
      expect(again.taxes_created).toEqual([]);
      const taxes = await prisma.operationalTax.findMany({
        where: { companyId: f.c },
        orderBy: { name: "asc" },
      });
      expect(
        taxes.map((t) => [
          t.name,
          t.percentage.toString(),
          t.dppFactor.toString(),
          t.isDefaultSales,
          t.isDefaultPurchase,
        ]),
      ).toEqual([
        ["PPN Masukan", "12", "0.9166666667", false, true],
        ["PPN Penjualan", "12", "0.9166666667", true, false],
      ]);
      const snapshot = await prisma.$transaction((tx) =>
        defaultSalesTaxSnapshot(tx, f.c, new Date()),
      );
      expect(snapshot).toMatchObject({ rate: "0.12", dpp_factor: "0.9166666667" });
    });
  });
});
