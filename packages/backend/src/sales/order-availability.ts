import { ConflictException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import { paymentTerms } from "./customer-credit";
import { orderSettings } from "./order-header";
import { stockBusinessDate } from "./transaction-controls";

type Tx = Prisma.TransactionClient;
const Decimal = Prisma.Decimal.clone({ precision: 48 });

export type OrderStockAvailability = {
  productId: string;
  available: string;
  elsewhere: { locatorType: string; locatorName: string; quantity: string }[];
};

/** Informational read only; allocation commands recheck eligibility under locks. */
export async function stockAvailability(
  companyId: string,
  warehouseId: string,
  productIds: string[],
  db: Tx = prisma,
): Promise<OrderStockAvailability[]> {
  const ids = [...new Set(productIds)];
  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, companyId, state: "ACTIVE" },
    select: { id: true },
  });
  if (!warehouse) throw new ConflictException("ORDER_WAREHOUSE_INACTIVE");
  const products = await db.product.findMany({
    where: { companyId, id: { in: ids }, state: "ACTIVE" },
    select: { id: true },
  });
  if (products.length !== ids.length) throw new ConflictException("ORDER_PRODUCT_INVALID");
  const today = await stockBusinessDate(db, companyId);
  const lots = await db.stockLot.findMany({
    where: {
      companyId,
      warehouseId,
      productId: { in: ids },
      state: "ACTIVE",
      quantityOnHand: { gt: 0 },
      warehouse: { companyId, state: "ACTIVE" },
      product: { companyId, state: "ACTIVE" },
      locator: { companyId, warehouseId, state: "ACTIVE" },
    },
    select: {
      productId: true,
      locatorId: true,
      quantityOnHand: true,
      quantityReserved: true,
      qualityState: true,
      expiryDate: true,
      product: { select: { expiryRequired: true } },
      locator: { select: { name: true, locatorType: true } },
    },
    orderBy: [
      { locator: { locatorType: "asc" } },
      { locator: { name: "asc" } },
      { locatorId: "asc" },
    ],
  });
  return ids.map((productId) => {
    let available = new Decimal(0);
    const elsewhere = new Map<
      string,
      { locatorType: string; locatorName: string; quantity: InstanceType<typeof Decimal> }
    >();
    for (const lot of lots) {
      if (lot.productId !== productId) continue;
      const net = Decimal.max(
        new Decimal(lot.quantityOnHand.toString()).minus(lot.quantityReserved.toString()),
        0,
      );
      if (net.isZero()) continue;
      if (["STORAGE", "DISPATCH"].includes(lot.locator.locatorType)) {
        if (
          lot.qualityState === "AVAILABLE" &&
          (lot.expiryDate ? lot.expiryDate > today : !lot.product.expiryRequired)
        )
          available = available.plus(net);
      } else {
        const entry = elsewhere.get(lot.locatorId) ?? {
          locatorType: lot.locator.locatorType,
          locatorName: lot.locator.name,
          quantity: new Decimal(0),
        };
        entry.quantity = entry.quantity.plus(net);
        elsewhere.set(lot.locatorId, entry);
      }
    }
    return {
      productId,
      available: available.toFixed(),
      elsewhere: [...elsewhere.values()].map((entry) => ({
        ...entry,
        quantity: entry.quantity.toFixed(),
      })),
    };
  });
}

export async function orderFormOptions(companyId: string, db: Tx = prisma) {
  const [warehouses, memberships, terms, settings, period] = await Promise.all([
    db.warehouse.findMany({
      where: { companyId, state: "ACTIVE" },
      select: { id: true, code: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.companyMembership.findMany({
      where: { companyId, active: true, deletedAt: null, user: { active: true } },
      select: { user: { select: { id: true, displayName: true } } },
      orderBy: { user: { displayName: "asc" } },
    }),
    paymentTerms(db, companyId),
    orderSettings(db, companyId),
    db.financePeriod.findFirst({
      where: { companyId, state: "CLOSED" },
      orderBy: { endsOn: "desc" },
      select: { endsOn: true },
    }),
  ]);
  const configured = settings.warehouseCode
    ? warehouses.find((w) => w.code === settings.warehouseCode)
    : warehouses.length === 1
      ? warehouses[0]
      : undefined;
  return {
    warehouses,
    salespeople: memberships.map(({ user }) => ({ id: user.id, name: user.displayName })),
    terms,
    defaults: {
      warehouseId: configured?.id ?? null,
      lineWarehouseEnabled: settings.lineWarehouseEnabled,
      referenceRequired: settings.referenceRequired,
      evidenceRequired: settings.evidenceRequired,
    },
    closedThrough: period?.endsOn.toISOString().slice(0, 10) ?? null,
  };
}
