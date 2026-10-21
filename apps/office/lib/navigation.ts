import { isAccessAdministrator, type AuthPrincipal } from "@evflow/contracts";

export type DashboardView =
  | "executive"
  | "sales"
  | "warehouse"
  | "finance"
  | "hris"
  | "actions"
  | "reports";

export const dashboardViews: {
  id: DashboardView;
  label: string;
  permission: string;
  sourcePermission?: string;
}[] = [
  { id: "executive", label: "Ringkasan Eksekutif", permission: "dashboard_executive.read" },
  {
    id: "sales",
    label: "Sales",
    permission: "dashboard_sales.read",
    sourcePermission: "crm_prospect.read",
  },
  {
    id: "warehouse",
    label: "Warehouse & Logistik",
    permission: "dashboard_warehouse.read",
    sourcePermission: "warehouse.read",
  },
  {
    id: "finance",
    label: "Finance",
    permission: "dashboard_finance.read",
    sourcePermission: "finance.read",
  },
  { id: "hris", label: "HRIS", permission: "dashboard_hris.read", sourcePermission: "hr.read" },
  { id: "actions", label: "Tugas & Persetujuan", permission: "dashboard_actions.read" },
  { id: "reports", label: "Laporan & Ekspor", permission: "dashboard_reports.read" },
];

export const moduleNavigation = [
  {
    label: "Sales & Marketing",
    permission: "crm_prospect.read",
    items: [
      "CRM",
      "Aktivitas Sales",
      "Penawaran & Harga",
      "Sampel & Trial",
      "Pesanan Pelanggan",
      "Target & Estimasi",
    ],
  },
  {
    label: "Warehouse & Logistik",
    permission: "warehouse.read",
    items: ["Pengadaan", "Barang Masuk", "Barang Keluar", "Persediaan"],
  },
  {
    label: "Finance",
    permission: "finance.read",
    items: [
      "Piutang (AR)",
      "Kredit & TOP Pelanggan",
      "Utang (AP)",
      "Kas & Bank",
      "Akuntansi",
      "Pajak",
      "Closing",
      "Aset",
      "Anggaran",
      "Biaya & Klaim",
      "Laporan",
      "Daftar Arsip",
    ],
  },
  {
    label: "HRIS",
    permission: "hr.read",
    items: [
      "Karyawan & Kontrak",
      "Rekrutmen",
      "Onboarding",
      "Waktu & Kehadiran",
      "Payroll",
      "Perjalanan Dinas",
      "Resign & Offboarding",
      "Reimbursement Saya",
      "Laporan HRIS",
    ],
  },
  {
    label: "Master Data",
    permission: "master_customer.read",
    items: ["Produk", "Pelanggan", "Supplier", "Vendor", "Gudang", "Item Operasional"],
  },
  {
    label: "Setting",
    permission: "company_profile.read",
    items: [
      "Profil Perusahaan",
      "Pengguna",
      "Peran",
      "Kebijakan Operasional",
      "Kebijakan Pelanggan Baru",
      "Kredit & Exposure",
      "Pengaturan Persetujuan",
      "Template Cetak",
      "Penomoran Dokumen",
      "Daftar Referensi & Alasan",
      "Periode & Closing",
      "Impor/Ekspor & Arsip",
      "Audit",
    ],
  },
] as const;

export function hasCompanyPermission(principal: AuthPrincipal, code: string) {
  if (isAccessAdministrator(principal)) return true;
  if (/^(user|role|permission)\./.test(code) && !isAccessAdministrator(principal)) return false;
  return principal.permissions.some(
    (permission) =>
      permission.code === code &&
      ["company", "privileged"].includes(permission.scope_type) &&
      (!permission.scope_id || permission.scope_id === principal.company_id),
  );
}

export function visibleDashboardViews(principal: AuthPrincipal) {
  return dashboardViews.filter(
    (view) =>
      hasCompanyPermission(principal, view.permission) &&
      (!view.sourcePermission ||
        hasCompanyPermission(principal, view.sourcePermission) ||
        (view.id === "warehouse" && hasWarehouseDashboardPermission(principal))),
  );
}

export function hasWarehouseDashboardPermission(principal: AuthPrincipal) {
  return (
    hasCompanyPermission(principal, "warehouse.read") ||
    principal.permissions.some(
      (p) => p.code === "warehouse.read" && p.scope_type === "warehouse" && Boolean(p.scope_id),
    )
  );
}

export function visibleModules(principal: AuthPrincipal) {
  return moduleNavigation.filter((module) =>
    module.label === "Setting"
      ? [
          "company_profile.read",
          "user.read",
          "role.read",
          "operational_policy.read",
          "transaction_approval.manage",
          "customer.payment_policy.manage",
        ].some((code) => hasCompanyPermission(principal, code))
      : (module.label === "Sales & Marketing" &&
          [
            "crm_contact.read",
            "crm_opportunity.read",
            "crm_activity.read",
          ].some((code) => hasCompanyPermission(principal, code))) ||
        (module.label === "Master Data" &&
          [
            "master_product",
            "master_supplier",
            "master_vendor",
            "master_warehouse",
            "master_operational_item",
          ].some((resource) => hasCompanyPermission(principal, `${resource}.read`))) ||
        hasCompanyPermission(principal, module.permission) ||
        (module.label === "Sales & Marketing" &&
          (hasCompanyPermission(principal, "sales_order.read") ||
            ["proforma.read", "sales_backorder.read"].some((code) =>
              hasCompanyPermission(principal, code),
            ))) ||
        (module.label === "Warehouse & Logistik" &&
          [
            "outbound_picking.read",
            "outbound_checking.read",
            "outbound_shipping.read",
            "delivery_receipt.read",
            "warehouse_allocation.read",
          ].some((code) => hasCompanyPermission(principal, code))) ||
        (module.label === "Finance" && ["account.read", "sales_invoice.read", "tax_master.read", "tax_output.read", "tax_input.read"].some(code => hasCompanyPermission(principal, code))),
  );
}
