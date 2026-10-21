import { prisma, Prisma } from "@evflow/database";
import { NotFoundException } from "@nestjs/common";

const productSelect = {
  code: true,
  name: true,
  baseUom: { select: { name: true } },
} satisfies Prisma.ProductSelect;
const stockSelect = {
  batchNo: true,
  warehouseId: true,
  expiryDate: true,
  locator: { select: { code: true } },
  product: { select: productSelect },
} satisfies Prisma.StockLotSelect;
const batchInclude = {
  salesOrder: {
    select: {
      id: true,
      number: true,
      customerId: true,
      deliveryAddress: true,
      customer: { select: { name: true } },
    },
  },
  pickList: { include: { lines: true } },
  allocations: {
    select: {
      id: true,
      quantity: true,
      inTransitQuantity: true,
      acceptedQuantity: true,
      returnedQuantity: true,
      stockLot: { select: stockSelect },
    },
  },
} satisfies Prisma.FulfillmentBatchInclude;

export function outboundStatus(
  stage: string,
  row: {
    state: string;
    pickList?: {
      state: string;
      lines: { assignedQuantity: { toString(): string }; pickedQuantity: { toString(): string } }[];
    } | null;
    shipmentSnapshot?: unknown;
  },
) {
  if (row.state === "CANCELLED" || row.state === "RELEASED") return "Dibatalkan";
  const p = row.pickList;
  const shortage =
    p?.state === "PICKED" &&
    p.lines.some((l) =>
      new Prisma.Decimal(l.pickedQuantity.toString()).lt(l.assignedQuantity.toString()),
    );
  if (stage === "picking")
    return !p
      ? "Belum dibuat"
      : p.state === "OPEN"
        ? "Siap diambil"
        : shortage
          ? "Sebagian diambil"
          : "Selesai";
  if (stage === "checking")
    return p?.state === "CHECKED" ? "Packing List terbit" : shortage ? "Ditahan" : "Perlu dicek";
  if (stage === "shipping")
    return row.state === "DELIVERED"
      ? "Selesai"
      : row.state !== "ALLOCATED"
        ? "Dalam perjalanan"
        : !row.shipmentSnapshot
          ? "Menunggu sopir"
          : "Siap kirim";
  return row.state === "DELIVERED"
    ? "Selesai"
    : row.state === "PARTIALLY_DELIVERED"
      ? "Sebagian diterima"
      : "Menunggu POD";
}

export async function outboundList(
  c: string,
  stage: string,
  page: number,
  search: string,
  status: string,
) {
  const q = { contains: search, mode: "insensitive" as const };
  const stageWhere: Prisma.FulfillmentBatchWhereInput =
    stage === "picking"
      ? { OR: [{ state: "ALLOCATED" }, { pickList: { isNot: null } }] }
      : stage === "checking"
        ? { pickList: { is: { state: { in: ["PICKED", "CHECKED"] } } } }
        : stage === "shipping"
          ? { pickList: { is: { state: "CHECKED" } } }
          : { state: { in: ["DISPATCHED", "PARTIALLY_DELIVERED", "DELIVERED"] } };
  const where: Prisma.FulfillmentBatchWhereInput = {
    companyId: c,
    AND: [
      stageWhere,
      {
        OR: [
          { number: q },
          { salesOrder: { number: q } },
          { salesOrder: { customer: { name: q } } },
        ],
      },
    ],
  };
  // Small projections permit derived shortage status without exposing stock cost or AR.
  const records = await prisma.fulfillmentBatch.findMany({
    where,
    select: {
      id: true,
      state: true,
      shipmentSnapshot: true,
      pickList: {
        select: {
          state: true,
          lines: { select: { assignedQuantity: true, pickedQuantity: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  const summary: Record<string, number> = {};
  for (const r of records) {
    const s = outboundStatus(stage, r);
    summary[s] = (summary[s] ?? 0) + 1;
  }
  const selected = records.filter((r) => !status || outboundStatus(stage, r) === status);
  const ids = selected.slice((page - 1) * 25, page * 25).map((r) => r.id);
  const rows = await prisma.fulfillmentBatch.findMany({
    where: { companyId: c, id: { in: ids } },
    include: batchInclude,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  const documents = await prisma.fulfillmentDocument.findMany({
    where: {
      companyId: c,
      batchId: { in: ids },
      kind: { in: ["PICKING", "PACKING", "SURAT_JALAN"] },
    },
    select: { id: true, batchId: true, number: true, kind: true, issuedAt: true, snapshot: true },
  });
  return {
    rows: rows.map((r) => ({
      ...r,
      status: outboundStatus(stage, r),
      documents: documents.filter((d) => d.batchId === r.id),
    })),
    total: selected.length,
    summary,
  };
}

export async function returnList(c: string, page: number, search: string) {
  const where = {
    companyId: c,
    OR: [
      { reason: { contains: search, mode: "insensitive" as const } },
      { customer: { name: { contains: search, mode: "insensitive" as const } } },
    ],
  };
  const [rows, total, groups] = await prisma.$transaction([
    prisma.customerReturn.findMany({
      where,
      include: { customer: { select: { name: true } }, salesInvoice: { select: { number: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * 25,
      take: 25,
    }),
    prisma.customerReturn.count({ where }),
    prisma.customerReturn.groupBy({
      by: ["state"],
      where,
      orderBy: { state: "asc" },
      _count: true,
    }),
  ]);
  return { rows, total, summary: Object.fromEntries(groups.map((g) => [g.state, g._count])) };
}
export async function returnDetail(c: string, id: string) {
  const row = await prisma.customerReturn.findFirst({
    where: { companyId: c, id },
    include: {
      customer: { select: { name: true } },
      salesInvoice: { select: { number: true } },
      lines: {
        select: {
          id: true,
          quantity: true,
          batchNo: true,
          quarantineLocator: { select: { code: true } },
          deliveryReceiptLine: {
            select: { allocation: { select: { stockLot: { select: stockSelect } } } },
          },
        },
      },
    },
  });
  if (!row) throw new NotFoundException();
  return row;
}
export async function returnSources(c: string) {
  const [receipts, locators] = await Promise.all([
    prisma.deliveryReceipt.findMany({
      where: { companyId: c },
      orderBy: { acceptedAt: "desc" },
      take: 250,
      select: {
        id: true,
        acceptedAt: true,
        salesOrder: {
          select: { number: true, customerId: true, customer: { select: { name: true } } },
        },
        lines: {
          select: {
            id: true,
            acceptedQuantity: true,
            returns: { select: { quantity: true } },
            allocation: { select: { stockLot: { select: stockSelect } } },
          },
        },
      },
    }),
    prisma.locator.findMany({
      where: { companyId: c, state: "ACTIVE", locatorType: "QUARANTINE" },
      select: { id: true, code: true, name: true, warehouseId: true },
    }),
  ]);
  return { receipts, locators };
}
