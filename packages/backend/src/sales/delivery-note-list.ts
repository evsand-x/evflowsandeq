import { prisma, Prisma } from "@evflow/database";
import { z } from "zod";
import { deliveryNoteView, getDeliveryNote } from "./delivery-note";

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal.clone({ precision: 48 });
const PAGE_SIZE = 25;

/** Tabs of the Surat Jalan list. UNINVOICED/INVOICED read invoices and need `sales_invoice.read`. */
export const deliveryNoteTabSchema = z.enum(["ALL", "DRAFT", "UNINVOICED", "INVOICED"]);
export type DeliveryNoteTab = z.infer<typeof deliveryNoteTabSchema>;

const activeInvoice = { state: { not: "VOID" as const } };
function tabWhere(tab: DeliveryNoteTab): Prisma.DeliveryNoteWhereInput {
  if (tab === "DRAFT") return { state: "DRAFT" };
  if (tab === "UNINVOICED") return { state: "ISSUED", invoices: { none: activeInvoice } };
  if (tab === "INVOICED") return { state: "ISSUED", invoices: { some: activeInvoice } };
  return {};
}

/**
 * Read model for the Surat Jalan list (Release 1): per row the source SO, customer, warehouses,
 * handover time, delivered quantity and (with invoice access) the invoice made from it.
 * Counts per tab come from the same filters except the tab itself.
 */
export async function deliveryNoteList(
  companyId: string,
  input: {
    page?: number;
    search?: string;
    state?: "DRAFT" | "ISSUED" | undefined;
    tab?: DeliveryNoteTab;
    warehouseId?: string | undefined;
  },
  includeBilling: boolean,
  db: Tx = prisma,
) {
  const page = input.page ?? 1;
  const search = input.search?.trim() ?? "";
  const tab = input.tab ?? "ALL";
  const base: Prisma.DeliveryNoteWhereInput = {
    companyId,
    ...(input.state ? { state: input.state } : {}),
    ...(input.warehouseId ? { lines: { some: { warehouseId: input.warehouseId } } } : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" } },
            { salesOrder: { number: { contains: search, mode: "insensitive" } } },
            { salesOrder: { customer: { name: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const where = { AND: [base, tabWhere(tab)] };
  const count = (t: DeliveryNoteTab) =>
    db.deliveryNote.count({ where: { AND: [base, tabWhere(t)] } });
  const [ids, total, all, draft, uninvoiced, invoiced, warehouses, company] = await Promise.all([
    db.deliveryNote.findMany({
      where,
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.deliveryNote.count({ where }),
    count("ALL"),
    count("DRAFT"),
    includeBilling ? count("UNINVOICED") : Promise.resolve(0),
    includeBilling ? count("INVOICED") : Promise.resolve(0),
    db.warehouse.findMany({
      where: { companyId, state: "ACTIVE" },
      select: { id: true, code: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.company.findUnique({ where: { id: companyId }, select: { timezone: true } }),
  ]);
  const notes = await Promise.all(ids.map(({ id }) => getDeliveryNote(companyId, id, db)));
  const [units, invoices] = notes.length
    ? await Promise.all([
        db.salesOrderLine.findMany({
          where: {
            companyId,
            id: { in: [...new Set(notes.flatMap((n) => n.lines.map((l) => l.salesOrderLineId)))] },
          },
          select: {
            id: true,
            Uom: { select: { name: true } },
            product: { select: { baseUom: { select: { name: true } } } },
          },
        }),
        includeBilling
          ? db.salesInvoice.findMany({
              where: {
                companyId,
                deliveryNoteId: { in: notes.map((n) => n.id) },
                ...activeInvoice,
              },
              select: { id: true, number: true, state: true, deliveryNoteId: true },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            })
          : Promise.resolve([]),
      ])
    : [[], []];
  const warehouseName = new Map(warehouses.map((w) => [w.id, w.name]));
  const missing = [
    ...new Set(
      notes.flatMap((n) => n.lines.map((l) => l.warehouseId).filter((id): id is string => !!id)),
    ),
  ].filter((id) => !warehouseName.has(id));
  if (missing.length)
    for (const w of await db.warehouse.findMany({
      where: { companyId, id: { in: missing } },
      select: { id: true, name: true },
    }))
      warehouseName.set(w.id, w.name);
  const unitOf = new Map(units.map((u) => [u.id, u.Uom?.name ?? u.product.baseUom.name]));
  const rows = notes.map((note) => {
    let quantity = new D(0);
    const lineUnits = new Set<string>();
    for (const line of note.lines) {
      // Issued: the quantity handed over; draft: the planned quantity.
      quantity = quantity.add(
        note.state === "ISSUED" ? (line.deliveredQuantity ?? line.quantity) : line.quantity,
      );
      lineUnits.add(unitOf.get(line.salesOrderLineId) ?? "");
    }
    const warehouseIds = [
      ...new Set(note.lines.map((l) => l.warehouseId).filter((id): id is string => !!id)),
    ];
    const invoice = invoices.find((i) => i.deliveryNoteId === note.id);
    return {
      ...deliveryNoteView(note),
      warehouses: warehouseIds.map((id) => ({ id, name: warehouseName.get(id) ?? "" })),
      quantity: quantity.toString(),
      unit: lineUnits.size === 1 ? [...lineUnits][0] || null : null,
      ...(includeBilling
        ? {
            invoice: invoice
              ? { id: invoice.id, number: invoice.number, state: invoice.state }
              : null,
          }
        : {}),
    };
  });
  return {
    rows,
    total,
    pageSize: PAGE_SIZE,
    summary: { all, draft, ...(includeBilling ? { uninvoiced, invoiced } : {}) },
    warehouses: warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name })),
    /** Company time zone for showing the handover time. */
    timezone: company?.timezone ?? null,
  };
}
