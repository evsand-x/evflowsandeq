import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { AccessService } from "../../packages/backend/src/identity/access.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import {
  accessHistory,
  accessUserDetail,
  accessRoleMembers,
  accessListSchema,
} from "../../packages/backend/src/identity/access-workspace";
import { createUserSchema, createRoleSchema, updateRoleSchema } from "@evflow/contracts";

describe("access workspace persistence and privacy", () => {
  const companyId = randomUUID(),
    otherCompanyId = randomUUID(),
    actorId = randomUUID();
  const service = new AccessService(new AuditService());
  let userId: string, roleId: string;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      throw new Error("Local development database required");
    await prisma.company.createMany({
      data: [
        { id: companyId, name: `UI IAM TEST ${companyId}` },
        { id: otherCompanyId, name: `UI IAM SCOPE TEST ${otherCompanyId}` },
      ],
    });
    await prisma.user.create({
      data: {
        id: actorId,
        email: `iam-actor-${actorId}@example.invalid`,
        displayName: "Actor Uji IAM",
        active: false,
        passwordHash: "DISABLED_TEST_ACCOUNT",
      },
    });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  it("accepts explicit inactive creation and rejects malformed filters", () => {
    expect(
      createUserSchema.parse({
        email: "u@example.invalid",
        display_name: "Uji",
        password: "non-login-test-password",
        active: false,
      }).active,
    ).toBe(false);
    expect(createRoleSchema.parse({ code: "ROLE_TEST", name: "Uji", active: false }).active).toBe(
      false,
    );
    expect(updateRoleSchema.parse({ name: "Uji", active: false }).active).toBe(false);
    expect(accessListSchema.safeParse({ page: 0 }).success).toBe(false);
  });
  it("creates isolated inactive membership and real role assignment", async () => {
    const role = await service.createRole(companyId, actorId, {
      code: "UI_TEST_ROLE",
      name: "Peran Uji UI",
      active: true,
    });
    roleId = role.id;
    const catalogCount = await prisma.permission.count();
    expect(await prisma.rolePermission.count({ where: { roleId, scopeType: "company" } })).toBe(
      catalogCount,
    );
    const user = await service.createUser(companyId, actorId, {
      display_name: "Pengguna Uji UI",
      email: `iam-${randomUUID()}@example.invalid`,
      password: randomUUID() + randomUUID(),
      active: false,
      role_ids: [roleId],
    });
    userId = user.user_id;
    expect(user.active).toBe(false);
    const detail = await accessUserDetail(companyId, userId);
    expect(detail.assignments[0]?.role_id).toBe(roleId);
    expect(detail.assignments[0]?.assigned_by).toBe("Actor Uji IAM");
    expect(detail.created_by).toBe("Actor Uji IAM");
    expect(detail.created_at).toBeInstanceOf(Date);
  });
  it("never returns tokens or cross-company sessions/history", async () => {
    await prisma.authSession.create({
      data: {
        companyId,
        membershipId: await accessUserMembership(),
        sessionFamilyId: randomUUID(),
        deviceLabel: "Perangkat uji",
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const detail = await accessUserDetail(companyId, userId);
    expect(detail.active_sessions).toBe(1);
    expect(detail.sessions[0]).toEqual(
      expect.objectContaining({ device_label: "Perangkat uji", revoked_at: null }),
    );
    expect(Object.keys(detail.sessions[0]!).sort()).toEqual([
      "created_at",
      "device_label",
      "expires_at",
      "id",
      "last_seen_at",
      "revoked_at",
    ]);
    await expect(accessUserDetail(otherCompanyId, userId)).rejects.toThrow("tidak ditemukan");
    await expect(accessHistory(otherCompanyId, "user", userId)).rejects.toThrow("tidak ditemukan");
    await expect(accessRoleMembers(otherCompanyId, roleId)).rejects.toThrow("tidak ditemukan");
  });
  it("keeps assignment date on identity edit and revokes sessions", async () => {
    const before = (await accessUserDetail(companyId, userId)).assignments[0]!.assigned_at;
    const user = (await service.listUsers(companyId))[0]!;
    await service.updateUser(companyId, actorId, userId, {
      display_name: "Pengguna Uji Diperbarui",
      email: user.email,
      active: false,
      role_ids: [roleId],
    });
    const after = await accessUserDetail(companyId, userId);
    expect(after.assignments[0]!.assigned_at).toEqual(before);
    expect(after.active_sessions).toBe(0);
    const members = await accessRoleMembers(companyId, roleId);
    expect(members[0]?.active).toBe(false);
    expect(members[0]?.display_name).toBe("Pengguna Uji Diperbarui");
  });
  it("revokes company sessions and retains immutable audit evidence", async () => {
    await prisma.authSession.create({
      data: {
        companyId,
        membershipId: await accessUserMembership(),
        sessionFamilyId: randomUUID(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    expect((await service.revokeSessions(companyId, actorId, userId)).sessions_revoked).toBe(1);
    expect((await accessUserDetail(companyId, userId)).active_sessions).toBe(0);
    const history = await accessHistory(companyId, "user", userId);
    expect(history.some((e) => e.action === "user.sessions_revoked")).toBe(true);
    expect(Object.keys(history[0]!).sort()).toEqual([
      "action",
      "actor",
      "affected_members",
      "changes",
      "id",
      "occurred_at",
      "reason",
    ]);
    await service.updateRole(companyId, actorId, roleId, { name: "Peran Uji UI", active: false });
    expect((await service.listRoles(companyId))[0]?.active).toBe(false);
  });
  it("rejects stale permission snapshots and records a safe permission diff", async () => {
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    const permission = await prisma.permission.findFirstOrThrow();
    const grants = [{ permission_id: permission.id, scope_type: "company", scope_id: null }];
    await service.updateRolePermissions(companyId, actorId, roleId, grants, []);
    await expect(service.updateRolePermissions(companyId, actorId, roleId, [], [])).rejects.toThrow(
      "telah berubah",
    );
    expect(await prisma.rolePermission.count({ where: { roleId } })).toBe(1);
    const history = await accessHistory(companyId, "role", roleId);
    expect(history.find((e) => e.action === "role.permissions_changed")).toEqual(
      expect.objectContaining({
        affected_members: 1,
        changes: [{ code: permission.code, scope_type: "company", allowed: true }],
      }),
    );
    await service.updateRolePermissions(companyId, actorId, roleId, [], grants);
  });
  it("deletes an assigned ordinary role and revokes member sessions", async () => {
    const membershipId = await accessUserMembership();
    await prisma.user.update({ where: { id: actorId }, data: { active: true } });
    const adminMembership = await prisma.companyMembership.create({
      data: { companyId, userId: actorId },
    });
    const adminRole = await prisma.role.create({
      data: { companyId, code: "ADMIN_SYSTEM", name: "Admin Sistem" },
    });
    await prisma.userRole.createMany({
      data: [
        { companyId, membershipId: adminMembership.id, roleId: adminRole.id },
        { companyId, membershipId: adminMembership.id, roleId },
      ],
    });
    await prisma.authSession.create({
      data: {
        companyId,
        membershipId: adminMembership.id,
        sessionFamilyId: randomUUID(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    await prisma.authSession.create({
      data: {
        companyId,
        membershipId,
        sessionFamilyId: randomUUID(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const result = await service.deleteRole(companyId, actorId, roleId);
    expect(result.affected_members).toBe(2);
    expect(await prisma.userRole.count({ where: { companyId, roleId } })).toBe(0);
    expect(
      await prisma.authSession.count({ where: { companyId, membershipId, revokedAt: null } }),
    ).toBe(0);
    expect(
      await prisma.authSession.count({
        where: {
          companyId,
          membershipId: adminMembership.id,
          revokedAt: null,
        },
      }),
    ).toBe(1);
    await prisma.userRole.deleteMany({ where: { roleId: adminRole.id } });
    await prisma.role.delete({ where: { id: adminRole.id } });
    expect(
      await prisma.auditEvent.count({
        where: { companyId, resourceType: "role", resourceId: roleId, action: "role.deleted" },
      }),
    ).toBe(1);
  });
  it("deletes an unused account, but archives an account with history", async () => {
    const fresh = await service.createUser(companyId, actorId, {
      display_name: "Belum Dipakai",
      email: `unused-${randomUUID()}@example.invalid`,
      password: randomUUID() + randomUUID(),
      role_ids: [],
    });
    await expect(service.deleteUser(otherCompanyId, actorId, fresh.user_id)).rejects.toThrow(
      "tidak ditemukan",
    );
    await expect(service.deleteUser(companyId, fresh.user_id, fresh.user_id)).rejects.toThrow(
      "akun sendiri",
    );
    expect((await service.deleteUser(companyId, actorId, fresh.user_id)).deleted).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: fresh.user_id } })).toBeNull();

    const membershipId = await accessUserMembership();
    const result = await service.deleteUser(companyId, actorId, userId);
    expect(result.archived).toBe(true);
    expect(
      await prisma.companyMembership.findUniqueOrThrow({ where: { id: membershipId } }),
    ).toEqual(expect.objectContaining({ active: false, deletedAt: expect.any(Date) }));
    expect((await service.listUsers(companyId)).some((item) => item.user_id === userId)).toBe(
      false,
    );
    expect(await prisma.authSession.count({ where: { membershipId, revokedAt: null } })).toBe(0);
    await expect(accessUserDetail(companyId, userId)).rejects.toThrow("tidak ditemukan");
    expect(
      await prisma.auditEvent.count({
        where: { companyId, resourceType: "user", resourceId: userId, action: "user.archived" },
      }),
    ).toBe(1);
  });
  it("preserves the last active Admin Sistem", async () => {
    const adminRole = await service.createRole(companyId, actorId, {
      code: "ADMIN_SYSTEM",
      name: "Admin Sistem",
    });
    expect(await prisma.rolePermission.count({ where: { roleId: adminRole.id } })).toBe(0);
    const soleAdmin = await service.createUser(companyId, actorId, {
      display_name: "Satu Admin",
      email: `sole-admin-${randomUUID()}@example.invalid`,
      password: randomUUID() + randomUUID(),
      role_ids: [adminRole.id],
    });
    await expect(service.deleteUser(companyId, actorId, soleAdmin.user_id)).rejects.toThrow(
      "harus memiliki Admin Sistem aktif",
    );
    expect((await service.listUsers(companyId)).some((u) => u.user_id === soleAdmin.user_id)).toBe(
      true,
    );
  });
  it("does not expand an existing role when another role is created", async () => {
    const existing = await prisma.role.create({
      data: { companyId, code: "EXISTING_LIMITED", name: "Peran Lama Terbatas" },
    });
    const permission = await prisma.permission.findFirstOrThrow();
    await prisma.rolePermission.create({
      data: {
        companyId,
        roleId: existing.id,
        permissionId: permission.id,
        scopeType: "company",
      },
    });
    const created = await service.createRole(companyId, actorId, {
      code: "NEW_FULL_ROLE",
      name: "Peran Baru Penuh",
    });
    expect(await prisma.rolePermission.count({ where: { roleId: existing.id } })).toBe(1);
    expect(await prisma.rolePermission.count({ where: { roleId: created.id } })).toBe(
      await prisma.permission.count(),
    );
  });
  async function accessUserMembership() {
    return (
      await prisma.companyMembership.findUniqueOrThrow({
        where: { companyId_userId: { companyId, userId } },
      })
    ).id;
  }
});
