import { Prisma } from "@evflow/database";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import {
  recordSalesOrderAdvanceSchema,
  verifySalesOrderAdvanceSchema,
  rejectSalesOrderAdvanceSchema,
} from "@evflow/contracts";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";
import { lockCustomer } from "./transaction-controls";
import { requireEvidence } from "./document-controls";
import { lineAmounts } from "./pricing-controls";
import { postCustomerReceiptTx } from "../finance/customer-receipt";
import { assertFinancePeriodOpen } from "../finance/period-guard";
import { financeDate, lockFinance } from "../finance/posting";
const audit = new AuditService();
const Decimal = Prisma.Decimal.clone({ precision: 48 });
function parse<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } },
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error);
  return result.data as T;
}
export async function recordSalesOrderAdvance(
  c: string,
  a: string,
  id: string,
  input: unknown,
  key: string,
) {
  const i = parse(recordSalesOrderAdvanceSchema, input);
  return transactionCommand(c, a, `sales-orders/${id}/advances`, key, i, async (tx) => {
    const ref = await tx.salesOrder.findFirst({ where: { id, companyId: c } });
    if (!ref) throw new NotFoundException();
    await lockCustomer(tx, c, ref.customerId);
    await tx.$queryRaw`SELECT id FROM sales_orders WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
    const order = await tx.salesOrder.findFirstOrThrow({
      where: { id, companyId: c },
      include: { lines: true },
    });
    if (!["DRAFT", "OPEN"].includes(order.state)) throw new ConflictException("ORDER_NOT_OPEN");
    if (!order.lines.length || order.lines.some((l) => !l.taxSnapshot))
      throw new ConflictException("ORDER_TOTAL_NOT_AVAILABLE");
    const total = order.lines.reduce(
      (s, l) => s.add(lineAmounts(l, l.orderedQuantity).total),
      new Decimal(0),
    );
    const sum = await tx.salesOrderAdvance.aggregate({
      where: {
        companyId: c,
        salesOrderId: id,
        state: { in: ["PENDING_VERIFICATION", "VERIFIED"] },
      },
      _sum: { amount: true },
    });
    if (new Decimal(i.amount).add(sum._sum.amount ?? 0).gt(total))
      throw new ConflictException("ADVANCE_EXCEEDS_ORDER_TOTAL");
    await requireEvidence(tx, c, i.evidence_id, "PAYMENT");
    if (
      !(await tx.financeBankAccount.findFirst({
        where: { id: i.bank_account_id, companyId: c, active: true, currency: order.currency },
      }))
    )
      throw new ConflictException("BANK_ACCOUNT_REQUIRED");
    const row = await tx.salesOrderAdvance.create({
      data: {
        companyId: c,
        salesOrderId: id,
        amount: i.amount,
        currency: order.currency,
        receivedAt: new Date(i.received_at),
        bankAccountId: i.bank_account_id,
        bankReference: i.bank_reference ?? null,
        evidenceId: i.evidence_id,
        recordedById: a,
        idempotencyKey: key,
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "sales_order_advance.recorded",
      resourceType: "sales_order_advance",
      resourceId: row.id,
      after: row,
    });
    return row;
  });
}
async function decide(c: string, a: string, id: string, version: number, reason?: string) {
  return transactionCommand(
    c,
    a,
    `sales-order-advances/${id}/${reason === undefined ? "verify" : "reject"}`,
    undefined,
    { version, reason },
    async (tx) => {
      const ref = await tx.salesOrderAdvance.findFirst({
        where: { id, companyId: c },
        include: { salesOrder: { select: { customerId: true } } },
      });
      if (!ref) throw new NotFoundException();
      await lockCustomer(tx, c, ref.salesOrder.customerId);
      await tx.$queryRaw`SELECT id FROM sales_order_advances WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
      const row = await tx.salesOrderAdvance.findFirstOrThrow({ where: { id, companyId: c } });
      if (row.state !== "PENDING_VERIFICATION" || row.version !== version)
        throw new ConflictException("ADVANCE_STATE_OR_VERSION_CHANGED");
      if (a === row.recordedById)
        throw new ConflictException("ADVANCE_SELF_VERIFICATION_FORBIDDEN");
      let customerReceiptId: string | undefined;
      if (reason === undefined) {
        await lockFinance(tx, c);
        await assertFinancePeriodOpen(tx, c, await financeDate(tx, c, row.receivedAt));
        const receipt = await postCustomerReceiptTx(tx, c, a, {
          customerId: ref.salesOrder.customerId,
          salesOrderId: row.salesOrderId,
          amount: row.amount,
          receivedAt: row.receivedAt,
          bankAccountId: row.bankAccountId,
          ...(row.bankReference === null ? {} : { bankReference: row.bankReference }),
          evidenceId: row.evidenceId,
          idempotencyKey: `sales-order-advance:${row.id}`,
          currency: row.currency,
        });
        customerReceiptId = receipt.id;
      }
      const updated = await tx.salesOrderAdvance.update({
        where: { id },
        data: {
          state: reason === undefined ? "VERIFIED" : "REJECTED",
          customerReceiptId: customerReceiptId ?? null,
          verifiedById: a,
          verifiedAt: new Date(),
          rejectionReason: reason ?? null,
          version: { increment: 1 },
        },
      });
      await audit.recordWith(tx, {
        companyId: c,
        actorId: a,
        action: `sales_order_advance.${reason === undefined ? "verified" : "rejected"}`,
        resourceType: "sales_order_advance",
        resourceId: id,
        before: row,
        after: updated,
        ...(reason === undefined ? {} : { reason }),
      });
      return updated;
    },
  );
}
export function verifySalesOrderAdvance(c: string, a: string, id: string, input: unknown) {
  return decide(c, a, id, parse(verifySalesOrderAdvanceSchema, input).version);
}
export function rejectSalesOrderAdvance(c: string, a: string, id: string, input: unknown) {
  const i = parse(rejectSalesOrderAdvanceSchema, input);
  return decide(c, a, id, i.version, i.reason);
}
