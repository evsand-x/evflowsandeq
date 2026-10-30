import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";
import { assertFinancePeriodOpen } from "../finance/period-guard";
import { postLedger } from "../finance/posting";

const audit = new AuditService();
const d = (v: string | Prisma.Decimal) => new Prisma.Decimal(v.toString());

export function calculateStockCountDeltas(
  lines: { stockLotId: string; expected: string; counted: string; unitCost: string }[],
) {
  return lines.flatMap((line) => {
    const counted = d(line.counted);
    if (counted.lt(0)) throw new ConflictException("COUNT_NEGATIVE");
    const delta = counted.minus(d(line.expected));
    return delta.isZero()
      ? []
      : [
          {
            stockLotId: line.stockLotId,
            delta: delta.toFixed(),
            unitCost: d(line.unitCost).toFixed(),
          },
        ];
  });
}

type LineInput = { stock_lot_id: string; counted_quantity: string };
type Input = { warehouse_id: string; locator_ids: string[]; reason: string; lines: LineInput[] };

export async function createStockCount(
  companyId: string,
  actorId: string,
  input: Input,
  key: string,
) {
  return transactionCommand(
    companyId,
    actorId,
    "inventory/stock-counts/create",
    key,
    input,
    async (tx) => {
      const warehouse = await tx.warehouse.findFirst({
        where: { id: input.warehouse_id, companyId, state: "ACTIVE" },
      });
      if (!warehouse) throw new NotFoundException("Gudang tidak ditemukan.");
      const lots = await tx.stockLot.findMany({
        where: {
          companyId,
          id: { in: input.lines.map((x) => x.stock_lot_id) },
          warehouseId: warehouse.id,
          locatorId: { in: input.locator_ids },
          state: "ACTIVE",
        },
      });
      if (lots.length !== input.lines.length)
        throw new ConflictException("STOCK_COUNT_SCOPE_INVALID");
      const count = await tx.stockCount.create({
        data: {
          companyId,
          warehouseId: warehouse.id,
          reason: input.reason,
          idempotencyKey: key,
          lines: {
            create: input.lines.map((line) => {
              const lot = lots.find((x) => x.id === line.stock_lot_id)!;
              const counted = d(line.counted_quantity);
              if (counted.lt(0)) throw new ConflictException("COUNT_NEGATIVE");
              return {
                stockLotId: lot.id,
                expectedQuantity: lot.quantityOnHand,
                countedQuantity: counted,
                unitCost: lot.unitCost,
              };
            }),
          },
        },
        include: { lines: true },
      });
      await audit.recordWith(tx, {
        companyId,
        actorId,
        action: "inventory.stock_count.created",
        resourceType: "stock_count",
        resourceId: count.id,
        after: count,
        reason: input.reason,
      });
      return count;
    },
  );
}

export async function updateStockCount(
  companyId: string,
  actorId: string,
  id: string,
  input: { version: number; lines: LineInput[]; reason: string },
  key: string,
) {
  return transactionCommand(
    companyId,
    actorId,
    `inventory/stock-counts/${id}/update`,
    key,
    input,
    async (tx) => {
      const count = await tx.stockCount.findFirst({
        where: { id, companyId },
        include: { lines: true },
      });
      if (!count) throw new NotFoundException("Opname tidak ditemukan.");
      if (count.state !== "DRAFT" || count.version !== input.version)
        throw new ConflictException("STOCK_COUNT_VERSION_CONFLICT");
      const lots = await tx.stockLot.findMany({
        where: {
          companyId,
          id: { in: input.lines.map((x) => x.stock_lot_id) },
          warehouseId: count.warehouseId,
        },
      });
      await tx.stockCountLine.deleteMany({ where: { stockCountId: id } });
      const updated = await tx.stockCount.update({
        where: { id },
        data: {
          reason: input.reason,
          version: { increment: 1 },
          lines: {
            create: input.lines.map((line) => {
              const lot = lots.find((x) => x.id === line.stock_lot_id);
              if (!lot) throw new ConflictException("STOCK_COUNT_SCOPE_INVALID");
              const counted = d(line.counted_quantity);
              if (counted.lt(0)) throw new ConflictException("COUNT_NEGATIVE");
              return {
                stockLotId: lot.id,
                expectedQuantity: lot.quantityOnHand,
                countedQuantity: counted,
                unitCost: lot.unitCost,
              };
            }),
          },
        },
        include: { lines: true },
      });
      await audit.recordWith(tx, {
        companyId,
        actorId,
        action: "inventory.stock_count.updated",
        resourceType: "stock_count",
        resourceId: id,
        before: count,
        after: updated,
        reason: input.reason,
      });
      return updated;
    },
  );
}

