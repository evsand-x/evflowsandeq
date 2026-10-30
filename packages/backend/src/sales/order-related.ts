import { ConflictException, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import { proformaBatchInclude, proformaSource, matchesProformaSource } from "./proforma";

export type OrderPermission = (code: string) => boolean;
export const advanceVisible = (can: OrderPermission) =>
  ["sales_order_advance.create", "sales_order_advance.verify", "customer_receipt.read"].some(can);
export type RelatedDocument = {
  kind:
    | "PROFORMA"
    | "PICK_SLIP"
    | "PACKING_LIST"
    | "SURAT_JALAN"
    | "POD"
    | "INVOICE"
    | "CREDIT_NOTE"
    | "ADVANCE";
  id: string;
  number: string;
  date: string;
  status: string;
  amount: string | null;
  href: string;
  batchId?: string;
};
type Tx = Prisma.TransactionClient;

export function orderLineProgress(line: {
  orderedQuantity: Prisma.Decimal;
  closedQuantity: Prisma.Decimal;
  allocatedQuantity: Prisma.Decimal;
  allocations: {
    acceptedQuantity: Prisma.Decimal;
    inTransitQuantity: Prisma.Decimal;
    returnedQuantity: Prisma.Decimal;
  }[];
}) {
  const D = Prisma.Decimal.clone({ precision: 48 });
  const accepted = line.allocations.reduce((s, a) => s.add(a.acceptedQuantity), new D(0));
  const sent = line.allocations.reduce(
    (s, a) => s.add(a.acceptedQuantity).add(a.inTransitQuantity).add(a.returnedQuantity),
    new D(0),
  );
  const closed = new D(line.closedQuantity),
    ordered = new D(line.orderedQuantity);
  return {
    ordered: ordered.toString(),
    sent: sent.toString(),
    accepted: accepted.toString(),
    closed: closed.toString(),
    remaining: D.max(0, ordered.sub(closed).sub(accepted)).toString(),
    lineStatus: closed.gte(ordered)
      ? "CLOSED"
      : accepted.gte(ordered.sub(closed))
        ? "DONE"
        : sent.gt(accepted)
          ? "IN_DELIVERY"
          : line.allocatedQuantity.gt(sent)
            ? "READY"
            : "WAITING_STOCK",
  };
}
export function remainingOrderBill(
  total: string | null,
  unallocated: string[],
  invoices: { total: string; outstandingAmount: string }[],
) {
  if (total === null) return null;
  const D = Prisma.Decimal.clone({ precision: 48 });
  return invoices
    .reduce(
      (s, i) => s.sub(new D(i.total).sub(i.outstandingAmount)),
      unallocated.reduce((s, v) => s.sub(v), new D(total)),
    )
    .toString();
}
export async function orderNeighbors(
  c: string,
  order: { orderDate: Date; number: string },
  db: Tx = prisma,
) {
  const [previous, next] = await Promise.all(
    ["asc", "desc"].map((direction) =>
      db.salesOrder.findFirst({
        where: {
          companyId: c,
          OR: [
            { orderDate: direction === "asc" ? { gt: order.orderDate } : { lt: order.orderDate } },
            {
              orderDate: order.orderDate,
              number: direction === "asc" ? { gt: order.number } : { lt: order.number },
            },
          ],
        },
        orderBy: [
          { orderDate: direction as "asc" | "desc" },
          { number: direction as "asc" | "desc" },
        ],
        select: { id: true },
      }),
    ),
  );
  return { previousId: next?.id ?? null, nextId: previous?.id ?? null };
}
export async function orderRelated(
  c: string,
  id: string,
  can: OrderPermission,
  db: Tx = prisma,
): Promise<RelatedDocument[]> {
  if (!(await db.salesOrder.findFirst({ where: { companyId: c, id }, select: { id: true } })))
    throw new NotFoundException();
  const result: RelatedDocument[] = [];
  const picking = can("outbound_picking.read"),
    checking = can("outbound_checking.read"),
    shipping = can("outbound_shipping.read"),
    podAllowed = can("delivery_receipt.read"),
    proforma = can("proforma.read");
  const warehouse = picking || checking || shipping || podAllowed;
  const warehouseKinds = [
    ...(picking ? ["PICKING"] : []),
    ...(checking ? ["PACKING"] : []),
    ...(shipping ? ["SURAT_JALAN"] : []),
  ];
  if (warehouse || proforma) {
    const batches = await db.fulfillmentBatch.findMany({
      where: { companyId: c, salesOrderId: id },
      include: { ...proformaBatchInclude, pickList: true, deliveryReceipts: true },
    });
    const documents = await db.fulfillmentDocument.findMany({
      where: {
        companyId: c,
        batchId: { in: batches.map((b) => b.id) },
        OR: [
          ...(proforma ? [{ kind: { startsWith: "PROFORMA" } }] : []),
          ...(warehouse ? [{ kind: { in: warehouseKinds } }] : []),
        ],
      },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    });
    for (const batch of batches) {
      const docs = documents.filter((d) => d.batchId === batch.id);
      const newest = docs.find((d) => d.kind.startsWith("PROFORMA"));
      let current: ReturnType<typeof proformaSource> | null = null;
      if (proforma && newest) {
        try {
          current = proformaSource(batch);
        } catch (e) {
          if (!(e instanceof ConflictException)) throw e;
        }
      }
      for (const doc of docs) {
        const isProforma = doc.kind.startsWith("PROFORMA");
        if (doc.kind === "PICKING") continue;
        const status = isProforma
          ? batch.state === "CANCELLED" || batch.salesOrder.state === "CANCELLED"
            ? "VOID"
            : doc.id !== newest?.id
              ? "SUPERSEDED"
              : current && matchesProformaSource(doc.snapshot, current)
                ? "ISSUED"
                : "REVISION_REQUIRED"
          : batch.state === "CANCELLED"
            ? "VOID"
            : "ISSUED";
        const value = (doc.snapshot as { total?: unknown } | null)?.total;
        result.push({
          kind: isProforma ? "PROFORMA" : doc.kind === "PACKING" ? "PACKING_LIST" : "SURAT_JALAN",
          id: doc.id,
          batchId: batch.id,
          number: doc.number,
          date: doc.issuedAt.toISOString(),
          status,
          amount: typeof value === "string" ? value : null,
          href: `/operations/${isProforma ? "proformas" : "documents"}/${doc.id}`,
        });
      }
      if (warehouse) {
        if (picking && batch.pickList)
          result.push({
            kind: "PICK_SLIP",
            id: batch.pickList.id,
            batchId: batch.id,
            number: docs.find((d) => d.kind === "PICKING")?.number ?? batch.number,
            date: batch.pickList.createdAt.toISOString(),
            status: batch.pickList.state,
            amount: null,
            href: `/operations/pick-slips/${batch.id}`,
          });
        if (podAllowed)
          for (const pod of batch.deliveryReceipts)
            result.push({
              kind: "POD",
              id: pod.id,
              batchId: batch.id,
              number: `POD ${batch.number}`,
              date: pod.acceptedAt.toISOString(),
              status: "CONFIRMED",
              amount: null,
              href: `/operations/warehouse/pod/${batch.id}`,
            });
      }
    }
  }
  if (can("sales_invoice.read")) {
    const invoices = await db.salesInvoice.findMany({
      where: { companyId: c, salesOrderId: id },
      include: { creditNotes: true },
    });
    for (const invoice of invoices) {
      result.push({
        kind: "INVOICE",
        id: invoice.id,
        number: invoice.number,
        date: (invoice.postedAt ?? invoice.createdAt).toISOString(),
        status: invoice.state,
        amount: can("sales_invoice.view_price") ? invoice.total?.toString() ?? null : null,
        href: `/operations/invoices/${invoice.id}`,
      });
      for (const credit of invoice.creditNotes)
        result.push({
          kind: "CREDIT_NOTE",
          id: credit.id,
          number: credit.number,
          date: (credit.postedAt ?? credit.createdAt).toISOString(),
          status: credit.state,
          amount: can("sales_invoice.view_price") ? credit.amount.toString() : null,
          href: `/operations/invoices/${invoice.id}`,
        });
    }
  }
  if (advanceVisible(can)) {
    const advances = await db.salesOrderAdvance.findMany({
      where: { companyId: c, salesOrderId: id },
    });
    for (const a of advances)
      result.push({
        kind: "ADVANCE",
        id: a.id,
        number: `Uang muka ${a.bankReference ?? a.id.slice(0, 8)}`,
        date: a.receivedAt.toISOString(),
        status: a.state,
        amount: a.amount.toString(),
        href: `/operations/orders/${id}#so-advances`,
      });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
