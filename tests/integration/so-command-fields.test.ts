import { randomUUID } from "node:crypto";
import type { Prisma } from "@evflow/database";
import { prisma } from "@evflow/database";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { reviseOrder, closeRemainder } from "../../packages/backend/src/sales/o2c-lifecycle";
import { listSalesOrders } from "../../packages/backend/src/sales/order-list";

const service = new OtcPtpService(new AuditService());
const rollback = new Error("rollback SO command test");
type Tx = Prisma.TransactionClient;
const realTransaction = prisma.$transaction.bind(prisma);
async function fixture(run: (f: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database only");
  await realTransaction(
    async (tx) => {
      const f = await setup(tx);
      // Keep real domain commands and their SQL/idempotency in the outer rollback transaction.
      const stub = vi.spyOn(prisma, "$transaction").mockImplementation(async (fn: unknown) => {
        if (typeof fn !== "function") throw new Error("Unexpected array transaction");
        return fn(tx);
      });
      try {
        await run(f);
      } finally {
        stub.mockRestore();
        prisma.$transaction = realTransaction;
      }
      throw rollback;
    },
    { timeout: 60000 },
  ).catch((e) => {
    if (e !== rollback) throw e;
  });
}
async function setup(tx: Tx) {
  const c = (await tx.company.create({ data: { name: "SO COMMAND TEST ONLY" } })).id;
  const a = (
    await tx.user.create({
      data: {
        email: `${randomUUID()}@test.invalid`,
        displayName: "Tester",
        passwordHash: "disabled",
      },
    })
  ).id;
  await tx.companyMembership.create({ data: { companyId: c, userId: a } });
  const master = () => ({
    companyId: c,
    code: randomUUID(),
    name: randomUUID(),
    normalizedName: randomUUID(),
    state: "ACTIVE" as const,
    createdById: a,
    updatedById: a,
  });
  const channel = await tx.customerChannel.create({ data: master() });
  const customer = await tx.customer.create({
    data: {
      ...master(),
      channelId: channel.id,
      defaultTermCode: "COD",
      shippingAddress: "Main address",
    },
  });
  const wa = await tx.warehouse.create({ data: { ...master(), timezone: "Asia/Makassar" } });
  const wb = await tx.warehouse.create({ data: { ...master(), timezone: "Asia/Makassar" } });
  const unit = await tx.uom.create({ data: master() });
  const category = await tx.productCategory.create({ data: master() });
  const product = await tx.product.create({
    data: { ...master(), baseUomId: unit.id, categoryId: category.id },
  });
  for (const warehouse of [wa, wb]) {
    const locator = await tx.locator.create({
      data: { ...master(), warehouseId: warehouse.id, locatorType: "STORAGE" },
    });
    await tx.stockLot.create({
      data: {
        companyId: c,
        productId: product.id,
        warehouseId: warehouse.id,
        locatorId: locator.id,
        batchNo: randomUUID(),
        expiryDate: new Date("2099-01-01"),
        quantityOnHand: warehouse.id === wa.id ? "10" : "50",
        unitCost: "1",
        qualityState: "AVAILABLE",
      },
    });
  }
  for (const kind of ["sales_order", "fulfillment"])
    await tx.documentNumberRule.create({
      data: {
        companyId: c,
        documentKind: kind,
        prefix: kind === "sales_order" ? "SO" : "FUL",
        digits: 4,
        effectiveFrom: new Date("2000-01-01"),
        effectiveTo: new Date("2999-12-31"),
        createdById: a,
      },
    });
  const policy = async (code: string, value: Prisma.InputJsonValue) =>
    tx.systemPolicy.create({
      data: {
        companyId: c,
        code,
        name: code,
        ownerDomain: "administration",
        policyGroup: "sales",
        scope: "company",
        valueType: "object",
        validationSchema: {},
        defaultValueSnapshot: {},
        versions: { create: { versionNo: 1, state: "ACTIVE", savedById: a, valueSnapshot: value } },
      },
    });
  await policy("OPS-FLX-03", [
    { code: "COD", label: "COD", kind: "COD", days: 0 },
    { code: "NET30", label: "Tempo 30", kind: "TEMPO", days: 30 },
  ]);
  await policy("OPS-WH-02", { with_expiry: "FEFO", without_expiry: "FIFO" });
  await tx.productReferencePrice.create({
    data: {
      companyId: c,
      productId: product.id,
      uomId: unit.id,
      kind: "SALE",
      currency: "IDR",
      unitPrice: "10",
      effectiveFrom: new Date("2000-01-01"),
      createdById: a,
    },
  });
  const account = await tx.financeAccount.create({
    data: { companyId: c, code: "TEST", name: "Test VAT", category: "LIABILITY" },
  });
  const tax = await tx.operationalTax.create({
    data: {
      companyId: c,
      name: "TEST VAT",
      kind: "PPN",
      usage: "SALES",
      effect: "ADD",
      accountId: account.id,
      percentage: "10",
      dppFactor: "1",
      decimalPlaces: 2,
      rounding: "HALF_UP",
      effectiveFrom: new Date("2000-01-01"),
      isDefaultSales: true,
    },
  });
  await tx.operationalTaxRevision.create({
    data: {
      companyId: c,
      taxId: tax.id,
      version: tax.version,
      snapshot: JSON.parse(JSON.stringify(tax)),
      actorId: a,
    },
  });
  const input = () => ({
    customer_id: customer.id,
    warehouse_id: wa.id,
    order_date: "2020-01-02",
    payment_term_code: "NET30",
    currency: "IDR",
    lines: [{ product_id: product.id, quantity: "30", unit_price: "10" }],
  });
  return { tx, c, a, customer, wa, wb, product, input, policy };
}
describe("SO commands persist selected fields and isolate stock", () => {
  it("submits demand without reservations or legacy credit gates", async()=>fixture(async f=>{
    await f.tx.customer.update({where:{id:f.customer.id},data:{creditFrozen:true,freezeReason:"Historical freeze",creditLimit:"0"}});
    const order=await service.createSalesOrder(f.c,f.a,f.input(),randomUUID());
    const submitted=await service.submitSalesOrder(f.c,f.a,order.id,randomUUID(),order.version);
    expect(submitted.state).toBe("OPEN");
    expect(submitted.paymentSnapshot).toMatchObject({term_code:"NET30",top_days:30});
    expect(await f.tx.fulfillmentBatch.count({where:{companyId:f.c,salesOrderId:order.id}})).toBe(0);
    expect(await f.tx.inventoryMovement.count({where:{companyId:f.c,kind:"RESERVATION"}})).toBe(0);
    expect((await f.tx.stockLot.findMany({where:{companyId:f.c}})).every(l=>l.quantityReserved.isZero())).toBe(true);
    expect(submitted.lines.every(l=>l.allocatedQuantity.isZero())).toBe(true);
  }));
  it("does not complete undelivered allocations when the shortage is closed", async () =>
    fixture(async (f) => {
      const order = await service.createSalesOrder(f.c, f.a, f.input(), randomUUID());
      const submitted = await service.submitSalesOrder(
        f.c,
        f.a,
        order.id,
        randomUUID(),
        order.version,
      );
      await closeRemainder(
        f.c,
        f.a,
        order.id,
        {
          version: submitted.version,
          reason: "Close shortage",
          lines: [{ line_id: submitted.lines[0]!.id, quantity: "20" }],
        },
        randomUUID(),
      );
      const result = await listSalesOrders(f.c, 1, "", undefined, {}, f.tx);
      expect(result.rows[0]).toMatchObject({ state: "CLOSED", displayStatus: "OPEN" });
    }));
  it("lists business dates and status tabs consistently with filtered totals and exact search", async () =>
    fixture(async (f) => {
      const first = await service.createSalesOrder(
        f.c,
        f.a,
        { ...f.input(), customer_reference: "SP%literal" },
        randomUUID(),
      );
      const second = await service.createSalesOrder(
        f.c,
        f.a,
        { ...f.input(), order_date: "2020-02-03", customer_reference: "SP-other" },
        randomUUID(),
      );
      await service.submitSalesOrder(f.c, f.a, second.id, randomUUID(), second.version);
      const all = await listSalesOrders(f.c, 1, "", undefined, {}, f.tx);
      expect(all.total).toBe(2);
      expect(all.summary).toMatchObject({ DRAFT: 1, OPEN: 1, all: 2 });
      expect(all.rows[0]).toMatchObject({
        id: second.id,
        displayStatus: "OPEN",
        dueDateEstimate: "2020-03-04",
        downPayment: "0",
      });
      expect(all.rows[0]).not.toHaveProperty("paymentSnapshot");
      expect(JSON.stringify(all.rows)).not.toContain("credit_limit");
      const filtered = await listSalesOrders(f.c, 1, "", undefined, { status: "DRAFT" }, f.tx);
      expect(filtered.total).toBe(1);
      expect(filtered.rows[0]!.id).toBe(first.id);
      expect(filtered.summary.all).toBe(2);
      expect((await listSalesOrders(f.c, 1, "SP%", undefined, {}, f.tx)).total).toBe(1);
      expect(
        (
          await listSalesOrders(
            f.c,
            1,
            "",
            undefined,
            { from: "2020-02-01", to: "2020-02-28" },
            f.tx,
          )
        ).total,
      ).toBe(1);
      expect((await listSalesOrders(randomUUID(), 1, "", undefined, {}, f.tx)).total).toBe(0);
      expect((await listSalesOrders(f.c, 2, "", undefined, {}, f.tx)).rows).toEqual([]);
    }));
  it("creates minimally, replays once, revises fields, snapshots selected term without reserving warehouse stock", async () =>
    fixture(async (f) => {
      const { tx, c, a, input, wa } = f;
      const key = randomUUID();
      const order = await service.createSalesOrder(c, a, input(), key);
      expect(order).toMatchObject({
        warehouseId: wa.id,
        paymentTermCode: "NET30",
        deliveryAddress: "Main address",
        customerReference: null,
        salespersonId: a,
        orderDate: new Date("2020-01-02"),
      });
      expect((await service.createSalesOrder(c, a, input(), key)).id).toBe(order.id);
      expect(await tx.salesOrder.count({ where: { companyId: c } })).toBe(1);
      expect(await tx.ledgerEntry.count({ where: { companyId: c } })).toBe(0);
      const revised = await reviseOrder(
        c,
        a,
        order.id,
        {
          version: order.version,
          reason: "Change reference",
          customer_reference: "SP-NEW",
          lines: order.lines.map((l: { id: string }) => ({
            line_id: l.id,
            quantity: "30",
            unit_price: "10",
          })),
        },
        randomUUID(),
      );
      expect(revised).toMatchObject({
        warehouseId: wa.id,
        paymentTermCode: "NET30",
        customerReference: "SP-NEW",
      });
      const submitted = await service.submitSalesOrder(
        c,
        a,
        order.id,
        randomUUID(),
        revised.version,
      );
      expect(submitted.paymentSnapshot).toMatchObject({
        term_code: "NET30",
        mode: "TEMPO",
        top_days: 30,
      });
      expect(submitted.lines[0]!.allocatedQuantity.toString()).toBe("0");
      expect(submitted.lines[0]!.backorderQuantity.toString()).toBe("0");
      expect(
        (
          await tx.stockLot.findFirstOrThrow({ where: { companyId: c, warehouseId: f.wb.id } })
        ).quantityReserved.toString(),
      ).toBe("0");
      // Changing the term catalog after submission must not invalidate issued payment terms.
      await tx.policyVersion.updateMany({
        where: { policy: { companyId: c, code: "OPS-FLX-03" } },
        data: { valueSnapshot: [] },
      });
      const again = await service.submitSalesOrder(c, a, order.id, randomUUID(), submitted.version);
      expect(again.paymentSnapshot).toMatchObject({ term_code: "NET30", top_days: 30 });
    }));
  it("rejects a removed term at draft submission and rechecks mandatory reference", async () =>
    fixture(async (f) => {
      const order = await service.createSalesOrder(f.c, f.a, f.input(), randomUUID());
      await f.policy("OPS-FLX-12", true);
      await expect(
        service.submitSalesOrder(f.c, f.a, order.id, randomUUID(), order.version),
      ).rejects.toThrow("ORDER_REFERENCE_REQUIRED");
      await f.tx.policyVersion.updateMany({
        where: { policy: { companyId: f.c, code: "OPS-FLX-12" } },
        data: { valueSnapshot: false },
      });
      await f.tx.policyVersion.updateMany({
        where: { policy: { companyId: f.c, code: "OPS-FLX-03" } },
        data: { valueSnapshot: [] },
      });
      await expect(
        service.submitSalesOrder(f.c, f.a, order.id, randomUUID(), order.version),
      ).rejects.toThrow("ORDER_PAYMENT_TERM_UNKNOWN");
    }));
  it("supports line warehouse override and legacy unscoped orders", async () =>
    fixture(async (f) => {
      await f.policy("OPS-FLX-11", true);
      const body = f.input();
      const order = await service.createSalesOrder(
        f.c,
        f.a,
        { ...body, lines: [{ ...body.lines[0], warehouse_id: f.wb.id }] },
        randomUUID(),
      );
      const submitted = await service.submitSalesOrder(
        f.c,
        f.a,
        order.id,
        randomUUID(),
        order.version,
      );
      expect(submitted.lines[0]!.allocatedQuantity.toString()).toBe("0");
      const legacy = await f.tx.salesOrder.create({
        data: {
          companyId: f.c,
          customerId: f.customer.id,
          number: randomUUID(),
          createdById: f.a,
          lines: {
            create: {
              companyId: f.c,
              productId: f.product.id,
              orderedQuantity: "25",
              unitPrice: "10",
            },
          },
        },
      });
      const result = await service.submitSalesOrder(
        f.c,
        f.a,
        legacy.id,
        randomUUID(),
        legacy.version,
      );
      expect(result.lines[0]!.allocatedQuantity.toString()).toBe("0");
      expect(result.paymentSnapshot).toMatchObject({ term_code: "COD" });
    }));
});