async function transition(
  companyId: string,
  actorId: string,
  id: string,
  version: number,
  key: string,
  target: "SUBMITTED" | "APPROVED",
) {
  return transactionCommand(
    companyId,
    actorId,
    `inventory/stock-counts/${id}/${target.toLowerCase()}`,
    key,
    { version },
    async (tx) => {
      const count = await tx.stockCount.findFirst({
        where: { id, companyId },
        include: { lines: true },
      });
      if (!count || count.version !== version)
        throw new ConflictException("STOCK_COUNT_VERSION_CONFLICT");
      if (target === "SUBMITTED" && count.state !== "DRAFT")
        throw new ConflictException("STOCK_COUNT_STATE_INVALID");
      if (
        target === "APPROVED" &&
        (count.state !== "SUBMITTED" || (count.createdAt && count.submittedById === actorId))
      )
        throw new ConflictException("STOCK_COUNT_APPROVAL_INVALID");
      const updated = await tx.stockCount.update({
        where: { id },
        data:
          target === "SUBMITTED"
            ? {
                state: target,
                submittedAt: new Date(),
                submittedById: actorId,
                version: { increment: 1 },
              }
            : {
                state: target,
                approvedAt: new Date(),
                approvedById: actorId,
                version: { increment: 1 },
              },
        include: { lines: true },
      });
      await audit.recordWith(tx, {
        companyId,
        actorId,
        action: `inventory.stock_count.${target.toLowerCase()}`,
        resourceType: "stock_count",
        resourceId: id,
        before: count,
        after: updated,
      });
      return updated;
    },
  );
}
export const submitStockCount = (
  c: string,
  a: string,
  id: string,
  input: { version: number },
  key: string,
) => transition(c, a, id, input.version, key, "SUBMITTED");
export const approveStockCount = (
  c: string,
  a: string,
  id: string,
  input: { version: number },
  key: string,
) => transition(c, a, id, input.version, key, "APPROVED");

export async function postStockCount(
  companyId: string,
  actorId: string,
  id: string,
  input: { version: number },
  key: string,
) {
  return transactionCommand(
    companyId,
    actorId,
    `inventory/stock-counts/${id}/post`,
    key,
    input,
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM stock_counts WHERE id=${id}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;
      const count = await tx.stockCount.findFirst({
        where: { id, companyId },
        include: { lines: true },
      });
      if (!count || count.state !== "APPROVED" || count.version !== input.version)
        throw new ConflictException("STOCK_COUNT_POST_INVALID");
      const sourceId = count.id;
      const businessDate = new Date();
      await assertFinancePeriodOpen(tx, companyId, businessDate);
      const profile = await tx.financePostingProfile.findFirst({
        where: {
          companyId,
          effectiveFrom: { lte: businessDate },
          effectiveTo: { gt: businessDate },
        },
      });
      const mappings = (profile?.mappings ?? {}) as Record<string, string>;
      if (!mappings.INVENTORY || !mappings.INVENTORY_ADJUSTMENT)
        throw new ConflictException("POSTING_MAPPING_REQUIRED:INVENTORY_ADJUSTMENT");
      let valueDelta = new Prisma.Decimal(0);
      for (const line of count.lines) {
        await tx.$queryRaw`SELECT id FROM stock_lots WHERE id=${line.stockLotId}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;
        const lot = await tx.stockLot.findFirst({ where: { id: line.stockLotId, companyId } });
        if (!lot) throw new NotFoundException("Lot stok tidak ditemukan.");
        const delta = line.countedQuantity.minus(lot.quantityOnHand);
        if (lot.quantityOnHand.plus(delta).lt(0)) throw new ConflictException("STOCK_NEGATIVE");
        if (delta.isZero()) continue;
        valueDelta = valueDelta.plus(delta.mul(lot.unitCost));
        await tx.stockLot.update({
          where: { id: lot.id },
          data: { quantityOnHand: { increment: delta } },
        });
        await tx.inventoryMovement.create({
          data: {
            companyId,
            stockLotId: lot.id,
            kind: "ADJUSTMENT",
            quantity: delta,
            unitCost: lot.unitCost,
            sourceType: "STOCK_COUNT",
            sourceId,
            idempotencyKey: `stock-count:${sourceId}:${lot.id}`,
          },
        });
      }
      if (!valueDelta.isZero()) {
        const amount = valueDelta.abs();
        await postLedger(tx, actorId, {
          businessDate,
          accountIds: valueDelta.gt(0)
            ? [mappings.INVENTORY, mappings.INVENTORY_ADJUSTMENT]
            : [mappings.INVENTORY_ADJUSTMENT, mappings.INVENTORY],
          data: [
            {
              companyId,
              kind: "INVENTORY",
              sourceType: "STOCK_COUNT",
              sourceId,
              debit: valueDelta.gt(0) ? amount : new Prisma.Decimal(0),
              credit: valueDelta.gt(0) ? new Prisma.Decimal(0) : amount,
              currency: "IDR",
            },
            {
              companyId,
              kind: "INVENTORY",
              sourceType: "STOCK_COUNT",
              sourceId,
              debit: valueDelta.gt(0) ? new Prisma.Decimal(0) : amount,
              credit: valueDelta.gt(0) ? amount : new Prisma.Decimal(0),
              currency: "IDR",
            },
          ],
        });
      }
      const posted = await tx.stockCount.update({
        where: { id },
        data: {
          state: "POSTED",
          postedAt: new Date(),
          postedById: actorId,
          version: { increment: 1 },
        },
        include: { lines: true },
      });
      await audit.recordWith(tx, {
        companyId,
        actorId,
        action: "inventory.stock_count.posted",
        resourceType: "stock_count",
        resourceId: id,
        before: count,
        after: posted,
      });
      await tx.outboxEvent.create({
        data: {
          companyId,
          eventType: "inventory.stock_count.posted",
          aggregateId: id,
          payload: { stock_count_id: id },
        },
      });
      return posted;
    },
  );
}
