import { prisma, Prisma } from "@evflow/database";

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal.clone({ precision: 48 });

export type OrderShipping = {
  status: "NOT_SHIPPED" | "PARTIAL" | "SHIPPED";
  /** Quantity still to deliver across lines, as a decimal string. */
  remainingQuantity: string;
  /** Unit of the remaining quantity when every remaining line uses the same unit. */
  remainingUnit: string | null;
  draftDeliveryNotes: number;
};
export type OrderBilling = {
  status: "NONE" | "UNINVOICED" | "UNPAID" | "PARTIAL" | "PAID";
  invoiceCount: number;
  uninvoicedDeliveryNotes: number;
};
export type OrderInvoiceFact = {
  id: string;
  number: string;
  total: string;
  outstanding: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
};
export type OrderDeliveryFacts = {
  /** Issued Surat Jalan quantities per SO line (Release 1 handover event). */
  delivered: Map<string, Prisma.Decimal>;
  /** Issued Surat Jalan quantities per SO line that already have a posted invoice. */
  invoiced: Map<string, Prisma.Decimal>;
  draftDeliveryNotes: number;
  issuedDeliveryNotes: number;
  uninvoicedDeliveryNotes: number;
  invoices: OrderInvoiceFact[];
};

function paymentStatus(total: Prisma.Decimal, outstanding: Prisma.Decimal) {
  return outstanding.lte(0) ? "PAID" : outstanding.gte(total) ? "UNPAID" : "PARTIAL";
}

/**
 * Read facts for SO list/detail from Release 1 documents: issued Surat Jalan quantities and
 * posted invoices. Fetched in bulk for one page, never stored as balances or used as command gates.
 */
