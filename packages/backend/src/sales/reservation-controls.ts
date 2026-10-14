import { ConflictException } from "@nestjs/common";
import { Prisma, prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "../common/transaction-command";
import { lockCustomer } from "./transaction-controls";
import { lineAmounts } from "./pricing-controls";
import { AuditService } from "../common/audit.service";
type Tx = Prisma.TransactionClient;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export async function reservationExpiry(tx: Tx, c: string, now = new Date()) {
  const policy = await tx.systemPolicy.findUnique({
    where: { companyId_code: { companyId: c, code: "OPS-FIN-06" } },
    include: {
      versions: {
        where: {
          state: { in: ["ACTIVE", "SCHEDULED"] },
          OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        },
        orderBy: [{ effectiveFrom: "desc" }, { versionNo: "desc" }],
        take: 1,
      },
    },
  });
  const version = policy?.versions[0];
  const parsed = z
    .object({
      value: z.number().int().min(1).max(8760),
      unit: z.enum(["business_day", "business_hour"]),
      working_weekdays: z.array(z.number().int().min(0).max(6)).min(1),
      holidays: z.array(z.string().date()),
      cutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      working_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      expiry_action: z.literal("release_unpicked"),
    })
    .safeParse(version?.valueSnapshot);
  if (!version || !parsed.success)
    throw new ConflictException("PREPAY_RESERVATION_CALENDAR_POLICY_REQUIRED");
  const company = await tx.company.findUniqueOrThrow({ where: { id: c } }),
    p = parsed.data;
  const day = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: company.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now),
  );
  if (p.working_start >= p.cutoff) throw new ConflictException("RESERVATION_WORKING_HOURS_INVALID");
  let added = 0,
    attempts = 0;
  while (p.unit === "business_day" && added < p.value) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (++attempts > 4000) throw new ConflictException("RESERVATION_CALENDAR_INVALID");
    if (
      p.working_weekdays.includes(day.getUTCDay()) &&
      !p.holidays.includes(day.toISOString().slice(0, 10))
    )
      added++;
  }
  const [h, m] = p.cutoff.split(":").map(Number);
  day.setUTCHours(h!, m!, 0, 0);
  if (p.unit === "business_hour") {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: company.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    day.setUTCHours(
      Number(parts.find((x) => x.type === "hour")!.value),
      Number(parts.find((x) => x.type === "minute")!.value),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    );
    const [sh, sm] = p.working_start.split(":").map(Number);
    let remaining = p.value * 60 * 60 * 1000;
    while (remaining > 0) {
      if (++attempts > 10000) throw new ConflictException("RESERVATION_CALENDAR_INVALID");
      const start = new Date(day),
        end = new Date(day);
      start.setUTCHours(sh!, sm!, 0, 0);
      end.setUTCHours(h!, m!, 0, 0);
      if (
        p.working_weekdays.includes(day.getUTCDay()) &&
        !p.holidays.includes(day.toISOString().slice(0, 10))
      ) {
        if (day < start) day.setTime(start.getTime());
        const available = Math.max(0, end.getTime() - day.getTime()),
          used = Math.min(available, remaining);
        day.setTime(day.getTime() + used);
        remaining -= used;
        if (!remaining) break;
      }
      day.setUTCDate(day.getUTCDate() + 1);
      day.setUTCHours(sh!, sm!, 0, 0);
    }
  }
  let instant = new Date(day);
  for (let n = 0; n < 3; n++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: company.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const part = (name: string) => Number(parts.find((x) => x.type === name)!.value);
    const local = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    );
    instant = new Date(instant.getTime() + day.getTime() - local);
  }
  return {
    expiresAt: instant,
    snapshot: json({ policy_version_id: version.id, timezone: company.timezone, ...p }),
  };
}

/**
 * Backorder reallocation is an explicit user command. Kept as a compatibility
 * hook for callers that still emit stock events; it intentionally does not
 * enqueue work for the worker.
 */
export async function enqueueBackorders(tx: Tx, c: string, productId: string) {
  void tx;
  void c;
  void productId;
}

