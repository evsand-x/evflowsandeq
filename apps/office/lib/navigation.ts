import { isAccessAdministrator, type AuthPrincipal } from "@evflow/contracts";

export type DashboardView =
  | "executive"
  | "sales"
  | "warehouse"
  | "finance"
  | "hris"
  | "actions"
  | "reports";

export const dashboardViews: { id: DashboardView; label: string; permission?: string }[] = [
  { id: "executive", label: "Ringkasan Eksekutif" },
  { id: "sales", label: "Sales", permission: "crm.read" },
  { id: "warehouse", label: "Warehouse & Logistik", permission: "warehouse.read" },
  { id: "finance", label: "Finance", permission: "finance.read" },
  { id: "hris", label: "HRIS", permission: "hr.read" },
  { id: "actions", label: "Tugas & Persetujuan" },
  { id: "reports", label: "Laporan & Ekspor" },
];

export const moduleNavigation = [
  {
    label: "Sales & Marketing",
    permission: "crm.read",
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
    permission: "master_data.read",
    items: [
      "Produk",
      "Pelanggan",
      "Supplier",
      "Vendor",
      "Gudang",
      "Item Operasional",
      "Referensi Reusable",
      "Ringkasan Lintas Domain",
    ],
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
      !view.permission ||
      hasCompanyPermission(principal, view.permission) ||
      (view.id === "warehouse" && hasWarehouseDashboardPermission(principal)),
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
      : hasCompanyPermission(principal, module.permission) ||
        (module.label === "Sales & Marketing" &&
          (hasCompanyPermission(principal, "sales_order.read") ||
            hasCompanyPermission(principal, "proforma.issue"))) ||
        (module.label === "Warehouse & Logistik" &&
          hasCompanyPermission(principal, "fulfillment.read")) ||
        (module.label === "Finance" && hasCompanyPermission(principal, "sales_invoice.read")),
  );
}
