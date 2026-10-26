import { prisma, Prisma } from "@evflow/database";
import { salesOrderDisplayStatusSchema } from "@evflow/contracts";
import { orderStatusRows } from "./order-status";
import { orderReadFacts } from "./order-summary";
import { orderView } from "./order-view";
import type { OrderListFilters } from "./order-list-filters";

/** Page, counts and row facts share one repeatable-read snapshot; no company-wide id arrays. */
export async function listSalesOrders(
  companyId: string,
  page: number,
  search: string,
  state: string | undefined,
  filters: OrderListFilters,
  db?: Prisma.TransactionClient,
  includeFinancial = true,
): Promise<{
  rows: Record<string, unknown>[];
  total: number;
  pageSize: number;
  summary: Record<string, number | null>;
  filters: { customers: { id: string; name: string }[] };
  asOf: string;
}> {
  if (!db)
    return prisma.$transaction(
      (tx) => listSalesOrders(companyId, page, search, state, filters, tx, includeFinancial),
      { isolationLevel: "RepeatableRead", timeout: 30000 },
    );
  const conditions: Prisma.Sql[] = [Prisma.sql`o.company_id=${companyId}::uuid`];
  if (state) conditions.push(Prisma.sql`o.state::text=${state}`);
  if (search) {
    const q = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      Prisma.sql`(o.number ILIKE ${q} OR c.name ILIKE ${q} OR o.customer_reference ILIKE ${q})`,
    );
  }
  if (filters.customer_id) conditions.push(Prisma.sql`o.customer_id=${filters.customer_id}::uuid`);
  if (filters.from) conditions.push(Prisma.sql`o.order_date>=${filters.from}::date`);
  if (filters.to) conditions.push(Prisma.sql`o.order_date<=${filters.to}::date`);
  const hasBackorder = Prisma.sql`EXISTS (SELECT 1 FROM sales_order_lines l WHERE l.sales_order_id=o.id AND l.backorder_quantity>0)`;
  if (filters.remainder === "CLOSED")
    conditions.push(Prisma.sql`o.state IN ('CLOSED','CANCELLED')`);
  if (filters.remainder === "BACKORDER")
    conditions.push(Prisma.sql`o.state NOT IN ('CLOSED','CANCELLED') AND ${hasBackorder}`);
  if (filters.remainder === "NOT_EVALUATED")
    conditions.push(Prisma.sql`o.state='DRAFT' AND NOT ${hasBackorder}`);
  if (filters.remainder === "IN_PROGRESS")
    conditions.push(
      Prisma.sql`o.state NOT IN ('DRAFT','CLOSED','CANCELLED') AND NOT ${hasBackorder}`,
    );
  if (filters.fulfillment) {
    const sent = Prisma.sql`(SELECT COALESCE(SUM(a.accepted_quantity+a.in_transit_quantity+a.returned_quantity),0) FROM fulfillment_allocations a JOIN sales_order_lines l ON l.id=a.sales_order_line_id WHERE l.sales_order_id=o.id)`;
    const ordered = Prisma.sql`(SELECT COALESCE(SUM(l.ordered_quantity),0) FROM sales_order_lines l WHERE l.sales_order_id=o.id)`;
    conditions.push(
      filters.fulfillment === "NOT_SHIPPED"
        ? Prisma.sql`${sent}=0`
        : filters.fulfillment === "PARTIAL"
          ? Prisma.sql`${sent}>0 AND ${sent}<${ordered}`
          : Prisma.sql`${ordered}>0 AND ${sent}>=${ordered}`,
    );
  }
  const selectedStatus = filters.status
    ? Prisma.sql`display_status=${filters.status}`
    : Prisma.sql`TRUE`;
  const [result] = await db.$queryRaw<
    { ids: string[]; total: number; counts: Record<string, number>; backorder: number }[]
  >`
    WITH statuses AS (${orderStatusRows(companyId)}), filtered AS (
      SELECT o.id,o.order_date,o.number,s.display_status,${hasBackorder} AS backorder
      FROM sales_orders o JOIN statuses s ON s.id=o.id JOIN customers c ON c.id=o.customer_id AND c.company_id=o.company_id
      WHERE ${Prisma.join(conditions, " AND ")}
    ), selected AS (
      SELECT * FROM filtered WHERE ${selectedStatus} ORDER BY order_date DESC,number DESC,id ASC LIMIT 25 OFFSET ${(page - 1) * 25}
    )
    SELECT COALESCE((SELECT jsonb_agg(id ORDER BY order_date DESC,number DESC,id ASC) FROM selected),'[]'::jsonb) AS ids,
      (SELECT count(*)::int FROM filtered WHERE ${selectedStatus}) AS total,
      COALESCE((SELECT jsonb_object_agg(display_status,n) FROM (SELECT display_status,count(*)::int n FROM filtered GROUP BY display_status) grouped),'{}'::jsonb) AS counts,
      (SELECT count(*)::int FROM filtered WHERE backorder) AS backorder`;
  const rows = await db.salesOrder.findMany({
    where: { companyId, id: { in: result!.ids } },
    orderBy: [{ orderDate: "desc" }, { number: "desc" }, { id: "asc" }],
    select: {
      id: true,
      number: true,
      state: true,
      currency: true,
      createdAt: true,
      customerReference: true,
      orderDate: true,
      paymentTermCode: true,
      paymentSnapshot: true,
      warehouseId: true,
      salespersonId: true,
      customer: { select: { name: true } },
      lines: {
        include: {
          allocations: {
            select: { acceptedQuantity: true, inTransitQuantity: true, returnedQuantity: true },
          },
        },
      },
    },
  });
  const facts = await orderReadFacts(companyId, rows, db, includeFinancial);
  const customerRows = await db.salesOrder.findMany({
    where: { companyId },
    distinct: ["customerId"],
    select: { customer: { select: { id: true, name: true } } },
    orderBy: { customerId: "asc" },
    take: 500,
  });
  const counts = Object.fromEntries(
    salesOrderDisplayStatusSchema.options.map((status) => [status, result!.counts[status] ?? 0]),
  );
  return {
    rows: rows.map(({ lines, paymentSnapshot, ...row }) => {
      void paymentSnapshot;
      const view = orderView({ ...row, lines, ...facts.get(row.id) });
      const { downPayment, ...publicView } = view;
      return { ...row, ...publicView, ...(includeFinancial ? { downPayment } : {}) };
    }),
    total: result!.total,
    pageSize: 25,
    summary: {
      ...counts,
      all: Object.values(counts).reduce((s, n) => s + n, 0),
      draft: counts.DRAFT! + counts.WAITING_APPROVAL!,
      open: counts.OPEN!,
      partial: counts.PARTIALLY_SHIPPED!,
      creditHold: counts.WAITING_APPROVAL!,
      backorder: result!.backorder,
    },
    filters: {
      customers: customerRows
        .map((row) => row.customer)
        .sort((a, b) => a.name.localeCompare(b.name, "id")),
    },
    asOf: new Date().toISOString(),
  };
}
