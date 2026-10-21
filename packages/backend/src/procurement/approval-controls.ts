import { ConflictException, ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@evflow/database";
import { isCompanyAdministrator } from "../identity/administrator";

export type ApprovalStep = { mode: "ANY" | "ALL"; user_ids: string[] };
export type ApprovalSnapshot = {
  policy_id: string;
  maximum_amount: string;
  allow_self: boolean;
  steps: ApprovalStep[];
  amount: string;
  currency: string;
  requester_id: string;
};

export async function approvePr(
  tx: Prisma.TransactionClient,
  companyId: string,
  actorId: string,
  id: string,
) {
  await tx.$queryRaw`SELECT id FROM purchase_requests WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
  const request = await tx.purchaseRequest.findFirst({ where: { id, companyId } });
  if (!request) throw new ConflictException("PR_NOT_FOUND");
  if (request.state === "APPROVED") return request;
  if (request.state !== "SUBMITTED") throw new ConflictException("PR_SUBMISSION_REQUIRED");
  if (!request.createdById || !request.approvalValue)
    throw new ConflictException("PR_APPROVAL_BASIS_REQUIRED");
  let snapshot = request.approvalSnapshot as ApprovalSnapshot | null;
  if (!snapshot) {
    const now = new Date();
    const policies = await tx.transactionApprovalPolicy.findMany({
      where: {
        companyId,
        documentKind: "PURCHASE_REQUEST",
        currency: request.currency,
        effectiveFrom: { lte: now },
        effectiveTo: { gt: now },
      },
    });
    if (policies.length !== 1)
      throw new ConflictException("APPROVAL_POLICY_REQUIRED_OR_CONFLICTING");
    const policy = policies[0]!;
    snapshot = {
      policy_id: policy.id,
      maximum_amount: policy.maximumAmount.toString(),
      allow_self: policy.allowSelf,
      steps: policy.steps as ApprovalStep[],
      amount: request.approvalValue.toString(),
      currency: request.currency,
      requester_id: request.createdById,
    };
  }
  const administrator = await isCompanyAdministrator(tx, companyId, actorId);
  if (!snapshot.steps.length || (!administrator && request.approvalValue.gt(snapshot.maximum_amount)))
    throw new ConflictException("APPROVAL_LIMIT_EXCEEDED");
  if (
    !request.approvalValue.eq(snapshot.amount) ||
    request.currency !== snapshot.currency ||
    request.createdById !== snapshot.requester_id
  )
    throw new ConflictException("APPROVAL_REVISION_CHANGED");
  if (!administrator && !snapshot.allow_self && actorId === snapshot.requester_id)
    throw new ForbiddenException("SELF_APPROVAL_FORBIDDEN");
  const actions = await tx.transactionApprovalAction.findMany({
    where: { companyId, sourceId: id, policyId: snapshot.policy_id },
  });
  const activeStep = snapshot.steps.findIndex((step, index) => {
    const approved = new Set(
      actions.filter((x) => x.step === index && x.decision === "APPROVED").map((x) => x.actorId),
    );
    return step.mode === "ALL"
      ? !step.user_ids.every((user) => approved.has(user))
      : !step.user_ids.some((user) => approved.has(user));
  });
  if (activeStep < 0) throw new ConflictException("APPROVAL_ALREADY_COMPLETE");
  const step = snapshot.steps[activeStep]!;
  const member = await tx.companyMembership.findFirst({
    where: { companyId, userId: actorId, active: true, user: { active: true } },
  });
  if (!member || (!administrator && !step.user_ids.includes(actorId)))
    throw new ForbiddenException("APPROVER_NOT_ASSIGNED");
  if (!actions.some((x) => x.step === activeStep && x.actorId === actorId))
    await tx.transactionApprovalAction.create({
      data: {
        companyId,
        sourceId: id,
        policyId: snapshot.policy_id,
        step: activeStep,
        actorId,
        decision: "APPROVED",
        reason: administrator
          ? "Keputusan Admin Sistem tanpa penunjukan approver."
          : "Persetujuan kebutuhan pembelian sesuai penugasan dan batas nilai.",
      },
    });
  const all = await tx.transactionApprovalAction.findMany({
    where: { companyId, sourceId: id, policyId: snapshot.policy_id, decision: "APPROVED" },
  });
  const complete = administrator || snapshot.steps.every((s, index) => {
    const users = new Set(all.filter((x) => x.step === index).map((x) => x.actorId));
    return s.mode === "ALL"
      ? s.user_ids.every((u) => users.has(u))
      : s.user_ids.some((u) => users.has(u));
  });
  return tx.purchaseRequest.update({
    where: { id },
    data: {
      approvalSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      state: complete ? "APPROVED" : "SUBMITTED",
    },
  });
}
