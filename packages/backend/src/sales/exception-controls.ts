import { createHash } from "node:crypto";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";
import type { ApprovalSnapshot, ApprovalStep } from "../procurement/approval-controls";
import { isCompanyAdministrator } from "../identity/administrator";
import { requireEvidence } from "./document-controls";
import { z } from "zod";

type Tx = Prisma.TransactionClient;
const audit = new AuditService();

/** Only business inputs participate: evaluation/state changes do not invalidate grants. */
export async function orderBasis(tx: Tx, companyId: string, id: string) {
  const order = await tx.salesOrder.findFirst({
    where: { companyId, id },
    include: { lines: { orderBy: { id: "asc" } } },
  });
  if (!order) throw new NotFoundException("SO tidak ditemukan.");
  const policy = await tx.customerPaymentPolicy.findFirst({
    where: {
      companyId,
      customerId: order.customerId,
      active: true,
      effectiveFrom: { lte: new Date() },
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  });
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        customer: order.customerId,
        material_revision: order.materialRevision,
        currency: order.currency,
        policy: policy?.id,
        reference: order.customerReference,
        address: order.deliveryAddress,
        lines: order.lines.map((l) => [
          l.id,
          l.productId,
          l.orderedQuantity.toString(),
          l.unitPrice.toString(),
        ]),
      }),
    )
    .digest("hex");
  return { order, hash };
}

