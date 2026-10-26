import { randomUUID } from "node:crypto";
import type { Prisma } from "@evflow/database";
import { prisma } from "@evflow/database";
import {
  stockAvailability,
  orderFormOptions,
} from "../../packages/backend/src/sales/order-availability";

const rollback = new Error("rollback availability fixture");
async function fixture(
  run: (
    tx: Prisma.TransactionClient,
    c: string,
    actor: string,
    w: string,
    p: string,
  ) => Promise<void>,
) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local test database required");
  await prisma
    .$transaction(
      async (tx) => {
        const c = (
          await tx.company.create({
            data: { name: "Availability test", timezone: "Pacific/Kiritimati" },
          })
        ).id;
        const actor = (
          await tx.user.create({
            data: {
              email: `${randomUUID()}@test.invalid`,
              displayName: "Sales",
              passwordHash: "disabled",
            },
          })
        ).id;
        await tx.companyMembership.create({ data: { companyId: c, userId: actor } });
        const master = () => ({
          companyId: c,
          code: randomUUID(),
          name: randomUUID(),
          normalizedName: randomUUID(),
          state: "ACTIVE" as const,
          createdById: actor,
          updatedById: actor,
        });
        const w = (await tx.warehouse.create({ data: { ...master(), timezone: "UTC" } })).id;
        const uom = await tx.uom.create({ data: master() });
        const category = await tx.productCategory.create({ data: master() });
        const p = (
          await tx.product.create({
            data: {
              ...master(),
              baseUomId: uom.id,
              categoryId: category.id,
              expiryRequired: false,
            },
          })
        ).id;
        await run(tx, c, actor, w, p);
        throw rollback;
      },
      { timeout: 30000 },
    )
    .catch((e) => {
      if (e !== rollback) throw e;
    });
}

async function lot(
  tx: Prisma.TransactionClient,
  c: string,
  actor: string,
  w: string,
  p: string,
  type: "STORAGE" | "RECEIVING" | "QUARANTINE" | "DISPATCH",
  quantity: string,
  reserved = "0",
  quality = "AVAILABLE",
  expiryDate: Date | null = null,
) {
  const l = await tx.locator.create({
    data: {
      companyId: c,
      warehouseId: w,
      code: randomUUID(),
      name: type,
      normalizedName: randomUUID(),
      locatorType: type,
      state: "ACTIVE",
      createdById: actor,
      updatedById: actor,
    },
  });
  return tx.stockLot.create({
    data: {
      companyId: c,
      productId: p,
      warehouseId: w,
      locatorId: l.id,
      batchNo: randomUUID(),
      state: "ACTIVE",
      qualityState: quality,
      quantityOnHand: quantity,
      quantityReserved: reserved,
      unitCost: "1",
      expiryDate,
    },
  });
}

describe("SO stock availability and form options", () => {
  it("splits sellable stock and other locators without modifying reservation", async () =>
    fixture(async (tx, c, a, w, p) => {
      const stock = await lot(tx, c, a, w, p, "STORAGE", "90", "4");
      await lot(tx, c, a, w, p, "RECEIVING", "20");
      await lot(tx, c, a, w, p, "QUARANTINE", "5", "0", "QUARANTINE");
      expect(await stockAvailability(c, w, [p], tx)).toEqual([
        {
          productId: p,
          available: "86",
          elsewhere: [
            { locatorType: "RECEIVING", locatorName: "RECEIVING", quantity: "20" },
            { locatorType: "QUARANTINE", locatorName: "QUARANTINE", quantity: "5" },
          ],
        },
      ]);
      expect(
        (
          await tx.stockLot.findUniqueOrThrow({ where: { id: stock.id } })
        ).quantityReserved.toString(),
      ).toBe("4");
    }));

  it("retains precision and excludes expired, unavailable and foreign warehouse stock", async () =>
    fixture(async (tx, c, a, w, p) => {
      await lot(tx, c, a, w, p, "STORAGE", "99999999999999.9999999999", "0.0000000001");
      await lot(tx, c, a, w, p, "DISPATCH", "0.0000000001");
      await lot(tx, c, a, w, p, "STORAGE", "9", "0", "PENDING");
      const today = new Date(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Pacific/Kiritimati",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
      );
      await lot(tx, c, a, w, p, "STORAGE", "10", "0", "AVAILABLE", today);
      const other = await tx.warehouse.create({
        data: {
          companyId: c,
          code: "OTHER",
          name: "Other",
          normalizedName: "other",
          timezone: "UTC",
          state: "ACTIVE",
          createdById: a,
          updatedById: a,
        },
      });
      await lot(tx, c, a, other.id, p, "STORAGE", "100");
      expect((await stockAvailability(c, w, [p], tx))[0]?.available).toBe(
        "99999999999999.9999999999",
      );
    }));

  it("rejects unknown or foreign ids rather than returning cross-company data", async () =>
    fixture(async (tx, c, a, w, p) => {
      await expect(stockAvailability(c, randomUUID(), [p], tx)).rejects.toThrow(
        "ORDER_WAREHOUSE_INACTIVE",
      );
      await expect(stockAvailability(c, w, [randomUUID()], tx)).rejects.toThrow(
        "ORDER_PRODUCT_INVALID",
      );
      await tx.product.update({ where: { id: p }, data: { state: "INACTIVE" } });
      await expect(stockAvailability(c, w, [p], tx)).rejects.toThrow("ORDER_PRODUCT_INVALID");
    }));

  it("returns zero for products with no stock and deduplicates product ids", async () =>
    fixture(async (tx, c, a, w, p) => {
      expect(await stockAvailability(c, w, [p, p], tx)).toEqual([
        { productId: p, available: "0", elsewhere: [] },
      ]);
    }));

  it("reads defaults and exposes only active salesperson identity and closed period date", async () =>
    fixture(async (tx, c, a, w) => {
      const warehouse = await tx.warehouse.findUniqueOrThrow({ where: { id: w } });
      const values = {
        "OPS-FLX-10": warehouse.code,
        "OPS-FLX-11": true,
        "OPS-FLX-12": true,
        "OPS-FLX-13": true,
        "OPS-FLX-03": [{ code: "T30", label: "30 hari", kind: "TEMPO", days: 30 }],
      };
      for (const [code, value] of Object.entries(values))
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
            versions: {
              create: { versionNo: 1, state: "ACTIVE", savedById: a, valueSnapshot: value },
            },
          },
        });
      const inactive = await tx.user.create({
        data: {
          email: `${randomUUID()}@test.invalid`,
          displayName: "Inactive",
          passwordHash: "disabled",
          active: false,
        },
      });
      await tx.companyMembership.create({ data: { companyId: c, userId: inactive.id } });
      await tx.financePeriod.create({
        data: {
          companyId: c,
          startsOn: new Date("2026-01-01"),
          endsOn: new Date("2026-01-31"),
          state: "CLOSED",
        },
      });
      await tx.financePeriod.create({
        data: {
          companyId: c,
          startsOn: new Date("2026-02-01"),
          endsOn: new Date("2026-02-28"),
          state: "OPEN",
        },
      });
      expect(await orderFormOptions(c, tx)).toEqual({
        warehouses: [{ id: w, code: warehouse.code, name: warehouse.name }],
        salespeople: [{ id: a, name: "Sales" }],
        terms: values["OPS-FLX-03"],
        defaults: {
          warehouseId: w,
          lineWarehouseEnabled: true,
          referenceRequired: true,
          evidenceRequired: true,
        },
        closedThrough: "2026-01-31",
      });
    }));
});
