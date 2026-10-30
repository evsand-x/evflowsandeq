import { NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";

const D = Prisma.Decimal;
type RawInventoryRow = {
  productId: string;
  quantityOnHand: string | Prisma.Decimal;
  quantityReserved: string | Prisma.Decimal;
  qualityState: string;
  locatorType: string;
  expiryDate: Date | null;
  minimumStock: string | Prisma.Decimal | null;
  unitCost: string | Prisma.Decimal;
};

function dec(value: string | Prisma.Decimal | null | undefined) {
  return new D(value?.toString() ?? "0");
}

export function aggregateInventoryRows(rows: RawInventoryRow[], today = new Date()) {
  const byProduct = new Map<
    string,
    {
      total: Prisma.Decimal;
      reserved: Prisma.Decimal;
      held: Prisma.Decimal;
      minimumStock: Prisma.Decimal;
      inventoryValue: Prisma.Decimal;
    }
  >();
  for (const row of rows) {
    const item = byProduct.get(row.productId) ?? {
      total: new D(0),
      reserved: new D(0),
      held: new D(0),
      minimumStock: dec(row.minimumStock),
      inventoryValue: new D(0),
    };
    const onHand = dec(row.quantityOnHand);
    const reserved = dec(row.quantityReserved);
    item.total = item.total.plus(onHand);
    item.reserved = item.reserved.plus(reserved);
    item.inventoryValue = item.inventoryValue.plus(onHand.mul(dec(row.unitCost)));
    const blocked =
      !["STORAGE", "DISPATCH"].includes(row.locatorType) ||
      !["AVAILABLE", "RELEASED"].includes(row.qualityState) ||
      (!!row.expiryDate && row.expiryDate < today);
    if (blocked) item.held = item.held.plus(onHand);
    byProduct.set(row.productId, item);
  }
  return [...byProduct.entries()].map(([productId, x]) => ({
    productId,
    total: x.total.toFixed(),
    reserved: x.reserved.toFixed(),
    held: x.held.toFixed(),
    available: D.max(x.total.minus(x.reserved).minus(x.held), 0).toFixed(),
    minimumStock: x.minimumStock.toFixed(),
    inventoryValue: x.inventoryValue.toFixed(),
  }));
}

type MovementRow = {
  id: string;
  createdAt: Date;
  kind: string;
  quantity: string | Prisma.Decimal;
  unitCost: string | Prisma.Decimal;
  sourceType: string;
  sourceId: string;
};
export function buildStockCard(movements: MovementRow[], range: { from: Date; to: Date }) {
  const sorted = movements
    .filter((m) => m.createdAt <= range.to)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  let balance = new D(0);
  let opening = new D(0),
    incoming = new D(0),
    outgoing = new D(0);
  const rows = sorted.map((m) => {
    const raw = dec(m.quantity);
    const qty = ["RESERVATION", "RELEASE"].includes(m.kind)
      ? new Prisma.Decimal(0)
      : m.kind === "DISPATCH"
        ? raw.abs().negated()
        : raw;
    balance = balance.plus(qty);
    if (m.createdAt < range.from) opening = balance;
    else if (m.createdAt <= range.to) {
      if (qty.gte(0)) incoming = incoming.plus(qty);
      else outgoing = outgoing.plus(qty.abs());
    }
    return {
      id: m.id,
      date: m.createdAt,
      kind: m.kind,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      incoming: qty.gt(0) ? qty.toFixed() : "0",
      outgoing: qty.lt(0) ? qty.abs().toFixed() : "0",
      balance: balance.toFixed(),
      unitCost: dec(m.unitCost).toFixed(),
    };
  });
  const closing = opening.plus(incoming).minus(outgoing);
  return {
    summary: {
      opening: opening.toFixed(),
      incoming: incoming.toFixed(),
      outgoing: outgoing.toFixed(),
      closing: closing.toFixed(),
    },
    rows,
  };
}

export async function listInventory(
  companyId: string,
  input: {
    search?: string;
    warehouseId?: string;
    categoryId?: string;
    lowOnly?: boolean;
    page?: number;
    pageSize?: number;
    includeCost?: boolean;
  },
) {
  const page = input.page ?? 1,
    pageSize = Math.min(input.pageSize ?? 25, 100),
    search = input.search?.trim() ?? "";
  const products = await prisma.product.findMany({
    where: {
      companyId,
      state: "ACTIVE",
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      minimumStock: true,
      category: { select: { name: true } },
      baseUom: { select: { code: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const ids = products.map((p) => p.id);
  const lots = ids.length
    ? await prisma.stockLot.findMany({
        where: {
          companyId,
          productId: { in: ids },
          ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
        },
        select: {
          productId: true,
          quantityOnHand: true,
          quantityReserved: true,
          qualityState: true,
          expiryDate: true,
          unitCost: true,
          locator: { select: { locatorType: true } },
          product: { select: { minimumStock: true } },
        },
      })
    : [];
  const aggregates = aggregateInventoryRows(
    lots.map((x) => ({
      ...x,
      locatorType: x.locator.locatorType,
      minimumStock: x.product.minimumStock,
    })),
  );
  const rows = products.map((p) => {
    const aggregate = aggregates.find((x) => x.productId === p.id) ?? {
      productId: p.id,
      total: "0",
      reserved: "0",
      held: "0",
      available: "0",
      minimumStock: p.minimumStock?.toString() ?? "0",
      inventoryValue: "0",
    };
    return {
      ...p,
      ...aggregate,
      inventoryValue: input.includeCost ? aggregate.inventoryValue : null,
      status: dec(aggregate.available).lte(dec(p.minimumStock)) ? "LOW" : "SAFE",
    };
  });
  const filtered = input.lowOnly ? rows.filter((x) => x.status === "LOW") : rows;
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export async function inventoryDetail(companyId: string, productId: string, includeCost = false) {
  const product = await prisma.product.findFirst({
    where: { companyId, id: productId, state: "ACTIVE" },
    select: {
      id: true,
      code: true,
      name: true,
      minimumStock: true,
      category: { select: { name: true } },
      baseUom: { select: { code: true } },
    },
  });
  if (!product) throw new NotFoundException("Produk tidak ditemukan.");
  const lots = await prisma.stockLot.findMany({
    where: { companyId, productId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      createdAt: true,
      batchNo: true,
      expiryDate: true,
      quantityOnHand: true,
      quantityReserved: true,
      qualityState: true,
      unitCost: true,
      warehouse: { select: { id: true, name: true } },
      locator: { select: { id: true, code: true, name: true, locatorType: true } },
    },
  });
  lots.sort((a, b) => {
    if (a.expiryDate && b.expiryDate) return a.expiryDate.getTime() - b.expiryDate.getTime();
    if (a.expiryDate) return -1;
    if (b.expiryDate) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
  });
  const agg = aggregateInventoryRows(
    lots.map((x) => ({
      productId,
      quantityOnHand: x.quantityOnHand,
      quantityReserved: x.quantityReserved,
      qualityState: x.qualityState,
      expiryDate: x.expiryDate,
      unitCost: x.unitCost,
      locatorType: x.locator.locatorType,
      minimumStock: product.minimumStock,
    })),
  )[0];
  const [salePrice, lastReceipt] = await Promise.all([
    prisma.productReferencePrice.findFirst({
      where: { companyId, productId, kind: "SALE" },
      orderBy: { effectiveFrom: "desc" },
      select: { unitPrice: true, effectiveFrom: true },
    }),
    prisma.goodsReceiptLine.findFirst({
      where: { productId, goodsReceipt: { companyId, state: "POSTED" } },
      orderBy: { goodsReceipt: { createdAt: "desc" } },
      select: { unitCost: true, goodsReceipt: { select: { number: true, createdAt: true } } },
    }),
  ]);
  const total = dec(agg?.total);
  const averageCost = total.isZero() ? new Prisma.Decimal(0) : dec(agg?.inventoryValue).div(total);
  return {
    product,
    summary: agg ? { ...agg, inventoryValue: includeCost ? agg.inventoryValue : null } : agg,
    lots: lots.map((x) => ({ ...x, unitCost: includeCost ? x.unitCost.toString() : null })),
    prices: {
      sale: salePrice?.unitPrice?.toString() ?? null,
      lastPurchase: includeCost ? (lastReceipt?.unitCost?.toString() ?? null) : null,
      averageCost: includeCost ? averageCost.toFixed() : null,
      lastPurchaseDocument: includeCost ? (lastReceipt?.goodsReceipt ?? null) : null,
    },
  };
}

export async function stockCard(
  companyId: string,
  productId: string,
  input: { warehouseId?: string; batchNo?: string; from: Date; to: Date; includeCost?: boolean },
) {
  const lots = await prisma.stockLot.findMany({
    where: {
      companyId,
      productId,
      ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
      ...(input.batchNo ? { batchNo: input.batchNo } : {}),
    },
    select: { id: true },
  });
  const movements = lots.length
    ? await prisma.inventoryMovement.findMany({
        where: { companyId, stockLotId: { in: lots.map((x) => x.id) } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          createdAt: true,
          kind: true,
          quantity: true,
          unitCost: true,
          sourceType: true,
          sourceId: true,
        },
      })
    : [];
  const card = buildStockCard(movements, input);
  return {
    ...card,
    rows: card.rows.map((x) => ({ ...x, unitCost: input.includeCost ? x.unitCost : null })),
  };
}
