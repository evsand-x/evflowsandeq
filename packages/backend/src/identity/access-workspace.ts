import { NotFoundException } from "@nestjs/common";
import { prisma } from "@evflow/database";
import { z } from "zod";
export const accessListSchema = z
  .object({
    q: z.string().trim().max(150).default(""),
    status: z.enum(["all", "active", "inactive"]).default("all"),
    role: z.union([z.literal("all"), z.string().uuid()]).default("all"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
export async function accessHistory(companyId: string, kind: "user" | "role", id: string) {
  const exists =
    kind === "user"
      ? await prisma.companyMembership.findFirst({
          where: { companyId, userId: id, deletedAt: null },
          select: { id: true },
        })
      : await prisma.role.findFirst({ where: { companyId, id }, select: { id: true } });
  if (!exists) throw new NotFoundException("Data akses tidak ditemukan.");
  const events = await prisma.auditEvent.findMany({
    where: { companyId, resourceType: kind, resourceId: id },
    select: {
      id: true,
      occurredAt: true,
      action: true,
      reason: true,
      metadata: true,
      actor: { select: { displayName: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return events.map((e) => {
    const meta =
      e.metadata && typeof e.metadata === "object" && !Array.isArray(e.metadata) ? e.metadata : {};
    const changes = Array.isArray(meta.changes)
      ? meta.changes.flatMap((c) =>
          c &&
          typeof c === "object" &&
          !Array.isArray(c) &&
          typeof c.code === "string" &&
          typeof c.allowed === "boolean" &&
          typeof c.scope_type === "string"
            ? [{ code: c.code, allowed: c.allowed, scope_type: c.scope_type }]
            : [],
        )
      : [];
    return {
      id: e.id,
      occurred_at: e.occurredAt,
      action: e.action,
      reason: e.reason,
      actor: e.actor ? { display_name: e.actor.displayName } : null,
      changes,
      affected_members: typeof meta.affected_members === "number" ? meta.affected_members : null,
    };
  });
}
export async function accessUserDetail(companyId: string, userId: string) {
  const member = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: {
      id: true,
      deletedAt: true,
      createdAt: true,
      userRoles: { select: { roleId: true, assignedAt: true, assignedById: true } },
      sessions: {
        select: {
          id: true,
          deviceLabel: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
        },
        orderBy: { lastSeenAt: "desc" },
        take: 100,
      },
    },
  });
  if (!member || member.deletedAt) throw new NotFoundException("Pengguna tidak ditemukan.");
  const creator = await prisma.auditEvent.findFirst({
    where: { companyId, resourceId: userId, resourceType: "user", action: "user.created" },
    select: { actor: { select: { displayName: true } } },
    orderBy: { occurredAt: "asc" },
  });
  const actors = await prisma.user.findMany({
    where: {
      id: { in: member.userRoles.flatMap((a) => (a.assignedById ? [a.assignedById] : [])) },
    },
    select: { id: true, displayName: true },
  });
  const activeSessions = await prisma.authSession.count({
    where: { companyId, membershipId: member.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  return {
    created_at: member.createdAt,
    created_by: creator?.actor?.displayName ?? null,
    active_sessions: activeSessions,
    assignments: member.userRoles.map((a) => ({
      role_id: a.roleId,
      assigned_at: a.assignedAt,
      assigned_by: actors.find((u) => u.id === a.assignedById)?.displayName ?? null,
    })),
    sessions: member.sessions.map((s) => ({
      id: s.id,
      device_label: s.deviceLabel,
      created_at: s.createdAt,
      last_seen_at: s.lastSeenAt,
      expires_at: s.expiresAt,
      revoked_at: s.revokedAt,
    })),
  };
}
export async function accessRoleMembers(companyId: string, roleId: string) {
  if (!(await prisma.role.findFirst({ where: { companyId, id: roleId }, select: { id: true } })))
    throw new NotFoundException("Peran tidak ditemukan.");
  const rows = await prisma.userRole.findMany({
    where: { companyId, roleId, membership: { deletedAt: null } },
    select: {
      assignedAt: true,
      membership: {
        select: {
          active: true,
          user: { select: { id: true, displayName: true, email: true, active: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });
  return rows.map((r) => ({
    user_id: r.membership.user.id,
    display_name: r.membership.user.displayName,
    email: r.membership.user.email,
    active: r.membership.active && r.membership.user.active,
    assigned_at: r.assignedAt,
  }));
}
