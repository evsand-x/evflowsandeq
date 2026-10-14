import { Prisma } from "@evflow/database";
import { lineAmounts } from "../sales/pricing-controls";
type Tx = Prisma.TransactionClient;
const zero = () => new Prisma.Decimal(0);

/** Independent quantities/open documents expose missing postings, not only copied-ledger differences. */
export async function reconcileEconomicO2c(tx: Tx, c: string) {
  const company = await tx.company.findUniqueOrThrow({ where: { id: c } });
  const [lots, batches, receipts, advances, gl, notes, refunds] = await Promise.all([
    tx.stockLot.findMany({ where: { companyId: c } }),
    tx.fulfillmentBatch.findMany({
      where: { companyId: c },
      include: {
        salesOrder: true,
        allocations: { include: { salesOrderLine: true } },
        deliveryReceipts: {
          include: {
            invoices: true,
            lines: { include: { allocation: { include: { salesOrderLine: true } } } },
          },
        },
      },
    }),
    tx.customerReceipt.findMany({ where: { companyId: c, state: "POSTED" } }),
    tx.advanceTax.findMany({ where: { companyId: c }, include: { lines: true } }),
    tx.financeJournalLine.findMany({ where: { companyId: c }, include: { journal: true } }),
    tx.creditNote.findMany({
      where: { companyId: c, state: "POSTED" },
      include: { salesInvoice: true },
    }),
    tx.customerRefund.findMany({
      where: { companyId: c, state: "POSTED" },
      include: { creditNote: { include: { salesInvoice: true } } },
    }),
  ]);
  const currencies = new Set([
    company.baseCurrency,
    ...batches.map((b) => b.salesOrder.currency),
    ...receipts.map((r) => r.currency),
    ...gl.map((l) => l.journal.currency),
  ]);
  const compare = (
    kind: string,
    currency: string,
    actual: Prisma.Decimal,
    kinds = [kind],
    credit = false,
  ) => {
    const book = gl
      .filter((l) => kinds.includes(l.ledgerKind) && l.journal.currency === currency)
      .reduce(
        (s, l) => (credit ? s.add(l.credit).sub(l.debit) : s.add(l.debit).sub(l.credit)),
        zero(),
      );
    return { kind, currency, source_balance: actual, gl: book, difference: actual.sub(book) };
  };
  const checks = [
    compare(
      "INVENTORY",
      company.baseCurrency,
      lots.reduce((s, l) => s.add(l.quantityOnHand.mul(l.unitCost)), zero()),
      ["INVENTORY", "INVENTORY_QUARANTINE"],
    ),
  ];
  const exceptions: string[] = [];
  for (const currency of currencies) {
    const relevant = batches.filter((b) => b.salesOrder.currency === currency);
    if (
      relevant.some((b) =>
        b.allocations.some((l) => l.inTransitQuantity.gt(0) && l.dispatchUnitCost === null),
      )
    )
      exceptions.push("DISPATCH_COST_SNAPSHOT_REQUIRED");
    const transit = relevant
      .flatMap((b) => b.allocations)
      .reduce((s, l) => s.add(l.inTransitQuantity.mul(l.dispatchUnitCost ?? zero())), zero());
    checks.push(compare("INVENTORY_TRANSIT", currency, transit));
    const unbilled = relevant
      .flatMap((b) => b.deliveryReceipts)
      .filter((p) => !p.invoices.some((i) => i.state === "POSTED"))
      .flatMap((p) => p.lines)
      .reduce(
        (s, l) => s.add(lineAmounts(l.allocation.salesOrderLine, l.acceptedQuantity).total),
        zero(),
      );
    checks.push(compare("UNBILLED_AR", currency, unbilled));
    const cash = receipts
      .filter((r) => r.currency === currency)
      .reduce((s, r) => s.add(r.unallocatedAmount), zero());
    const outstandingTax = advances
      .filter((t) => receipts.some((r) => r.id === t.receiptId && r.currency === currency))
      .reduce((s, t) => s.add(t.amount).sub(t.appliedAmount).sub(t.reversedAmount), zero());
    const creditNotes = notes.filter((n) => n.salesInvoice.currency === currency);
    const noteCredits = await tx.ledgerEntry.aggregate({
      where: {
        companyId: c,
        kind: "CUSTOMER_ADVANCE",
        sourceType: "CREDIT_NOTE",
        sourceId: { in: creditNotes.map((n) => n.id) },
      },
      _sum: { credit: true, debit: true },
    });
    const taxCredits = await tx.ledgerEntry.aggregate({
      where: { companyId: c, currency, kind: "CUSTOMER_ADVANCE", sourceType: "TAX_CORRECTION" },
      _sum: { credit: true, debit: true },
    });
    const refunded = refunds
      .filter((r) => r.creditNote.salesInvoice.currency === currency)
      .reduce((s, r) => s.add(r.amount), zero());
    const total = cash
      .sub(outstandingTax)
      .add(noteCredits._sum.credit ?? zero())
      .sub(noteCredits._sum.debit ?? zero())
      .add(taxCredits._sum.credit ?? zero())
      .sub(taxCredits._sum.debit ?? zero())
      .sub(refunded);
    checks.push(compare("CUSTOMER_ADVANCE", currency, total, ["CUSTOMER_ADVANCE"], true));
  }
  if (advances.some((a) => a.amount.gt(0) && !a.lines.length))
    exceptions.push("LEGACY_ADVANCE_TAX_RECONCILIATION_REQUIRED");
  return {
    checks,
    exceptions,
    balanced: !exceptions.length && checks.every((c) => c.difference.eq(0)),
  };
}