export async function orderDeliveryFacts(
  companyId: string,
  orderIds: string[],
  db: Tx = prisma,
  includeInvoices = false,
): Promise<Map<string, OrderDeliveryFacts>> {
  const result = new Map<string, OrderDeliveryFacts>(
    orderIds.map((id) => [
      id,
      {
        delivered: new Map(),
        invoiced: new Map(),
        draftDeliveryNotes: 0,
        issuedDeliveryNotes: 0,
        uninvoicedDeliveryNotes: 0,
        invoices: [],
      },
    ]),
  );
  if (!orderIds.length) return result;
  const [notes, invoices] = await Promise.all([
    db.deliveryNote.findMany({
      where: { companyId, salesOrderId: { in: orderIds }, state: { in: ["DRAFT", "ISSUED"] } },
      select: {
        salesOrderId: true,
        state: true,
        lines: { select: { salesOrderLineId: true, deliveredQuantity: true } },
        invoices: { where: { state: { not: "VOID" } }, select: { state: true } },
      },
    }),
    includeInvoices
      ? db.salesInvoice.findMany({
          where: { companyId, salesOrderId: { in: orderIds }, state: "POSTED" },
          select: {
            id: true,
            number: true,
            salesOrderId: true,
            total: true,
            outstandingAmount: true,
          },
          orderBy: [{ postedAt: "asc" }, { number: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  const add = (map: Map<string, Prisma.Decimal>, key: string, value: Prisma.Decimal | null) =>
    map.set(key, (map.get(key) ?? new D(0)).add(value ?? 0));
  for (const note of notes) {
    const facts = result.get(note.salesOrderId)!;
    if (note.state === "DRAFT") {
      facts.draftDeliveryNotes += 1;
      continue;
    }
    facts.issuedDeliveryNotes += 1;
    const invoiced = note.invoices.some((invoice) => invoice.state === "POSTED");
    if (!note.invoices.length) facts.uninvoicedDeliveryNotes += 1;
    for (const line of note.lines) {
      add(facts.delivered, line.salesOrderLineId, line.deliveredQuantity);
      if (invoiced) add(facts.invoiced, line.salesOrderLineId, line.deliveredQuantity);
    }
  }
  for (const invoice of invoices) {
    if (!invoice.salesOrderId) continue;
    const total = new D(invoice.total ?? 0),
      outstanding = new D(invoice.outstandingAmount);
    result.get(invoice.salesOrderId)?.invoices.push({
      id: invoice.id,
      number: invoice.number,
      total: total.toString(),
      outstanding: outstanding.toString(),
      paymentStatus: paymentStatus(total, outstanding),
    });
  }
  return result;
}

type ProgressLine = {
  id: string;
  orderedQuantity: Prisma.Decimal;
  closedQuantity: Prisma.Decimal;
  allocations: {
    acceptedQuantity: Prisma.Decimal;
    inTransitQuantity: Prisma.Decimal;
    returnedQuantity: Prisma.Decimal;
  }[];
};

/**
 * Issued Surat Jalan quantities count as accepted handover in the existing SO projections
 * (status, fulfillment text, line progress) without changing the stored allocations.
 */
export function withDeliveredQuantities<T extends ProgressLine>(
  lines: T[],
  facts: OrderDeliveryFacts | undefined,
): T[] {
  if (!facts?.delivered.size) return lines;
  return lines.map((line) => {
    const delivered = facts.delivered.get(line.id);
    return delivered?.gt(0)
      ? {
          ...line,
          allocations: [
            ...line.allocations,
            {
              acceptedQuantity: delivered,
              inTransitQuantity: new D(0),
              returnedQuantity: new D(0),
            },
          ],
        }
      : line;
  });
}

/** Shipping summary for a submitted order; null for drafts and cancelled orders. */
export function orderShipping(
  state: string,
  lines: (ProgressLine & { unit?: string | null })[],
  facts: OrderDeliveryFacts | undefined,
): OrderShipping | null {
  if (["DRAFT", "CANCELLED"].includes(state)) return null;
  let remaining = new D(0),
    sent = new D(0);
  const units = new Set<string | null>();
  for (const line of lines) {
    const lineSent = line.allocations.reduce(
      (s, a) => s.add(a.acceptedQuantity).add(a.inTransitQuantity),
      new D(0),
    );
    const open = D.max(0, new D(line.orderedQuantity).sub(line.closedQuantity).sub(lineSent));
    sent = sent.add(lineSent);
    if (open.gt(0)) {
      remaining = remaining.add(open);
      units.add(line.unit ?? null);
    }
  }
  return {
    status: remaining.isZero() ? "SHIPPED" : sent.gt(0) ? "PARTIAL" : "NOT_SHIPPED",
    remainingQuantity: remaining.toString(),
    remainingUnit: units.size === 1 ? [...units][0]! : null,
    draftDeliveryNotes: facts?.draftDeliveryNotes ?? 0,
  };
}

/** Billing summary; only built for callers allowed to read sales invoices. */
export function orderBilling(
  state: string,
  facts: OrderDeliveryFacts | undefined,
): OrderBilling | null {
  if (["DRAFT", "CANCELLED"].includes(state) || !facts) return null;
  const outstanding = facts.invoices.map((i) => i.paymentStatus);
  return {
    status: facts.uninvoicedDeliveryNotes
      ? "UNINVOICED"
      : !outstanding.length
        ? "NONE"
        : outstanding.every((s) => s === "PAID")
          ? "PAID"
          : outstanding.every((s) => s === "UNPAID")
            ? "UNPAID"
            : "PARTIAL",
    invoiceCount: facts.invoices.length,
    uninvoicedDeliveryNotes: facts.uninvoicedDeliveryNotes,
  };
}

/** SQL fragment: issued Surat Jalan quantity per SO line, for status filters and counts. */
export function deliveredLineSql(companyId: string) {
  return Prisma.sql`SELECT dnl.sales_order_line_id, SUM(COALESCE(dnl.delivered_quantity,0)) AS delivered
    FROM delivery_note_lines dnl
    JOIN delivery_notes dn ON dn.id = dnl.delivery_note_id
      AND dn.company_id = ${companyId}::uuid AND dn.state = 'ISSUED'
    WHERE dnl.company_id = ${companyId}::uuid
    GROUP BY dnl.sales_order_line_id`;
}

/** SQL predicate on alias `o`: an issued Surat Jalan of the order has no invoice yet. */
export function uninvoicedOrderSql() {
  return Prisma.sql`EXISTS (SELECT 1 FROM delivery_notes dn
    WHERE dn.company_id = o.company_id AND dn.sales_order_id = o.id AND dn.state = 'ISSUED'
      AND NOT EXISTS (SELECT 1 FROM sales_invoices si
        WHERE si.delivery_note_id = dn.id AND si.company_id = dn.company_id AND si.state <> 'VOID'))`;
}
