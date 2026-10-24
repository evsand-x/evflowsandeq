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
      "Termin, Ongkos Kirim & Kredit",
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

// Izin baca per submenu Master Data; tidak ada grant induk bersama (IAM-01/04).
export const masterDataPermissions: Record<string, string> = {
  Produk: "master_product",
  Pelanggan: "master_customer",
  Supplier: "master_supplier",
  Vendor: "master_vendor",
  Gudang: "master_warehouse",
  "Item Operasional": "master_operational_item",
};

// Route hanya untuk submenu yang layarnya sudah tersedia; submenu lain tidak tampil (CFG-10).
export const masterDataRoutes: Record<string, string> = {
  Produk: "/master-data/products",
  Pelanggan: "/master-data/customers",
  Supplier: "/master-data/suppliers",
  Vendor: "/master-data/vendors",
  Gudang: "/master-data/warehouses",
  "Item Operasional": "/master-data/operational-items",
};

// CFG-10: satu sumber menu yang berfungsi. Submenu tanpa route tidak tampil di navigasi.
export const menuRoutes: Record<string, Record<string, string>> = {
  "Sales & Marketing": { CRM: "/crm/prospects", "Pesanan Pelanggan": "/operations/orders" },
  "Warehouse & Logistik": {
    "Barang Keluar": "/operations/pick-slips",
    Persediaan: "/operations/controls",
  },
  Finance: {
    "Piutang (AR)": "/operations/invoices",
    "Kredit & TOP Pelanggan": "/operations/controls",
    "Kas & Bank": "/operations/reconciliation",
    Akuntansi: "/operations/accounts",
    Pajak: "/operations/tax-rules",
  },
  "Master Data": masterDataRoutes,
  Setting: {
    "Profil Perusahaan": "/setting/company",
    Pengguna: "/setting/users",
    Peran: "/setting/roles",
    "Kebijakan Operasional": "/setting/policies",
    "Termin, Ongkos Kirim & Kredit": "/setting/sales",
    "Pengaturan Persetujuan": "/operations/controls",
    "Penomoran Dokumen": "/setting/numbering",
  },
};

// Izin baca per submenu Setting; Pengguna/Peran tetap khusus Admin Sistem (IAM-04).
export const settingPermissions: Record<string, string> = {
  "Profil Perusahaan": "company_profile.read",
  Pengguna: "user.read",
  Peran: "role.read",
  "Kebijakan Operasional": "setting_general.read",
  "Termin, Ongkos Kirim & Kredit": "terms_credit.read",
  "Pengaturan Persetujuan": "transaction_approval.manage",
  "Penomoran Dokumen": "numbering_rule.read",
};

export function isMenuAvailable(module: string, item: string) {
  return Boolean(menuRoutes[module]?.[item]);
}

/** Submenus that work and that this principal may open, in navigation order. */
export function visibleMenuItems(principal: AuthPrincipal, module: string) {
  const items: readonly string[] = moduleNavigation.find((m) => m.label === module)?.items ?? [];
  return items
    .filter((item) => isMenuAvailable(module, item))
    .filter((item) =>
      module === "Setting"
        ? hasCompanyPermission(principal, settingPermissions[item]!)
        : module === "Master Data"
          ? hasCompanyPermission(principal, `${masterDataPermissions[item]}.read`)
          : true,
    )
    .map((label) => ({ label, href: menuRoutes[module]![label]! }));
}

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
  const working = moduleNavigation.filter((module) =>
    module.items.some((item) => isMenuAvailable(module.label, item)),
  );
  return working.filter((module) =>
    module.label === "Setting"
      ? visibleMenuItems(principal, "Setting").length > 0
      : (module.label === "Sales & Marketing" &&
          ["crm_contact.read", "crm_opportunity.read", "crm_activity.read"].some((code) =>
            hasCompanyPermission(principal, code),
          )) ||
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
        (module.label === "Finance" &&
          [
            "account.read",
            "sales_invoice.read",
            "tax_master.read",
            "tax_output.read",
            "tax_input.read",
          ].some((code) => hasCompanyPermission(principal, code))),
  );
}
