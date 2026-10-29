import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { lineAmounts } from "./pricing-controls";
import { orderBasis, validException } from "./exception-controls";
import { customerCredit, paymentTerm, paymentTerms } from "./customer-credit";

type Tx = Prisma.TransactionClient;
const zero = () => new Prisma.Decimal(0);

/** All credit-affecting commands take this lock before document and stock locks. */
export async function lockCustomer(tx: Tx, companyId: string, customerId: string) {
  await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customerId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
  const customer = await tx.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new NotFoundException("Pelanggan tidak ditemukan.");
  return customer;
}

/**
 * Payment terms and credit attributes of the customer (stage 2b). The term comes from the
 * customer's default term code in the active OPS-FLX-03 list.
 */
export async function currentPaymentPolicy(tx: Tx, companyId: string, customerId: string, termCodeOverride?: string | null) {
  const credit = await customerCredit(tx, companyId, customerId);
  // Interim until stage 3 adds the term picker on the SO: a customer without a default term
  // uses the company's COD term (first OPS-FLX-03 entry of kind COD).
  const term = termCodeOverride
    ? (await paymentTerms(tx, companyId)).find(t => t.code === termCodeOverride)
    : credit.defaultTerm
    ? await paymentTerm(tx, companyId, credit.defaultTerm)
    : (await paymentTerms(tx, companyId)).find((t) => t.kind === "COD");
  if (!term) throw new ConflictException(termCodeOverride ? "ORDER_PAYMENT_TERM_UNKNOWN" : "PAYMENT_POLICY_REQUIRED");
  return {
    termCode: term.code,
    termLabel: term.label,
    mode: term.kind,
    topDays: term.kind === "TEMPO" ? term.days : 0,
    creditLimit: credit.limit,
    pastDueGraceDays: credit.graceDays,
    frozen: credit.frozen,
  };
}

/** Components are disjoint: invoiced POD is never counted again as unbilled. */
export async function creditExposure(
  tx: Tx,
  companyId: string,
  customerId: string,
  currency: string,
) {
  const invoices = await tx.salesInvoice.findMany({
    where: { companyId, customerId, state: "POSTED", outstandingAmount: { gt: 0 } },
  });
  const batches = await tx.fulfillmentBatch.findMany({
    where: { companyId, salesOrder: { customerId } },
    include: {
      salesOrder: true,
      allocations: { include: { salesOrderLine: true } },
      deliveryReceipts: {
        include: {
          invoices: true,
          lines: { include: { allocation: { include: { salesOrderLine: true } } } },
        },
      },
      customerReceipts: { where: { state: "POSTED", unallocatedAmount: { gt: 0 } } },
    },
  });
  if (
    invoices.some((x) => x.currency !== currency) ||
    batches.some((b) => b.salesOrder.currency !== currency)
  )
    throw new ConflictException("CREDIT_CURRENCY_MISMATCH");
  const ar = invoices.reduce((sum, x) => sum.add(x.outstandingAmount), zero());
  let allocated = zero(),
    transit = zero(),
    unbilled = zero(),
    advances = zero();
  for (const batch of batches) {
    const reserved =
      batch.state === "ALLOCATED"
        ? batch.allocations.reduce(
            (sum, x) => sum.add(lineAmounts(x.salesOrderLine, x.quantity).total),
            zero(),
          )
        : zero();
    const traveling = batch.allocations.reduce(
      (sum, x) =>
        x.inTransitQuantity.gt(0)
          ? sum.add(lineAmounts(x.salesOrderLine, x.inTransitQuantity).total)
          : sum,
      zero(),
    );
    const pending = batch.deliveryReceipts
      .filter((r) => !r.invoices.some((i) => i.state === "POSTED"))
      .reduce(
        (sum, r) =>
          sum.add(
            r.lines.reduce(
              (value, x) =>
                value.add(lineAmounts(x.allocation.salesOrderLine, x.acceptedQuantity).total),
              zero(),
            ),
          ),
        zero(),
      );
    const linked = batch.customerReceipts.reduce((sum, r) => {
      if (r.currency !== currency) throw new ConflictException("CREDIT_CURRENCY_MISMATCH");
      return sum.add(r.unallocatedAmount);
    }, zero());
    allocated = allocated.add(reserved);
    transit = transit.add(traveling);
    unbilled = unbilled.add(pending);
    // A linked advance cannot shelter another shipment's commitment.
    advances = advances.add(Prisma.Decimal.min(linked, reserved.add(traveling).add(pending)));
  }
  return {
    ar,
    allocated,
    transit,
    unbilled,
    advances,
    total: ar.add(allocated).add(transit).add(unbilled).sub(advances),
  };
}

