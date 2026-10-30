import { randomUUID } from "node:crypto";
import { Prisma, prisma, type SalesOrderState } from "@evflow/database";
import type { SalesOrderDisplayStatus } from "@evflow/contracts";
import {
  orderDisplayStatus,
  orderIdsByDisplayStatus,
  orderStatusRows,
} from "../../packages/backend/src/sales/order-status";

const statuses: SalesOrderDisplayStatus[] = [
  "DRAFT",
  "WAITING_APPROVAL",
  "OPEN",
  "PARTIALLY_SHIPPED",
  "IN_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];
const decimal = (value: string) => new Prisma.Decimal(value);

describe("SO display-status SQL parity on PostgreSQL", () => {
  it("partitions company orders with the same per-line rules and pending exception lifecycle", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      process.env.NODE_ENV === "production" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      throw new Error("Status query fixtures require a local non-production database");
    }
    const rollback = new Error("STATUS_QUERY_FIXTURE_ROLLBACK");
    await expect(
      prisma.$transaction(
        async (tx) => {
          // Rollback-only projection fixtures: source table names resolve to connection-local temp tables.
          await tx.$executeRawUnsafe(
            "CREATE TEMP TABLE sales_orders (id uuid, company_id uuid, state text) ON COMMIT DROP",
          );
          await tx.$executeRawUnsafe(
            "CREATE TEMP TABLE sales_order_lines (id uuid, company_id uuid, sales_order_id uuid, ordered_quantity numeric(24,10), closed_quantity numeric(24,10)) ON COMMIT DROP",
          );
          await tx.$executeRawUnsafe(
            "CREATE TEMP TABLE fulfillment_batches (id uuid, company_id uuid, sales_order_id uuid) ON COMMIT DROP",
          );
          await tx.$executeRawUnsafe(
            "CREATE TEMP TABLE fulfillment_allocations (sales_order_line_id uuid, fulfillment_batch_id uuid, accepted_quantity numeric(24,10), in_transit_quantity numeric(24,10), returned_quantity numeric(24,10)) ON COMMIT DROP",
          );
          await tx.$executeRawUnsafe(
            "CREATE TEMP TABLE sales_exception_requests (company_id uuid, sales_order_id uuid, state text, expires_at timestamptz) ON COMMIT DROP",
          );
          const company = randomUUID(),
            otherCompany = randomUUID();
          const expected = new Map<SalesOrderDisplayStatus, string[]>(
            statuses.map((status) => [status, []]),
          );
          async function order(
            state: SalesOrderState,
            quantities: string[][],
            pending: "active" | "expired" | "superseded" | "foreign" | null = null,
            owner = company,
          ) {
            const id = randomUUID();
            await tx.$executeRaw`INSERT INTO sales_orders VALUES (${id}::uuid, ${owner}::uuid, ${state})`;
            const lines = [];
            for (const [
              ordered = "10",
              accepted = "0",
              transit = "0",
              closed = "0",
              returned = "0",
            ] of quantities) {
              const lineId = randomUUID(),
                batchId = randomUUID();
              await tx.$executeRaw`INSERT INTO sales_order_lines VALUES (${lineId}::uuid, ${owner}::uuid, ${id}::uuid, ${ordered}::numeric, ${closed}::numeric)`;
              await tx.$executeRaw`INSERT INTO fulfillment_batches VALUES (${batchId}::uuid, ${owner}::uuid, ${id}::uuid)`;
              await tx.$executeRaw`INSERT INTO fulfillment_allocations VALUES (${lineId}::uuid, ${batchId}::uuid, ${accepted}::numeric, ${transit}::numeric, ${returned}::numeric)`;
              lines.push({
                ordered: decimal(ordered),
                accepted: decimal(accepted),
                inTransit: decimal(transit),
                closed: decimal(closed),
              });
            }
            if (pending) {
              const requestCompany = pending === "foreign" ? otherCompany : owner;
              const requestState = pending === "superseded" ? "SUPERSEDED" : "SUBMITTED";
              const expiry =
                pending === "expired" ? new Date("2000-01-01") : new Date("2099-01-01");
              await tx.$executeRaw`INSERT INTO sales_exception_requests VALUES (${requestCompany}::uuid, ${id}::uuid, ${requestState}, ${expiry})`;
            }
            if (owner === company)
              expected
                .get(orderDisplayStatus({ state, lines, pendingException: pending === "active" }))!
                .push(id);
            return id;
          }
          await order("DRAFT", [["10"]]);
          await order("DRAFT", [["10"]], "active");
          await order("DRAFT", [["10"]], "expired");
          await order("DRAFT", [["10"]], "superseded");
          await order("DRAFT", [["10"]], "foreign");
          await order("OPEN", [["10"]]);
          await order("OPEN", []);
          await order("OPEN", [["10", "7", "0", "0", "3"]]);
          await order("OPEN", [["10", "2", "8"]]);
          await order("OPEN", [["10", "10"]]);
          await order("OPEN", [["10", "7", "0", "3"]]);
          await order("OPEN", [["10", "20"], ["10"]]);
          await order("OPEN", [["9999999999999.0000000001", "9999999999999"]]);
          await order("CLOSED", [["10"]]);
          await order("CLOSED", [["30", "0", "0", "20"]]);
          await order("CLOSED", [["30", "0", "10", "20"]]);
          await order("CLOSED", [["30", "10", "0", "20"]]);
          await order("COMPLETED", []);
          await order("CANCELLED", [["10", "10"]], "active");
          await order("OPEN", [["10", "10"]], null, otherCompany);
          // Duplicate allocations aggregate per line rather than duplicating its required quantity.
          const splitId = await order("OPEN", [["10", "4"]]);
          const splitLines = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM sales_order_lines WHERE sales_order_id = ${splitId}::uuid`;
          const splitBatch = randomUUID();
          await tx.$executeRaw`INSERT INTO fulfillment_batches VALUES (${splitBatch}::uuid, ${company}::uuid, ${splitId}::uuid)`;
          await tx.$executeRaw`INSERT INTO fulfillment_allocations VALUES (${splitLines[0]!.id}::uuid, ${splitBatch}::uuid, 6, 0, 0)`;
          expected.set(
            "PARTIALLY_SHIPPED",
            expected.get("PARTIALLY_SHIPPED")!.filter((id) => id !== splitId),
          );
          expected.get("COMPLETED")!.push(splitId);
          const classified = await tx.$queryRaw<
            { id: string; display_status: SalesOrderDisplayStatus }[]
          >(orderStatusRows(company));
          expect(classified).toHaveLength(
            [...expected.values()].reduce((sum, ids) => sum + ids.length, 0),
          );
          for (const status of statuses) {
            expect(
              classified
                .filter((row) => row.display_status === status)
                .map((row) => row.id)
                .sort(),
              status,
            ).toEqual(expected.get(status)!.sort());
            const rows = await tx.$queryRaw<{ id: string }[]>(
              Prisma.sql`SELECT id FROM sales_orders WHERE ${orderIdsByDisplayStatus(company, status)}`,
            );
            expect(rows.map((row) => row.id).sort(), status).toEqual(expected.get(status)!.sort());
          }
          await tx.$executeRaw`INSERT INTO sales_orders SELECT md5(i::text)::uuid, ${company}::uuid, 'OPEN' FROM generate_series(1, 40000) i`;
          const projection = orderStatusRows(company);
          // Classification remains a SQL relation: bind count is independent of company order volume.
          expect(projection.values.length).toBeLessThanOrEqual(8);
          const totals = await tx.$queryRaw<{ count: bigint }[]>(
            Prisma.sql`SELECT COUNT(*) AS count FROM (${projection}) classified WHERE display_status = 'OPEN'`,
          );
          expect(totals[0]!.count).toBe(BigInt(40000 + expected.get("OPEN")!.length));
          throw rollback;
        },
        { timeout: 20_000 },
      ),
    ).rejects.toBe(rollback);
  });
});
