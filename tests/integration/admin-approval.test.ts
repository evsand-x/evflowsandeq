import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { approvePr } from "../../packages/backend/src/procurement/approval-controls";

it("allows Admin Sistem to approve their own unassigned purchase request", async () => {
  const database = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(database.hostname))
    throw new Error("Local development database required");
  const companyId = randomUUID(), administratorId = randomUUID(), approverId = randomUUID();
  await prisma.company.create({ data: { id: companyId, name: "ADMIN APPROVAL TEST" } });
  for (const id of [administratorId, approverId]) {
    await prisma.user.create({
      data: { id, email: `${id}@example.invalid`, displayName: "Test", passwordHash: "disabled" },
    });
    await prisma.companyMembership.create({ data: { companyId, userId: id } });
  }
  const role = await prisma.role.create({
    data: { companyId, code: "ADMIN_SYSTEM", name: "Admin Sistem" },
  });
  const membership = await prisma.companyMembership.findUniqueOrThrow({
    where: { companyId_userId: { companyId, userId: administratorId } },
  });
  await prisma.userRole.create({
    data: { companyId, membershipId: membership.id, roleId: role.id },
  });
  await prisma.transactionApprovalPolicy.create({
    data: {
      companyId,
      documentKind: "PURCHASE_REQUEST",
      currency: "IDR",
      maximumAmount: "100",
      steps: [{ mode: "ALL", user_ids: [approverId] }],
      effectiveFrom: new Date("2020-01-01"),
      effectiveTo: new Date("2099-01-01"),
      createdById: administratorId,
    },
  });
  const request = await prisma.purchaseRequest.create({
    data: {
      companyId,
      number: randomUUID(),
      state: "SUBMITTED",
      createdById: administratorId,
      approvalValue: "100",
      currency: "IDR",
    },
  });
  const approved = await prisma.$transaction((tx) =>
    approvePr(tx, companyId, administratorId, request.id),
  );
  expect(approved.state).toBe("APPROVED");
  const action = await prisma.transactionApprovalAction.findFirstOrThrow({
    where: { companyId, sourceId: request.id, actorId: administratorId },
  });
  expect(action.reason).toContain("Admin Sistem");
});
