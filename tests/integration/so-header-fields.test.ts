import { randomUUID } from "node:crypto";
import type { Prisma } from "@evflow/database";
import { prisma } from "@evflow/database";
import { resolveOrderHeader } from "../../packages/backend/src/sales/order-header";

const rollback = new Error("rollback SO header test");
async function fixture(
  run: (
    tx: Prisma.TransactionClient,
    c: string,
    a: string,
    customer: Awaited<ReturnType<typeof prisma.customer.create>>,
    warehouse: Awaited<ReturnType<typeof prisma.warehouse.create>>,
  ) => Promise<void>,
) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local test database required");
  await prisma
    .$transaction(
      async (tx) => {
        const { id: c } = await tx.company.create({ data: { name: "SO header test" } });
        const { id: a } = await tx.user.create({
          data: {
            email: `${randomUUID()}@test.invalid`,
            displayName: "Tester",
            passwordHash: "disabled",
          },
        });
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
          data: { ...master(), channelId: channel.id, shippingAddress: "Alamat kirim utama" },
        });
        const warehouse = await tx.warehouse.create({
          data: { ...master(), timezone: "Asia/Makassar" },
        });
        await run(tx, c, a, customer, warehouse);
        throw rollback;
      },
      { timeout: 30000 },
    )
    .catch((e) => {
      if (e !== rollback) throw e;
    });
}
async function policy(
  tx: Prisma.TransactionClient,
  c: string,
  a: string,
  code: string,
  value: Prisma.InputJsonValue,
) {
  await tx.systemPolicy.create({
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
}
const input = () => ({
  customer_id: randomUUID(),
  currency: "IDR",
  lines: [{ product_id: randomUUID(), quantity: "1", unit_price: "1000" }],
});
describe("SO header defaults and isolation", () => {
  it("defaults address, salesperson and sole active warehouse and allows an old business date", async () =>
    fixture(async (tx, c, a, customer, w) => {
      const h = await resolveOrderHeader(
        tx,
        c,
        a,
        { ...input(), order_date: "2020-01-02" },
        customer,
      );
      expect(h).toMatchObject({
        orderDate: new Date("2020-01-02"),
        salespersonId: a,
        warehouseId: w.id,
        deliveryAddress: customer.shippingAddress,
        customerReference: null,
        evidenceId: null,
      });
    }));
  it("requires reference and evidence only when configured", async () =>
    fixture(async (tx, c, a, customer) => {
      await policy(tx, c, a, "OPS-FLX-12", true);
      await policy(tx, c, a, "OPS-FLX-13", true);
      await expect(resolveOrderHeader(tx, c, a, input(), customer)).rejects.toThrow(
        "ORDER_REFERENCE_REQUIRED",
      );
      await expect(
        resolveOrderHeader(tx, c, a, { ...input(), customer_reference: "SP" }, customer),
      ).rejects.toThrow("SALES_ORDER_EVIDENCE_REQUIRED");
    }));
  it("rejects unknown terms and foreign salesperson or warehouse", async () =>
    fixture(async (tx, c, a, customer) => {
      await expect(
        resolveOrderHeader(tx, c, a, { ...input(), payment_term_code: "NOPE" }, customer),
      ).rejects.toThrow("ORDER_PAYMENT_TERM_UNKNOWN");
      await expect(
        resolveOrderHeader(tx, c, a, { ...input(), salesperson_id: randomUUID() }, customer),
      ).rejects.toThrow("ORDER_SALESPERSON_INVALID");
      await expect(
        resolveOrderHeader(tx, c, a, { ...input(), warehouse_id: randomUUID() }, customer),
      ).rejects.toThrow("ORDER_WAREHOUSE_INACTIVE");
    }));
  it("does not silently choose between warehouses and honors configured default", async () =>
    fixture(async (tx, c, a, customer, w) => {
      await tx.warehouse.create({
        data: {
          companyId: c,
          code: "SECOND",
          name: "Second",
          normalizedName: "second",
          state: "ACTIVE",
          createdById: a,
          updatedById: a,
          timezone: "Asia/Makassar",
        },
      });
      await expect(resolveOrderHeader(tx, c, a, input(), customer)).rejects.toThrow(
        "ORDER_WAREHOUSE_REQUIRED",
      );
      await policy(tx, c, a, "OPS-FLX-10", w.code);
      expect((await resolveOrderHeader(tx, c, a, input(), customer)).warehouseId).toBe(w.id);
      await tx.warehouse.update({ where: { id: w.id }, data: { state: "INACTIVE" } });
      await expect(resolveOrderHeader(tx, c, a, input(), customer)).rejects.toThrow(
        "ORDER_WAREHOUSE_INACTIVE",
      );
    }));
  it("only permits line warehouses when enabled", async () =>
    fixture(async (tx, c, a, customer, w) => {
      const i = input();
      const body = { ...i, lines: [{ ...i.lines[0]!, warehouse_id: w.id }] };
      await expect(resolveOrderHeader(tx, c, a, body, customer)).rejects.toThrow(
        "ORDER_LINE_WAREHOUSE_DISABLED",
      );
      await policy(tx, c, a, "OPS-FLX-11", true);
      expect((await resolveOrderHeader(tx, c, a, body, customer)).lineWarehouseIds).toEqual([w.id]);
    }));
});
