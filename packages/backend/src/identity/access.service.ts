import { prisma, type Prisma } from "@evflow/database";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../common/audit.service";
import { discountLimitText } from "../sales/discount-limit";
import { hashPassword } from "./password";

async function keepCompanyAdministrator(
  tx: Prisma.TransactionClient,
  companyId: string,
  membershipId: string,
  keepsAdministrator: boolean,
) {
  if (keepsAdministrator) return;
  await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
  const current = await tx.userRole.findFirst({
    where: { companyId, membershipId, role: { code: "ADMIN_SYSTEM", active: true } },
  });
  if (!current) return;
  const others = await tx.companyMembership.count({
    where: {
      companyId,
      id: { not: membershipId },
      active: true,
      deletedAt: null,
      user: { active: true },
      userRoles: { some: { role: { code: "ADMIN_SYSTEM", active: true } } },
    },
  });
  if (!others) throw new ConflictException("Perusahaan harus memiliki Admin Sistem aktif.");
}

async function revokeChangedRoleSessions(
  tx: Prisma.TransactionClient,
  companyId: string,
  membershipIds: string[],
  reason: string,
) {
  if (!membershipIds.length) return 0;
  const administrators = await tx.companyMembership.findMany({
    where: {
      companyId,
      id: { in: membershipIds },
      userRoles: { some: { role: { code: "ADMIN_SYSTEM", active: true } } },
    },
    select: { id: true },
  });
  const protectedIds = new Set(administrators.map((item) => item.id));
  const changedIds = membershipIds.filter((id) => !protectedIds.has(id));
  if (!changedIds.length) return 0;
  const result = await tx.authSession.updateMany({
    where: { companyId, membershipId: { in: changedIds }, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

@Injectable()
export class AccessService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async revokeSessions(companyId: string, actorId: string, userId: string) {
    const member = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { id: true, deletedAt: true },
    });
    if (!member || member.deletedAt) throw new NotFoundException("Pengguna tidak ditemukan.");
    return prisma.$transaction(async (tx) => {
      const result = await tx.authSession.updateMany({
        where: { companyId, membershipId: member.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "admin_force_revoke" },
      });
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: "user.sessions_revoked",
        resourceType: "user",
        resourceId: userId,
        after: { sessions_revoked: result.count },
      });
      return { sessions_revoked: result.count };
    });
  }

  async listUsers(companyId: string) {
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ user: { displayName: "asc" } }, { id: "asc" }],
      include: {
        user: { select: { id: true, email: true, displayName: true, active: true } },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
        sessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
      },
    });
    return memberships.map((membership) => {
      const effectivePermissions = new Map<
        string,
        { code: string; scope_type: string; scope_id: string | null }
      >();
      for (const assignment of membership.userRoles) {
        if (!assignment.role.active) continue;
        for (const grant of assignment.role.rolePermissions) {
          const key = `${grant.permission.code}:${grant.scopeType}:${grant.scopeId ?? ""}`;
          effectivePermissions.set(key, {
            code: grant.permission.code,
            scope_type: grant.scopeType,
            scope_id: grant.scopeId,
          });
        }
      }
      return {
        membership_id: membership.id,
        user_id: membership.user.id,
        email: membership.user.email,
        display_name: membership.user.displayName,
        active: membership.active && membership.user.active,
        discount_limit: discountLimitText(membership.discountLimit),
        last_active_at: membership.sessions[0]?.lastSeenAt.toISOString() ?? null,
        roles: membership.userRoles.map((item) => ({
          id: item.role.id,
          code: item.role.code,
          name: item.role.name,
        })),
        effective_permissions: [...effectivePermissions.values()],
      };
    });
  }

  async createUser(
    companyId: string,
    actorId: string,
    input: {
      email: string;
      display_name: string;
      password: string;
      role_ids: string[];
      active?: boolean;
    },
  ) {
    const email = input.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException("Email sudah terdaftar.");
    }
    const roles = await prisma.role.findMany({
      where: { companyId, id: { in: input.role_ids }, active: true },
    });
    if (roles.length !== new Set(input.role_ids).size) {
      throw new NotFoundException("Satu atau beberapa role tidak tersedia pada perusahaan ini.");
    }
    const passwordHash = await hashPassword(input.password);
    const created = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email,
          displayName: input.display_name,
          passwordHash,
        },
      });
      const membership = await transaction.companyMembership.create({
        data: { companyId, userId: user.id, active: input.active ?? true },
      });
      if (roles.length) {
        await transaction.userRole.createMany({
          data: roles.map((role) => ({
            companyId,
            membershipId: membership.id,
            roleId: role.id,
            assignedById: actorId,
          })),
        });
      }
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "user.created",
        resourceType: "user",
        resourceId: user.id,
        after: { email, display_name: input.display_name, role_ids: input.role_ids },
      });
      return { user, membership };
    });
    return {
      user_id: created.user.id,
      membership_id: created.membership.id,
      email: created.user.email,
      display_name: created.user.displayName,
      active: created.user.active && created.membership.active,
    };
  }

  async deleteUser(companyId: string, actorId: string, userId: string) {
    if (userId === actorId) throw new ConflictException("Anda tidak dapat menghapus akun sendiri.");
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
      const membership = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId } },
        include: { user: true, userRoles: { include: { role: true } } },
      });
      if (!membership || membership.deletedAt)
        throw new NotFoundException("Pengguna tidak ditemukan.");
      await keepCompanyAdministrator(tx, companyId, membership.id, false);
      const [sessions, actorEvents, resourceEvents, savedPolicies, otherMemberships] =
        await Promise.all([
          tx.authSession.count({ where: { membershipId: membership.id } }),
          tx.auditEvent.count({ where: { actorId: userId } }),
          tx.auditEvent.count({
            where: {
              companyId,
              resourceType: "user",
              resourceId: userId,
              action: { not: "user.created" },
            },
          }),
          tx.policyVersion.count({ where: { savedById: userId } }),
          tx.companyMembership.count({ where: { userId, id: { not: membership.id } } }),
        ]);
      const archive = !!(
        sessions ||
        actorEvents ||
        resourceEvents ||
        savedPolicies ||
        otherMemberships
      );
      const now = new Date();
      await tx.authSession.updateMany({
        where: { membershipId: membership.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: "user_deleted" },
      });
      await tx.userRole.deleteMany({ where: { membershipId: membership.id } });
      if (archive) {
        await tx.companyMembership.update({
          where: { id: membership.id },
          data: { active: false, deletedAt: now },
        });
      } else {
        await tx.companyMembership.delete({ where: { id: membership.id } });
        await tx.user.delete({ where: { id: userId } });
      }
      await this.audit.recordWith(tx, {
        companyId,
        actorId,
        action: archive ? "user.archived" : "user.deleted",
        resourceType: "user",
        resourceId: userId,
        before: {
          email: membership.user.email,
          display_name: membership.user.displayName,
          role_ids: membership.userRoles.map((assignment) => assignment.roleId),
        },
        after: { archived: archive, sessions_revoked: sessions },
      });
      return { user_id: userId, archived: archive, deleted: !archive };
    });
  }

  async assignRoles(companyId: string, actorId: string, userId: string, roleIds: string[]) {
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: { userRoles: true },
    });
    if (!membership || membership.deletedAt)
      throw new NotFoundException("Pengguna tidak ditemukan.");
    if (userId === actorId && roleIds.length === 0)
      throw new ConflictException("Anda tidak dapat mengosongkan peran akun sendiri.");
    const roles = await prisma.role.findMany({
      where: {
        companyId,
        id: { in: roleIds },
        OR: [{ active: true }, { id: { in: membership.userRoles.map((a) => a.roleId) } }],
      },
    });
    if (roles.length !== new Set(roleIds).size) throw new NotFoundException("Role tidak valid.");
    const before = membership.userRoles.map((item) => item.roleId).sort();
    await prisma.$transaction(async (transaction) => {
      await keepCompanyAdministrator(
        transaction,
        companyId,
        membership.id,
        roles.some((role) => role.code === "ADMIN_SYSTEM"),
      );
      await transaction.userRole.deleteMany({
        where: { membershipId: membership.id, roleId: { notIn: roles.map((r) => r.id) } },
      });
      if (roles.length) {
        await transaction.userRole.createMany({
          data: roles
            .filter((role) => !membership.userRoles.some((a) => a.roleId === role.id))
            .map((role) => ({
              companyId,
              membershipId: membership.id,
              roleId: role.id,
              assignedById: actorId,
            })),
        });
      }
      await transaction.authSession.updateMany({
        where: { membershipId: membership.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "role_assignment_changed" },
      });
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "user.roles_changed",
        resourceType: "user",
        resourceId: userId,
        before,
        after: roleIds.slice().sort(),
      });
    });
    return { user_id: userId, role_ids: roleIds, sessions_revoked: true };
  }

  async updateUser(
    companyId: string,
    actorId: string,
    userId: string,
    input: { display_name: string; email: string; active: boolean; role_ids: string[] },
  ) {
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: { user: true, userRoles: true },
    });
    if (!membership || membership.deletedAt)
      throw new NotFoundException("Pengguna tidak ditemukan.");
    if (userId === actorId && (!input.active || input.role_ids.length === 0))
      throw new ConflictException(
        "Anda tidak dapat menonaktifkan atau mengosongkan peran akun sendiri.",
      );
    const email = input.email.toLowerCase();
    const duplicate = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
    if (duplicate) throw new ConflictException("Email sudah terdaftar.");
    const roles = await prisma.role.findMany({
      where: {
        companyId,
        id: { in: input.role_ids },
        OR: [{ active: true }, { id: { in: membership.userRoles.map((a) => a.roleId) } }],
      },
    });
    if (roles.length !== new Set(input.role_ids).size)
      throw new NotFoundException("Role tidak valid.");
    const before = {
      display_name: membership.user.displayName,
      email: membership.user.email,
      active: membership.user.active && membership.active,
      role_ids: membership.userRoles.map((item) => item.roleId).sort(),
    };
    await prisma.$transaction(async (transaction) => {
      await keepCompanyAdministrator(
        transaction,
        companyId,
        membership.id,
        input.active && roles.some((role) => role.code === "ADMIN_SYSTEM"),
      );
      await transaction.user.update({
        where: { id: userId },
        data: { displayName: input.display_name, email },
      });
      await transaction.companyMembership.update({
        where: { id: membership.id },
        data: { active: input.active },
      });
      await transaction.userRole.deleteMany({
        where: { membershipId: membership.id, roleId: { notIn: roles.map((r) => r.id) } },
      });
      if (roles.length)
        await transaction.userRole.createMany({
          data: roles
            .filter((role) => !membership.userRoles.some((a) => a.roleId === role.id))
            .map((role) => ({
              companyId,
              membershipId: membership.id,
              roleId: role.id,
              assignedById: actorId,
            })),
        });
      await transaction.authSession.updateMany({
        where: { membershipId: membership.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "user_access_changed" },
      });
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "user.updated",
        resourceType: "user",
        resourceId: userId,
        before,
        after: input,
      });
    });
    return { user_id: userId, sessions_revoked: true };
  }

  async listRoles(companyId: string) {
    const roles = await prisma.role.findMany({
      where: { companyId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });
    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      active: role.active,
      discount_limit: discountLimitText(role.discountLimit),
      member_count: role._count.userRoles,
      permissions: role.rolePermissions.map((grant) => ({
        permission_id: grant.permissionId,
        code: grant.permission.code,
        scope_type: grant.scopeType,
        scope_id: grant.scopeId,
      })),
    }));
  }

  async createRole(
    companyId: string,
    actorId: string,
    input: {
      code: string;
      name: string;
      description?: string | undefined;
      active?: boolean | undefined;
    },
  ) {
    const existing = await prisma.role.findFirst({ where: { companyId, code: input.code } });
    if (existing) throw new ConflictException("Kode peran sudah digunakan.");
    const role = await prisma.$transaction(async (transaction) => {
      const created = await transaction.role.create({
        data: {
          companyId,
          code: input.code,
          active: input.active ?? true,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
        },
      });
      let initialPermissionCount = 0;
      if (created.code !== "ADMIN_SYSTEM") {
        const catalog = await transaction.permission.findMany({ select: { id: true } });
        initialPermissionCount = catalog.length;
        if (catalog.length)
          await transaction.rolePermission.createMany({
            data: catalog.map((permission) => ({
              companyId,
              roleId: created.id,
              permissionId: permission.id,
              scopeType: "company",
            })),
          });
      }
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "role.created",
        resourceType: "role",
        resourceId: created.id,
        after: { ...created, initial_permission_count: initialPermissionCount },
      });
      return created;
    });
    return role;
  }

  async updateRole(
    companyId: string,
    actorId: string,
    roleId: string,
    input: { name: string; description?: string | undefined; active?: boolean | undefined },
  ) {
    const role = await prisma.role.findFirst({ where: { companyId, id: roleId } });
    if (!role) throw new NotFoundException("Peran tidak ditemukan.");
    if (role.code === "ADMIN_SYSTEM" && input.active === false)
      throw new ConflictException("Peran Admin Sistem tidak dapat dinonaktifkan.");
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.role.update({
        where: { id: roleId },
        data: {
          name: input.name,
          description: input.description ?? null,
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      if (input.active !== undefined && input.active !== role.active) {
        const members = await transaction.userRole.findMany({
          where: { companyId, roleId },
          select: { membershipId: true },
        });
        await revokeChangedRoleSessions(
          transaction,
          companyId,
          members.map((m) => m.membershipId),
          "role_status_changed",
        );
      }
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "role.updated",
        resourceType: "role",
        resourceId: roleId,
        before: role,
        after: result,
      });
      return result;
    });
    return updated;
  }

  async deleteRole(companyId: string, actorId: string, roleId: string) {
    const role = await prisma.role.findFirst({
      where: { companyId, id: roleId },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!role) throw new NotFoundException("Peran tidak ditemukan.");
    if (role.code === "ADMIN_SYSTEM")
      throw new ConflictException("Peran Admin Sistem tidak dapat dihapus.");
    await prisma.$transaction(async (transaction) => {
      const assignments = await transaction.userRole.findMany({
        where: { companyId, roleId },
        select: { membershipId: true },
      });
      const membershipIds = assignments.map((item) => item.membershipId);
      let revokedSessions = 0;
      if (membershipIds.length) {
        revokedSessions = await revokeChangedRoleSessions(
          transaction,
          companyId,
          membershipIds,
          "role_deleted",
        );
        await transaction.userRole.deleteMany({ where: { companyId, roleId } });
      }
      await transaction.rolePermission.deleteMany({ where: { roleId } });
      await transaction.role.delete({ where: { id: roleId } });
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "role.deleted",
        resourceType: "role",
        resourceId: roleId,
        before: role,
        after: { affected_members: membershipIds.length, sessions_revoked: revokedSessions },
      });
    });
    return { role_id: roleId, deleted: true, affected_members: role._count.userRoles };
  }

  async listPermissions() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });
    return permissions.map(({ id, code, resource, action, description }) => ({
      id,
      code,
      resource,
      action,
      description,
    }));
  }

  async updateRolePermissions(
    companyId: string,
    actorId: string,
    roleId: string,
    grants: Array<{
      permission_id: string;
      scope_type: string;
      scope_id?: string | null | undefined;
    }>,
    expected?: Array<{
      permission_id: string;
      scope_type: string;
      scope_id?: string | null | undefined;
    }>,
  ) {
    const key = (g: { permissionId: string; scopeType: string; scopeId: string | null }) =>
      `${g.permissionId}:${g.scopeType}:${g.scopeId ?? ""}`;
    const normalized = grants.map((g) => ({
      companyId,
      roleId,
      permissionId: g.permission_id,
      scopeType: g.scope_type,
      scopeId: g.scope_id ?? null,
    }));
    if (new Set(normalized.map(key)).size !== normalized.length)
      throw new ConflictException("Grant permission duplikat.");
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM roles WHERE id=${roleId}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;
      const role = await transaction.role.findFirst({
        where: { id: roleId, companyId },
        include: { rolePermissions: true },
      });
      if (!role) throw new NotFoundException("Role tidak ditemukan.");
      if (role.code === "ADMIN_SYSTEM")
        throw new ConflictException(
          "Hak Admin Sistem melekat pada peran dan tidak dapat dibatasi.",
        );
      if (expected) {
        const expectedKeys = expected
          .map((g) => `${g.permission_id}:${g.scope_type}:${g.scope_id ?? ""}`)
          .sort();
        if (JSON.stringify(expectedKeys) !== JSON.stringify(role.rolePermissions.map(key).sort()))
          throw new ConflictException("Hak akses telah berubah. Muat ulang sebelum menyimpan.");
      }
      const permissionIds = [
        ...new Set([...normalized, ...role.rolePermissions].map((g) => g.permissionId)),
      ];
      const catalog = await transaction.permission.findMany({
        where: { id: { in: permissionIds } },
        select: { id: true, code: true },
      });
      if (normalized.some((g) => !catalog.some((p) => p.id === g.permissionId)))
        throw new NotFoundException("Permission tidak valid.");
      const previous = new Set(role.rolePermissions.map(key)),
        next = new Set(normalized.map(key));
      const changes = [
        ...normalized
          .filter((g) => !previous.has(key(g)))
          .map((g) => ({
            code: catalog.find((p) => p.id === g.permissionId)!.code,
            scope_type: g.scopeType,
            allowed: true,
          })),
        ...role.rolePermissions
          .filter((g) => !next.has(key(g)))
          .map((g) => ({
            code: catalog.find((p) => p.id === g.permissionId)?.code ?? g.permissionId,
            scope_type: g.scopeType,
            allowed: false,
          })),
      ];
      if (!changes.length)
        return { role_id: roleId, permissions: normalized, sessions_revoked: false };
      await transaction.rolePermission.deleteMany({ where: { roleId } });
      if (normalized.length) await transaction.rolePermission.createMany({ data: normalized });
      const affected = await transaction.userRole.findMany({
        where: { companyId, roleId },
        select: { membershipId: true },
      });
      const revokedSessions = await revokeChangedRoleSessions(
        transaction,
        companyId,
        affected.map((m) => m.membershipId),
        "role_permissions_changed",
      );
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "role.permissions_changed",
        resourceType: "role",
        resourceId: roleId,
        before: role.rolePermissions,
        after: normalized,
        metadata: { changes, affected_members: affected.length, sessions_revoked: revokedSessions },
      });
      return { role_id: roleId, permissions: normalized, sessions_revoked: revokedSessions > 0 };
    });
  }
}
