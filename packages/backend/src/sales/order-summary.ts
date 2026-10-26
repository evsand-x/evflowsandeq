import { prisma, Prisma } from "@evflow/database";
import { paymentTerms, type PaymentTerm } from "./customer-credit";

/** Additional read facts, fetched in bulk for one list page, never stored as balances. */
export async function orderReadFacts(
  companyId: string,
  orders: {
    id: string;
    paymentTermCode: string | null;
    paymentSnapshot: Prisma.JsonValue | null;
  }[],
  db: Prisma.TransactionClient = prisma,
  includeFinancial = true,
) {
  const ids = orders.map((o) => o.id);
  const [requests, receipts, terms] = await Promise.all([
    db.salesExceptionRequest.findMany({
      where: {
        companyId,
        salesOrderId: { in: ids },
        state: "SUBMITTED",
        expiresAt: { gt: new Date() },
      },
      select: { salesOrderId: true },
    }),
    db.customerReceipt.findMany({
      where: {
        companyId,
        ...(includeFinancial ? {} : { id: { in: [] } }),
        state: "POSTED",
        OR: [
          { salesOrderId: { in: ids } },
          { fulfillmentBatch: { companyId, salesOrderId: { in: ids } } },
        ],
      },
      select: {
        salesOrderId: true,
        amount: true,
        refundedAmount: true,
        fulfillmentBatch: { select: { salesOrderId: true } },
      },
    }),
    paymentTerms(db, companyId),
  ]);
  const Decimal = Prisma.Decimal.clone({ precision: 48 });
  return new Map(
    orders.map((o) => {
      const snapshot = o.paymentSnapshot as {
        mode?: PaymentTerm["kind"];
        top_days?: number;
        term_code?: string;
        term_label?: string;
      } | null;
      const paymentTerm = snapshot?.mode
        ? {
            code: snapshot.term_code ?? "",
            label: snapshot.term_label ?? "",
            kind: snapshot.mode,
            days: snapshot.top_days ?? 0,
          }
        : (terms.find((t) => t.code === o.paymentTermCode) ?? null);
      return [
        o.id,
        {
          paymentTerm,
          pendingException: requests.some((r) => r.salesOrderId === o.id),
          downPayment: receipts
            .filter((r) => r.salesOrderId === o.id || r.fulfillmentBatch?.salesOrderId === o.id)
            .reduce(
              (sum, r) =>
                sum.add(Decimal.max(new Decimal(r.amount.toString()).sub(r.refundedAmount), 0)),
              new Decimal(0),
            )
            .toString(),
        },
      ];
    }),
  );
}
