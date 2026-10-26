import { Prisma } from "@evflow/database";
import { lineAmounts } from "./pricing-controls";
import type { SalesOrderState } from "@evflow/database";
import { orderDisplayStatus, estimatedDueDate } from "./order-status";
import type { PaymentTerm } from "./customer-credit";

type Line = {
  orderedQuantity: Prisma.Decimal;
  allocatedQuantity: Prisma.Decimal;
  closedQuantity: Prisma.Decimal;
  backorderQuantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  taxSnapshot: Prisma.JsonValue | null;
  allocations: {
    acceptedQuantity: Prisma.Decimal;
    inTransitQuantity: Prisma.Decimal;
    returnedQuantity: Prisma.Decimal;
  }[];
};
/** Read projection only; never used as a command gate. No costs or exposure are exposed. */
export function orderView(order: { state: string; lines: Line[]; orderDate?: Date; pendingException?: boolean; paymentTerm?: PaymentTerm | null; downPayment?: string }) {
  const Decimal = Prisma.Decimal.clone({ precision: 48 });
  const zero = () => new Decimal(0);
  let subtotal = zero(),
    tax = zero(),
    shipped = zero(),
    ordered = zero();
  const priced = order.lines.map((line) => {
    ordered = ordered.add(line.orderedQuantity);
    shipped = shipped.add(
      line.allocations.reduce(
        (s, a) => s.add(a.acceptedQuantity).add(a.inTransitQuantity).add(a.returnedQuantity),
        zero(),
      ),
    );
    const amounts = line.taxSnapshot ? lineAmounts(line, line.orderedQuantity) : null;
    const net = amounts?.net ?? line.unitPrice.mul(line.orderedQuantity);
    subtotal = subtotal.add(net);
    if (amounts) tax = tax.add(amounts.tax);
    return {
      subtotal: net.toString(),
      taxAmount: amounts?.tax.toString() ?? null,
      remainder: line.orderedQuantity
        .sub(line.allocatedQuantity)
        .sub(line.closedQuantity)
        .toString(),
    };
  });
  const taxKnown = order.lines.length > 0 && order.lines.every((l) => !!l.taxSnapshot);
  return {
    displayStatus: orderDisplayStatus({ state: order.state as SalesOrderState, pendingException: order.pendingException ?? false,
      lines: order.lines.map(l => ({ ordered: l.orderedQuantity, closed: l.closedQuantity,
        accepted: l.allocations.reduce((s,a) => s.add(a.acceptedQuantity), zero()),
        inTransit: l.allocations.reduce((s,a) => s.add(a.inTransitQuantity), zero()) })) }),
    dueDateEstimate: order.orderDate ? estimatedDueDate(order.orderDate, order.paymentTerm ?? null) : null,
    downPayment: order.downPayment ?? "0",
    subtotal: subtotal.toString(),
    taxAmount: taxKnown ? tax.toString() : null,
    total: taxKnown ? subtotal.add(tax).toString() : null,
    fulfillment: shipped.isZero()
      ? "Belum Dikirim"
      : shipped.gte(ordered)
        ? "Terkirim Semua"
        : "Sebagian",
    remainderStatus: ["CLOSED", "CANCELLED"].includes(order.state)
      ? "Ditutup"
      : order.lines.some((l) => l.backorderQuantity.gt(0))
        ? "Backorder"
        : order.state === "DRAFT"
          ? "Belum dievaluasi"
          : "Proses Pemenuhan",
    lineValues: priced,
  };
}
