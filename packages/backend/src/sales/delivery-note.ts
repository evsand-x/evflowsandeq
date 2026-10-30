import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import {
  createDeliveryNoteSchema,
  issueDeliveryNoteSchema,
  receiveDeliveryNoteSchema,
  type CreateDeliveryNoteInput,
} from "@evflow/contracts";
import { transactionCommand } from "../common/transaction-command";
import { nextDocumentNumber } from "../common/document-number";
import { AuditService } from "../common/audit.service";
import { eligibleLots, lockCustomer } from "./transaction-controls";
import { requireEvidence } from "./document-controls";
import { lineAmounts } from "./pricing-controls";
import { lockFinance, financeDate, postDeliveryNoteLedger } from "../finance/posting";
import { defaultSalesTaxOn } from "../finance/operational-tax";
import { assertFinancePeriodOpen } from "../finance/period-guard";

type Tx = Prisma.TransactionClient;
const Decimal = Prisma.Decimal.clone({ precision: 48 });
const d = (v: Prisma.Decimal.Value) => new Decimal(v);
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const audit = new AuditService();
function parse<T>(
  schema: { safeParse(v: unknown): { success: boolean; data?: T; error?: unknown } },
  v: unknown,
): T {
  const result = schema.safeParse(v);
  if (!result.success) throw new BadRequestException(result.error);
  return result.data as T;
}
const include = {
  receipt: true,
  lines: {
    include: {
      salesOrderLine: {
        include: {
          product: { select: { code: true, name: true, baseUom: { select: { name: true } } } },
        },
      },
    },
  },
  salesOrder: {
    select: {
      id: true,
      number: true,
      customerId: true,
      salespersonId: true,
      customer: { select: { name: true } },
    },
  },
} satisfies Prisma.DeliveryNoteInclude;
export async function getDeliveryNote(c: string, id: string, tx: Tx = prisma) {
  const row = await tx.deliveryNote.findFirst({ where: { id, companyId: c }, include });
  if (!row) throw new NotFoundException("Surat Jalan tidak ditemukan.");
  return row;
}
export async function listDeliveryNotes(
  c: string,
  page = 1,
  search = "",
  state?: "DRAFT" | "ISSUED",
  tx: Tx = prisma,
) {
  const where: Prisma.DeliveryNoteWhereInput = {
    companyId: c,
    ...(state ? { state } : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" } },
            { salesOrder: { number: { contains: search, mode: "insensitive" } } },
            { salesOrder: { customer: { name: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    tx.deliveryNote.findMany({
      where,
      include,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * 25,
      take: 25,
    }),
    tx.deliveryNote.count({ where }),
  ]);
  return { rows, total };
}
export async function deliveredOrderQuantities(c: string, orderId: string, tx: Tx = prisma) {
  const rows = await tx.deliveryNoteLine.groupBy({
    by: ["salesOrderLineId"],
    where: { companyId: c, deliveryNote: { salesOrderId: orderId, state: "ISSUED" } },
    _sum: { deliveredQuantity: true },
  });
  return Object.fromEntries(
    rows.map((r) => [r.salesOrderLineId, (r._sum.deliveredQuantity ?? d(0)).toString()]),
  );
}
export async function getOrderDeliveryProgress(c: string, orderId: string, tx: Tx = prisma) {
  const order = await tx.salesOrder.findFirst({
    where: { id: orderId, companyId: c },
    select: { id: true },
  });
  if (!order) throw new NotFoundException("SO tidak ditemukan.");
  return deliveredOrderQuantities(c, orderId, tx);
}
async function lockOrder(tx: Tx, c: string, id: string) {
  const ref = await tx.salesOrder.findFirst({ where: { companyId: c, id } });
  if (!ref) throw new NotFoundException("SO tidak ditemukan.");
  await lockCustomer(tx, c, ref.customerId);
  await tx.$queryRaw`SELECT id FROM sales_orders WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM sales_order_lines WHERE sales_order_id=${id}::uuid AND company_id=${c}::uuid ORDER BY id FOR UPDATE`;
  const order = await tx.salesOrder.findFirstOrThrow({
    where: { id, companyId: c },
    include: {
      lines: {
        include: {
          product: { select: { code: true, name: true, baseUom: { select: { name: true } } } },
          Uom: { select: { name: true } },
        },
      },
    },
  });
  if (order.state !== "OPEN") throw new ConflictException("ORDER_NOT_OPEN");
  return order;
}
async function draftLines(
  tx: Tx,
  c: string,
  input: CreateDeliveryNoteInput,
  order: Awaited<ReturnType<typeof lockOrder>>,
  formWarehouseId?: string,
) {
  const delivered = await deliveredOrderQuantities(c, order.id, tx);
  const rows = [];
  for (const item of input.lines) {
    const source = order.lines.find((l) => l.id === item.sales_order_line_id);
    if (
      !source ||
      d(item.quantity).gt(
        d(source.orderedQuantity)
          .sub(source.closedQuantity)
          .sub(delivered[source.id] ?? 0),
      )
    )
      throw new ConflictException("DELIVERY_NOTE_QTY_EXCEEDED");
    const warehouseId = item.warehouse_id ?? source.warehouseId ?? order.warehouseId;
    if (formWarehouseId && warehouseId !== formWarehouseId)
      throw new ConflictException("DELIVERY_NOTE_WAREHOUSE_MISMATCH");
    if (
      !warehouseId ||
      !(await tx.warehouse.findFirst({ where: { companyId: c, id: warehouseId, state: "ACTIVE" } }))
    )
      throw new ConflictException("ORDER_WAREHOUSE_INACTIVE");
    if (
      item.locator_id &&
      !(await tx.locator.findFirst({
        where: {
          companyId: c,
          id: item.locator_id,
          warehouseId,
          state: "ACTIVE",
          locatorType: { in: ["STORAGE", "DISPATCH"] },
        },
      }))
    )
      throw new ConflictException("STOCK_NOT_ELIGIBLE");
    if (!source.taxSnapshot) throw new ConflictException("TAX_SNAPSHOT_REQUIRED");
    rows.push({
      companyId: c,
      salesOrderLineId: source.id,
      quantity: item.quantity,
      warehouseId,
      locatorId: item.locator_id ?? null,
      unitPrice: source.unitPrice,
      taxSnapshot: json(source.taxSnapshot),
    });
  }
  return rows;
}
async function orderSnapshot(
  tx: Tx,
  c: string,
  order: Awaited<ReturnType<typeof lockOrder>>,
  freightOverride?: Prisma.Decimal,
) {
  const terms = order.freightTermsSnapshot as { payer?: string; tax_mode?: string } | null;
  // Ongkir ditagihkan hanya bila SO menetapkan ongkir ditanggung pelanggan. Nilai yang diketik di
  // Surat Jalan menggantikan estimasi SO; bila ditanggung perusahaan, nilainya tetap tersimpan
  // sebagai biaya kirim Surat Jalan tetapi tidak masuk tagihan, pendapatan maupun Invoice.
  const amount =
    terms?.payer === "CUSTOMER" ? (freightOverride ?? d(order.freightEstimate ?? 0)) : d(0);
  const freightTax =
    amount.gt(0) && terms?.tax_mode === "TAXABLE" ? await defaultSalesTaxOn(tx, c, amount) : null;
  const company = await tx.company.findUniqueOrThrow({
    where: { id: c },
    select: { name: true, address: true, phone: true },
  });
  return json({
    company,
    products: Object.fromEntries(
      order.lines.map((l) => [l.id, { ...l.product, unit: l.Uom?.name ?? l.product.baseUom.name }]),
    ),
    payment: order.paymentSnapshot,
    freight: order.freightTermsSnapshot,
    freight_amount: amount.toString(),
    freight_tax_amount: freightTax?.tax.toString() ?? "0",
    freight_tax_snapshot: freightTax?.snapshot ?? null,
    currency: order.currency,
    customer_id: order.customerId,
    sales_order_number: order.number,
    delivery_address: order.deliveryAddress,
  });
}
function defaultFreightAmount(order: Awaited<ReturnType<typeof lockOrder>>) {
  const terms = order.freightTermsSnapshot as { payer?: string } | null;
  return terms?.payer === "CUSTOMER" ? d(order.freightEstimate ?? 0) : d(0);
}
export function createDeliveryNote(c: string, a: string, input: unknown, key: string) {
  const i = parse(createDeliveryNoteSchema, input);
  return transactionCommand(c, a, "delivery-notes/create", key, i, async (tx) => {
    const order = await lockOrder(tx, c, i.sales_order_id);
    const documentDate = new Date(
      `${i.document_date ?? order.orderDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const shipDate = new Date(
      `${i.ship_date ?? documentDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const warehouseId = i.warehouse_id ?? order.warehouseId ?? undefined;
    if (
      warehouseId &&
      !(await tx.warehouse.findFirst({ where: { companyId: c, id: warehouseId, state: "ACTIVE" } }))
    )
      throw new ConflictException("ORDER_WAREHOUSE_INACTIVE");
    if (
      i.number &&
      (await tx.deliveryNote.findFirst({
        where: { companyId: c, number: i.number },
        select: { id: true },
      }))
    )
      throw new ConflictException("DELIVERY_NOTE_NUMBER_EXISTS");
    const lines = await draftLines(tx, c, i, order, warehouseId);
    const freightAmount = i.freight_amount ? d(i.freight_amount) : undefined;
    const row = await tx.deliveryNote.create({
      data: {
        companyId: c,
        salesOrderId: order.id,
        number: i.number ?? (await nextDocumentNumber(tx, c, "document_SURAT_JALAN")),
        documentDate,
        shipDate,
        warehouseId: warehouseId ?? null,
        carrierName: i.carrier_name ?? null,
        vehicleNumber: i.vehicle_number ?? null,
        driverName: i.driver_name ?? null,
        freightAmount: freightAmount ?? defaultFreightAmount(order),
        createdById: a,
        notes: i.notes ?? null,
        snapshot: await orderSnapshot(tx, c, order, freightAmount),
        lines: { create: lines },
      },
      include,
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "delivery_note.created",
      resourceType: "delivery_note",
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}
export function updateDeliveryNoteDraft(
  c: string,
  a: string,
  id: string,
  input: unknown,
  key: string,
) {
  const i = parse(createDeliveryNoteSchema, input);
  return transactionCommand(c, a, `delivery-notes/${id}/update`, key, i, async (tx) => {
    const order = await lockOrder(tx, c, i.sales_order_id);
    await tx.$queryRaw`SELECT id FROM delivery_notes WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
    const before = await getDeliveryNote(c, id, tx);
    if (before.state !== "DRAFT") throw new ConflictException("DELIVERY_NOTE_IMMUTABLE");
    if (before.salesOrderId !== order.id)
      throw new ConflictException("DELIVERY_NOTE_ORDER_MISMATCH");
    if (
      i.number &&
      i.number !== before.number &&
      (await tx.deliveryNote.findFirst({
        where: { companyId: c, number: i.number, id: { not: id } },
        select: { id: true },
      }))
    )
      throw new ConflictException("DELIVERY_NOTE_NUMBER_EXISTS");
    const warehouseId = i.warehouse_id ?? order.warehouseId ?? undefined;
    if (
      warehouseId &&
      !(await tx.warehouse.findFirst({ where: { companyId: c, id: warehouseId, state: "ACTIVE" } }))
    )
      throw new ConflictException("ORDER_WAREHOUSE_INACTIVE");
    const documentDate = new Date(
      `${i.document_date ?? order.orderDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const shipDate = new Date(
      `${i.ship_date ?? documentDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const lines = await draftLines(tx, c, i, order, warehouseId);
    const freightAmount = i.freight_amount ? d(i.freight_amount) : undefined;
    await tx.deliveryNoteLine.deleteMany({ where: { companyId: c, deliveryNoteId: id } });
    const row = await tx.deliveryNote.update({
      where: { id },
      data: {
        number: i.number ?? before.number,
        documentDate,
        shipDate,
        warehouseId: warehouseId ?? null,
        carrierName: i.carrier_name ?? null,
        vehicleNumber: i.vehicle_number ?? null,
        driverName: i.driver_name ?? null,
        freightAmount: freightAmount ?? defaultFreightAmount(order),
        notes: i.notes ?? null,
        snapshot: await orderSnapshot(tx, c, order, freightAmount),
        lines: { create: lines },
      },
      include,
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "delivery_note.updated",
      resourceType: "delivery_note",
      resourceId: id,
      before,
      after: row,
    });
    return row;
  });
}
export function issueDeliveryNote(c: string, a: string, id: string, input: unknown, key: string) {
  const i = parse(issueDeliveryNoteSchema, input);
  return transactionCommand(c, a, `delivery-notes/${id}/issue`, key, i, async (tx) => {
    // Same company finance lock as inventory receipts; valuation and stock issue cannot race.
    await lockCustomer(
      tx,
      c,
      (
        await tx.salesOrder.findFirstOrThrow({
          where: { companyId: c, id: (await getDeliveryNote(c, id, tx)).salesOrderId },
        })
      ).customerId,
    );
    await lockFinance(tx, c);
    const ref = await getDeliveryNote(c, id, tx);
    const order = await lockOrder(tx, c, ref.salesOrderId);
    await tx.$queryRaw`SELECT id FROM delivery_notes WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
    const note = await getDeliveryNote(c, id, tx);
    if (note.state !== "DRAFT") throw new ConflictException("DELIVERY_NOTE_IMMUTABLE");
    const issuedAt = new Date();
    await assertFinancePeriodOpen(tx, c, await financeDate(tx, c, issuedAt));
    if (!note.lines.length) throw new ConflictException("DELIVERY_NOTE_LINES_REQUIRED");
    const delivered = await deliveredOrderQuantities(c, order.id, tx);
    const amounts = [];
    for (const line of note.lines) {
      const qty = d(line.quantity),
        rejected = d(0);
      const source = order.lines.find((l) => l.id === line.salesOrderLineId)!;
      if (
        qty.gt(
          d(source.orderedQuantity)
            .sub(source.closedQuantity)
            .sub(delivered[source.id] ?? 0),
        )
      )
        throw new ConflictException("DELIVERY_NOTE_QTY_EXCEEDED");
      amounts.push({ line, qty, rejected, amount: lineAmounts(line, qty) });
    }
    // Lock all eligible lots in stable order before assigning quantities.
    const productIds = [...new Set(note.lines.map((l) => l.salesOrderLine.productId))].sort();
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM stock_lots WHERE company_id=${c}::uuid AND product_id IN (${Prisma.join(productIds.map((productId) => Prisma.sql`${productId}::uuid`))}) ORDER BY id FOR UPDATE`,
    );
    const lots = await eligibleLots(
      tx,
      c,
      note.lines.map((l) => l.salesOrderLine.productId),
      [...new Set(note.lines.map((l) => l.warehouseId!))],
    );
    const productCosts = new Map<string, Prisma.Decimal>();
    for (const productId of [
      ...new Set(note.lines.map((l) => l.salesOrderLine.productId)),
    ].sort()) {
      // Valuation scope is the already-locked, eligible lot set for this shipment.
      // Never rewrite quarantine, expired, inactive, reserved-only, or foreign lots.
      const eligibleProductLots = lots.filter(
        (lot) =>
          lot.productId === productId && lot.quantityOnHand.sub(d(lot.quantityReserved ?? 0)).gt(0),
      );
      productCosts.set(productId, eligibleMovingAverageCost(eligibleProductLots, productId));
    }
    const stockPlans = allocateDeliveryStock(
      lots,
      amounts.map((item) => ({
        id: item.line.id,
        productId: item.line.salesOrderLine.productId,
        warehouseId: item.line.warehouseId!,
        locatorId: item.line.locatorId,
        quantity: item.qty,
      })),
    );
    const plans = amounts.map((item) => ({
      ...item,
      parts: stockPlans
        .find((p) => p.id === item.line.id)!
        .parts.map((part) => ({
          ...part,
          unitCost: productCosts.get(item.line.salesOrderLine.productId)!,
        })),
    }));
    // Spread the same product book cost over the remaining physical lots. The total
    // inventory value is unchanged; future receipts blend into this moving average.
    for (const [productId, unitCost] of productCosts) {
      const eligibleIds = lots
        .filter(
          (lot) =>
            lot.productId === productId &&
            lot.quantityOnHand.sub(d(lot.quantityReserved ?? 0)).gt(0),
        )
        .map((lot) => lot.id);
      if (eligibleIds.length)
        await tx.stockLot.updateMany({
          where: { companyId: c, id: { in: eligibleIds } },
          data: { unitCost },
        });
    }
    let cost = d(0);
    for (const plan of plans) {
      for (const part of plan.parts) {
        await tx.stockLot.update({
          where: { id: part.lotId },
          data: { quantityOnHand: { decrement: part.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            companyId: c,
            stockLotId: part.lotId,
            kind: "DISPATCH",
            quantity: part.quantity,
            unitCost: part.unitCost,
            sourceType: "DELIVERY_NOTE",
            sourceId: id,
            idempotencyKey: `delivery-note:${id}:${plan.line.id}:${part.lotId}`,
          },
        });
        cost = cost.add(part.quantity.mul(part.unitCost));
      }
      await tx.deliveryNoteLine.update({
        where: { id: plan.line.id },
        data: {
          deliveredQuantity: plan.qty,
          rejectedQuantity: plan.rejected,
          costSnapshot: json(plan.parts),
        },
      });
    }
    const net = plans.reduce((s, l) => s.add(l.amount.net), d(0));
    const tax = plans.reduce((s, l) => s.add(l.amount.tax), d(0));
    const snapshot = note.snapshot as {
      freight_amount?: string;
      freight_tax_amount?: string;
      freight_tax_snapshot?: { account_id?: string };
    } | null;
    const freight = d(snapshot?.freight_amount ?? 0),
      freightTax = d(snapshot?.freight_tax_amount ?? 0);
    const journal = {
      companyId: c,
      sourceType: "DELIVERY_NOTE",
      sourceId: id,
      currency: order.currency,
    };
    const posting: Prisma.LedgerEntryCreateManyInput[] = [
      { ...journal, kind: "SALE_COGS", debit: cost.toDecimalPlaces(8), credit: d(0) },
      { ...journal, kind: "INVENTORY", debit: d(0), credit: cost.toDecimalPlaces(8) },
      {
        ...journal,
        kind: "UNBILLED_AR",
        debit: net.add(tax).add(freight).add(freightTax),
        credit: d(0),
      },
      { ...journal, kind: "SALE_REVENUE", debit: d(0), credit: net },
    ];
    const accountIds: (string | undefined)[] = [undefined, undefined, undefined, undefined];
    for (const plan of plans)
      if (!plan.amount.tax.isZero()) {
        posting.push({
          ...journal,
          kind: "SALES_TAX",
          debit: Decimal.max(plan.amount.tax.neg(), 0),
          credit: Decimal.max(plan.amount.tax, 0),
        });
        accountIds.push((plan.line.taxSnapshot as { account_id?: string } | null)?.account_id);
      }
    if (!freight.isZero()) {
      posting.push({ ...journal, kind: "SALE_FREIGHT_REVENUE", debit: d(0), credit: freight });
      accountIds.push(undefined);
    }
    if (!freightTax.isZero()) {
      posting.push({
        ...journal,
        kind: "SALES_TAX",
        debit: Decimal.max(freightTax.neg(), 0),
        credit: Decimal.max(freightTax, 0),
      });
      accountIds.push(snapshot?.freight_tax_snapshot?.account_id);
    }
    await postDeliveryNoteLedger(tx, a, { businessDate: issuedAt, accountIds, data: posting });
    const updated = await tx.deliveryNote.update({
      where: { id },
      data: {
        state: "ISSUED",
        issuedAt,
        issuedById: a,
        issueIdempotencyKey: key,
        snapshot: json({
          ...(note.snapshot as Record<string, unknown>),
          document_date: note.documentDate?.toISOString().slice(0, 10) ?? null,
          ship_date: note.shipDate?.toISOString().slice(0, 10) ?? null,
          warehouse_id: note.warehouseId,
          carrier_name: note.carrierName,
          vehicle_number: note.vehicleNumber,
          driver_name: note.driverName,
          recorded_freight_amount: note.freightAmount?.toString() ?? null,
        }),
      },
      include,
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "delivery_note.issued",
      resourceType: "delivery_note",
      resourceId: id,
      before: note,
      after: updated,
    });
    await tx.outboxEvent.create({
      data: {
        companyId: c,
        eventType: "delivery_note.issued",
        aggregateId: id,
        payload: { delivery_note_id: id, sales_order_id: order.id },
      },
    });
    return updated;
  });
}

/** Append receipt evidence without mutating the issued source or posting any balance. */
export function receiveDeliveryNote(c: string, a: string, id: string, input: unknown, key: string) {
  const i = parse(receiveDeliveryNoteSchema, input);
  return transactionCommand(c, a, `delivery-notes/${id}/receipt`, key, i, async (tx) => {
    await tx.$queryRaw`SELECT id FROM delivery_notes WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
    const note = await getDeliveryNote(c, id, tx);
    if (note.state !== "ISSUED" || !note.issuedAt)
      throw new ConflictException("DELIVERY_NOTE_NOT_ISSUED");
    if (note.receipt || note.handoverAt)
      throw new ConflictException("DELIVERY_NOTE_ALREADY_RECEIVED");
    await requireEvidence(tx, c, i.evidence_id, "SURAT_JALAN");
    const handoverAt = new Date(i.handover_at);
    if (handoverAt < note.issuedAt || handoverAt.getTime() > Date.now())
      throw new ConflictException("DELIVERY_NOTE_RECEIPT_DATE_INVALID");
    if (i.lines.length !== note.lines.length)
      throw new ConflictException("DELIVERY_NOTE_LINES_REQUIRED");
    for (const line of note.lines) {
      const receiptLine = i.lines.find((l) => l.sales_order_line_id === line.salesOrderLineId);
      if (!receiptLine) throw new ConflictException("DELIVERY_NOTE_LINES_REQUIRED");
      const qty = d(receiptLine.delivered_quantity);
      const sent = d(line.deliveredQuantity!);
      if (qty.gt(sent)) throw new ConflictException("DELIVERY_NOTE_RECEIPT_QTY_INVALID");
      if (qty.lt(sent) && !receiptLine.discrepancy_reason?.trim())
        throw new ConflictException("DELIVERY_NOTE_DISCREPANCY_REASON_REQUIRED");
    }
    const receipt = await tx.deliveryNoteReceipt.create({
      data: {
        companyId: c,
        deliveryNoteId: id,
        handoverAt,
        receiverName: i.receiver_name,
        receiverTitle: i.receiver_title || null,
        evidenceId: i.evidence_id,
        snapshot: json(i),
        recordedById: a,
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "delivery_note.received",
      resourceType: "delivery_note",
      resourceId: id,
      after: receipt,
    });
    await tx.outboxEvent.create({
      data: {
        companyId: c,
        eventType: "delivery_note.received",
        aggregateId: id,
        payload: { delivery_note_id: id, receipt_id: receipt.id },
      },
    });
    return receipt;
  });
}

type StockCandidate = {
  id: string;
  productId: string;
  warehouseId: string;
  locatorId: string;
  quantityOnHand: Prisma.Decimal;
  quantityReserved: Prisma.Decimal;
};
/** Pure planning phase: validates the whole shipment before the first stock mutation. */
export function allocateDeliveryStock(
  lots: StockCandidate[],
  lines: {
    id: string;
    productId: string;
    warehouseId: string;
    locatorId: string | null;
    quantity: Prisma.Decimal;
  }[],
) {
  const available = new Map(lots.map((l) => [l.id, d(l.quantityOnHand).sub(l.quantityReserved)]));
  return lines.map((line) => {
    let remaining = d(line.quantity);
    const parts: { lotId: string; quantity: Prisma.Decimal }[] = [];
    for (const lot of lots) {
      if (
        lot.productId !== line.productId ||
        lot.warehouseId !== line.warehouseId ||
        (line.locatorId && lot.locatorId !== line.locatorId)
      )
        continue;
      const capacity = available.get(lot.id)!;
      if (capacity.lte(0) || remaining.lte(0)) continue;
      const quantity = Decimal.min(capacity, remaining);
      parts.push({ lotId: lot.id, quantity });
      remaining = remaining.sub(quantity);
      available.set(lot.id, capacity.sub(quantity));
    }
    if (remaining.gt(0)) throw new ConflictException("STOCK_INSUFFICIENT");
    return { id: line.id, parts };
  });
}

/** Outbound projection deliberately contains quantities and delivery identity only. */
export function deliveryNoteView(row: Awaited<ReturnType<typeof getDeliveryNote>>) {
  const snapshot = row.snapshot as {
    payment?: { term_code?: string; term_label?: string; mode?: string; top_days?: number };
    delivery_address?: string;
    products?: Record<string, { code: string; name: string; unit?: string }>;
  } | null;
  const payment = snapshot?.payment;
  const receiptSource =
    row.receipt ??
    (row.handoverAt
      ? {
          handoverAt: row.handoverAt,
          receiverName: row.receiverName,
          receiverTitle: row.receiverTitle,
          evidenceId: row.evidenceId,
          snapshot: row.handoverSnapshot,
        }
      : null);
  const receipt = receiptSource
    ? {
        handoverAt: receiptSource.handoverAt,
        receiverName: receiptSource.receiverName,
        receiverTitle: receiptSource.receiverTitle,
        evidenceId: receiptSource.evidenceId,
        lines: (
          (
            receiptSource.snapshot as {
              lines?: {
                sales_order_line_id: string;
                delivered_quantity: string;
                discrepancy_reason?: string;
              }[];
            } | null
          )?.lines ?? []
        ).map((line) => ({
          sales_order_line_id: line.sales_order_line_id,
          delivered_quantity: line.delivered_quantity,
          discrepancy_reason: line.discrepancy_reason ?? null,
        })),
      }
    : null;
  return {
    id: row.id,
    number: row.number,
    state: row.state,
    documentDate: row.documentDate ? new Date(row.documentDate).toISOString().slice(0, 10) : null,
    shipDate: row.shipDate ? new Date(row.shipDate).toISOString().slice(0, 10) : null,
    warehouseId: row.warehouseId,
    carrierName: row.carrierName,
    vehicleNumber: row.vehicleNumber,
    driverName: row.driverName,
    freightAmount: row.freightAmount?.toString() ?? null,
    salesOrderId: row.salesOrderId,
    notes: row.notes,
    receipt,
    handoverAt: receipt?.handoverAt ?? null,
    receiverName: receipt?.receiverName ?? null,
    receiverTitle: receipt?.receiverTitle ?? null,
    evidenceId: receipt?.evidenceId ?? null,
    issuedAt: row.issuedAt,
    createdAt: row.createdAt,
    salesOrder: row.salesOrder,
    deliveryAddress: snapshot?.delivery_address ?? null,
    payment: payment
      ? {
          term_code: payment.term_code,
          term_label: payment.term_label,
          mode: payment.mode,
          top_days: payment.top_days,
        }
      : null,
    lines: row.lines.map((line) => ({
      id: line.id,
      salesOrderLineId: line.salesOrderLineId,
      quantity: line.quantity.toString(),
      unit:
        snapshot?.products?.[line.salesOrderLineId]?.unit ??
        line.salesOrderLine.product.baseUom?.name ??
        null,
      deliveredQuantity: line.deliveredQuantity?.toString() ?? null,
      rejectedQuantity: line.rejectedQuantity.toString(),
      warehouseId: line.warehouseId,
      locatorId: line.locatorId,
      product: {
        id: line.salesOrderLine.productId,
        ...(snapshot?.products?.[line.salesOrderLineId] ?? line.salesOrderLine.product),
      },
    })),
  };
}

/** Moving-average book cost over the eligible, locked lots used by a shipment. */
export function eligibleMovingAverageCost(
  lots: Array<{
    productId: string;
    quantityOnHand: Prisma.Decimal;
    quantityReserved?: Prisma.Decimal;
    unitCost: Prisma.Decimal;
  }>,
  productId: string,
) {
  const scoped = lots.filter(
    (lot) =>
      lot.productId === productId && lot.quantityOnHand.sub(d(lot.quantityReserved ?? 0)).gt(0),
  );
  const quantity = scoped.reduce((sum, lot) => sum.add(lot.quantityOnHand), d(0));
  if (quantity.lte(0)) throw new ConflictException("STOCK_INSUFFICIENT");
  return scoped
    .reduce((sum, lot) => sum.add(lot.quantityOnHand.mul(lot.unitCost)), d(0))
    .div(quantity)
    .toDecimalPlaces(8);
}
