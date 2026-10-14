import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { z } from "zod";
import { createSalesOrderSchema } from "@evflow/contracts";
import { freightValues } from "./proforma";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";
import { lockCustomer } from "./transaction-controls";
import { issueDocument, requireEvidence } from "./document-controls";

const audit = new AuditService();
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const reason = z.string().trim().min(1).max(1000);
const command = z
  .object({ version: z.number().int().positive(), reason, evidence_id: z.string().uuid() })
  .strict();

/** Resolve a physical shortage, keeping the original picking snapshot as evidence. */
export async function resolvePick(c: string, a: string, id: string, body: unknown, key: string) {
  const input = command.parse(body);
  return transactionCommand(c, a, `pick-lists/${id}/resolve-shortage`, key, input, async (tx) => {
    const ref = await tx.pickList.findFirst({
      where: { id, companyId: c },
      include: { fulfillmentBatch: { include: { salesOrder: true } } },
    });
    if (!ref) throw new NotFoundException();
    await lockCustomer(tx, c, ref.fulfillmentBatch.salesOrder.customerId);
    await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id=${ref.fulfillmentBatchId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM pick_lists WHERE id=${id}::uuid FOR UPDATE`;
    const pick = await tx.pickList.findUniqueOrThrow({
      where: { id },
      include: { lines: { include: { allocation: true } }, fulfillmentBatch: true },
    });
    if (
      pick.version !== input.version ||
      pick.state !== "PICKED" ||
      pick.fulfillmentBatch.state !== "ALLOCATED"
    )
      throw new ConflictException("PICK_REVISION_OR_STATE_CHANGED");
    await requireEvidence(tx, c, input.evidence_id, "WAREHOUSE_CONTROL");
    if (
      await tx.salesInvoice.count({
        where: { companyId: c, fulfillmentBatchId: pick.fulfillmentBatchId },
      })
    )
      throw new ConflictException("ISSUED_INVOICE_CORRECTION_REQUIRED");
    let changed = false;
    for (const line of [...pick.lines].sort((x, y) =>
      x.allocation.stockLotId.localeCompare(y.allocation.stockLotId),
    )) {
      const shortage = line.assignedQuantity.sub(line.pickedQuantity);
      if (shortage.lte(0)) continue;
      changed = true;
      await tx.$queryRaw`SELECT id FROM stock_lots WHERE id=${line.allocation.stockLotId}::uuid FOR UPDATE`;
      await tx.stockLot.update({
        where: { id: line.allocation.stockLotId },
        data: {
          quantityReserved: { decrement: shortage },
          qualityState: "HOLD",
          qualityReason: input.reason,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          companyId: c,
          stockLotId: line.allocation.stockLotId,
          kind: "RELEASE",
          quantity: shortage,
          sourceType: "PICK_SHORTAGE",
          sourceId: id,
          idempotencyKey: `shortage:${id}:${input.version}:${line.id}`,
          unitCost: (
            await tx.stockLot.findUniqueOrThrow({ where: { id: line.allocation.stockLotId } })
          ).unitCost,
        },
      });
      await tx.fulfillmentAllocation.update({
        where: { id: line.fulfillmentAllocationId },
        data: { quantity: line.pickedQuantity },
      });
      await tx.pickListLine.update({
        where: { id: line.id },
        data: { assignedQuantity: line.pickedQuantity },
      });
      await tx.salesOrderLine.update({
        where: { id: line.allocation.salesOrderLineId },
        data: {
          allocatedQuantity: { decrement: shortage },
          backorderQuantity: { increment: shortage },
        },
      });
    }
    if (!changed) throw new ConflictException("PICK_SHORTAGE_REQUIRED");
    const updated = await tx.pickList.update({
      where: { id },
      data: { version: { increment: 1 } },
      include: { lines: true },
    });
    await tx.salesOrder.update({
      where: { id: pick.fulfillmentBatch.salesOrderId },
      data: { version: { increment: 1 } },
    });
    await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "PICK_LIST",
        sourceId: id,
        kind: "SHORTAGE_RESOLVED",
        snapshot: json({ before: pick, after: updated, input }),
      },
    });
    await issueDocument(tx, c, a, pick.fulfillmentBatchId, `PICKING_REVISION:${updated.version}`, {
      reason: input.reason,
      supersedes: "PICKING",
      lines: updated.lines,
    });
    // Proforma revisions require explicit review and issuance; retain the old snapshot.
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "pick_list.shortage_resolved",
      resourceType: "pick_list",
      resourceId: id,
      before: pick,
      after: updated,
      reason: input.reason,
    });
    return updated;
  });
}

/** Return physically picked goods to their source locator before releasing a whole batch. */
export async function releaseBatch(c: string, a: string, id: string, body: unknown, key: string) {
  const input = z
    .object({
      reason,
      evidence_id: z.string().uuid(),
      returned_to_source: z.boolean(),
      version: z.number().int().positive(),
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, `fulfillments/${id}/release`, key, input, async (tx) => {
    const ref = await tx.fulfillmentBatch.findFirst({
      where: { id, companyId: c },
      include: { salesOrder: true },
    });
    if (!ref) throw new NotFoundException();
    await lockCustomer(tx, c, ref.salesOrder.customerId);
    await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id=${id}::uuid FOR UPDATE`;
    const batch = await tx.fulfillmentBatch.findUniqueOrThrow({
      where: { id },
      include: {
        pickList: { include: { lines: true } },
        allocations: { include: { stockLot: true } },
        salesOrder: true,
      },
    });
    if (batch.state !== "ALLOCATED" || batch.salesOrder.version !== input.version)
      throw new ConflictException("BATCH_STATE_OR_VERSION_CHANGED");
    if (batch.pickList)
      await tx.$queryRaw`SELECT id FROM pick_lists WHERE id=${batch.pickList.id}::uuid FOR UPDATE`;
    if (batch.pickList?.lines.some((l) => l.pickedQuantity.gt(0)) && !input.returned_to_source)
      throw new ConflictException("PHYSICAL_RETURN_REQUIRED");
    await requireEvidence(tx, c, input.evidence_id, "WAREHOUSE_CONTROL");
    if (await tx.salesInvoice.count({ where: { companyId: c, fulfillmentBatchId: id } }))
      throw new ConflictException("ISSUED_INVOICE_CORRECTION_REQUIRED");
    for (const l of [...batch.allocations].sort((x, y) =>
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
          sourceType: "BATCH_RELEASE",
          sourceId: id,
          idempotencyKey: `release:${id}:${l.id}`,
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
    await tx.salesOrder.update({
      where: { id: batch.salesOrderId },
      data: { version: { increment: 1 } },
    });
    const after = await tx.fulfillmentBatch.update({ where: { id }, data: { state: "CANCELLED" } });
    await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "FULFILLMENT",
        sourceId: id,
        kind: "RELEASED",
        snapshot: json({ input, before: batch }),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "fulfillment.released",
      resourceType: "fulfillment",
      resourceId: id,
      reason: input.reason,
      after,
    });
    return after;
  });
}

export async function closeRemainder(c: string, a: string, id: string, body: unknown, key: string) {
  const input = z
    .object({
      version: z.number().int().positive(),
      reason,
      cancel: z.boolean().default(false),
      confirmation: z
        .object({ contact: reason, at: z.string().datetime(), channel: reason, reference: reason })
        .strict()
        .optional(),
      lines: z
        .array(
          z
            .object({
              line_id: z.string().uuid(),
              quantity: z.string().regex(/^\d+(\.\d{1,10})?$/),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, `orders/${id}/close-remainder`, key, input, async (tx) => {
    const ref = await tx.salesOrder.findFirst({ where: { id, companyId: c } });
    if (!ref) throw new NotFoundException();
    await lockCustomer(tx, c, ref.customerId);
    await tx.$queryRaw`SELECT id FROM sales_orders WHERE id=${id}::uuid FOR UPDATE`;
    const order = await tx.salesOrder.findUniqueOrThrow({
      where: { id },
      include: { lines: true, fulfillments: true },
    });
    if (order.version !== input.version || !["DRAFT", "OPEN"].includes(order.state))
      throw new ConflictException("ORDER_STATE_OR_VERSION_CHANGED");
    if (new Set(input.lines.map((l) => l.line_id)).size !== input.lines.length)
      throw new ConflictException("DUPLICATE_LINES");
    if (input.cancel && !input.confirmation)
      throw new ConflictException("CUSTOMER_CANCELLATION_CONFIRMATION_REQUIRED");
    for (const i of input.lines) {
      const line = order.lines.find((l) => l.id === i.line_id),
        qty = new Prisma.Decimal(i.quantity);
      if (
        !line ||
        qty.lte(0) ||
        qty.gt(line.orderedQuantity.sub(line.allocatedQuantity).sub(line.closedQuantity))
      )
        throw new ConflictException("REMAINDER_EXCEEDED_RELEASE_BATCH_FIRST");
      await tx.salesOrderLine.update({
        where: { id: line.id },
        data: {
          closedQuantity: { increment: qty },
          backorderQuantity: order.state === "DRAFT" ? 0 : line.backorderQuantity.sub(qty),
        },
      });
    }
    const lines = await tx.salesOrderLine.findMany({ where: { salesOrderId: id } });
    const complete = lines.every((l) =>
      l.orderedQuantity.eq(l.allocatedQuantity.add(l.closedQuantity)),
    );
    if (input.cancel && (!complete || order.fulfillments.some((b) => b.state === "ALLOCATED")))
      throw new ConflictException("CANCELLATION_REQUIRES_ALL_REMAINDER_SETTLED");
    const anyDispatched = order.fulfillments.some(
      (b) => !["ALLOCATED", "CANCELLED"].includes(b.state),
    );
    const after = await tx.salesOrder.update({
      where: { id },
      data: {
        version: { increment: 1 },
        state: complete ? (input.cancel && !anyDispatched ? "CANCELLED" : "CLOSED") : order.state,
      },
    });
    await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "SALES_ORDER",
        sourceId: id,
        kind: input.cancel ? "CANCEL_REMAINDER" : "CLOSE_REMAINDER",
        snapshot: json({ input, before: order, after }),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "sales_order.remainder_closed",
      resourceType: "sales_order",
      resourceId: id,
      reason: input.reason,
      after,
    });
    return after;
  });
}

export async function reviseOrder(c: string, a: string, id: string, body: unknown, key: string) {
  const input = z
    .object({
      version: z.number().int().positive(),
      reason,
      evidence_id: z.string().uuid(),
      customer_reference: reason,
      delivery_address: reason,
      freight: createSalesOrderSchema.shape.freight.nullable(),
      lines: z
        .array(
          z
            .object({
              line_id: z.string().uuid(),
              quantity: z.string().regex(/^\d+(\.\d{1,10})?$/),
              unit_price: z.string().regex(/^\d+(\.\d{1,8})?$/),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, `orders/${id}/revise`, key, input, async (tx) => {
    const ref = await tx.salesOrder.findFirst({ where: { companyId: c, id } });
    if (!ref) throw new NotFoundException();
    await lockCustomer(tx, c, ref.customerId);
    await tx.$queryRaw`SELECT id FROM sales_orders WHERE id=${id}::uuid FOR UPDATE`;
    const order = await tx.salesOrder.findUniqueOrThrow({
      where: { id },
      include: { lines: true, fulfillments: true },
    });
    if (order.version !== input.version || !["DRAFT", "OPEN"].includes(order.state))
      throw new ConflictException("ORDER_STATE_OR_VERSION_CHANGED");
    if (
      order.fulfillments.some((b) => b.state !== "CANCELLED") ||
      order.lines.some((l) => l.closedQuantity.gt(0))
    )
      throw new ConflictException("ORDER_REVISION_REQUIRES_UNCOMMITTED_QUANTITIES");
    if (
      input.lines.length !== order.lines.length ||
      new Set(input.lines.map((l) => l.line_id)).size !== input.lines.length
    )
      throw new ConflictException("REVISION_LINES_REQUIRED");
    await requireEvidence(tx, c, input.evidence_id, "SALES_ORDER");
    if (input.freight) {
      await freightValues(tx, c, order.customerId, {
        amount: input.freight.estimate,
        tax_mode: input.freight.tax_mode,
        tax_rule_id: input.freight.tax_rule_id,
      });
    }
    for (const line of input.lines) {
      if (
        !order.lines.some((l) => l.id === line.line_id) ||
        new Prisma.Decimal(line.quantity).lte(0)
      )
        throw new ConflictException("ORDER_REVISION_LINE_INVALID");
      await tx.salesOrderLine.update({
        where: { id: line.line_id },
        data: {
          orderedQuantity: line.quantity,
          unitPrice: line.unit_price,
          allocatedQuantity: 0,
          backorderQuantity: 0,
          priceSnapshot: Prisma.DbNull,
          taxSnapshot: Prisma.DbNull,
        },
      });
    }
    await tx.salesExceptionRequest.updateMany({
      where: { companyId: c, salesOrderId: id, state: { in: ["APPROVED", "SUBMITTED"] } },
      data: { state: "SUPERSEDED" },
    });
    const after = await tx.salesOrder.update({
      where: { id },
      data: {
        state: "DRAFT",
        version: { increment: 1 },
        materialRevision: { increment: 1 },
        paymentSnapshot: Prisma.DbNull,
        customerReference: input.customer_reference,
        deliveryAddress: input.delivery_address,
        evidenceId: input.evidence_id,
        ...(input.freight !== undefined
          ? {
              freightEstimate: input.freight?.estimate ?? null,
              freightTermsSnapshot: input.freight ? json(input.freight) : Prisma.DbNull,
            }
          : {}),
      },
    });
    await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "SALES_ORDER",
        sourceId: id,
        kind: "MATERIAL_REVISION",
        snapshot: json({ input, before: order, after }),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "sales_order.revised",
      resourceType: "sales_order",
      resourceId: id,
      reason: input.reason,
      after,
    });
    return after;
  });
}
