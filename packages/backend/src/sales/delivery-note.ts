import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import {
  createDeliveryNoteSchema,
  issueDeliveryNoteSchema,
  type CreateDeliveryNoteInput,
} from "@evflow/contracts";
import { transactionCommand } from "../common/transaction-command";
import { nextDocumentNumber } from "../common/document-number";
import { AuditService } from "../common/audit.service";
import { eligibleLots, lockCustomer } from "./transaction-controls";
import { requireEvidence } from "./document-controls";
import { lineAmounts } from "./pricing-controls";
import { lockFinance, financeDate, postLedger } from "../finance/posting";
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
  lines: {
    include: { salesOrderLine: { include: { product: { select: { code: true, name: true } } } } },
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
async function lockOrder(tx: Tx, c: string, id: string) {
  const ref = await tx.salesOrder.findFirst({ where: { companyId: c, id } });
  if (!ref) throw new NotFoundException("SO tidak ditemukan.");
  await lockCustomer(tx, c, ref.customerId);
  await tx.$queryRaw`SELECT id FROM sales_orders WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM sales_order_lines WHERE sales_order_id=${id}::uuid AND company_id=${c}::uuid ORDER BY id FOR UPDATE`;
  const order = await tx.salesOrder.findFirstOrThrow({
    where: { id, companyId: c },
    include: { lines: { include: { product: { select: { code: true, name: true } } } } },
  });
  if (order.state !== "OPEN") throw new ConflictException("ORDER_NOT_OPEN");
  return order;
}
async function draftLines(
  tx: Tx,
  c: string,
  input: CreateDeliveryNoteInput,
  order: Awaited<ReturnType<typeof lockOrder>>,
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
async function orderSnapshot(tx: Tx, c: string, order: Awaited<ReturnType<typeof lockOrder>>) {
  const terms = order.freightTermsSnapshot as { payer?: string; tax_mode?: string } | null;
  const amount = terms?.payer === "CUSTOMER" ? d(order.freightEstimate ?? 0) : d(0);
  const freightTax =
    amount.gt(0) && terms?.tax_mode === "TAXABLE" ? await defaultSalesTaxOn(tx, c, amount) : null;
  const company = await tx.company.findUniqueOrThrow({
    where: { id: c },
    select: { name: true, address: true, phone: true },
  });
  return json({
    company,
    products: Object.fromEntries(order.lines.map((l) => [l.id, l.product])),
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
export function createDeliveryNote(c: string, a: string, input: unknown, key: string) {
  const i = parse(createDeliveryNoteSchema, input);
  return transactionCommand(c, a, "delivery-notes/create", key, i, async (tx) => {
    const order = await lockOrder(tx, c, i.sales_order_id);
    const lines = await draftLines(tx, c, i, order);
    const row = await tx.deliveryNote.create({
      data: {
        companyId: c,
        salesOrderId: order.id,
        number: await nextDocumentNumber(tx, c, "document_SURAT_JALAN"),
        createdById: a,
        notes: i.notes ?? null,
        snapshot: await orderSnapshot(tx, c, order),
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
    const lines = await draftLines(tx, c, i, order);
    await tx.deliveryNoteLine.deleteMany({ where: { companyId: c, deliveryNoteId: id } });
    const row = await tx.deliveryNote.update({
      where: { id },
      data: {
        notes: i.notes ?? null,
        snapshot: await orderSnapshot(tx, c, order),
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
    await requireEvidence(tx, c, i.evidence_id, "SURAT_JALAN");
    const handoverAt = new Date(i.handover_at);
    await assertFinancePeriodOpen(tx, c, await financeDate(tx, c, handoverAt));
    if (i.lines.length !== note.lines.length)
      throw new ConflictException("DELIVERY_NOTE_LINES_REQUIRED");
    const delivered = await deliveredOrderQuantities(c, order.id, tx);
    const amounts = [];
    for (const line of note.lines) {
      const received = i.lines.find((l) => l.sales_order_line_id === line.salesOrderLineId);
      if (!received) throw new ConflictException("DELIVERY_NOTE_LINES_REQUIRED");
      const qty = d(received.delivered_quantity),
        rejected = d(received.rejected_quantity ?? 0);
      if (qty.add(rejected).gt(line.quantity))
        throw new ConflictException("DELIVERY_NOTE_HANDOVER_QTY_EXCEEDED");
      if ((rejected.gt(0) || qty.lt(line.quantity)) && !received.discrepancy_reason?.trim())
        throw new ConflictException("DELIVERY_NOTE_DISCREPANCY_REASON_REQUIRED");
      const source = order.lines.find((l) => l.id === line.salesOrderLineId)!;
      if (
        qty.gt(
          d(source.orderedQuantity)
            .sub(source.closedQuantity)
            .sub(delivered[source.id] ?? 0),
        )
      )
        throw new ConflictException("DELIVERY_NOTE_QTY_EXCEEDED");
      amounts.push({ line, received, qty, rejected, amount: lineAmounts(line, qty) });
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
      const balances = await tx.stockLot.findMany({
        where: { companyId: c, productId, quantityOnHand: { gt: 0 } },
      });
      const quantity = balances.reduce((s, l) => s.add(l.quantityOnHand), d(0));
      if (quantity.lte(0)) throw new ConflictException("STOCK_INSUFFICIENT");
      productCosts.set(
        productId,
        balances
          .reduce((s, l) => s.add(d(l.quantityOnHand).mul(l.unitCost)), d(0))
          .div(quantity)
          .toDecimalPlaces(8),
      );
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
      await tx.stockLot.updateMany({
        where: { companyId: c, productId, quantityOnHand: { gt: 0 } },
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
    await postLedger(tx, a, { businessDate: handoverAt, accountIds, data: posting });
    const updated = await tx.deliveryNote.update({
      where: { id },
      data: {
        state: "ISSUED",
        handoverAt,
        receiverName: i.receiver_name,
        evidenceId: i.evidence_id,
        issuedAt: new Date(),
        issuedById: a,
        issueIdempotencyKey: key,
        handoverSnapshot: json(i),
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
    products?: Record<string, { code: string; name: string }>;
  } | null;
  const payment = snapshot?.payment;
  return {
    id: row.id,
    number: row.number,
    state: row.state,
    salesOrderId: row.salesOrderId,
    notes: row.notes,
    handoverAt: row.handoverAt,
    receiverName: row.receiverName,
    evidenceId: row.evidenceId,
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
