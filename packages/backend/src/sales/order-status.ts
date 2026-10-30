import { Prisma, type SalesOrderState } from "@evflow/database";
import type { SalesOrderDisplayStatus } from "@evflow/contracts";
import type { PaymentTerm } from "./customer-credit";
import { deliveredLineSql } from "./order-delivery-facts";

const Quantity = Prisma.Decimal.clone({ precision: 48 });

type StatusLine = {
  ordered: Prisma.Decimal;
  closed: Prisma.Decimal;
  accepted: Prisma.Decimal;
  inTransit: Prisma.Decimal;
};

/** Read projection only; command gates retain their own domain invariants. */
export function orderDisplayStatus(input: {
  state: SalesOrderState;
  pendingException: boolean;
  lines: StatusLine[];
}): SalesOrderDisplayStatus {
  if (input.state === "CANCELLED") return "CANCELLED";
  if (input.state === "DRAFT") return input.pendingException ? "WAITING_APPROVAL" : "DRAFT";
  if (
    input.state === "COMPLETED" ||
    (input.lines.length > 0 &&
      input.lines.every((line) =>
        line.accepted.gte(new Quantity(line.ordered.toString()).sub(line.closed)),
      ))
  )
    return "COMPLETED";
  if (
    input.lines.length > 0 &&
    input.lines.every((line) =>
      new Quantity(line.accepted.toString())
        .add(line.inTransit)
        .gte(new Quantity(line.ordered.toString()).sub(line.closed)),
    )
  )
    return "IN_DELIVERY";
  if (input.lines.some((line) => new Quantity(line.accepted.toString()).add(line.inTransit).gt(0)))
    return "PARTIALLY_SHIPPED";
  return "OPEN";
}

/** One company-scoped SQL relation for filtering, pagination and status counts in one snapshot. */
export function orderStatusRows(companyId: string): Prisma.Sql {
  // Issued Surat Jalan (Release 1 handover) counts as accepted, like a confirmed delivery.
  return Prisma.sql`    WITH delivered AS (${deliveredLineSql(companyId)}), line_progress AS (
      SELECT l.sales_order_id, l.id,
        l.ordered_quantity - l.closed_quantity AS need,
        COALESCE(SUM(a.accepted_quantity), 0) + COALESCE(MAX(d.delivered), 0) AS accepted,
        COALESCE(SUM(a.accepted_quantity + a.in_transit_quantity), 0) + COALESCE(MAX(d.delivered), 0) AS sent
      FROM sales_order_lines l
      LEFT JOIN delivered d ON d.sales_order_line_id = l.id
      LEFT JOIN fulfillment_allocations a ON a.sales_order_line_id = l.id
        AND EXISTS (
          SELECT 1 FROM fulfillment_batches b
          WHERE b.id = a.fulfillment_batch_id AND b.company_id = ${companyId}::uuid
            AND b.sales_order_id = l.sales_order_id
        )
      WHERE l.company_id = ${companyId}::uuid
      GROUP BY l.sales_order_id, l.id, l.ordered_quantity, l.closed_quantity
    ), progress AS (
      SELECT sales_order_id, COUNT(*) AS line_count,
        BOOL_AND(accepted >= need) AS fully_accepted,
        BOOL_AND(sent >= need) AS fully_sent,
        BOOL_OR(sent > 0) AS any_sent
      FROM line_progress GROUP BY sales_order_id
    )
    SELECT o.id,      CASE
        WHEN o.state = 'CANCELLED' THEN 'CANCELLED'
        WHEN o.state = 'DRAFT' AND EXISTS (
          SELECT 1 FROM sales_exception_requests e
          WHERE e.company_id = ${companyId}::uuid AND e.sales_order_id = o.id
            AND e.state = 'SUBMITTED' AND e.expires_at > CURRENT_TIMESTAMP
        ) THEN 'WAITING_APPROVAL'
        WHEN o.state = 'DRAFT' THEN 'DRAFT'
        WHEN o.state = 'COMPLETED' OR (p.line_count > 0 AND p.fully_accepted) THEN 'COMPLETED'
        WHEN p.line_count > 0 AND p.fully_sent THEN 'IN_DELIVERY'
        WHEN p.any_sent THEN 'PARTIALLY_SHIPPED'
        ELSE 'OPEN'
      END AS display_status
    FROM sales_orders o
    LEFT JOIN progress p ON p.sales_order_id = o.id
    WHERE o.company_id = ${companyId}::uuid`;
}

/** Company-scoped id predicate retained for existing consumers. */
export function orderIdsByDisplayStatus(
  companyId: string,
  status: SalesOrderDisplayStatus,
): Prisma.Sql {
  return Prisma.sql`id IN (SELECT id FROM (${orderStatusRows(companyId)}) classified WHERE display_status = ${status})`;
}
export function estimatedDueDate(orderDate: Date, term: PaymentTerm | null): string | null {
  if (!term || term.kind !== "TEMPO") return null;
  const due = new Date(orderDate);
  due.setUTCDate(due.getUTCDate() + term.days);
  return due.toISOString().slice(0, 10);
}