export async function checkCredit(
  tx: Tx,
  companyId: string,
  customerId: string,
  currency: string,
  orderId?: string,
) {
  if (!(await tx.customer.findFirst({ where: { id: customerId, companyId, state: "ACTIVE" } })))
    throw new ConflictException("CUSTOMER_NOT_ACTIVE");
  const grants = orderId ? await validException(tx, companyId, orderId, "SALES_ORDER_UNLOCK") : [];
  const order = orderId ? (await orderBasis(tx, companyId, orderId)).order : null;
  // Issued terms are immutable during later stock allocation; only current credit attributes change.
  const payment = order?.paymentSnapshot as { term_code?: string; term_label?: string; mode?: string; top_days?: number } | null;
  const credit = await customerCredit(tx, companyId, customerId);
  const policy = payment?.mode && ["COD", "PREPAY", "TEMPO"].includes(payment.mode)
    ? { mode: payment.mode as "COD" | "PREPAY" | "TEMPO", topDays: payment.top_days ?? 0,
        termCode: payment.term_code ?? "", termLabel: payment.term_label ?? "",
        creditLimit: credit.limit, pastDueGraceDays: credit.graceDays, frozen: credit.frozen }
    : await currentPaymentPolicy(tx, companyId, customerId, order?.paymentTermCode);
  if (order && (order.customerId !== customerId || order.currency !== currency))
    throw new ConflictException("UNLOCK_SCOPE_INVALID");
  const value = order?.lines.reduce(
    (sum, l) => sum.add(lineAmounts(l, l.orderedQuantity).total),
    zero(),
  );
  const permits = (reason: string) =>
    grants.some(
      (g) => value && g.amountLimit.gte(value) && (g.reasons as string[]).includes(reason),
    );
  if (policy.frozen && !permits("CUSTOMER_CREDIT_FROZEN"))
    throw new ConflictException("CUSTOMER_CREDIT_FROZEN");
  if (policy.mode !== "TEMPO") return policy;
  // Limit and grace are optional on the master: no grace means past due from the due date,
  // no limit means no limit check (credit mode OFF/WARN/BLOCK arrives in stage 3).
  const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
  const today = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: company.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  today.setUTCDate(today.getUTCDate() - (policy.pastDueGraceDays ?? 0));
  const overdue = await tx.salesInvoice.count({
    where: {
      companyId,
      customerId,
      state: "POSTED",
      outstandingAmount: { gt: 0 },
      dueDate: { lt: today },
    },
  });
  if (overdue && !permits("CUSTOMER_PAST_DUE")) throw new ConflictException("CUSTOMER_PAST_DUE");
  if (policy.creditLimit === null) return policy;
  const exposure = await creditExposure(tx, companyId, customerId, currency);
  if (exposure.total.gt(policy.creditLimit) && !permits("CREDIT_HOLD"))
    throw new ConflictException("CREDIT_HOLD");
  return policy;
}

export async function stockBusinessDate(tx: Tx, companyId: string) {
  const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
  return new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: company.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
}

export async function eligibleLots(tx: Tx, companyId: string, productIds: string[], warehouseIds?: string[]) {
  const today = await stockBusinessDate(tx, companyId);
  const policy = await tx.systemPolicy.findUnique({
    where: { companyId_code: { companyId, code: "OPS-WH-02" } },
    include: {
      versions: {
        where: {
          state: "ACTIVE",
          OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date() } }],
        },
        orderBy: [{ effectiveFrom: "desc" }, { versionNo: "desc" }],
        take: 1,
      },
    },
  });
  const strategy = policy?.versions[0]?.valueSnapshot as
    | { with_expiry?: string; without_expiry?: string }
    | undefined;
  if (
    !strategy ||
    !["FEFO", "FIFO"].includes(strategy.with_expiry ?? "") ||
    strategy.without_expiry !== "FIFO"
  )
    throw new ConflictException("STOCK_STRATEGY_POLICY_REQUIRED");
  const where: Prisma.StockLotWhereInput = {
    companyId,
    state: "ACTIVE",
    qualityState: "AVAILABLE",
    quantityOnHand: { gt: 0 },
    productId: { in: productIds },
    ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
    warehouse: { state: "ACTIVE" },
    product: { state: "ACTIVE" },
    locator: { state: "ACTIVE", locatorType: { in: ["STORAGE", "DISPATCH"] } },
    OR: [{ expiryDate: { gt: today } }, { expiryDate: null, product: { expiryRequired: false } }],
  };
  const candidates = await tx.stockLot.findMany({
    where,
    orderBy: { id: "asc" },
    select: { id: true },
  });
  for (const lot of candidates)
    await tx.$queryRaw`SELECT id FROM stock_lots WHERE id = ${lot.id}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
  // Reapply eligibility and FEFO after locking; database row order is not a contract.
  return tx.stockLot.findMany({
    where: { ...where, id: { in: candidates.map((x) => x.id) } },
    orderBy: [
      ...(strategy.with_expiry === "FEFO"
        ? [{ expiryDate: { sort: "asc" as const, nulls: "last" as const } }]
        : []),
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });
}

export async function assertDispatchLots(tx: Tx, companyId: string, lotIds: string[]) {
  const today = await stockBusinessDate(tx, companyId);
  for (const id of [...new Set(lotIds)].sort())
    await tx.$queryRaw`SELECT id FROM stock_lots WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
  const lots = await tx.stockLot.findMany({
    where: { companyId, id: { in: lotIds } },
    include: { product: true, locator: true, warehouse: true },
  });
  if (
    lots.length !== new Set(lotIds).size ||
    lots.some(
      (x) =>
        x.state !== "ACTIVE" ||
        x.qualityState !== "AVAILABLE" ||
        x.product.state !== "ACTIVE" ||
        x.warehouse.state !== "ACTIVE" ||
        x.locator.state !== "ACTIVE" ||
        !["STORAGE", "DISPATCH"].includes(x.locator.locatorType) ||
        (x.expiryDate ? x.expiryDate <= today : x.product.expiryRequired),
    )
  )
    throw new ConflictException("STOCK_NOT_ELIGIBLE");
  return lots;
}