export async function processReservationExpiries() {
  const rows = await prisma.fulfillmentBatch.findMany({
    where: { state: "ALLOCATED", reservationExpiresAt: { lte: new Date() } },
    include: { salesOrder: true },
    orderBy: { reservationExpiresAt: "asc" },
    take: 25,
  });
  for (const ref of rows) {
    await transactionCommand(
      ref.companyId,
      ref.salesOrder.createdById,
      `reservation/${ref.id}/expire`,
      undefined,
      { id: ref.id },
      async (tx) => {
        const c = ref.companyId,
          a = ref.salesOrder.createdById;
        await lockCustomer(tx, c, ref.salesOrder.customerId);
        await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id=${ref.id}::uuid FOR UPDATE`;
        const b = await tx.fulfillmentBatch.findUniqueOrThrow({
          where: { id: ref.id },
          include: {
            pickList: { include: { lines: true } },
            allocations: { include: { stockLot: true, salesOrderLine: true } },
          },
        });
        if (
          b.state !== "ALLOCATED" ||
          !b.reservationExpiresAt ||
          b.reservationExpiresAt > new Date()
        )
          return { skipped: true };
        if (b.pickList)
          await tx.$queryRaw`SELECT id FROM pick_lists WHERE id=${b.pickList.id}::uuid FOR UPDATE`;
        const required = b.allocations.reduce(
          (s, l) => s.add(lineAmounts(l.salesOrderLine, l.quantity).total),
          new Prisma.Decimal(0),
        );
        const funds =
          (
            await tx.customerReceipt.aggregate({
              where: {
                companyId: c,
                fulfillmentBatchId: b.id,
                currency: ref.salesOrder.currency,
                state: "POSTED",
              },
              _sum: { unallocatedAmount: true },
            })
          )._sum.unallocatedAmount ?? new Prisma.Decimal(0);
        if (funds.gte(required)) {
          await tx.fulfillmentBatch.update({
            where: { id: b.id },
            data: { reservationExpiresAt: null },
          });
          return { funded: true };
        }
        if (
          b.pickList?.lines.some((l) => l.pickedQuantity.gt(0)) ||
          (await tx.salesInvoice.count({ where: { companyId: c, fulfillmentBatchId: b.id } }))
        ) {
          if (
            !(await tx.o2cControlEvent.count({
              where: { companyId: c, sourceId: b.id, kind: "EXPIRY_RETURN_REQUIRED" },
            }))
          )
            await tx.o2cControlEvent.create({
              data: {
                companyId: c,
                actorId: a,
                sourceType: "FULFILLMENT",
                sourceId: b.id,
                kind: "EXPIRY_RETURN_REQUIRED",
                snapshot: { required: required.toString(), funds: funds.toString() },
              },
            });
          return { blocked: "PHYSICAL_RETURN_OR_DOCUMENT_CORRECTION_REQUIRED" };
        }
        for (const l of [...b.allocations].sort((x, y) =>
          x.stockLotId.localeCompare(y.stockLotId),
        )) {
          await tx.$queryRaw`SELECT id FROM stock_lots WHERE id=${l.stockLotId}::uuid FOR UPDATE`;
          await tx.stockLot.update({
            where: { id: l.stockLotId },
            data: { quantityReserved: { decrement: l.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              companyId: c,
              stockLotId: l.stockLotId,
              kind: "RELEASE",
              quantity: l.quantity,
              unitCost: l.stockLot.unitCost,
              sourceType: "RESERVATION_EXPIRY",
              sourceId: b.id,
              idempotencyKey: `expiry:${b.id}:${l.id}`,
            },
          });
          await tx.salesOrderLine.update({
            where: { id: l.salesOrderLineId },
            data: {
              allocatedQuantity: { decrement: l.quantity },
              backorderQuantity: { increment: l.quantity },
            },
          });
        }
        await tx.fulfillmentBatch.update({ where: { id: b.id }, data: { state: "CANCELLED" } });
        await tx.salesOrder.update({
          where: { id: b.salesOrderId },
          data: { version: { increment: 1 } },
        });
        await tx.o2cControlEvent.create({
          data: {
            companyId: c,
            actorId: a,
            sourceType: "FULFILLMENT",
            sourceId: b.id,
            kind: "RESERVATION_EXPIRED",
            snapshot: json(b),
          },
        });
        await new AuditService().recordWith(tx, {
          companyId: c,
          actorId: a,
          action: "reservation.expired",
          resourceType: "fulfillment",
          resourceId: b.id,
          after: { state: "CANCELLED" },
        });
        return { released: true };
      },
    );
  }
}
