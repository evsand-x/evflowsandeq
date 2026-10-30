import { isAccessAdministrator } from "@evflow/contracts";
import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../identity/auth.types";

type Auth = AuthenticatedRequest["auth"];
export type PolicyAction = "read" | "update";

// Setiap kelompok kebijakan dimiliki tepat satu submenu Setting; tidak ada grant bersama.
const GROUP_RESOURCE = {
  company: "setting_general",
  system: "setting_general",
  finance: "setting_general",
  warehouse: "setting_general",
  crm: "setting_general",
  visit: "setting_general",
  hr: "setting_general",
  sales: "terms_credit",
} as const;

export const POLICY_GROUPS = Object.keys(GROUP_RESOURCE);

export function policyPermission(group: string, action: PolicyAction): string {
  const resource = (GROUP_RESOURCE as Record<string, string | undefined>)[group];
  if (!resource) throw new Error(`Kelompok kebijakan tanpa izin submenu: ${group}`);
  return `${resource}.${action}`;
}

export function hasCompanyPermission(auth: Auth, code: string) {
  if (isAccessAdministrator(auth)) return true;
  return auth.permissions.some(
    (permission) =>
      permission.code === code &&
      ["company", "privileged"].includes(permission.scope_type) &&
      (!permission.scope_id || permission.scope_id === auth.company_id),
  );
}

export function assertPolicyPermission(auth: Auth, group: string, action: PolicyAction) {
  if (!hasCompanyPermission(auth, policyPermission(group, action))) {
    throw new ForbiddenException("Izin atau scope tidak mencukupi.");
  }
}

export function readablePolicyGroups(auth: Auth) {
  return POLICY_GROUPS.filter((group) => hasCompanyPermission(auth, policyPermission(group, "read")));
}
