import type { AuthPrincipal, DashboardSummary } from "@evflow/contracts";
import { prisma } from "@evflow/database";
import { Injectable } from "@nestjs/common";

const statuses = [
  ["NEW", "Baru"],
  ["IN_PROGRESS", "Dalam Pendekatan"],
  ["POTENTIAL", "Potensial"],
  ["DEFERRED", "Ditunda"],
  ["DROPPED", "Tidak Dilanjutkan"],
] as const;
const definitionVersion = "crm-prospect-institutions-v1";

@Injectable()
export class DashboardService {
  async summary(principal: AuthPrincipal): Promise<DashboardSummary> {
    const now = new Date();
    const canReadCrm = principal.permissions.some(
      (permission) =>
        permission.code === "crm.read" &&
        ["company", "privileged"].includes(permission.scope_type) &&
        (!permission.scope_id || permission.scope_id === principal.company_id),
    );
    if (!canReadCrm)
      return { company_id: principal.company_id, as_of: now.toISOString(), sales: null };

    const [groups, actions] = await prisma.$transaction(
      async (tx) => {
        const grouped = await tx.prospect.groupBy({
          by: ["approachStatus"],
          where: { companyId: principal.company_id },
          _count: { _all: true },
        });
        // Keep the personal queue narrower than company-wide CRM summary counts.
        const due = await tx.prospect.findMany({
          where: {
            companyId: principal.company_id,
            ownerId: principal.user_id,
            nextActionAt: { lte: now },
            nextAction: { not: null },
            approachStatus: { notIn: ["DEFERRED", "DROPPED"] },
          },
          select: {
            id: true,
            code: true,
            nextAction: true,
            nextActionAt: true,
            customer: { select: { name: true } },
          },
          orderBy: [{ nextActionAt: "asc" }, { id: "asc" }],
          take: 10,
        });
        return [grouped, due] as const;
      },
      { isolationLevel: "RepeatableRead" },
    );
    const counts = new Map(groups.map((group) => [group.approachStatus, group._count._all]));
    const timestamp = now.toISOString();
    // This read model is queried live; both timestamps describe the completed read.
    const updatedAt = timestamp;
    const metric = (code: string, label: string, value: number) => ({
      code,
      label,
      value,
      unit: "institusi" as const,
      definition_version: definitionVersion,
      data_as_of: timestamp,
      updated_at: updatedAt,
      freshness: "fresh" as const,
    });
    const metrics = [
      metric(
        "prospects_total",
        "Prospek",
        groups.reduce((sum, group) => sum + group._count._all, 0),
      ),
      ...statuses.map(([status, label]) =>
        metric(`prospects_${status.toLowerCase()}`, label, counts.get(status) ?? 0),
      ),
    ];
    return {
      company_id: principal.company_id,
      as_of: timestamp,
      sales: {
        metrics,
        actions: actions.map((item) => ({
          id: item.id,
          prospect_code: item.code,
          customer_name: item.customer.name,
          action: item.nextAction!,
          due_at: item.nextActionAt!.toISOString(),
        })),
      },
    };
  }
}
