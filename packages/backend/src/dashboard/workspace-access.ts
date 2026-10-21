import { isAccessAdministrator, type AuthPrincipal } from "@evflow/contracts";
import { ForbiddenException } from "@nestjs/common";

export function hasDomainAccess(principal: AuthPrincipal, code: string) {
  return (
    isAccessAdministrator(principal) ||
    principal.permissions.some(
      (p) =>
        p.code === code &&
        ["company", "privileged"].includes(p.scope_type) &&
        (!p.scope_id || p.scope_id === principal.company_id),
    )
  );
}

export type DashboardView =
  | "executive"
  | "sales"
  | "warehouse"
  | "finance"
  | "hris"
  | "actions"
  | "reports";

export function requireDashboardView(principal: AuthPrincipal, view: DashboardView) {
  if (!hasDomainAccess(principal, `dashboard_${view}.read`))
    throw new ForbiddenException("Izin tampilan Dashboard tidak mencukupi.");
}
