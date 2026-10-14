import { prisma } from "@evflow/database";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../common/audit.service";
import { hashPassword } from "./password";

@Injectable()
export class AccessService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async listUsers(companyId: string) {
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId },
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
    input: { email: string; display_name: string; password: string; role_ids: string[] },
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
        data: { companyId, userId: user.id },
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
      active: created.user.active,
    };
  }

  async assignRoles(companyId: string, actorId: string, userId: string, roleIds: string[]) {
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: { userRoles: true },
    });
    if (!membership) throw new NotFoundException("Pengguna tidak ditemukan.");
    if (userId === actorId && roleIds.length === 0)
      throw new ConflictException("Anda tidak dapat mengosongkan peran akun sendiri.");
    const roles = await prisma.role.findMany({
      where: { companyId, id: { in: roleIds }, active: true },
    });
    if (roles.length !== new Set(roleIds).size) throw new NotFoundException("Role tidak valid.");
    const before = membership.userRoles.map((item) => item.roleId).sort();
    await prisma.$transaction(async (transaction) => {
      await transaction.userRole.deleteMany({ where: { membershipId: membership.id } });
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
    if (!membership) throw new NotFoundException("Pengguna tidak ditemukan.");
    if (userId === actorId && (!input.active || input.role_ids.length === 0))
      throw new ConflictException(
        "Anda tidak dapat menonaktifkan atau mengosongkan peran akun sendiri.",
      );
    const email = input.email.toLowerCase();
    const duplicate = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
    if (duplicate) throw new ConflictException("Email sudah terdaftar.");
    const roles = await prisma.role.findMany({
      where: { companyId, id: { in: input.role_ids }, active: true },
    });
    if (roles.length !== new Set(input.role_ids).size)
      throw new NotFoundException("Role tidak valid.");
    const before = {
      display_name: membership.user.displayName,
      email: membership.user.email,
      active: membership.user.active,
      role_ids: membership.userRoles.map((item) => item.roleId).sort(),
    };
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: userId },
        data: { displayName: input.display_name, email, active: input.active },
      });
      await transaction.userRole.deleteMany({ where: { membershipId: membership.id } });
      if (roles.length)
        await transaction.userRole.createMany({
          data: roles.map((role) => ({
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
    input: { code: string; name: string; description?: string | undefined },
  ) {
    const existing = await prisma.role.findFirst({ where: { companyId, code: input.code } });
    if (existing) throw new ConflictException("Kode peran sudah digunakan.");
    const role = await prisma.$transaction(async (transaction) => {
      const created = await transaction.role.create({
        data: {
          companyId,
          code: input.code,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
        },
      });
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "role.created",
        resourceType: "role",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
    return role;
  }

  async updateRole(
    companyId: string,
    actorId: string,
    roleId: string,
    input: { name: string; description?: string | undefined },
  ) {
    const role = await prisma.role.findFirst({ where: { companyId, id: roleId } });
    if (!role) throw new NotFoundException("Peran tidak ditemukan.");
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.role.update({
        where: { id: roleId },
        data: { name: input.name, description: input.description ?? null },
      });
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
    if (role._count.userRoles > 0)
      throw new ConflictException("Peran masih digunakan oleh pengguna.");
    await prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({ where: { roleId } });
      await transaction.role.delete({ where: { id: roleId } });
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "role.deleted",
        resourceType: "role",
        resourceId: roleId,
        before: role,
      });
    });
    return { role_id: roleId, deleted: true };
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
  ) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, companyId },
      include: { rolePermissions: true },
    });
    if (!role) throw new NotFoundException("Role tidak ditemukan.");
    const permissionIds = [...new Set(grants.map((grant) => grant.permission_id))];
    const permissionCount = await prisma.permission.count({ where: { id: { in: permissionIds } } });
    if (permissionCount !== permissionIds.length)
      throw new NotFoundException("Permission tidak valid.");
    const normalized = grants.map((grant) => ({
      companyId,
      roleId,
      permissionId: grant.permission_id,
      scopeType: grant.scope_type,
      scopeId: grant.scope_id ?? null,
    }));
    const uniqueKeys = new Set(
      normalized.map((grant) => `${grant.permissionId}:${grant.scopeType}:${grant.scopeId ?? ""}`),
    );
    if (uniqueKeys.size !== normalized.length)
      throw new ConflictException("Grant permission duplikat.");
    await prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({ where: { roleId } });
      if (normalized.length) await transaction.rolePermission.createMany({ data: normalized });
      const affected = await transaction.userRole.findMany({
        where: { roleId },
        select: { membershipId: true },
      });
      await transaction.authSession.updateMany({
        where: {
          membershipId: { in: affected.map((item) => item.membershipId) },
          revokedAt: null,
        },
        data: { revokedAt: new Date(), revokedReason: "role_permissions_changed" },
      });
      await this.audit.recordWith(transaction, {
        companyId,
        actorId,
        action: "role.permissions_changed",
        resourceType: "role",
        resourceId: roleId,
        before: role.rolePermissions,
        after: normalized,
      });
    });
    return { role_id: roleId, permissions: normalized, sessions_revoked: true };
  }
}
