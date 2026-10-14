import type { AuthPrincipal } from "@evflow/contracts";

export function hasDomainAccess(principal: AuthPrincipal, code: string) {
  return principal.permissions.some(
    (p) =>
      p.code === code &&
      ["company", "privileged"].includes(p.scope_type) &&
      (!p.scope_id || p.scope_id === principal.company_id),
  );
}
