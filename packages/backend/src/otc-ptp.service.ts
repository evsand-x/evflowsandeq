/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma, prisma } from "@evflow/database";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "./common/audit.service";
import {
  assertDispatchLots,
  checkCredit,
  eligibleLots,
  lockCustomer,
} from "./sales/transaction-controls";
import {
  assertPriceGrants,
  lineAmounts,
  priceOrder,
  rejectTaxChoice,
} from "./sales/pricing-controls";
import { approvePr } from "./procurement/approval-controls";
import { transactionCommand } from "./common/transaction-command";
import { lockFinance, postLedger } from "./finance/posting";
import { postAdvanceTax, consumeAdvanceTax } from "./finance/advance-tax";
import { issueDocument, requireEvidence } from "./sales/document-controls";
import { reservationExpiry } from "./sales/reservation-controls";
import { nextDocumentNumber } from "./common/document-number";
import {
  operationalTaxSnapshot,
  calculateOperationalTax,
  defaultSalesTaxOn,
} from "./finance/operational-tax";
type Tx = Prisma.TransactionClient;
const d = (v: string | Prisma.Decimal) => new Prisma.Decimal(v);
type FreightTaxMode = "NON_TAXABLE" | "TAXABLE";
@Injectable()
export class OtcPtpService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}
  /** Taxable freight carries the default sales tax (PPN); its snapshot is kept on the document. */
  private async freightTax(tx: Tx, companyId: string, amount: Prisma.Decimal, mode: FreightTaxMode) {
    if (mode === "NON_TAXABLE") return { amount: d("0"), snapshot: null };
    const { tax, snapshot } = await defaultSalesTaxOn(tx, companyId, amount);
    return { amount: tax, snapshot };
  }
  private async lockPickBatch(tx: Tx, c: string, id: string) {
    const ref = await tx.pickList.findFirst({
      where: { id, companyId: c },
      include: { fulfillmentBatch: { include: { salesOrder: true } } },
    });
    if (!ref) throw new NotFoundException();
    await lockCustomer(tx, c, ref.fulfillmentBatch.salesOrder.customerId);
    await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id=${ref.fulfillmentBatchId}::uuid FOR UPDATE`;
    if (
      (await tx.fulfillmentBatch.findUniqueOrThrow({ where: { id: ref.fulfillmentBatchId } }))
        .state !== "ALLOCATED"
    )
      throw new ConflictException("FULFILLMENT_NOT_ALLOCATED");
  }
  private async num(tx: Tx, c: string, e: string, _p: string) {
    return nextDocumentNumber(tx, c, e);
  }
  async openStock(c: string, a: string, i: any, key: string) {
    return transactionCommand(c, a, "stock/opening", key, i, async (tx) => {
      const old = await tx.inventoryMovement.findUnique({
        where: { companyId_idempotencyKey: { companyId: c, idempotencyKey: key } },
        include: { stockLot: true },
      });
      if (old) return old.stockLot;
      const [p, w, l] = await Promise.all([
        tx.product.findFirst({ where: { id: i.product_id, companyId: c, state: "ACTIVE" } }),
        tx.warehouse.findFirst({ where: { id: i.warehouse_id, companyId: c, state: "ACTIVE" } }),
        tx.locator.findFirst({ where: { id: i.locator_id, companyId: c, state: "ACTIVE" } }),
      ]);
      if (!p || !w || !l || l.warehouseId !== w.id)
        throw new NotFoundException("Produk, gudang atau locator tidak valid.");
      const priorLot = await tx.stockLot.findFirst({
        where: {
          companyId: c,
          productId: p.id,
          warehouseId: w.id,
          locatorId: l.id,
          batchNo: i.batch_no,
        },
      });
      if (
        priorLot &&
        (!priorLot.unitCost.eq(i.unit_cost) ||
          (priorLot.expiryDate?.toISOString().slice(0, 10) ?? null) !== (i.expiry_date ?? null))
      )
        throw new ConflictException("OPENING_LOT_BASIS_CHANGED");
      const lot = await tx.stockLot.upsert({
        where: {
          companyId_productId_warehouseId_locatorId_batchNo: {
            companyId: c,
            productId: p.id,
            warehouseId: w.id,
            locatorId: l.id,
            batchNo: i.batch_no,
          },
        },
        create: {
          companyId: c,
          productId: p.id,
          warehouseId: w.id,
          locatorId: l.id,
          batchNo: i.batch_no,
          expiryDate: i.expiry_date ? new Date(i.expiry_date) : null,
          quantityOnHand: d(i.quantity),
          unitCost: d(i.unit_cost),
        },
        update: { quantityOnHand: { increment: d(i.quantity) } },
      });
      const movement = await tx.inventoryMovement.create({
        data: {
          companyId: c,
          stockLotId: lot.id,
          kind: "OPENING_RECEIPT",
          quantity: d(i.quantity),
          unitCost: d(i.unit_cost),
          sourceType: "OPENING_STOCK",
          sourceId: lot.id,
          idempotencyKey: key,
        },
      });
      await postLedger(tx, a, {
        data: [
          {
            companyId: c,
            kind: "INVENTORY",
            sourceType: "OPENING_STOCK",
            sourceId: movement.id,
            debit: d(i.quantity).mul(d(i.unit_cost)),
            credit: d("0"),
          },
          {
            companyId: c,
            kind: "OPENING_STOCK",
            sourceType: "OPENING_STOCK",
            sourceId: movement.id,
            debit: d("0"),
            credit: d(i.quantity).mul(d(i.unit_cost)),
          },
        ],
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "inventory.opening_stock.posted",
        resourceType: "stock_lot",
        resourceId: lot.id,
        after: lot,
      });
      return lot;
    });
  }
  async createSalesOrder(c: string, a: string, i: any, key?: string) {
    rejectTaxChoice(i);
    const cust = await prisma.customer.findFirst({
      where: { id: i.customer_id, companyId: c, state: "ACTIVE" },
    });
    if (!cust) throw new NotFoundException("Pelanggan tidak ditemukan.");
    return transactionCommand(c, a, "sales-orders/create", key, i, async (tx) => {
      const company = await tx.company.findUniqueOrThrow({ where: { id: c } });
      if (i.currency !== company.baseCurrency)
        throw new ConflictException("FOREIGN_CURRENCY_SALES_NOT_ENABLED");
      await requireEvidence(tx, c, i.evidence_id, "SALES_ORDER");
      if (!i.customer_reference?.trim() || !i.delivery_address?.trim())
        throw new ConflictException("ORDER_REFERENCE_ADDRESS_REQUIRED");
      const products = await tx.product.count({
        where: {
          companyId: c,
          state: "ACTIVE",
          id: { in: [...new Set<string>(i.lines.map((x: any) => x.product_id))] },
        },
      });
      if (products !== new Set(i.lines.map((x: any) => x.product_id)).size)
        throw new ConflictException("ORDER_PRODUCT_INVALID");
      if (i.freight?.tax_mode === "TAXABLE")
        await this.freightTax(tx, c, d(i.freight.estimate), "TAXABLE");
      const o = await tx.salesOrder.create({
        data: {
          companyId: c,
          customerId: cust.id,
          number: await this.num(tx, c, "sales_order", "SO"),
          currency: i.currency,
          createdById: a,
          customerReference: i.customer_reference,
          deliveryAddress: i.delivery_address,
          evidenceId: i.evidence_id,
          notes: i.notes,
          freightEstimate: i.freight ? d(i.freight.estimate) : null,
          freightTermsSnapshot: i.freight
            ? {
                payer: i.freight.payer,
                basis: i.freight.basis,
                estimate: i.freight.estimate,
                tax_mode: i.freight.tax_mode,
              }
            : Prisma.DbNull,
          lines: {
            create: i.lines.map((x: any) => ({
              companyId: c,
              productId: x.product_id,
              orderedQuantity: d(x.quantity),
              unitPrice: d(x.unit_price),
            })),
          },
        },
        include: { lines: true },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "sales_order.created",
        resourceType: "sales_order",
        resourceId: o.id,
        after: o,
      });
      return o;
    });
  }
  async setPaymentPolicy(c: string, a: string, customerId: string, i: any) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customerId}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId: c, state: "ACTIVE" },
      });
      if (!customer) throw new NotFoundException("Pelanggan tidak ditemukan.");
      if (
        i.mode === "TEMPO" &&
        (i.top_days === null || i.top_days === undefined || !i.credit_limit)
      )
        throw new ConflictException("TOP_AND_CREDIT_LIMIT_REQUIRED");
      if (i.mode === "TEMPO" && i.past_due_grace_days == null)
        throw new ConflictException("PAST_DUE_POLICY_REQUIRED");
      if (i.frozen && !i.freeze_reason?.trim())
        throw new ConflictException("FREEZE_REASON_REQUIRED");
      const policy = await tx.customerPaymentPolicy.create({
        data: {
          companyId: c,
          customerId,
          mode: i.mode,
          topDays: i.top_days ?? null,
          creditLimit: i.credit_limit ? d(i.credit_limit) : null,
          pastDueGraceDays: i.past_due_grace_days ?? null,
          frozen: i.frozen ?? false,
          freezeReason: i.freeze_reason ?? null,
          effectiveFrom: i.effective_from ? new Date(i.effective_from) : new Date(),
          createdById: a,
        },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "customer.payment_policy.created",
        resourceType: "customer_payment_policy",
        resourceId: policy.id,
        after: policy,
      });
      return policy;
    });
  }
  async submitSalesOrder(c: string, a: string, id: string, key: string, version?: number) {
    return transactionCommand(
      c,
      a,
      `sales-orders/${id}/submit`,
      key,
      { id, version },
      async (tx) => {
        const reference = await tx.salesOrder.findFirst({
          where: { id, companyId: c },
          select: { customerId: true },
        });
        if (!reference) throw new NotFoundException("SO tidak ditemukan.");
        await lockCustomer(tx, c, reference.customerId);
        await tx.$queryRaw`SELECT id FROM sales_orders WHERE id = ${id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
        const o = await tx.salesOrder.findFirst({
          where: { id, companyId: c },
          include: { lines: true },
        });
        if (!o) throw new NotFoundException("SO tidak ditemukan.");
        if (version !== undefined && o.version !== version)
          throw new ConflictException("ORDER_VERSION_CHANGED");
        if (!["DRAFT", "OPEN"].includes(o.state)) throw new ConflictException("ORDER_NOT_OPEN");
        if (o.state === "OPEN" && !o.lines.some((l) => l.backorderQuantity.gt(0))) {
          if (version !== undefined) {
            await assertPriceGrants(tx, c, o.lines);
            await checkCredit(tx, c, o.customerId, o.currency, o.id);
          }
          return o;
        }
        if (o.state === "OPEN" && version === undefined)
          throw new ConflictException("REALLOCATION_COMMAND_REQUIRED");
        await requireEvidence(tx, c, o.evidenceId ?? undefined, "SALES_ORDER");
        if (o.state === "DRAFT") await priceOrder(tx, c, o.customerId, o.currency, o.lines);
        else await assertPriceGrants(tx, c, o.lines);
        const policy = await checkCredit(tx, c, o.customerId, o.currency, o.id);
        const lockedLots = await eligibleLots(
          tx,
          c,
          o.lines.map((x) => x.productId),
        );
        const alloc: any[] = [];
        const shortage: any[] = [];
        for (const line of o.lines) {
          const pending =
            o.state === "DRAFT"
              ? line.orderedQuantity.sub(line.closedQuantity)
              : line.backorderQuantity;
          let rem = d(pending);
          for (const lot of lockedLots.filter((x) => x.productId === line.productId)) {
            const av = d(lot.quantityOnHand).sub(lot.quantityReserved);
            if (av.lte(0) || rem.lte(0)) continue;
            const q = av.lt(rem) ? av : rem;
            alloc.push({ lineId: line.id, lotId: lot.id, q });
            rem = rem.sub(q);
            await tx.stockLot.update({
              where: { id: lot.id },
              data: { quantityReserved: { increment: q } },
            });
            lot.quantityReserved = lot.quantityReserved.add(q);
            await tx.inventoryMovement.create({
              data: {
                companyId: c,
                stockLotId: lot.id,
                kind: "RESERVATION",
                quantity: q,
                unitCost: lot.unitCost,
                sourceType: "SALES_ORDER",
                sourceId: o.id,
                idempotencyKey: `${key}:${line.id}:${lot.id}`,
              },
            });
          }
          await tx.salesOrderLine.update({
            where: { id: line.id },
            data: { allocatedQuantity: { increment: pending.sub(rem) }, backorderQuantity: rem },
          });
          if (rem.gt(0)) shortage.push({ productId: line.productId, quantity: rem });
        }
        if (alloc.length) {
          const reservation =
            (o.paymentSnapshot as { mode?: string } | null)?.mode === "PREPAY" ||
            (!o.paymentSnapshot && policy.mode === "PREPAY")
              ? await reservationExpiry(tx, c)
              : null;
          await tx.fulfillmentBatch.create({
            data: {
              reservationExpiresAt: reservation?.expiresAt ?? null,
              reservationSnapshot: reservation?.snapshot ?? Prisma.DbNull,
              companyId: c,
              salesOrderId: o.id,
              number: await this.num(tx, c, "fulfillment", "FUL"),
              allocations: {
                create: alloc.map((x) => ({
                  salesOrderLineId: x.lineId,
                  stockLotId: x.lotId,
                  quantity: x.q,
                })),
              },
            },
            include: { allocations: true },
          });
        }
        // Backorder is a requirement for logistics review, not an automatic purchase request.
        await checkCredit(tx, c, o.customerId, o.currency, o.id);
        const u = await tx.salesOrder.update({
          where: { id: o.id },
          data: {
            state: "OPEN",
            version: { increment: 1 },
            submittedAt: o.submittedAt ?? new Date(),
            paymentSnapshot: o.paymentSnapshot ?? {
              policy_id: policy.id,
              mode: policy.mode,
              top_days: policy.mode === "COD" ? 0 : policy.topDays,
              credit_limit: policy.creditLimit?.toString() ?? null,
              effective_from: policy.effectiveFrom.toISOString(),
            },
          },
          include: {
            lines: true,
            fulfillments: true,
            purchaseRequests: { include: { lines: true } },
          },
        });
        await this.audit.recordWith(tx, {
          companyId: c,
          actorId: a,
          action: "sales_order.submitted",
          resourceType: "sales_order",
          resourceId: o.id,
          after: u,
        });
        return u;
      },
    );
  }
  async createPickingSlip(c: string, a: string, id: string, key: string) {
    return transactionCommand(
      c,
      a,
      `fulfillment-batches/${id}/create-picking`,
      key,
      { id },
      async (tx) => {
        const ref = await tx.fulfillmentBatch.findFirst({
          where: { id, companyId: c },
          include: { salesOrder: true },
        });
        if (!ref) throw new NotFoundException("Fulfillment tidak ditemukan.");
        await lockCustomer(tx, c, ref.salesOrder.customerId);
        await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
        const batch = await tx.fulfillmentBatch.findFirst({
          where: { id, companyId: c },
          include: {
            salesOrder: { include: { customer: true } },
            pickList: true,
            allocations: {
              include: { stockLot: true, salesOrderLine: { include: { product: true } } },
            },
          },
        });
        if (!batch) throw new NotFoundException("Fulfillment tidak ditemukan.");
        if (batch.state !== "ALLOCATED") throw new ConflictException("FULFILLMENT_NOT_ALLOCATED");
        if (batch.pickList) return batch.pickList;
        const allocations = batch.allocations.filter((x) => x.quantity.gt(0));
        if (!allocations.length) throw new ConflictException("EMPTY_FULFILLMENT");
        const pick = await tx.pickList.create({
          data: {
            companyId: c,
            fulfillmentBatchId: batch.id,
            lines: {
              create: allocations.map((x) => ({
                fulfillmentAllocationId: x.id,
                assignedQuantity: x.quantity,
              })),
            },
          },
          include: { lines: true },
        });
        await issueDocument(tx, c, a, batch.id, "PICKING", {
          order_number: batch.salesOrder.number,
          customer: batch.salesOrder.customer.name,
          address: batch.salesOrder.deliveryAddress,
          reference: batch.salesOrder.customerReference,
          currency: batch.salesOrder.currency,
          allocations: allocations.map((x) => ({
            product: x.salesOrderLine.product.name,
            quantity: x.quantity,
            batch: x.stockLot.batchNo,
            expiry: x.stockLot.expiryDate,
            locator_id: x.stockLot.locatorId,
          })),
        });
        await this.audit.recordWith(tx, {
          companyId: c,
          actorId: a,
          action: "picking_slip.created",
          resourceType: "pick_list",
          resourceId: pick.id,
          after: pick,
        });
        return pick;
      },
    );
  }
  async dispatch(c: string, a: string, id: string, key?: string) {
    return transactionCommand(c, a, `fulfillments/${id}/dispatch`, key, { id }, async (tx) => {
      const reference = await tx.fulfillmentBatch.findFirst({
        where: { id, companyId: c },
        include: { salesOrder: true },
      });
      if (!reference) throw new NotFoundException("Fulfillment tidak ditemukan.");
      await lockCustomer(tx, c, reference.salesOrder.customerId);
      await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id = ${id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const b = await tx.fulfillmentBatch.findFirst({
        where: { id, companyId: c },
        include: {
          salesOrder: true,
          allocations: { include: { stockLot: true, salesOrderLine: true } },
        },
      });
      if (!b) throw new NotFoundException("Fulfillment tidak ditemukan.");
      if (b.state !== "ALLOCATED") throw new ConflictException("Fulfillment sudah diproses.");
      if (!b.allocations.some((x) => x.quantity.gt(0)))
        throw new ConflictException("EMPTY_FULFILLMENT_RELEASE_REQUIRED");
      if (!b.shipmentSnapshot) throw new ConflictException("SHIPMENT_DETAILS_REQUIRED");
      const pick = await tx.pickList.findUnique({
        where: { fulfillmentBatchId: b.id },
        include: { lines: true },
      });
      if (
        !pick ||
        pick.state !== "CHECKED" ||
        pick.lines.some((line) => !line.checkedQuantity.eq(line.assignedQuantity))
      )
        throw new ConflictException("PICKING_CHECK_REQUIRED");
      await checkCredit(tx, c, b.salesOrder.customerId, b.salesOrder.currency, b.salesOrderId);
      await assertPriceGrants(
        tx,
        c,
        b.allocations.filter((x) => x.quantity.gt(0)).map((x) => x.salesOrderLine),
      );
      await assertDispatchLots(
        tx,
        c,
        b.allocations.filter((x) => x.quantity.gt(0)).map((x) => x.stockLotId),
      );
      const snapshot = b.salesOrder.paymentSnapshot as { mode?: string } | null;
      if (!snapshot?.mode) throw new ConflictException("PAYMENT_SNAPSHOT_REQUIRED");
      if (snapshot.mode === "PREPAY") {
        if (!b.reservationSnapshot)
          throw new ConflictException("PREPAY_RESERVATION_POLICY_REQUIRED");
        const required = b.allocations.reduce(
          (sum, allocation) =>
            sum.add(lineAmounts(allocation.salesOrderLine, allocation.quantity).total),
          d("0"),
        );
        const receipts = await tx.customerReceipt.aggregate({
          where: {
            companyId: c,
            fulfillmentBatchId: b.id,
            state: "POSTED",
            currency: b.salesOrder.currency,
          },
          _sum: { unallocatedAmount: true },
        });
        if ((receipts._sum.unallocatedAmount ?? d("0")).lt(required))
          throw new ConflictException("PREPAYMENT_REQUIRED");
      }
      for (const x of b.allocations) {
        if (x.quantity.lte(0)) continue;
        await tx.stockLot.update({
          where: { id: x.stockLotId },
          data: {
            quantityOnHand: { decrement: x.quantity },
            quantityReserved: { decrement: x.quantity },
          },
        });
        await tx.inventoryMovement.create({
          data: {
            companyId: c,
            stockLotId: x.stockLotId,
            kind: "DISPATCH",
            quantity: x.quantity,
            unitCost: x.stockLot.unitCost,
            sourceType: "FULFILLMENT",
            sourceId: b.id,
            idempotencyKey: `dispatch:${b.id}:${x.id}`,
          },
        });
        await tx.fulfillmentAllocation.update({
          where: { id: x.id },
          data: { inTransitQuantity: x.quantity, dispatchUnitCost: x.stockLot.unitCost },
        });
      }
      const dispatchCost = b.allocations.reduce(
        (sum, x) => sum.add(x.quantity.mul(x.stockLot.unitCost)),
        d("0"),
      );
      await postLedger(tx, a, {
        data: [
          {
            companyId: c,
            kind: "INVENTORY_TRANSIT",
            sourceType: "FULFILLMENT",
            sourceId: b.id,
            debit: dispatchCost,
            credit: d("0"),
            currency: b.salesOrder.currency,
          },
          {
            companyId: c,
            kind: "INVENTORY",
            sourceType: "FULFILLMENT",
            sourceId: b.id,
            debit: d("0"),
            credit: dispatchCost,
            currency: b.salesOrder.currency,
          },
        ],
      });
      const dispatched = await tx.fulfillmentBatch.update({
        where: { id: b.id },
        data: { state: "DISPATCHED", dispatchedAt: new Date() },
      });
      const packing = await tx.fulfillmentDocument.findUnique({
        where: { companyId_batchId_kind: { companyId: c, batchId: id, kind: "PACKING" } },
      });
      if (!packing) throw new ConflictException("PACKING_DOCUMENT_REQUIRED");
      await issueDocument(tx, c, a, id, "SURAT_JALAN", {
        packing: packing.snapshot,
        shipment: b.shipmentSnapshot,
        dispatched_at: dispatched.dispatchedAt,
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "fulfillment.dispatched",
        resourceType: "fulfillment_batch",
        resourceId: id,
        after: dispatched,
      });
      return dispatched;
    });
  }

  async confirmPick(c: string, a: string, id: string, input: any, key?: string, draft = false) {
    return transactionCommand(
      c,
      a,
      `pick-lists/${id}/${draft ? "draft" : "pick"}`,
      key,
      input,
      async (tx) => {
        await this.lockPickBatch(tx, c, id);
        await tx.$queryRaw`SELECT id FROM pick_lists WHERE id = ${id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
        const pick = await tx.pickList.findFirst({
          where: { id, companyId: c },
          include: { lines: true },
        });
        if (!pick) throw new NotFoundException("Picking list tidak ditemukan.");
        if (pick.state !== "OPEN") throw new ConflictException("Picking list sudah diproses.");
        if (
          (draft && input.version == null) ||
          (input.version != null && input.version !== pick.version)
        )
          throw new ConflictException("PICK_REVISION_OR_STATE_CHANGED");
        const pickLineIds = new Set(pick.lines.map((line) => line.id));
        if (
          input.lines.length !== pick.lines.length ||
          input.lines.some((item: any) => !pickLineIds.has(item.pick_list_line_id)) ||
          new Set(input.lines.map((item: any) => item.pick_list_line_id)).size !==
            input.lines.length
        )
          throw new ConflictException("PICK_LINES_REQUIRED");
        for (const item of input.lines) {
          const line = pick.lines.find((candidate) => candidate.id === item.pick_list_line_id);
          if (
            !line ||
            d(item.picked_quantity).lt(0) ||
            d(item.picked_quantity).gt(line.assignedQuantity)
          )
            throw new ConflictException("Qty picking melebihi alokasi.");
          await tx.pickListLine.update({
            where: { id: line.id },
            data: { pickedQuantity: d(item.picked_quantity) },
          });
        }
        const updated = await tx.pickList.update({
          where: { id: pick.id },
          data: {
            state: draft ? "OPEN" : "PICKED",
            pickedAt: draft ? null : new Date(),
            version: { increment: 1 },
          },
          include: { lines: true },
        });
        await this.audit.recordWith(tx, {
          companyId: c,
          actorId: a,
          action: draft ? "pick_list.draft_saved" : "pick_list.confirmed",
          resourceType: "pick_list",
          resourceId: pick.id,
          after: updated,
          ...(input.reason ? { reason: input.reason } : {}),
        });
        return updated;
      },
    );
  }

  async confirmCheck(c: string, a: string, id: string, input: any = {}, key?: string) {
    return transactionCommand(c, a, `pick-lists/${id}/check`, key, input, async (tx) => {
      await this.lockPickBatch(tx, c, id);
      await tx.$queryRaw`SELECT id FROM pick_lists WHERE id = ${id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const pick = await tx.pickList.findFirst({
        where: { id, companyId: c },
        include: { lines: true },
      });
      if (!pick) throw new NotFoundException("Picking list tidak ditemukan.");
      if (pick.state !== "PICKED") throw new ConflictException("Picking belum dikonfirmasi.");
      if (input.checks?.length) {
        if (
          input.checks.length !== pick.lines.length ||
          new Set(input.checks.map((x: any) => x.pick_list_line_id)).size !== pick.lines.length
        )
          throw new ConflictException("CHECK_LINES_REQUIRED");
        for (const check of input.checks) {
          const line = pick.lines.find((l) => l.id === check.pick_list_line_id);
          if (
            !line ||
            (check.checked_quantity != null && !line.pickedQuantity.eq(check.checked_quantity))
          )
            throw new ConflictException("CHECK_QTY_MISMATCH");
          if (check.condition !== "BAIK")
            throw new ConflictException("CHECK_CONDITION_REQUIRES_RESOLUTION");
        }
      }
      const incomplete = pick.lines.some((line) => !line.pickedQuantity.eq(line.assignedQuantity));
      if (incomplete) throw new ConflictException("CHECK_QTY_MISMATCH");
      if (!pick.lines.some((line) => line.pickedQuantity.gt(0)))
        throw new ConflictException("EMPTY_PICK_RELEASE_REQUIRED");
      for (const line of pick.lines)
        await tx.pickListLine.update({
          where: { id: line.id },
          data: { checkedQuantity: line.pickedQuantity },
        });
      const updated = await tx.pickList.update({
        where: { id: pick.id },
        data: { state: "CHECKED", checkedAt: new Date(), version: { increment: 1 } },
        include: { lines: true },
      });
      const source = await tx.fulfillmentDocument.findUnique({
        where: {
          companyId_batchId_kind: {
            companyId: c,
            batchId: pick.fulfillmentBatchId,
            kind: "PICKING",
          },
        },
      });
      if (!source) throw new ConflictException("PICKING_DOCUMENT_REQUIRED");
      await issueDocument(tx, c, a, pick.fulfillmentBatchId, "PACKING", {
        source: source.snapshot,
        checked_at: updated.checkedAt,
        checker_id: a,
        packing: input.packing ?? null,
        checks: input.checks ?? [],
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "pick_list.checked",
        resourceType: "pick_list",
        resourceId: pick.id,
        after: updated,
      });
      return updated;
    });
  }
  async confirmPod(c: string, a: string, id: string, input: any, key?: string) {
    return transactionCommand(c, a, `fulfillments/${id}/pod`, key, input, async (tx) => {
      await requireEvidence(tx, c, input.evidence_id, "POD");
      if (!input.receiver_name?.trim()) throw new ConflictException("POD_RECEIVER_REQUIRED");
      const reference = await tx.fulfillmentBatch.findFirst({
        where: { id, companyId: c },
        include: { salesOrder: true },
      });
      if (!reference) throw new NotFoundException("Fulfillment tidak ditemukan.");
      await lockCustomer(tx, c, reference.salesOrder.customerId);
      await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id = ${id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const b = await tx.fulfillmentBatch.findFirst({
        where: { id, companyId: c },
        include: {
          salesOrder: true,
          allocations: { include: { stockLot: true, salesOrderLine: true } },
        },
      });
      if (!b) throw new NotFoundException("Fulfillment tidak ditemukan.");
      if (!(["DISPATCHED", "PARTIALLY_DELIVERED"] as string[]).includes(b.state))
        throw new ConflictException("Pengiriman belum dispatched.");
      const prior = await tx.deliveryReceipt.findMany({
        where: { fulfillmentBatchId: b.id },
        include: { lines: true },
      });
      const allocationIds = new Set(b.allocations.map((allocation) => allocation.id));
      if (
        input.lines.some((item: any) => !allocationIds.has(item.fulfillment_allocation_id)) ||
        new Set(input.lines.map((item: any) => item.fulfillment_allocation_id)).size !==
          input.lines.length
      )
        throw new ConflictException("POD_LINES_REQUIRED");
      const lines = input.lines.map((item: any) => {
        const allocation = b.allocations.find(
          (candidate) => candidate.id === item.fulfillment_allocation_id,
        );
        const acceptedQuantity = d(item.accepted_quantity);
        const returnedQuantity = d(item.returned_quantity ?? "0");
        const alreadySettled = prior.reduce(
          (sum, receipt) =>
            sum
              .add(
                receipt.lines.find((line) => line.fulfillmentAllocationId === allocation?.id)
                  ?.acceptedQuantity ?? d("0"),
              )
              .add(
                receipt.lines.find((line) => line.fulfillmentAllocationId === allocation?.id)
                  ?.returnedQuantity ?? d("0"),
              ),
          d("0"),
        );
        const remaining = allocation ? allocation.quantity.sub(alreadySettled) : d("0");
        if (
          !allocation ||
          acceptedQuantity.add(returnedQuantity).gt(remaining) ||
          returnedQuantity.lt(0) ||
          acceptedQuantity.add(returnedQuantity).lte(0)
        )
          throw new ConflictException("POD_QTY_EXCEEDED");
        return {
          fulfillmentAllocationId: allocation.id,
          acceptedQuantity,
          returnedQuantity,
        };
      });
      const acceptedQuantity = lines.reduce(
        (sum: Prisma.Decimal, line: any) => sum.add(line.acceptedQuantity),
        d("0"),
      );
      const r = await tx.deliveryReceipt.create({
        data: {
          companyId: c,
          salesOrderId: b.salesOrderId,
          fulfillmentBatchId: b.id,
          acceptedAt: input.accepted_at ? new Date(input.accepted_at) : new Date(),
          receiverName: input.receiver_name,
          evidenceId: input.evidence_id,
          acceptedQuantity,
          lines: { create: lines },
        },
      });
      const cost = b.allocations.reduce(
        (s, x) =>
          s.add(
            (
              lines.find((line: any) => line.fulfillmentAllocationId === x.id)?.acceptedQuantity ??
              d("0")
            ).mul(
              x.dispatchUnitCost ??
                (() => {
                  throw new ConflictException("DISPATCH_COST_SNAPSHOT_REQUIRED");
                })(),
            ),
          ),
        d("0"),
      );
      for (const line of lines) {
        const allocation = b.allocations.find(
          (candidate) => candidate.id === line.fulfillmentAllocationId,
        )!;
        await tx.fulfillmentAllocation.update({
          where: { id: allocation.id },
          data: {
            inTransitQuantity: { decrement: line.acceptedQuantity.add(line.returnedQuantity) },
            acceptedQuantity: { increment: line.acceptedQuantity },
            returnedQuantity: { increment: line.returnedQuantity },
          },
        });
        if (line.returnedQuantity.gt(0)) {
          const locator = input.quarantine_locator_id
            ? await tx.locator.findFirst({
                where: {
                  id: input.quarantine_locator_id,
                  companyId: c,
                  state: "ACTIVE",
                  locatorType: "QUARANTINE",
                  warehouseId: allocation.stockLot.warehouseId,
                },
              })
            : null;
          if (!locator) throw new ConflictException("RETURN_QUARANTINE_LOCATOR_REQUIRED");
          const returned = await tx.stockLot.create({
            data: {
              companyId: c,
              productId: allocation.stockLot.productId,
              warehouseId: locator.warehouseId,
              locatorId: locator.id,
              batchNo: `${allocation.stockLot.batchNo}:POD:${r.id}:${allocation.id}`,
              expiryDate: allocation.stockLot.expiryDate,
              quantityOnHand: line.returnedQuantity,
              unitCost:
                allocation.dispatchUnitCost ??
                (() => {
                  throw new ConflictException("DISPATCH_COST_SNAPSHOT_REQUIRED");
                })(),
              qualityState: "QUARANTINE",
              qualityReason: `POD ${r.id}`,
            },
          });
          await tx.inventoryMovement.create({
            data: {
              companyId: c,
              stockLotId: returned.id,
              kind: "RETURN_FROM_TRANSIT",
              quantity: line.returnedQuantity,
              unitCost:
                allocation.dispatchUnitCost ??
                (() => {
                  throw new ConflictException("DISPATCH_COST_SNAPSHOT_REQUIRED");
                })(),
              sourceType: "DELIVERY_RECEIPT",
              sourceId: r.id,
              idempotencyKey: `pod-return:${r.id}:${allocation.id}`,
            },
          });
          const returnCost = line.returnedQuantity.mul(
            allocation.dispatchUnitCost ??
              (() => {
                throw new ConflictException("DISPATCH_COST_SNAPSHOT_REQUIRED");
              })(),
          );
          await postLedger(tx, a, {
            data: [
              {
                companyId: c,
                kind: "INVENTORY_QUARANTINE",
                sourceType: "POD_RETURN",
                sourceId: returned.id,
                debit: returnCost,
                credit: d("0"),
                currency: b.salesOrder.currency,
              },
              {
                companyId: c,
                kind: "INVENTORY_TRANSIT",
                sourceType: "POD_RETURN",
                sourceId: returned.id,
                debit: d("0"),
                credit: returnCost,
                currency: b.salesOrder.currency,
              },
            ],
          });
        }
      }
      const amounts = lines.map((line: any) =>
        lineAmounts(
          b.allocations.find((x) => x.id === line.fulfillmentAllocationId)!.salesOrderLine,
          line.acceptedQuantity,
        ),
      );
      const net = amounts.reduce(
        (sum: Prisma.Decimal, x: ReturnType<typeof lineAmounts>) => sum.add(x.net),
        d("0"),
      );
      const tax = amounts.reduce(
        (sum: Prisma.Decimal, x: ReturnType<typeof lineAmounts>) => sum.add(x.tax),
        d("0"),
      );
      const journal = {
        companyId: c,
        sourceType: "DELIVERY_RECEIPT",
        sourceId: r.id,
        currency: b.salesOrder.currency,
      };
      const advancedTax = await consumeAdvanceTax(
        tx,
        c,
        b.id,
        lines.map((line: any) => ({
          allocationId: line.fulfillmentAllocationId,
          tax: lineAmounts(
            b.allocations.find((x) => x.id === line.fulfillmentAllocationId)!.salesOrderLine,
            line.acceptedQuantity,
          ).tax,
        })),
      );
      const masterTaxes = lines.flatMap((line: any) => {
        const source = b.allocations.find(
          (x) => x.id === line.fulfillmentAllocationId,
        )!.salesOrderLine;
        const snapshot = source.taxSnapshot as { account_id?: string } | null;
        if (!snapshot?.account_id) return [];
        return [
          {
            accountId: snapshot.account_id,
            amount: lineAmounts(source, line.acceptedQuantity).tax,
          },
        ];
      });
      const legacyTax = tax
        .sub(
          masterTaxes.reduce(
            (sum: Prisma.Decimal, row: { amount: Prisma.Decimal }) => sum.add(row.amount),
            d("0"),
          ),
        )
        .sub(advancedTax);
      await postLedger(tx, a, {
        accountIds: [
          undefined,
          undefined,
          undefined,
          undefined,
          ...(legacyTax.isZero() ? [] : [undefined]),
          ...masterTaxes.map((row: { accountId: string }) => row.accountId),
          undefined,
        ],
        data: [
          { ...journal, kind: "SALE_COGS", debit: cost, credit: d("0") },
          { ...journal, kind: "INVENTORY_TRANSIT", debit: d("0"), credit: cost },
          { ...journal, kind: "UNBILLED_AR", debit: net.add(tax), credit: d("0") },
          { ...journal, kind: "SALE_REVENUE", debit: d("0"), credit: net },
          ...(legacyTax.isZero()
            ? []
            : [
                {
                  ...journal,
                  kind: "SALES_TAX" as const,
                  debit: Prisma.Decimal.max(legacyTax.neg(), 0),
                  credit: Prisma.Decimal.max(legacyTax, 0),
                },
              ]),
          ...masterTaxes.map((row: { amount: Prisma.Decimal }) => ({
            ...journal,
            kind: "SALES_TAX" as const,
            debit: Prisma.Decimal.max(row.amount.neg(), 0),
            credit: Prisma.Decimal.max(row.amount, 0),
          })),
          { ...journal, kind: "CUSTOMER_ADVANCE", debit: d("0"), credit: advancedTax },
        ],
      });
      const settled = (
        await tx.fulfillmentAllocation.findMany({ where: { fulfillmentBatchId: b.id } })
      ).every((allocation) => allocation.inTransitQuantity.lte(0));
      await tx.fulfillmentBatch.update({
        where: { id: b.id },
        data: { state: settled ? "DELIVERED" : "PARTIALLY_DELIVERED", podAt: r.acceptedAt },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "delivery_receipt.confirmed",
        resourceType: "delivery_receipt",
        resourceId: r.id,
        after: r,
      });
      return r;
    });
  }
  async issueInvoice(c: string, a: string, id: string, key: string) {
    return transactionCommand(c, a, `fulfillments/${id}/issue-invoice`, key, { id }, async (tx) => {
      const batch = await tx.fulfillmentBatch.findFirst({
        where: { id, companyId: c },
        include: {
          salesOrder: true,
          pickList: { include: { lines: { include: { allocation: { include: { salesOrderLine: true } } } } } },
        },
      });
      if (!batch) throw new NotFoundException();
      await lockCustomer(tx, c, batch.salesOrder.customerId);
      await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id=${id}::uuid FOR UPDATE`;
      if (!batch.pickList || batch.pickList.state !== "CHECKED" || batch.state !== "ALLOCATED")
        throw new ConflictException("CHECKED_PACKING_LIST_REQUIRED");
      const existing = await tx.salesInvoice.findFirst({
        where: { companyId: c, fulfillmentBatchId: id, state: { in: ["POSTED", "ISSUED_WAITING_POD"] } },
      });
      if (existing?.state === "POSTED") return existing;
      const lines = batch.pickList.lines
        .filter((l) => l.checkedQuantity.gt(0))
        .map((l) => ({ allocation_id: l.allocation.id, quantity: l.checkedQuantity, amounts: lineAmounts(l.allocation.salesOrderLine, l.checkedQuantity) }));
      const subtotal = lines.reduce((s, l) => s.add(l.amounts.net), d("0"));
      const tax = lines.reduce((s, l) => s.add(l.amounts.tax), d("0")).add(batch.freightTaxAmount);
      const total = subtotal.add(tax).add(batch.freightAmount);
      if (total.lte(0)) throw new ConflictException("INVOICE_QUANTITY_REQUIRED");
      const policy = batch.salesOrder.paymentSnapshot as { mode?: string; top_days?: number | null } | null;
      if (!policy?.mode || (policy.mode === "TEMPO" && policy.top_days == null)) throw new ConflictException("PAYMENT_SNAPSHOT_REQUIRED");
      const company = await tx.company.findUniqueOrThrow({ where: { id: c } });
      const dueDate = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: company.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
      dueDate.setUTCDate(dueDate.getUTCDate() + (policy.top_days ?? 0));
      const snapshot = JSON.parse(JSON.stringify({ status: "POSTED", source: "PACKING_LIST", packing_list: batch.pickList.id, order: batch.salesOrder.number, lines, payment: policy, issued_at: new Date(), due_date: dueDate }));
      const invoice = existing
        ? await tx.salesInvoice.update({ where: { id: existing.id }, data: { state: "POSTED", subtotal, taxAmount: tax, total, freightAmount: batch.freightAmount, freightTaxAmount: batch.freightTaxAmount, outstandingAmount: total, dueDate, postedAt: new Date(), issuedSnapshot: snapshot } })
        : await tx.salesInvoice.create({ data: { companyId: c, customerId: batch.salesOrder.customerId, salesOrderId: batch.salesOrderId, fulfillmentBatchId: id, number: await this.num(tx, c, "sales_invoice", "INV"), state: "POSTED", currency: batch.salesOrder.currency, subtotal, taxAmount: tax, total, freightAmount: batch.freightAmount, freightTaxAmount: batch.freightTaxAmount, freightSnapshot: { amount: batch.freightAmount.toString(), tax: batch.freightTaxAmount.toString(), tax_snapshot: batch.freightTaxSnapshot }, outstandingAmount: total, dueDate, postedAt: new Date(), issuedSnapshot: snapshot } });
      await issueDocument(tx, c, a, id, `INVOICE:${invoice.id}`, { ...snapshot, number: invoice.number, company: company.name, customer: (await tx.customer.findUniqueOrThrow({ where: { id: batch.salesOrder.customerId } })).name, currency: invoice.currency, subtotal, tax, total, lines });
      await postLedger(tx, a, { data: [{ companyId: c, kind: "AR", sourceType: "SALES_INVOICE", sourceId: invoice.id, currency: invoice.currency, debit: total, credit: d("0") }, { companyId: c, kind: "UNBILLED_AR", sourceType: "SALES_INVOICE", sourceId: invoice.id, currency: invoice.currency, debit: d("0"), credit: total }] });
      await this.audit.recordWith(tx, { companyId: c, actorId: a, action: "sales_invoice.posted", resourceType: "sales_invoice", resourceId: invoice.id, after: invoice });
      return invoice;
    });
  }
  async saveInvoiceDraft(
    c: string,
    a: string,
    id: string | undefined,
    input: {
      delivery_receipt_id: string;
      notes: string;
      billing_reference: string;
      version?: number | undefined;
    },
    key: string,
  ) {
    return transactionCommand(c, a, `invoice-drafts/${id ?? "new"}`, key, input, async (tx) => {
      const ref = await tx.deliveryReceipt.findFirst({
        where: { companyId: c, id: input.delivery_receipt_id },
        include: { salesOrder: true },
      });
      if (!ref) throw new NotFoundException("POD tidak ditemukan.");
      await lockCustomer(tx, c, ref.salesOrder.customerId);
      await tx.$queryRaw`SELECT id FROM delivery_receipts WHERE id=${ref.id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
      const before = id ? await tx.salesInvoice.findFirst({ where: { id, companyId: c } }) : null;
      if (id && !before) throw new NotFoundException();
      if (before && (before.state !== "DRAFT" || before.deliveryReceiptId !== ref.id))
        throw new ConflictException("INVOICE_DRAFT_LOCKED");
      const oldSnapshot = before?.issuedSnapshot as { version?: number } | null;
      if (before && input.version !== oldSnapshot?.version)
        throw new ConflictException("INVOICE_DRAFT_VERSION_CHANGED");
      const duplicate = await tx.salesInvoice.findFirst({
        where: {
          companyId: c,
          deliveryReceiptId: ref.id,
          state: { in: ["DRAFT", "POSTED"] },
          ...(id ? { id: { not: id } } : {}),
        },
      });
      if (duplicate) throw new ConflictException("POD_ALREADY_HAS_INVOICE");
      const waiting = await tx.salesInvoice.findFirst({
        where: {
          companyId: c,
          fulfillmentBatchId: ref.fulfillmentBatchId,
          state: "ISSUED_WAITING_POD",
        },
      });
      if (waiting) throw new ConflictException("FINALIZE_EXISTING_INVOICE");
      const pod = await tx.deliveryReceipt.findUniqueOrThrow({
        where: { id: ref.id },
        include: {
          fulfillmentBatch: true,
          lines: {
            include: {
              allocation: {
                include: {
                  salesOrderLine: {
                    include: { product: { include: { baseUom: true } }, Uom: true },
                  },
                },
              },
            },
          },
        },
      });
      const customer = await tx.customer.findUniqueOrThrow({
        where: { id: ref.salesOrder.customerId },
      });
      const company = await tx.company.findUniqueOrThrow({ where: { id: c } });
      const allocations = pod.lines.map((l) => ({
        product_code: l.allocation.salesOrderLine.product.code,
        product: l.allocation.salesOrderLine.product.name,
        unit:
          l.allocation.salesOrderLine.Uom?.name ?? l.allocation.salesOrderLine.product.baseUom.name,
        quantity: l.acceptedQuantity,
        unit_price: l.allocation.salesOrderLine.unitPrice,
        tax_snapshot: l.allocation.salesOrderLine.taxSnapshot,
        amounts: lineAmounts(l.allocation.salesOrderLine, l.acceptedQuantity),
      }));
      const subtotal = allocations.reduce((s, l) => s.add(l.amounts.net), d("0"));
      const tax = allocations.reduce(
        (s, l) => s.add(l.amounts.tax),
        pod.fulfillmentBatch.freightTaxAmount,
      );
      const total = subtotal.add(tax).add(pod.fulfillmentBatch.freightAmount);
      if (total.lte(0)) throw new ConflictException("INVOICE_ACCEPTED_QUANTITY_REQUIRED");
      const snapshot = JSON.parse(
        JSON.stringify({
          version: (oldSnapshot?.version ?? 0) + 1,
          notes: input.notes,
          reference: input.billing_reference,
          company: company.name,
          customer: customer.name,
          address: ref.salesOrder.deliveryAddress,
          currency: ref.salesOrder.currency,
          payment: ref.salesOrder.paymentSnapshot,
          allocations,
          subtotal,
          tax,
          total,
          freight: {
            amount: pod.fulfillmentBatch.freightAmount,
            tax: pod.fulfillmentBatch.freightTaxAmount,
          },
          batch_number: pod.fulfillmentBatch.number,
        }),
      );
      const data = {
        companyId: c,
        customerId: customer.id,
        salesOrderId: ref.salesOrderId,
        deliveryReceiptId: ref.id,
        fulfillmentBatchId: ref.fulfillmentBatchId,
        currency: ref.salesOrder.currency,
        state: "DRAFT" as const,
        subtotal,
        taxAmount: tax,
        total,
        freightAmount: pod.fulfillmentBatch.freightAmount,
        freightTaxAmount: pod.fulfillmentBatch.freightTaxAmount,
        outstandingAmount: 0,
        issuedSnapshot: snapshot,
      };
      const result = before
        ? await tx.salesInvoice.update({ where: { id: before.id }, data })
        : await tx.salesInvoice.create({
            data: { ...data, number: await this.num(tx, c, "sales_invoice", "INV") },
          });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: before ? "sales_invoice.draft_updated" : "sales_invoice.draft_created",
        resourceType: "sales_invoice",
        resourceId: result.id,
        before: before ?? undefined,
        after: result,
      });
      return result;
    });
  }
  async postInvoice(c: string, a: string, rid: string, key?: string) {
    return transactionCommand(
      c,
      a,
      `delivery-receipts/${rid}/invoice`,
      key,
      { rid },
      async (tx) => {
        const reference = await tx.deliveryReceipt.findFirst({
          where: { id: rid, companyId: c },
          include: { salesOrder: true },
        });
        if (!reference) throw new NotFoundException("POD tidak ditemukan.");
        await lockCustomer(tx, c, reference.salesOrder.customerId);
        await tx.$queryRaw`SELECT id FROM delivery_receipts WHERE id = ${rid}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
        const r = await tx.deliveryReceipt.findFirst({
          where: { id: rid, companyId: c },
          include: {
            salesOrder: true,
            invoices: true,
            lines: { include: { allocation: { include: { salesOrderLine: true } } } },
          },
        });
        if (!r) throw new NotFoundException("POD tidak ditemukan.");
        const freightBatch = await tx.fulfillmentBatch.findFirstOrThrow({
          where: { id: r.fulfillmentBatchId, companyId: c },
        });
        const postedInvoice = r.invoices.find((i) => i.state === "POSTED");
        if (postedInvoice) return postedInvoice;
        const policy = r.salesOrder.paymentSnapshot as {
          mode?: string;
          top_days?: number | null;
        } | null;
        if (!policy?.mode || (policy.mode === "TEMPO" && policy.top_days == null))
          throw new ConflictException("PAYMENT_SNAPSHOT_REQUIRED");
        const company = await tx.company.findUniqueOrThrow({ where: { id: c } });
        const dueDate = new Date(
          new Intl.DateTimeFormat("en-CA", {
            timeZone: company.timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(r.acceptedAt),
        );
        dueDate.setUTCDate(dueDate.getUTCDate() + (policy.top_days ?? 0));
        const amounts = r.lines.map((x) =>
          lineAmounts(x.allocation.salesOrderLine, x.acceptedQuantity),
        );
        const sub = amounts.reduce((sum, x) => sum.add(x.net), d("0"));
        const tax = amounts
          .reduce((sum, x) => sum.add(x.tax), d("0"))
          .add(freightBatch.freightTaxAmount);
        const total = sub.add(tax).add(freightBatch.freightAmount);
        if (total.lte(0)) throw new ConflictException("INVOICE_ACCEPTED_QUANTITY_REQUIRED");
        const waitingIssued = await tx.salesInvoice.findFirst({
          where: {
            companyId: c,
            fulfillmentBatchId: r.fulfillmentBatchId,
            state: "ISSUED_WAITING_POD",
          },
        });
        const draft = r.invoices.find((i) => i.state === "DRAFT");
        if (
          draft &&
          (!draft.total?.eq(total) || !draft.subtotal.eq(sub) || !draft.taxAmount.eq(tax))
        )
          throw new ConflictException("INVOICE_DRAFT_SOURCE_CHANGED");
        if (draft && waitingIssued) throw new ConflictException("DUPLICATE_INVOICE_SOURCE");
        const waiting = waitingIssued ?? draft;
        const invoiceData = {
          companyId: c,
          customerId: r.salesOrder.customerId,
          salesOrderId: r.salesOrderId,
          deliveryReceiptId: r.id,
          fulfillmentBatchId: r.fulfillmentBatchId,
          number: waiting?.number ?? (await this.num(tx, c, "sales_invoice", "INV")),
          state: "POSTED" as const,
          currency: r.salesOrder.currency,
          subtotal: sub,
          taxAmount: tax,
          total,
          freightAmount: freightBatch.freightAmount,
          freightTaxAmount: freightBatch.freightTaxAmount,
          freightSnapshot: {
            amount: freightBatch.freightAmount.toString(),
            tax: freightBatch.freightTaxAmount.toString(),
            tax_snapshot: freightBatch.freightTaxSnapshot,
          },
          outstandingAmount: total,
          dueDate,
          postedAt: new Date(),
        };
        const inv = waiting
          ? await tx.salesInvoice.update({ where: { id: waiting.id }, data: invoiceData })
          : await tx.salesInvoice.create({ data: invoiceData });
        if (waiting)
          await tx.o2cControlEvent.create({
            data: {
              companyId: c,
              actorId: a,
              sourceType: "SALES_INVOICE",
              sourceId: inv.id,
              kind: "FINALIZED_FROM_POD",
              snapshot: JSON.parse(JSON.stringify({ issued: waiting, posted: inv, pod_id: r.id })),
            },
          });
        const customer = await tx.customer.findUniqueOrThrow({
          where: { id: r.salesOrder.customerId },
        });
        const products = await tx.product.findMany({
          where: {
            companyId: c,
            id: { in: r.lines.map((x) => x.allocation.salesOrderLine.productId) },
          },
        });
        await issueDocument(tx, c, a, r.fulfillmentBatchId, `INVOICE:${inv.id}`, {
          number: inv.number,
          company: company.name,
          customer: customer.name,
          order: r.salesOrder.number,
          address: r.salesOrder.deliveryAddress,
          pod: r.id,
          receiver: r.receiverName,
          currency: inv.currency,
          due_date: inv.dueDate,
          subtotal: sub,
          tax,
          total,
          lines: r.lines.map((x) => ({
            product_code: products.find((p) => p.id === x.allocation.salesOrderLine.productId)
              ?.code,
            tax_snapshot: x.allocation.salesOrderLine.taxSnapshot,
            product: products.find((p) => p.id === x.allocation.salesOrderLine.productId)?.name,
            quantity: x.acceptedQuantity,
            unit_price: x.allocation.salesOrderLine.unitPrice,
            amounts: lineAmounts(x.allocation.salesOrderLine, x.acceptedQuantity),
          })),
        });
        await postLedger(tx, a, {
          data: [
            {
              companyId: c,
              kind: "AR",
              sourceType: "SALES_INVOICE",
              sourceId: inv.id,
              currency: inv.currency,
              debit: total,
              credit: d("0"),
            },
            {
              companyId: c,
              kind: "UNBILLED_AR",
              sourceType: "SALES_INVOICE",
              sourceId: inv.id,
              currency: inv.currency,
              debit: d("0"),
              credit: total,
            },
          ],
        });
        const receipts = await tx.customerReceipt.findMany({
          where: {
            companyId: c,
            fulfillmentBatchId: r.fulfillmentBatchId,
            state: "POSTED",
            unallocatedAmount: { gt: 0 },
          },
          orderBy: { receivedAt: "asc" },
        });
        let remaining = total;
        for (const receipt of receipts) {
          if (remaining.lte(0)) break;
          if (receipt.currency !== inv.currency)
            throw new ConflictException("RECEIPT_INVOICE_STATE_OR_CURRENCY_MISMATCH");
          const amount = receipt.unallocatedAmount.lt(remaining)
            ? receipt.unallocatedAmount
            : remaining;
          const allocation = await tx.customerReceiptAllocation.create({
            data: { companyId: c, receiptId: receipt.id, invoiceId: inv.id, amount },
          });
          await tx.customerReceipt.update({
            where: { id: receipt.id },
            data: { unallocatedAmount: { decrement: amount } },
          });
          await tx.salesInvoice.update({
            where: { id: inv.id },
            data: { outstandingAmount: { decrement: amount } },
          });
          await postLedger(tx, a, {
            data: [
              {
                companyId: c,
                kind: "CUSTOMER_ADVANCE",
                sourceType: "CUSTOMER_RECEIPT_ALLOCATION",
                sourceId: allocation.id,
                currency: inv.currency,
                debit: amount,
                credit: d("0"),
              },
              {
                companyId: c,
                kind: "AR",
                sourceType: "CUSTOMER_RECEIPT_ALLOCATION",
                sourceId: allocation.id,
                currency: inv.currency,
                debit: d("0"),
                credit: amount,
              },
            ],
          });
          remaining = remaining.sub(amount);
        }
        await this.audit.recordWith(tx, {
          companyId: c,
          actorId: a,
          action: "sales_invoice.posted",
          resourceType: "sales_invoice",
          resourceId: inv.id,
          after: inv,
        });
        return tx.salesInvoice.findUniqueOrThrow({ where: { id: inv.id } });
      },
    );
  }
  async createCustomerReturn(c: string, a: string, customerId: string, i: any, key: string) {
    return transactionCommand(c, a, `customers/${customerId}/returns`, key, i, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c + ":return:" + key}, 0))`;
      await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customerId}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const existing = await tx.customerReturn.findUnique({
        where: { companyId_idempotencyKey: { companyId: c, idempotencyKey: key } },
        include: { lines: true },
      });
      if (existing) throw new ConflictException("IDEMPOTENCY_KEY_ALREADY_USED");
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId: c, state: "ACTIVE" },
      });
      if (!customer) throw new NotFoundException("Pelanggan tidak ditemukan.");
      const invoice = i.sales_invoice_id
        ? await tx.salesInvoice.findFirst({
            where: { id: i.sales_invoice_id, companyId: c, customerId, state: "POSTED" },
          })
        : null;
      if (i.sales_invoice_id && !invoice) throw new ConflictException("RETURN_INVOICE_INVALID");
      const sourceIds: string[] = i.lines.map((line: any) => line.delivery_receipt_line_id);
      if (new Set(sourceIds).size !== i.lines.length)
        throw new ConflictException("DUPLICATE_RETURN_LINES");
      const sourceLines = await tx.deliveryReceiptLine.findMany({
        where: {
          id: { in: sourceIds },
          deliveryReceipt: {
            companyId: c,
            salesOrder: { customerId },
            ...(invoice ? { id: invoice.deliveryReceiptId! } : {}),
          },
        },
        include: {
          returns: true,
          deliveryReceipt: { include: { salesOrder: true } },
          allocation: { include: { salesOrderLine: true, stockLot: true } },
        },
      });
      if (sourceLines.length !== i.lines.length)
        throw new ConflictException("RETURN_SOURCE_NOT_FOUND");
      const currencies = new Set(
        sourceLines.map((line) => line.deliveryReceipt.salesOrder.currency),
      );
      if (currencies.size !== 1) throw new ConflictException("RETURN_CURRENCY_MISMATCH");
      const returnData: any = {
        companyId: c,
        customerId,
        reason: i.reason,
        idempotencyKey: key,
        state: "RECEIVED",
        createdById: a,
        lines: {
          create: i.lines.map((item: any) => {
            const source = sourceLines.find((line) => line.id === item.delivery_receipt_line_id)!;
            const qty = d(item.quantity);
            const previouslyReturned = source.returns.reduce(
              (sum, line) => sum.add(line.quantity),
              d("0"),
            );
            if (qty.lte(0) || qty.gt(source.acceptedQuantity.sub(previouslyReturned)))
              throw new ConflictException("RETURN_QTY_EXCEEDED");
            return {
              deliveryReceiptLineId: source.id,
              quantity: qty,
              unitPrice: source.allocation.salesOrderLine.unitPrice,
              quarantineLocatorId: item.quarantine_locator_id,
              batchNo: item.batch_no,
            };
          }),
        },
      };
      if (invoice) returnData.salesInvoiceId = invoice.id;
      const ret = await tx.customerReturn.create({ data: returnData, include: { lines: true } });
      for (const line of ret.lines) {
        const source = sourceLines.find(
          (candidate) => candidate.id === line.deliveryReceiptLineId,
        )!;
        const locator = await tx.locator.findFirst({
          where: {
            id: line.quarantineLocatorId,
            companyId: c,
            warehouseId: source.allocation.stockLot.warehouseId,
            locatorType: "QUARANTINE",
            state: "ACTIVE",
          },
        });
        if (!locator) throw new ConflictException("QUARANTINE_LOCATOR_REQUIRED");
        const lot = await tx.stockLot.upsert({
          where: {
            companyId_productId_warehouseId_locatorId_batchNo: {
              companyId: c,
              productId: source.allocation.stockLot.productId,
              warehouseId: source.allocation.stockLot.warehouseId,
              locatorId: locator.id,
              batchNo: `${line.batchNo}:${ret.id}:${line.id}`,
            },
          },
          create: {
            companyId: c,
            productId: source.allocation.stockLot.productId,
            warehouseId: source.allocation.stockLot.warehouseId,
            locatorId: locator.id,
            batchNo: `${line.batchNo}:${ret.id}:${line.id}`,
            expiryDate: source.allocation.stockLot.expiryDate,
            quantityOnHand: line.quantity,
            unitCost:
              source.allocation.dispatchUnitCost ??
              (() => {
                throw new ConflictException("DISPATCH_COST_SNAPSHOT_REQUIRED");
              })(),
          },
          update: { quantityOnHand: { increment: line.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            companyId: c,
            stockLotId: lot.id,
            kind: "RETURN_RECEIPT",
            quantity: line.quantity,
            unitCost:
              source.allocation.dispatchUnitCost ??
              (() => {
                throw new ConflictException("DISPATCH_COST_SNAPSHOT_REQUIRED");
              })(),
            sourceType: "CUSTOMER_RETURN",
            sourceId: ret.id,
            idempotencyKey: `return:${ret.id}:${line.id}`,
          },
        });
      }
      const returnedCost = ret.lines.reduce(
        (sum, line) =>
          sum.add(
            line.quantity.mul(
              sourceLines.find((s) => s.id === line.deliveryReceiptLineId)!.allocation
                .dispatchUnitCost!,
            ),
          ),
        d("0"),
      );
      const source = {
        companyId: c,
        sourceType: "CUSTOMER_RETURN",
        sourceId: ret.id,
        currency: [...currencies][0]!,
      };
      await postLedger(tx, a, {
        data: [
          { ...source, kind: "INVENTORY_QUARANTINE", debit: returnedCost, credit: d("0") },
          { ...source, kind: "SALE_COGS", debit: d("0"), credit: returnedCost },
        ],
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "customer_return.received",
        resourceType: "customer_return",
        resourceId: ret.id,
        after: ret,
      });
      return ret;
    });
  }

  async postCreditNote(c: string, a: string, returnId: string) {
    return prisma.$transaction(async (tx) => {
      const reference = await tx.customerReturn.findFirst({
        where: { id: returnId, companyId: c },
      });
      if (!reference) throw new NotFoundException();
      await lockCustomer(tx, c, reference.customerId);
      await tx.$queryRaw`SELECT id FROM customer_returns WHERE id = ${returnId}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const ret = await tx.customerReturn.findFirst({
        where: { id: returnId, companyId: c },
        include: { lines: true, salesInvoice: true, creditNotes: true },
      });
      if (!ret || !ret.salesInvoice) throw new ConflictException("RETURN_INVOICE_REQUIRED");
      if (ret.creditNotes.length) return ret.creditNotes[0];
      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${ret.salesInvoice.id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const invoice = await tx.salesInvoice.findUnique({ where: { id: ret.salesInvoice.id } });
      if (!invoice) throw new NotFoundException("Invoice tidak ditemukan.");
      const amount = ret.lines.reduce(
        (sum, line) => sum.add(line.quantity.mul(line.unitPrice)),
        d("0"),
      );
      if (
        invoice.companyId !== c ||
        invoice.customerId !== ret.customerId ||
        invoice.state !== "POSTED" ||
        ret.state !== "RECEIVED"
      )
        throw new ConflictException("RETURN_INVOICE_INVALID");
      const sources = await tx.deliveryReceiptLine.findMany({
        where: {
          id: { in: ret.lines.map((line) => line.deliveryReceiptLineId) },
          deliveryReceiptId: invoice.deliveryReceiptId!,
        },
      });
      if (
        !ret.lines.length ||
        sources.length !== ret.lines.length ||
        ret.lines.some(
          (line) =>
            line.quantity.lte(0) ||
            line.quantity.gt(
              sources.find((source) => source.id === line.deliveryReceiptLineId)!.acceptedQuantity,
            ),
        )
      )
        throw new ConflictException("RETURN_SOURCE_INVALID");
      const credited =
        (
          await tx.creditNote.aggregate({
            where: { salesInvoiceId: invoice.id, state: "POSTED" },
            _sum: { amount: true },
          })
        )._sum.amount ?? d("0");
      if (amount.lte(0) || amount.gt(invoice.subtotal.sub(credited)))
        throw new ConflictException("CREDIT_NOTE_EXCEEDED");
      const arAmount = Prisma.Decimal.min(amount, invoice.outstandingAmount);
      const customerCredit = amount.sub(arAmount);
      const note = await tx.creditNote.create({
        data: {
          companyId: c,
          customerReturnId: ret.id,
          salesInvoiceId: invoice.id,
          number: await this.num(tx, c, "credit_note", "CN"),
          amount,
          state: "POSTED",
          postedAt: new Date(),
        },
      });
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { outstandingAmount: { decrement: arAmount } },
      });
      await postLedger(tx, a, {
        data: [
          {
            companyId: c,
            kind: "SALES_RETURN",
            currency: invoice.currency,
            sourceType: "CREDIT_NOTE",
            sourceId: note.id,
            debit: amount,
            credit: d("0"),
          },
          {
            companyId: c,
            kind: "AR",
            sourceType: "CREDIT_NOTE",
            currency: invoice.currency,
            sourceId: note.id,
            debit: d("0"),
            credit: arAmount,
          },
          {
            companyId: c,
            kind: "CUSTOMER_ADVANCE",
            sourceType: "CREDIT_NOTE",
            currency: invoice.currency,
            sourceId: note.id,
            debit: d("0"),
            credit: customerCredit,
          },
        ],
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "credit_note.posted",
        resourceType: "credit_note",
        resourceId: note.id,
        after: note,
      });
      return note;
    });
  }

  async postCustomerRefund(c: string, a: string, i: any, key: string) {
    return transactionCommand(c, a, "customer-refunds", key, i, async (tx) => {
      const ref = await tx.creditNote.findFirst({
        where: { companyId: c, id: i.credit_note_id },
        include: { salesInvoice: true },
      });
      if (!ref) throw new NotFoundException();
      await lockCustomer(tx, c, ref.salesInvoice.customerId);
      await requireEvidence(tx, c, i.evidence_id, "PAYMENT");
      if (!i.bank_reference?.trim() || !i.bank_account_id)
        throw new ConflictException("REFUND_BANK_AND_REFERENCE_REQUIRED");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c + ":refund:" + key}, 0))`;
      await tx.$queryRaw`SELECT id FROM credit_notes WHERE id = ${i.credit_note_id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const existing = await tx.customerRefund.findUnique({
        where: { companyId_idempotencyKey: { companyId: c, idempotencyKey: key } },
      });
      if (existing) {
        if (existing.creditNoteId !== i.credit_note_id || !existing.amount.eq(d(i.amount)))
          throw new ConflictException("IDEMPOTENCY_PAYLOAD_MISMATCH");
        return existing;
      }
      const note = await tx.creditNote.findFirst({
        where: { id: i.credit_note_id, companyId: c, state: "POSTED" },
        include: { salesInvoice: true },
      });
      if (!note) throw new NotFoundException("Credit note tidak ditemukan.");
      await lockFinance(tx, c);
      const request = await tx.o2cControlEvent.findFirst({
        where: {
          companyId: c,
          id: i.approval_request_id ?? "00000000-0000-0000-0000-000000000000",
          sourceType: "CUSTOMER_REFUND",
          sourceId: note.id,
          kind: "REQUEST",
        },
      });
      const approved =
        request &&
        (await tx.o2cControlEvent.count({
          where: { companyId: c, sourceId: request.id, kind: "APPROVED" },
        }));
      const basis = request?.snapshot as { input: Record<string, string> } | undefined;
      if (
        !approved ||
        !basis ||
        ["credit_note_id", "bank_account_id", "evidence_id", "bank_reference", "amount"].some(
          (k) => basis.input[k] !== i[k],
        )
      )
        throw new ConflictException("REFUND_APPROVAL_REQUIRED_OR_CHANGED");
      if (
        await tx.o2cControlEvent.count({
          where: { companyId: c, sourceId: request!.id, kind: "POSTED" },
        })
      )
        throw new ConflictException("REFUND_APPROVAL_ALREADY_USED");
      const amount = d(i.amount);
      const alreadyRefunded =
        (
          await tx.customerRefund.aggregate({
            where: { creditNoteId: note.id, state: "POSTED" },
            _sum: { amount: true },
          })
        )._sum.amount ?? d("0");
      const taxCorrections = await tx.o2cControlEvent.findMany({
        where: { companyId: c, sourceType: "TAX_CORRECTION", sourceId: note.id, kind: "REQUEST" },
        select: { id: true },
      });
      const liability = await tx.ledgerEntry.aggregate({
        where: {
          companyId: c,
          OR: [
            { sourceType: "CREDIT_NOTE", sourceId: note.id },
            { sourceType: "TAX_CORRECTION", sourceId: { in: taxCorrections.map((e) => e.id) } },
          ],
          kind: "CUSTOMER_ADVANCE",
        },
        _sum: { credit: true, debit: true },
      });
      const refundable = (liability._sum.credit ?? d("0"))
        .sub(liability._sum.debit ?? d("0"))
        .sub(alreadyRefunded);
      if (amount.lte(0) || amount.gt(refundable)) throw new ConflictException("REFUND_EXCEEDED");
      const refund = await tx.customerRefund.create({
        data: {
          companyId: c,
          creditNoteId: note.id,
          amount,
          state: "POSTED",
          idempotencyKey: key,
          currency: note.salesInvoice.currency,
          bankAccountId: i.bank_account_id,
          evidenceId: i.evidence_id,
          bankReference: i.bank_reference,
        },
      });
      await postLedger(tx, a, {
        data: [
          {
            companyId: c,
            kind: "CUSTOMER_ADVANCE",
            sourceType: "CUSTOMER_REFUND",
            currency: note.salesInvoice.currency,
            sourceId: refund.id,
            debit: amount,
            credit: d("0"),
          },
          {
            companyId: c,
            kind: "CASH_REFUND",
            sourceType: "CUSTOMER_REFUND",
            currency: note.salesInvoice.currency,
            sourceId: refund.id,
            debit: d("0"),
            credit: amount,
          },
        ],
      });
      await tx.o2cControlEvent.create({
        data: {
          companyId: c,
          actorId: a,
          sourceType: "CUSTOMER_REFUND",
          sourceId: request!.id,
          kind: "POSTED",
          snapshot: { refund_id: refund.id },
        },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "customer_refund.posted",
        resourceType: "customer_refund",
        resourceId: refund.id,
        after: refund,
      });
      return refund;
    });
  }

  async getArAging(c: string, customerId?: string, asOfInput?: string) {
    const asOf = asOfInput ? new Date(asOfInput) : new Date();
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        companyId: c,
        state: "POSTED",
        ...(customerId ? { customerId } : {}),
        outstandingAmount: { gt: 0 },
      },
      select: {
        id: true,
        customerId: true,
        number: true,
        dueDate: true,
        outstandingAmount: true,
        currency: true,
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    });
    const buckets = {
      current: d("0"),
      days1to30: d("0"),
      days31to60: d("0"),
      days61to90: d("0"),
      over90: d("0"),
    };
    const items = invoices.map((invoice) => {
      if (!invoice.dueDate) throw new ConflictException("POSTED_INVOICE_DUE_DATE_REQUIRED");
      const days = Math.max(0, Math.floor((asOf.getTime() - invoice.dueDate.getTime()) / 86400000));
      const key =
        days === 0
          ? "current"
          : days <= 30
            ? "days1to30"
            : days <= 60
              ? "days31to60"
              : days <= 90
                ? "days61to90"
                : "over90";
      buckets[key] = buckets[key].add(invoice.outstandingAmount);
      return { ...invoice, daysPastDue: days, bucket: key };
    });
    return { asOf, customerId: customerId ?? null, buckets, items };
  }

  async invoiceCandidates(c: string) {
    const batches = await prisma.fulfillmentBatch.findMany({
      where: { companyId: c, state: "ALLOCATED", pickList: { state: "CHECKED" } },
      include: { salesOrder: { include: { customer: true } }, pickList: { include: { lines: { include: { allocation: { include: { salesOrderLine: { include: { product: { include: { baseUom: true } }, Uom: true } } } } } } } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
    });
    const ids = batches.map((b) => b.id);
    const invoices = await prisma.salesInvoice.findMany({ where: { companyId: c, fulfillmentBatchId: { in: ids }, state: { in: ["POSTED", "ISSUED_WAITING_POD"] } }, select: { id: true, number: true, state: true, fulfillmentBatchId: true } });
    const used = new Set(invoices.map((i) => i.fulfillmentBatchId));
    const company = await prisma.company.findUniqueOrThrow({ where: { id: c } });
    return batches.filter((b) => !used.has(b.id)).map((b) => {
      const lines = b.pickList!.lines.filter((l) => l.checkedQuantity.gt(0));
      const allocations = lines.map((l) => ({ product_code: l.allocation.salesOrderLine.product.code, product: l.allocation.salesOrderLine.product.name, unit: l.allocation.salesOrderLine.Uom?.name ?? l.allocation.salesOrderLine.product.baseUom.name, quantity: l.checkedQuantity, unit_price: l.allocation.salesOrderLine.unitPrice, tax_snapshot: l.allocation.salesOrderLine.taxSnapshot, amounts: lineAmounts(l.allocation.salesOrderLine, l.checkedQuantity) }));
      const subtotal = allocations.reduce((s, l) => s.add(l.amounts.net), d("0"));
      const tax = allocations.reduce((s, l) => s.add(l.amounts.tax), d("0")).add(b.freightTaxAmount);
      return { id: b.id, sourceType: "PACKING_LIST", packingListId: b.pickList!.id, checkedAt: b.pickList!.checkedAt, fulfillmentBatch: { id: b.id, number: b.number, freightAmount: b.freightAmount, freightTaxAmount: b.freightTaxAmount }, salesOrder: b.salesOrder, snapshot: { company: company.name, customer: b.salesOrder.customer.name, currency: b.salesOrder.currency, address: b.salesOrder.deliveryAddress, reference: b.salesOrder.customerReference, payment: b.salesOrder.paymentSnapshot, allocations, subtotal, tax, total: subtotal.add(tax).add(b.freightAmount), freight: { amount: b.freightAmount, tax: b.freightTaxAmount } } };
    });
  }

  async createCustomerReceipt(c: string, a: string, customerId: string, i: any, key: string) {
    return transactionCommand(c, a, `customers/${customerId}/receipt`, key, i, async (tx) => {
      await lockCustomer(tx, c, customerId);
      await requireEvidence(tx, c, i.evidence_id, "PAYMENT");
      if (!i.bank_reference?.trim()) throw new ConflictException("BANK_REFERENCE_REQUIRED");
      const existing = await tx.customerReceipt.findUnique({
        where: { companyId_idempotencyKey: { companyId: c, idempotencyKey: key } },
        include: { allocations: true },
      });
      if (existing) return existing;
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId: c, state: "ACTIVE" },
      });
      if (!customer) throw new NotFoundException("Pelanggan tidak ditemukan.");
      if (i.fulfillment_batch_id) {
        const batch = await tx.fulfillmentBatch.findFirst({
          where: { id: i.fulfillment_batch_id, companyId: c, salesOrder: { customerId } },
          include: { salesOrder: true },
        });
        if (!batch) throw new ConflictException("FULFILLMENT_CUSTOMER_MISMATCH");
        if (batch.salesOrder.currency !== i.currency)
          throw new ConflictException("FULFILLMENT_CURRENCY_MISMATCH");
        if (["CANCELLED", "CLOSED"].includes(batch.salesOrder.state) || batch.state === "CANCELLED")
          throw new ConflictException("FULFILLMENT_NOT_OPEN");
      }
      const receipt = await tx.customerReceipt.create({
        data: {
          companyId: c,
          customerId,
          fulfillmentBatchId: i.fulfillment_batch_id,
          externalReference: i.external_reference,
          bankReference: i.bank_reference,
          bankAccountId: i.bank_account_id,
          evidenceId: i.evidence_id,
          receivedAt: i.received_at ? new Date(i.received_at) : new Date(),
          amount: d(i.amount),
          unallocatedAmount: d(i.amount),
          currency: i.currency,
          idempotencyKey: key,
          createdById: a,
        },
      });
      await postLedger(tx, a, {
        data: [
          {
            companyId: c,
            kind: "CASH_RECEIPT",
            sourceType: "CUSTOMER_RECEIPT",
            sourceId: receipt.id,
            currency: receipt.currency,
            debit: receipt.amount,
            credit: d("0"),
          },
          {
            companyId: c,
            kind: "CUSTOMER_ADVANCE",
            sourceType: "CUSTOMER_RECEIPT",
            sourceId: receipt.id,
            currency: receipt.currency,
            debit: d("0"),
            credit: receipt.amount,
          },
        ],
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "customer_receipt.posted",
        resourceType: "customer_receipt",
        resourceId: receipt.id,
        after: receipt,
      });
      await postAdvanceTax(tx, c, a, receipt.id);
      return receipt;
    });
  }

  async allocateCustomerReceipt(c: string, a: string, receiptId: string, i: any, key?: string) {
    return transactionCommand(c, a, `receipts/${receiptId}/allocate`, key, i, async (tx) => {
      const reference = await tx.customerReceipt.findFirst({
        where: { id: receiptId, companyId: c },
      });
      if (!reference) throw new NotFoundException("Penerimaan pelanggan tidak ditemukan.");
      await lockCustomer(tx, c, reference.customerId);
      await tx.$queryRaw`SELECT id FROM customer_receipts WHERE id = ${receiptId}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const receipt = await tx.customerReceipt.findFirst({
        where: { id: receiptId, companyId: c },
      });
      if (!receipt) throw new NotFoundException("Penerimaan pelanggan tidak ditemukan.");
      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${i.invoice_id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const invoice = await tx.salesInvoice.findFirst({
        where: { id: i.invoice_id, companyId: c },
      });
      if (!invoice || invoice.customerId !== receipt.customerId)
        throw new ConflictException("RECEIPT_INVOICE_MISMATCH");
      if (receipt.fulfillmentBatchId && invoice.fulfillmentBatchId !== receipt.fulfillmentBatchId)
        throw new ConflictException("RECEIPT_FUNDS_BOUND_TO_ANOTHER_FULFILLMENT");
      if (
        receipt.state !== "POSTED" ||
        invoice.state !== "POSTED" ||
        receipt.currency !== invoice.currency
      )
        throw new ConflictException("RECEIPT_INVOICE_STATE_OR_CURRENCY_MISMATCH");
      const amount = d(i.amount);
      if (
        amount.lte(0) ||
        amount.gt(receipt.unallocatedAmount) ||
        amount.gt(invoice.outstandingAmount)
      )
        throw new ConflictException("RECEIPT_ALLOCATION_EXCEEDED");
      const allocation = await tx.customerReceiptAllocation.create({
        data: { companyId: c, receiptId, invoiceId: invoice.id, amount },
      });
      await tx.customerReceipt.update({
        where: { id: receipt.id },
        data: { unallocatedAmount: { decrement: amount } },
      });
      const updated = await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { outstandingAmount: { decrement: amount } },
      });
      await postLedger(tx, a, {
        data: [
          {
            companyId: c,
            kind: "CUSTOMER_ADVANCE",
            sourceType: "CUSTOMER_RECEIPT_ALLOCATION",
            sourceId: allocation.id,
            currency: receipt.currency,
            debit: amount,
            credit: d("0"),
          },
          {
            companyId: c,
            kind: "AR",
            sourceType: "CUSTOMER_RECEIPT_ALLOCATION",
            sourceId: allocation.id,
            currency: receipt.currency,
            debit: d("0"),
            credit: amount,
          },
        ],
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "customer_receipt.allocated",
        resourceType: "customer_receipt_allocation",
        resourceId: allocation.id,
        after: { allocation, invoice: updated },
      });
      return { allocation, invoice: updated };
    });
  }

  async createSupplierInvoice(c: string, a: string, poId: string, i: any, key: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.supplierInvoice.findUnique({
        where: { companyId_idempotencyKey: { companyId: c, idempotencyKey: key } },
        include: { lines: true, payable: true },
      });
      if (existing) return existing;
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${poId}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const po = await tx.purchaseOrder.findFirst({
        where: { id: poId, companyId: c },
        include: { lines: true },
      });
      if (!po) throw new NotFoundException("PO tidak ditemukan.");
      if (["CANCELLED", "CLOSED"].includes(po.state))
        throw new ConflictException("PO_TIDAK_DAPAT_DITAGIH");
      if (i.lines.length !== new Set(i.lines.map((x: any) => x.purchase_order_line_id)).size)
        throw new ConflictException("DUPLICATE_INVOICE_LINES");
      const lines = i.lines.map((item: any) => {
        const line = po.lines.find((candidate) => candidate.id === item.purchase_order_line_id);
        const quantity = d(item.quantity);
        const unitCost = d(item.unit_cost);
        if (!line || quantity.gt(line.receivedQuantity.sub(line.invoicedQuantity)))
          throw new ConflictException("INVOICE_QTY_EXCEEDED");
        if (!unitCost.equals(line.unitCost)) throw new ConflictException("INVOICE_PRICE_MISMATCH");
        return { purchaseOrderLineId: line.id, quantity, unitCost };
      });
      const subtotal = lines.reduce(
        (sum: Prisma.Decimal, line: any) => sum.add(line.quantity.mul(line.unitCost)),
        d("0"),
      );
      const taxSnapshot = i.tax_master_id
        ? await operationalTaxSnapshot(
            tx,
            c,
            i.tax_master_id,
            new Date(i.invoice_date + "T23:59:59.999Z"),
            "PURCHASE",
          )
        : null;
      const taxAmount = taxSnapshot
        ? calculateOperationalTax(subtotal, taxSnapshot)
        : d(i.tax_amount ?? "0");
      if (taxSnapshot && i.tax_amount !== undefined && !taxAmount.eq(i.tax_amount))
        throw new ConflictException("TAX_AMOUNT_MISMATCH");
      const invoice = await tx.supplierInvoice.create({
        data: {
          companyId: c,
          supplierId: po.supplierId,
          purchaseOrderId: po.id,
          externalNumber: i.supplier_invoice_number,
          number: await this.num(tx, c, "supplier_invoice", "PINV"),
          invoiceDate: new Date(i.invoice_date),
          dueDate: new Date(i.due_date),
          subtotal,
          taxAmount,
          total: subtotal.add(taxAmount),
          ...(taxSnapshot ? { taxSnapshot } : {}),
          currency: i.currency,
          state: "MATCHED",
          idempotencyKey: key,
          createdById: a,
          lines: { create: lines },
        },
        include: { lines: true },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "supplier_invoice.matched",
        resourceType: "supplier_invoice",
        resourceId: invoice.id,
        after: invoice,
      });
      return invoice;
    });
  }
  async postSupplierInvoice(c: string, a: string, id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM supplier_invoices WHERE id = ${id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const invoice = await tx.supplierInvoice.findFirst({
        where: { id, companyId: c },
        include: { lines: true, payable: true },
      });
      if (!invoice) throw new NotFoundException("Invoice supplier tidak ditemukan.");
      if (invoice.state === "POSTED") return invoice;
      if (invoice.state !== "MATCHED") throw new ConflictException("INVOICE_NOT_MATCHED");
      const poLines = await tx.purchaseOrderLine.findMany({
        where: { id: { in: invoice.lines.map((line) => line.purchaseOrderLineId) } },
      });
      for (const line of invoice.lines) {
        const poLine = poLines.find((candidate) => candidate.id === line.purchaseOrderLineId)!;
        if (line.quantity.gt(poLine.receivedQuantity.sub(poLine.invoicedQuantity)))
          throw new ConflictException("INVOICE_QTY_EXCEEDED");
        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: { invoicedQuantity: { increment: line.quantity } },
        });
      }
      const payable = await tx.payableOpenItem.create({
        data: {
          companyId: c,
          supplierId: invoice.supplierId,
          supplierInvoiceId: invoice.id,
          originalAmount: invoice.total,
          outstandingAmount: invoice.total,
          dueDate: invoice.dueDate,
          currency: invoice.currency,
        },
      });
      await postLedger(tx, a, {
        data: [
          {
            companyId: c,
            kind: "GRNI",
            sourceType: "SUPPLIER_INVOICE",
            sourceId: invoice.id,
            debit: invoice.subtotal,
            credit: d("0"),
          },
          {
            companyId: c,
            kind: "PURCHASE_TAX",
            sourceType: "SUPPLIER_INVOICE",
            sourceId: invoice.id,
            debit: Prisma.Decimal.max(invoice.taxAmount, 0),
            credit: Prisma.Decimal.max(invoice.taxAmount.neg(), 0),
          },
          {
            companyId: c,
            kind: "AP",
            sourceType: "SUPPLIER_INVOICE",
            sourceId: invoice.id,
            debit: d("0"),
            credit: invoice.total,
          },
        ],
        accountIds: [
          undefined,
          (invoice.taxSnapshot as { account_id?: string } | null)?.account_id,
          undefined,
        ],
      });
      const posted = await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: { state: "POSTED", postedAt: new Date() },
        include: { lines: true, payable: true },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "supplier_invoice.posted",
        resourceType: "supplier_invoice",
        resourceId: invoice.id,
        after: posted,
      });
      void payable;
      return posted;
    });
  }
  async approvePurchaseRequest(c: string, a: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const u = await approvePr(tx, c, a, id);
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action:
          u.state === "APPROVED" ? "purchase_request.approved" : "purchase_request.step_approved",
        resourceType: "purchase_request",
        resourceId: id,
        after: u,
      });
      return u;
    });
  }
  async createPurchaseOrder(c: string, a: string, rid: string, i: any) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchase_requests WHERE id = ${rid}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const r = await tx.purchaseRequest.findFirst({
        where: { id: rid, companyId: c },
        include: { lines: true },
      });
      if (!r || r.state !== "APPROVED")
        throw new ConflictException("PR belum disetujui atau tidak ditemukan.");
      if (i.lines.length !== new Set(i.lines.map((x: any) => x.purchase_request_line_id)).size)
        throw new ConflictException("DUPLICATE_PR_LINES");
      const requestLines = i.lines.map((x: any) => {
        const line = r.lines.find((candidate) => candidate.id === x.purchase_request_line_id);
        const quantity = d(x.quantity);
        if (!line || quantity.gt(line.quantity.sub(line.coveredQuantity)))
          throw new ConflictException("PR_QTY_EXCEEDED");
        return { input: x, line, quantity };
      });
      const [s, w] = await Promise.all([
        tx.supplier.findFirst({ where: { id: i.supplier_id, companyId: c, state: "ACTIVE" } }),
        tx.warehouse.findFirst({ where: { id: i.warehouse_id, companyId: c, state: "ACTIVE" } }),
      ]);
      if (!s || !w) throw new NotFoundException("Supplier atau gudang tidak ditemukan.");
      const po = await tx.purchaseOrder.create({
        data: {
          companyId: c,
          supplierId: s.id,
          purchaseRequestId: r.id,
          warehouseId: w.id,
          number: await this.num(tx, c, "purchase_order", "PO"),
          state: "OPEN",
        },
      });
      for (const item of requestLines) {
        await tx.purchaseOrderLine.create({
          data: {
            purchaseOrderId: po.id,
            productId: item.line.productId,
            orderedQuantity: item.quantity,
            unitCost: d(item.input.unit_cost),
            requestAllocations: {
              create: {
                purchaseRequestLineId: item.line.id,
                quantity: item.quantity,
              },
            },
          },
        });
        await tx.purchaseRequestLine.update({
          where: { id: item.line.id },
          data: { coveredQuantity: { increment: item.quantity } },
        });
      }
      const poWithLines = await tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: { lines: true },
      });
      await tx.purchaseRequest.update({
        where: { id: r.id },
        data: { state: "APPROVED" },
      });
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "purchase_order.issued",
        resourceType: "purchase_order",
        resourceId: po.id,
        after: poWithLines,
      });
      return poWithLines;
    });
  }
  async receivePurchaseOrder(c: string, a: string, id: string, i: any, key: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.goodsReceipt.findUnique({
        where: { companyId_idempotencyKey: { companyId: c, idempotencyKey: key } },
        include: { lines: true },
      });
      if (existing) return existing;
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id}::uuid AND company_id = ${c}::uuid FOR UPDATE`;
      const o = await tx.purchaseOrder.findFirst({
        where: { id, companyId: c },
        include: { lines: { include: { requestAllocations: true } } },
      });
      if (!o) throw new NotFoundException("PO tidak ditemukan.");
      if (["COMPLETED", "CLOSED", "CANCELLED"].includes(o.state))
        throw new ConflictException("PO_TIDAK_DAPAT_DITERIMA");
      if (i.lines.length !== new Set(i.lines.map((x: any) => x.purchase_order_line_id)).size)
        throw new ConflictException("DUPLICATE_PO_LINES");
      const l = await tx.locator.findFirst({
        where: { id: i.locator_id, companyId: c, warehouseId: o.warehouseId, state: "ACTIVE" },
      });
      if (!l) throw new NotFoundException("Locator tidak ditemukan.");
      const gr = await tx.goodsReceipt.create({
        data: {
          companyId: c,
          purchaseOrderId: o.id,
          warehouseId: o.warehouseId,
          number: await this.num(tx, c, "goods_receipt", "GR"),
          idempotencyKey: key,
          state: "POSTED",
          lines: {
            create: i.lines.map((x: any) => {
              const pl = o.lines.find((y) => y.id === x.purchase_order_line_id);
              if (!pl || d(x.quantity).gt(pl.orderedQuantity.sub(pl.receivedQuantity)))
                throw new ConflictException("Qty penerimaan melebihi sisa PO.");
              return {
                purchaseOrderLineId: pl.id,
                productId: pl.productId,
                quantity: d(x.quantity),
                batchNo: x.batch_no,
                expiryDate: x.expiry_date ? new Date(x.expiry_date) : null,
                unitCost: pl.unitCost,
              };
            }),
          },
        },
        include: { lines: true },
      });
      for (const x of gr.lines) {
        const lot = await tx.stockLot.upsert({
          where: {
            companyId_productId_warehouseId_locatorId_batchNo: {
              companyId: c,
              productId: x.productId,
              warehouseId: o.warehouseId,
              locatorId: l.id,
              batchNo: x.batchNo,
            },
          },
          create: {
            companyId: c,
            productId: x.productId,
            warehouseId: o.warehouseId,
            locatorId: l.id,
            batchNo: x.batchNo,
            expiryDate: x.expiryDate,
            quantityOnHand: x.quantity,
            unitCost: x.unitCost,
          },
          update: { quantityOnHand: { increment: x.quantity } },
        });
        await tx.purchaseOrderLine.update({
          where: { id: x.purchaseOrderLineId },
          data: { receivedQuantity: { increment: x.quantity } },
        });
        for (const allocation of o.lines.find((line) => line.id === x.purchaseOrderLineId)!
          .requestAllocations) {
          await tx.purchaseRequestLine.update({
            where: { id: allocation.purchaseRequestLineId },
            data: { fulfilledQuantity: { increment: x.quantity } },
          });
        }
        await tx.inventoryMovement.create({
          data: {
            companyId: c,
            stockLotId: lot.id,
            kind: "RECEIPT",
            quantity: x.quantity,
            unitCost: x.unitCost,
            sourceType: "GOODS_RECEIPT",
            sourceId: gr.id,
            idempotencyKey: `gr:${gr.id}:${x.id}`,
          },
        });
        const value = x.quantity.mul(x.unitCost);
        await postLedger(tx, a, {
          data: [
            {
              companyId: c,
              kind: "PURCHASE_RECEIPT",
              sourceType: "GOODS_RECEIPT",
              sourceId: gr.id,
              debit: value,
              credit: d("0"),
            },
            {
              companyId: c,
              kind: "GRNI",
              sourceType: "GOODS_RECEIPT",
              sourceId: gr.id,
              debit: d("0"),
              credit: value,
            },
          ],
        });
      }
      const refreshedPoLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: o.id },
      });
      await tx.purchaseOrder.update({
        where: { id: o.id },
        data: {
          state: refreshedPoLines.every((line) => line.receivedQuantity.gte(line.orderedQuantity))
            ? "COMPLETED"
            : "PARTIALLY_RECEIVED",
        },
      });
      if (o.purchaseRequestId) {
        const request = await tx.purchaseRequest.findUnique({ where: { id: o.purchaseRequestId } });
        const requestLines = await tx.purchaseRequestLine.findMany({
          where: { purchaseRequestId: o.purchaseRequestId },
        });
        if (request && requestLines.every((line) => line.fulfilledQuantity.gte(line.quantity)))
          await tx.purchaseRequest.update({
            where: { id: request.id },
            data: { state: "COMPLETED" },
          });
        else if (request && requestLines.some((line) => line.fulfilledQuantity.gt(0)))
          await tx.purchaseRequest.update({
            where: { id: request.id },
            data: { state: "PARTIALLY_FULFILLED" },
          });
      }
      await this.audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "goods_receipt.posted",
        resourceType: "goods_receipt",
        resourceId: gr.id,
        after: gr,
      });
      return gr;
    });
  }
}
