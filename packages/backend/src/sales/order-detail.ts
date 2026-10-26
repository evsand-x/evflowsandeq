import { NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import { orderReadFacts } from "./order-summary";
import { orderView } from "./order-view";
import {
  orderLineProgress,
  orderNeighbors,
  orderRelated,
  remainingOrderBill,
  type OrderPermission,
} from "./order-related";

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal.clone({ precision: 48 });

export async function orderDetail(
  companyId: string,
  id: string,
  can: OrderPermission = () => false,
  db: Tx = prisma,
) {
  const row = await db.salesOrder.findFirst({
    where: { companyId, id },
    include: {
      customer: { select: { id: true, name: true, channel: { select: { name: true } } } },
      salesperson: { select: { id: true, displayName: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      lines: {
        include: {
          product: {
            select: { id: true, code: true, name: true, baseUom: { select: { name: true } } },
          },
          Uom: { select: { name: true } },
          allocations: {
            select: { acceptedQuantity: true, inTransitQuantity: true, returnedQuantity: true },
          },
        },
        orderBy: { id: "asc" },
      },
      fulfillments: {
        select: { id: true, state: true, pickList: { select: { id: true, state: true } } },
      },
    },
  });
  if (!row) throw new NotFoundException();

  const financial =
    can("sales_order_advance.create") ||
    can("sales_order_advance.verify") ||
    can("customer_receipt.read");
  const facts = await orderReadFacts(companyId, [row], db, financial);
  const view = orderView({ ...row, ...facts.get(row.id) });
  const receipts = financial
    ? await db.customerReceipt.findMany({
        where: {
          companyId,
          state: "POSTED",
          OR: [{ salesOrderId: id }, { fulfillmentBatch: { companyId, salesOrderId: id } }],
        },
        select: { amount: true, unallocatedAmount: true, refundedAmount: true },
      })
    : [];
  const invoices =
    financial && can("sales_invoice.read")
      ? await db.salesInvoice.findMany({
          where: { companyId, salesOrderId: id, state: "POSTED" },
          select: { total: true, outstandingAmount: true },
        })
      : [];
  const total = view.total;
  const remainingBill =
    financial && can("sales_invoice.read")
      ? remainingOrderBill(
          total,
          receipts.map((receipt) => new D(receipt.unallocatedAmount).toString()),
          invoices.map((invoice) => ({
            total: new D(invoice.total ?? 0).toString(),
            outstandingAmount: new D(invoice.outstandingAmount).toString(),
          })),
        )
      : null;
  const lines = row.lines
    .map((line, index) => ({
      ...line,
      ...view.lineValues[index],
      ...orderLineProgress(line),
      product: line.product,
      uom: line.Uom,
    }))
    .sort(
      (a, b) =>
        Number(new D(b.remaining).gt(new D(0))) - Number(new D(a.remaining).gt(new D(0))) ||
        a.id.localeCompare(b.id),
    );
  const advances = financial
    ? await db.salesOrderAdvance.findMany({
        where: { companyId, salesOrderId: id },
        include: { customerReceipt: false },
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      })
    : [];
  const advanceRows = financial
    ? await Promise.all(
        advances.map(async (advance) => {
          const [recordedBy, bankAccount] = await Promise.all([
            db.user.findUnique({
              where: { id: advance.recordedById },
              select: { displayName: true },
            }),
            db.financeBankAccount.findFirst({
              where: { id: advance.bankAccountId, companyId },
              select: { name: true, lastFour: true },
            }),
          ]);
          return {
            ...advance,
            amount: advance.amount.toString(),
            receivedAt: advance.receivedAt.toISOString(),
            recordedBy: { displayName: recordedBy?.displayName ?? "" },
            bankAccount: bankAccount
              ? { name: bankAccount.name, number: bankAccount.lastFour }
              : null,
          };
        }),
      )
    : undefined;
  const auditRows = await db.auditEvent.findMany({
    where: {
      companyId,
      resourceType: "sales_order",
      resourceId: id,
      action: { not: "sales_order.printed" },
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 1,
    include: { actor: { select: { displayName: true } } },
  });
  const printRows = await db.auditEvent.findMany({
    where: {
      companyId,
      resourceType: "sales_order",
      resourceId: id,
      action: "sales_order.printed",
    },
    orderBy: { occurredAt: "desc" },
    take: 1,
    include: { actor: { select: { displayName: true } } },
  });
  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true, legalName: true, address: true, taxIdentity: true },
  });
  const related = await orderRelated(companyId, id, can, db);
  const neighbors = await orderNeighbors(companyId, row, db);
  const { paymentSnapshot, ...safeRow } = row;
  void paymentSnapshot;
  const { downPayment, ...safeView } = view;
  return {
    ...safeRow,
    ...safeView,
    companyProfile: {
      name: company.legalName ?? company.name,
      address: company.address,
      taxId: company.taxIdentity,
    },
    warehouseName: row.warehouse?.name ?? null,
    salespersonName: row.salesperson?.displayName ?? null,
    lines,
    ...(financial ? { advances: advanceRows, downPayment } : {}),
    ...(financial && can("sales_invoice.read") ? { remainingBill } : {}),
    related,
    neighbors,
    lastChanged: auditRows.find((event) => event.action !== "sales_order.printed")
      ? (() => {
          const event = auditRows.find((item) => item.action !== "sales_order.printed")!;
          return { by: event.actor?.displayName ?? "", at: event.occurredAt.toISOString() };
        })()
      : null,
    lastPrinted: printRows[0]
      ? { by: printRows[0].actor?.displayName ?? "", at: printRows[0].occurredAt.toISOString() }
      : null,
  };
}
