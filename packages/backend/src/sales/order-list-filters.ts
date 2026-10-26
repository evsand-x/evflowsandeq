import { Prisma, prisma } from "@evflow/database";
import { z } from "zod";
import { salesOrderDisplayStatusSchema } from "@evflow/contracts";

// Filter daftar Sales Order. Status pemenuhan dan sisa memakai aturan yang sama dengan orderView.
export const orderListFilterSchema = z
  .object({
    customer_id: z.string().uuid().optional(),
    status: salesOrderDisplayStatusSchema.optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    fulfillment: z.enum(["NOT_SHIPPED", "PARTIAL", "SHIPPED"]).optional(),
    remainder: z.enum(["BACKORDER", "IN_PROGRESS", "NOT_EVALUATED", "CLOSED"]).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "Tanggal awal tidak boleh setelah tanggal akhir.",
    path: ["to"],
  });
export type OrderListFilters = z.infer<typeof orderListFilterSchema>;

/** Awal hari lokal perusahaan (YYYY-MM-DD) sebagai instan UTC. */
export function localDayStart(date: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!);
  let instant = guess;
  for (let n = 0; n < 2; n++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const part = (name: string) => Number(parts.find((x) => x.type === name)!.value);
    const local = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    );
    instant -= local - guess;
  }
  return new Date(instant);
}

function nextDay(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

const closedStates = ["CLOSED", "CANCELLED"] as const;
const withBackorder: Prisma.SalesOrderWhereInput = {
  lines: { some: { backorderQuantity: { gt: 0 } } },
};
const withoutBackorder: Prisma.SalesOrderWhereInput = {
  lines: { none: { backorderQuantity: { gt: 0 } } },
};

/** Bagian filter yang dapat dinyatakan langsung dengan Prisma (tanpa agregasi alokasi). */
export function orderFilterWhere(
  filters: OrderListFilters,
  _timeZone: string,
): Prisma.SalesOrderWhereInput[] {
  const and: Prisma.SalesOrderWhereInput[] = [];
  if (filters.customer_id) and.push({ customerId: filters.customer_id });
  if (filters.from || filters.to)
    and.push({
      orderDate: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lt: new Date(nextDay(filters.to)) } : {}),
      },
    });
  if (filters.remainder === "CLOSED") and.push({ state: { in: [...closedStates] } });
  if (filters.remainder === "BACKORDER")
    and.push({ state: { notIn: [...closedStates] }, ...withBackorder });
  if (filters.remainder === "NOT_EVALUATED") and.push({ state: "DRAFT", ...withoutBackorder });
  if (filters.remainder === "IN_PROGRESS")
    and.push({ state: { notIn: [...closedStates, "DRAFT"] }, ...withoutBackorder });
  return and;
}

/** ID SO per status pemenuhan: kirim = accepted + in transit + returned dibanding jumlah dipesan. */
export async function fulfillmentOrderIds(
  companyId: string,
  mode: NonNullable<OrderListFilters["fulfillment"]>,
) {
  const condition =
    mode === "NOT_SHIPPED"
      ? Prisma.sql`shipped = 0`
      : mode === "PARTIAL"
        ? Prisma.sql`shipped > 0 AND shipped < ordered`
        : Prisma.sql`ordered > 0 AND shipped >= ordered`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT o.id,
        (SELECT COALESCE(SUM(a.accepted_quantity + a.in_transit_quantity + a.returned_quantity), 0)
          FROM fulfillment_allocations a
          JOIN sales_order_lines l ON l.id = a.sales_order_line_id
          WHERE l.sales_order_id = o.id) AS shipped,
        (SELECT COALESCE(SUM(l.ordered_quantity), 0)
          FROM sales_order_lines l WHERE l.sales_order_id = o.id) AS ordered
      FROM sales_orders o
      WHERE o.company_id = ${companyId}::uuid
    ) totals
    WHERE ${condition}`;
  return rows.map((row) => row.id);
}
