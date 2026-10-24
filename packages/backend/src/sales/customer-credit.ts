import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import type { AuditService } from "../common/audit.service";

type Tx = Prisma.TransactionClient;

export type PaymentTerm = {
  code: string;
  label: string;
  days: number;
  kind: "COD" | "PREPAY" | "TEMPO";
};

export type CustomerCredit = {
  limit: Prisma.Decimal | null;
  frozen: boolean;
  graceDays: number | null;
  defaultTerm: string | null;
};

/** Credit attributes of one customer (stage 2b; replaces CustomerPaymentPolicy). */
export async function customerCredit(
  tx: Tx,
  companyId: string,
  customerId: string,
): Promise<CustomerCredit> {
  const row = await tx.customer.findFirst({
    where: { id: customerId, companyId },
    select: {
      creditLimit: true,
      creditFrozen: true,
      pastDueGraceDays: true,
      defaultTermCode: true,
    },
  });
  if (!row) throw new NotFoundException("Pelanggan tidak ditemukan.");
  return {
    limit: row.creditLimit,
    frozen: row.creditFrozen,
    graceDays: row.pastDueGraceDays,
    defaultTerm: row.defaultTermCode,
  };
}

/** The company's active OPS-FLX-03 term list; empty when the setting is missing. */
export async function paymentTerms(tx: Tx, companyId: string): Promise<PaymentTerm[]> {
  const version = await tx.policyVersion.findFirst({
    where: { policy: { companyId, code: "OPS-FLX-03" }, state: "ACTIVE" },
    orderBy: { versionNo: "desc" },
    select: { valueSnapshot: true },
  });
  const value = version?.valueSnapshot;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is PaymentTerm =>
      !!t &&
      typeof t === "object" &&
      typeof (t as PaymentTerm).code === "string" &&
      typeof (t as PaymentTerm).days === "number" &&
      ["COD", "PREPAY", "TEMPO"].includes((t as PaymentTerm).kind),
  );
}

/** Resolves a term code; a code that is no longer in the active list blocks the process. */
export async function paymentTerm(tx: Tx, companyId: string, code: string) {
  const term = (await paymentTerms(tx, companyId)).find((t) => t.code === code);
  if (!term) throw new ConflictException("PAYMENT_TERM_INVALID");
  return term;
}

/** Stable fingerprint of the credit inputs; a change invalidates unlock grants. */
export function creditFingerprint(credit: CustomerCredit) {
  return [credit.defaultTerm, credit.limit?.toString() ?? null, credit.frozen, credit.graceDays];
}

export type CustomerCreditInput = {
  default_term_code?: string | null;
  credit_limit?: string | null;
  credit_frozen?: boolean;
  freeze_reason?: string | null;
  past_due_grace_days?: number | null;
};

const creditKeys = [
  "default_term_code",
  "credit_limit",
  "credit_frozen",
  "freeze_reason",
  "past_due_grace_days",
] as const;

/** True when the request carries any credit attribute (gated by customer_credit.update). */
export function hasCreditInput(input: Record<string, unknown>) {
  return creditKeys.some((key) => input[key] !== undefined);
}

type CreditColumns = {
  creditLimit: Prisma.Decimal | null;
  creditFrozen: boolean;
  freezeReason: string | null;
  pastDueGraceDays: number | null;
  defaultTermCode: string | null;
};

export function creditColumns(row: CreditColumns): CreditColumns {
  return {
    creditLimit: row.creditLimit,
    creditFrozen: row.creditFrozen,
    freezeReason: row.freezeReason,
    pastDueGraceDays: row.pastDueGraceDays,
    defaultTermCode: row.defaultTermCode,
  };
}

/**
 * Merges the provided credit attributes over the current ones and validates the result.
 * Returns null when the input carries no credit attribute (the stored values stay as they are).
 */
export async function resolveCustomerCredit(
  tx: Tx,
  companyId: string,
  current: CreditColumns,
  input: CustomerCreditInput,
): Promise<CreditColumns | null> {
  if (!hasCreditInput(input as Record<string, unknown>)) return null;
  const pick = <K extends keyof CustomerCreditInput>(key: K, fallback: unknown) =>
    input[key] === undefined ? fallback : input[key];
  const term = pick("default_term_code", current.defaultTermCode) as string | null;
  const limit = pick("credit_limit", current.creditLimit?.toString() ?? null) as string | null;
  const frozen = pick("credit_frozen", current.creditFrozen) as boolean;
  const reason = (pick("freeze_reason", current.freezeReason) as string | null)?.trim() || null;
  const grace = pick("past_due_grace_days", current.pastDueGraceDays) as number | null;
  const resolved = term ? await paymentTerm(tx, companyId, term) : null;
  if (frozen && !reason) throw new ConflictException("FREEZE_REASON_REQUIRED");
  if (resolved?.kind === "TEMPO" && !limit)
    throw new ConflictException("TOP_AND_CREDIT_LIMIT_REQUIRED");
  if (resolved?.kind === "TEMPO" && grace === null)
    throw new ConflictException("PAST_DUE_POLICY_REQUIRED");
  return {
    creditLimit: limit === null ? null : new Prisma.Decimal(limit),
    creditFrozen: frozen,
    freezeReason: frozen ? reason : null,
    pastDueGraceDays: grace,
    defaultTermCode: term,
  };
}

export function creditChanged(before: CreditColumns, after: CreditColumns) {
  return (
    JSON.stringify(creditFingerprint(fromColumns(before))) !==
      JSON.stringify(creditFingerprint(fromColumns(after))) ||
    (before.freezeReason ?? null) !== (after.freezeReason ?? null)
  );
}

function fromColumns(row: CreditColumns): CustomerCredit {
  return {
    limit: row.creditLimit,
    frozen: row.creditFrozen,
    graceDays: row.pastDueGraceDays,
    defaultTerm: row.defaultTermCode,
  };
}

type Audit = Pick<AuditService, "recordWith">;

/** JSON-safe credit values; money stays a decimal string. */
function creditSnapshot(row: CreditColumns) {
  return { ...creditColumns(row), creditLimit: row.creditLimit?.toString() ?? null };
}

export async function recordCreditChange(
  tx: Tx,
  audit: Audit,
  companyId: string,
  actorId: string,
  customerId: string,
  before: CreditColumns,
  after: CreditColumns,
) {
  if (!creditChanged(before, after)) return;
  await audit.recordWith(tx, {
    companyId,
    actorId,
    action: "customer.credit.updated",
    resourceType: "customer",
    resourceId: customerId,
    before: creditColumns(before),
    after: creditColumns(after),
    // Audit rows keep only hashes of before/after; the credit values themselves go in metadata.
    metadata: { before: creditSnapshot(before), after: creditSnapshot(after) },
  });
}

/**
 * Standalone command for seeds and fixtures: locks the customer, validates, updates the credit
 * attributes with a version increment and audits the change.
 */
export async function setCustomerCredit(
  tx: Tx,
  audit: Audit,
  companyId: string,
  actorId: string,
  customerId: string,
  input: CustomerCreditInput,
) {
  await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customerId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
  const current = await tx.customer.findFirst({ where: { id: customerId, companyId } });
  if (!current) throw new NotFoundException("Pelanggan tidak ditemukan.");
  const next = await resolveCustomerCredit(tx, companyId, current, input);
  if (!next) return current;
  const updated = await tx.customer.update({
    where: { id: customerId },
    data: { ...next, version: { increment: 1 }, updatedById: actorId },
  });
  await recordCreditChange(tx, audit, companyId, actorId, customerId, current, next);
  return updated;
}
