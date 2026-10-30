import { NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import { previewDocumentNumber } from "../common/document-number";
import { stockAvailability } from "./order-availability";
import { stockBusinessDate } from "./transaction-controls";
import { deliveredOrderQuantities, deliveryNoteView, getDeliveryNote } from "./delivery-note";

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal.clone({ precision: 48 });

/**
 * Read model for the Surat Jalan form (new draft from an SO, or editing a draft): SO header and
 * lines with issued and remaining quantities, eligible stock in the chosen warehouse, the next
 * number from Setting, active warehouses and carrier names used before. Informational only:
 * create/update/issue recheck quantities, stock and uniqueness under locks.
 */
export async function deliveryNoteForm(
  companyId: string,
  input: {
    salesOrderId?: string | undefined;
    deliveryNoteId?: string | undefined;
    warehouseId?: string | undefined;
  },
  db: Tx = prisma,
) {
  const note = input.deliveryNoteId
    ? await getDeliveryNote(companyId, input.deliveryNoteId, db)
    : null;
  const orderId = note?.salesOrderId ?? input.salesOrderId;
  if (!orderId) throw new NotFoundException("SO tidak ditemukan.");
  const order = await db.salesOrder.findFirst({
    where: { id: orderId, companyId },
    select: {
      id: true,
      number: true,
      state: true,
      orderDate: true,
      currency: true,
      warehouseId: true,
      deliveryAddress: true,
      paymentSnapshot: true,
      freightTermsSnapshot: true,
      freightEstimate: true,
      customer: { select: { id: true, name: true } },
      lines: {
        select: {
          id: true,
          productId: true,
          warehouseId: true,
          orderedQuantity: true,
          closedQuantity: true,
          unitPrice: true,
          taxSnapshot: true,
          product: { select: { code: true, name: true, baseUom: { select: { name: true } } } },
          Uom: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!order) throw new NotFoundException("SO tidak ditemukan.");
  const [issued, warehouses, nextNumber, today, company, carriers] = await Promise.all([
    deliveredOrderQuantities(companyId, order.id, db),
    db.warehouse.findMany({
      where: { companyId, state: "ACTIVE" },
      select: { id: true, code: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    previewDocumentNumber(db, companyId, "document_SURAT_JALAN"),
    stockBusinessDate(db, companyId),
    db.company.findUnique({ where: { id: companyId }, select: { timezone: true } }),
    db.deliveryNote.findMany({
      where: { companyId, carrierName: { not: null } },
      distinct: ["carrierName"],
      select: { carrierName: true },
      orderBy: { carrierName: "asc" },
      take: 50,
    }),
  ]);
  const noteWarehouse =
    note?.warehouseId ?? note?.lines.find((l) => l.warehouseId)?.warehouseId ?? null;
  const warehouseId =
    [input.warehouseId, noteWarehouse, order.warehouseId, warehouses[0]?.id].find(
      (id) => !!id && warehouses.some((w) => w.id === id),
    ) ?? null;
  const stock = warehouseId
    ? await stockAvailability(
        companyId,
        warehouseId,
        order.lines.map((l) => l.productId),
        db,
      ).catch(() => [])
    : [];
  const payment = order.paymentSnapshot as { term_label?: string } | null;
  return {
    order: {
      id: order.id,
      number: order.number,
      state: order.state,
      orderDate: order.orderDate.toISOString().slice(0, 10),
      currency: order.currency,
      customer: order.customer,
      deliveryAddress: order.deliveryAddress,
      paymentTerm: payment?.term_label ?? null,
      freight: order.freightTermsSnapshot,
      freightEstimate: order.freightEstimate?.toString() ?? null,
    },
    lines: order.lines.map((line) => {
      const issuedQty = new D(issued[line.id] ?? 0);
      const remaining = D.max(
        0,
        new D(line.orderedQuantity).sub(line.closedQuantity).sub(issuedQty),
      );
      const tax = line.taxSnapshot as { rate?: string; dpp_factor?: string } | null;
      return {
        id: line.id,
        productId: line.productId,
        product: { code: line.product.code, name: line.product.name },
        unit: line.Uom?.name ?? line.product.baseUom.name,
        ordered: line.orderedQuantity.toString(),
        issued: issuedQty.toString(),
        remaining: remaining.toString(),
        unitPrice: line.unitPrice.toString(),
        tax: tax?.rate ? { rate: tax.rate, dppFactor: tax.dpp_factor ?? "1" } : null,
        stock: stock.find((s) => s.productId === line.productId)?.available ?? null,
      };
    }),
    note: note ? deliveryNoteView(note) : null,
    warehouseId,
    warehouses,
    nextNumber,
    today: today.toISOString().slice(0, 10),
    timezone: company?.timezone ?? null,
    carriers: carriers.map((c) => c.carrierName!).filter(Boolean),
  };
}