export async function validException(
  tx: Tx,
  c: string,
  orderId: string,
  kind: string,
  lineId?: string,
) {
  const basis = await orderBasis(tx, c, orderId);
  const grants = await tx.salesExceptionRequest.findMany({
    where: {
      companyId: c,
      salesOrderId: orderId,
      kind,
      state: "APPROVED",
      lineId: lineId ?? null,
      materialHash: basis.hash,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  return grants;
}

export async function requestException(
  c: string,
  a: string,
  id: string,
  i: {
    kind: "SALES_ORDER_UNLOCK" | "SPECIAL_PRICE";
    version: number;
    line_id?: string | undefined;
    reasons: string[];
    reason: string;
    evidence_id: string;
    amount_limit: string;
  },
  key: string,
) {
  return transactionCommand(c, a, `orders/${id}/exceptions`, key, i, async (tx) => {
    await tx.$queryRaw`SELECT id FROM sales_orders WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
    const { order, hash } = await orderBasis(tx, c, id);
    if (order.version !== i.version) throw new ConflictException("ORDER_VERSION_CHANGED");
    if (!["DRAFT", "OPEN"].includes(order.state))
      throw new ConflictException("ORDER_EXCEPTION_STATE_INVALID");
    await requireEvidence(tx, c, i.evidence_id, "SALES_ORDER");
    if (
      i.kind === "SPECIAL_PRICE" &&
      !order.lines.some(
        (l) =>
          l.id === i.line_id &&
          (order.state === "DRAFT" ||
            !!(l.priceSnapshot as { exception_id?: string } | null)?.exception_id),
      )
    )
      throw new ConflictException("PRICE_LINE_INVALID");
    if (i.kind === "SALES_ORDER_UNLOCK" && (i.line_id || !i.reasons.length))
      throw new ConflictException("UNLOCK_SCOPE_REQUIRED");
    const now = new Date();
    const policies = await tx.transactionApprovalPolicy.findMany({
      where: {
        companyId: c,
        documentKind: i.kind,
        currency: order.currency,
        effectiveFrom: { lte: now },
        effectiveTo: { gt: now },
      },
    });
    if (policies.length !== 1)
      throw new ConflictException("APPROVAL_POLICY_REQUIRED_OR_CONFLICTING");
    const policy = policies[0]!;
    const allowed = policy.allowedReasons as string[] | null;
    if (
      !policy.grantHours ||
      (i.kind === "SALES_ORDER_UNLOCK" && (!allowed || i.reasons.some((r) => !allowed.includes(r))))
    )
      throw new ConflictException("UNLOCK_SCOPE_NOT_ALLOWED");
    const amount = new Prisma.Decimal(i.amount_limit);
    const basisAmount = order.lines
      .filter((l) => !i.line_id || l.id === i.line_id)
      .reduce((sum, l) => sum.add(l.unitPrice.mul(l.orderedQuantity)), new Prisma.Decimal(0));
    if (amount.lte(0) || amount.gt(policy.maximumAmount) || amount.lt(basisAmount))
      throw new ConflictException("APPROVAL_LIMIT_EXCEEDED");
    const steps = policy.steps as ApprovalStep[];
    if (!steps.length || steps.some((s) => !s.user_ids.length))
      throw new ConflictException("APPROVAL_ASSIGNMENT_REQUIRED");
    if (
      await tx.salesExceptionRequest.count({
        where: {
          companyId: c,
          salesOrderId: id,
          kind: i.kind,
          lineId: i.line_id ?? null,
          materialHash: hash,
          state: "SUBMITTED",
          expiresAt: { gt: now },
        },
      })
    )
      throw new ConflictException("EXCEPTION_ALREADY_PENDING");
    const row = await tx.salesExceptionRequest.create({
      data: {
        companyId: c,
        salesOrderId: id,
        lineId: i.line_id ?? null,
        kind: i.kind,
        materialHash: hash,
        amountLimit: amount,
        reasons: i.reasons,
        reason: i.reason,
        evidenceId: i.evidence_id,
        requesterId: a,
        expiresAt: new Date(now.getTime() + policy.grantHours * 3600000),
        policySnapshot: {
          policy_id: policy.id,
          maximum_amount: policy.maximumAmount.toString(),
          allow_self: policy.allowSelf,
          steps: policy.steps,
          amount: amount.toString(),
          currency: order.currency,
          requester_id: a,
        },
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "sales_exception.submitted",
      resourceType: "sales_order",
      resourceId: id,
      after: row,
      reason: i.reason,
    });
    return row;
  });
}

export async function decideException(
  c: string,
  a: string,
  id: string,
  i: { decision: "APPROVED" | "REJECTED" | "REVISION_REQUIRED"; reason: string },
  key: string,
) {
  return transactionCommand(c, a, `exceptions/${id}/decision`, key, i, async (tx) => {
    const ref = await tx.salesExceptionRequest.findFirst({ where: { companyId: c, id } });
    if (!ref) throw new NotFoundException();
    await tx.$queryRaw`SELECT id FROM sales_orders WHERE id=${ref.salesOrderId}::uuid AND company_id=${c}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM sales_exception_requests WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
    const row = await tx.salesExceptionRequest.findUniqueOrThrow({ where: { id } });
    if (row.state !== "SUBMITTED") throw new ConflictException("EXCEPTION_NOT_PENDING");
    if (row.expiresAt <= new Date()) throw new ConflictException("EXCEPTION_EXPIRED");
    const { hash, order } = await orderBasis(tx, c, row.salesOrderId);
    if (hash !== row.materialHash) throw new ConflictException("APPROVAL_REVISION_CHANGED");
    const snapshot = row.policySnapshot as ApprovalSnapshot;
    const administrator = await isCompanyAdministrator(tx, c, a);
    if (!administrator && !snapshot.allow_self && row.requesterId === a)
      throw new ForbiddenException("SELF_APPROVAL_FORBIDDEN");
    const actions = await tx.transactionApprovalAction.findMany({
      where: { companyId: c, sourceId: id },
    });
    const completed = (s: ApprovalStep, index: number, votes = actions) => {
      const ids = new Set(
        votes.filter((x) => x.step === index && x.decision === "APPROVED").map((x) => x.actorId),
      );
      return s.mode === "ALL"
        ? s.user_ids.every((u) => ids.has(u))
        : s.user_ids.some((u) => ids.has(u));
    };
    const step = snapshot.steps.findIndex((s, n) => !completed(s, n));
    if (
      step < 0 ||
      (!administrator && !snapshot.steps[step]!.user_ids.includes(a)) ||
      !(await tx.companyMembership.findFirst({
        where: { companyId: c, userId: a, active: true, user: { active: true } },
      }))
    )
      throw new ForbiddenException("APPROVER_NOT_ASSIGNED");
    if (actions.some((x) => x.step === step && x.actorId === a))
      throw new ConflictException("APPROVAL_ALREADY_RECORDED");
    const vote = await tx.transactionApprovalAction.create({
      data: {
        companyId: c,
        sourceId: id,
        policyId: snapshot.policy_id,
        step,
        actorId: a,
        decision: i.decision,
        reason: i.reason,
      },
    });
    const state =
      i.decision !== "APPROVED"
        ? i.decision
        : administrator || snapshot.steps.every((s, n) => completed(s, n, [...actions, vote]))
          ? "APPROVED"
          : "SUBMITTED";
    const after = await tx.salesExceptionRequest.update({
      where: { id },
      data: {
        state,
        decidedAt: state === "SUBMITTED" ? null : new Date(),
      },
    });
    if (state === "APPROVED") {
      await tx.$executeRaw`INSERT INTO sales_exception_evaluations
        (id, company_id, sales_order_id, actor_id, order_version)
        VALUES (${row.id}::uuid, ${c}::uuid, ${row.salesOrderId}::uuid, ${a}::uuid, ${order.version})`;
    }
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: `sales_exception.${state.toLowerCase()}`,
      resourceType: "sales_order",
      resourceId: row.salesOrderId,
      before: row,
      after,
      reason: i.reason,
    });
    return after;
  });
}

export async function manageException(
  c: string,
  a: string,
  id: string,
  body: unknown,
  key: string,
) {
  const input = z
    .object({
      action: z.enum(["CANCEL", "DELEGATE"]),
      reason: z.string().trim().min(1).max(1000),
      delegate_id: z.string().uuid().optional(),
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, `exceptions/${id}/manage`, key, input, async (tx) => {
    const ref = await tx.salesExceptionRequest.findFirst({ where: { companyId: c, id } });
    if (!ref) throw new NotFoundException();
    await tx.$queryRaw`SELECT id FROM sales_orders WHERE id=${ref.salesOrderId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM sales_exception_requests WHERE id=${id}::uuid FOR UPDATE`;
    const row = await tx.salesExceptionRequest.findUniqueOrThrow({ where: { id } });
    if (row.state !== "SUBMITTED" || row.expiresAt <= new Date())
      throw new ConflictException("EXCEPTION_NOT_PENDING");
    let after;
    if (input.action === "CANCEL") {
      if (row.requesterId !== a) throw new ForbiddenException("ONLY_REQUESTER_CAN_CANCEL");
      after = await tx.salesExceptionRequest.update({
        where: { id },
        data: { state: "CANCELLED", decidedAt: new Date() },
      });
    } else {
      const p = row.policySnapshot as ApprovalSnapshot;
      const actions = await tx.transactionApprovalAction.findMany({
        where: { companyId: c, sourceId: id },
      });
      const step = p.steps.findIndex((s, n) => {
        const approved = new Set(
          actions.filter((v) => v.step === n && v.decision === "APPROVED").map((v) => v.actorId),
        );
        return s.mode === "ALL"
          ? !s.user_ids.every((u) => approved.has(u))
          : !s.user_ids.some((u) => approved.has(u));
      });
      if (
        step < 0 ||
        !p.steps[step]!.user_ids.includes(a) ||
        actions.some((v) => v.step === step && v.actorId === a) ||
        !input.delegate_id ||
        input.delegate_id === a ||
        (!p.allow_self && input.delegate_id === row.requesterId)
      )
        throw new ForbiddenException("DELEGATION_NOT_ALLOWED");
      const member = await tx.companyMembership.findFirst({
        where: { companyId: c, userId: input.delegate_id, active: true, user: { active: true } },
        include: {
          userRoles: {
            include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
          },
        },
      });
      const permission =
        row.kind === "SPECIAL_PRICE" ? "price_request.approve" : "sales_order.unlock.approve";
      if (
        !member?.userRoles.some(
          (r) =>
            r.role.active &&
            r.role.rolePermissions.some(
              (g) =>
                g.permission.code === permission &&
                ["company", "privileged"].includes(g.scopeType) &&
                (!g.scopeId || g.scopeId === c),
            ),
        )
      )
        throw new ForbiddenException("DELEGATE_PERMISSION_REQUIRED");
      if (p.steps.some((s) => s.user_ids.includes(input.delegate_id!)))
        throw new ConflictException("DELEGATE_ALREADY_ASSIGNED");
      const steps = p.steps.map((s, n) =>
        n === step
          ? { ...s, user_ids: s.user_ids.map((u) => (u === a ? input.delegate_id! : u)) }
          : s,
      );
      after = await tx.salesExceptionRequest.update({
        where: { id },
        data: { policySnapshot: JSON.parse(JSON.stringify({ ...p, steps })) },
      });
    }
    await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "SALES_EXCEPTION",
        sourceId: id,
        kind: input.action,
        snapshot: JSON.parse(JSON.stringify({ input, before: row, after })),
      },
    });
    await audit.recordWith(tx, {
      companyId: c,
      actorId: a,
      action: `sales_exception.${input.action.toLowerCase()}`,
      resourceType: "sales_order",
      resourceId: row.salesOrderId,
      reason: input.reason,
      before: row,
      after,
    });
    return after;
  });
}
