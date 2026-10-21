import { ForbiddenException, SetMetadata } from "@nestjs/common";
import { isAccessAdministrator, type AuthPrincipal } from "@evflow/contracts";

export const RESOURCE_PERMISSION = "evflow.resource_permission";
export const resourcePermissions = {
  taxInvoices: { output: "tax_output", input: "tax_input" },
  outbound: {
    picking: "outbound_picking",
    checking: "outbound_checking",
    shipping: "outbound_shipping",
    pod: "delivery_receipt",
  },
  crm: {
    prospects: "crm_prospect",
    contacts: "crm_contact",
    customers: "crm_customer",
    opportunities: "crm_opportunity",
  },
  master: {
    products: "master_product",
    customers: "master_customer",
    suppliers: "master_supplier",
    vendors: "master_vendor",
    warehouses: "master_warehouse",
    locators: "master_locator",
    "operational-items": "master_operational_item",
    "product-categories": "master_product_category",
    uoms: "master_uom",
    "customer-channels": "master_customer_channel",
    rayons: "master_rayon",
  },
  related: {
    prospect: "crm_prospect",
    contact: "crm_contact",
    customer: "crm_customer",
    opportunity: "crm_opportunity",
    activity: "crm_activity",
  },
} as const;
export type ResourceRule = {
  family: keyof typeof resourcePermissions;
  action: string;
  source: "params" | "query" | "body";
  key: string;
};
export const RequireResourcePermission = (
  family: ResourceRule["family"],
  action: string,
  source: ResourceRule["source"] = "params",
  key = "resource",
) => SetMetadata(RESOURCE_PERMISSION, { family, action, source, key });
export function resourcePermissionCode(rule: ResourceRule, value: unknown) {
  const mapping = resourcePermissions[rule.family] as Record<string, string>;
  if (typeof value !== "string" || !Object.hasOwn(mapping, value))
    throw new ForbiddenException("Jenis sumber izin tidak tersedia.");
  return `${mapping[value]}.${rule.action}`;
}
export function hasResourcePermission(auth: AuthPrincipal, code: string) {
  return (
    isAccessAdministrator(auth) ||
    auth.permissions.some(
      (p) =>
        p.code === code &&
        ["company", "privileged"].includes(p.scope_type) &&
        (!p.scope_id || p.scope_id === auth.company_id),
    )
  );
}
export function requireRelatedPermissions(auth: AuthPrincipal, input: Record<string, unknown>) {
  for (const type of ["customer", "contact", "prospect", "opportunity"] as const) {
    if (
      input[`${type}_id`] &&
      !hasResourcePermission(auth, `${resourcePermissions.related[type]}.read`)
    )
      throw new ForbiddenException("Izin data terkait tidak mencukupi.");
  }
}
