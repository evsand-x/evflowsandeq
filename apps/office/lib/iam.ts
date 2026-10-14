export type Permission = {
  id: string;
  code: string;
  resource: string;
  action: string;
  description: string | null;
};
export type Grant = {
  permission_id: string;
  code: string;
  scope_type: string;
  scope_id: string | null;
};
export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  member_count: number;
  permissions: Grant[];
};
export type User = {
  membership_id: string;
  user_id: string;
  email: string;
  display_name: string;
  active: boolean;
  last_active_at: string | null;
  roles: Pick<Role, "id" | "code" | "name">[];
  effective_permissions: Omit<Grant, "permission_id">[];
};

export const actionColumns = [
  ["read", "Lihat"],
  ["create", "Buat"],
  ["update", "Ubah Draft"],
  ["submit", "Ajukan"],
  ["approve", "Setujui/Tolak"],
  ["post", "Posting"],
  ["cancel", "Batalkan"],
  ["export", "Cetak/Ekspor"],
] as const;

export const actionLabels: Record<string, string> = {
  read: "Lihat",
  create: "Buat",
  update: "Ubah",
  submit: "Ajukan",
  approve: "Setujui/Tolak",
  post: "Posting",
  cancel: "Batalkan",
  export: "Cetak/Ekspor",
  assign: "Tugaskan",
  delete: "Hapus",
  activate: "Aktifkan",
  pick: "Picking",
  check: "Periksa",
  dispatch: "Kirim",
  confirm: "Konfirmasi",
  allocate: "Alokasikan",
  manage: "Kelola",
  decide: "Putuskan",
  request: "Minta persetujuan",
  reallocate: "Alokasi ulang",
  release: "Lepaskan",
  close_remainder: "Tutup sisa",
  issue: "Terbitkan",
  unmatch: "Lepas pencocokan",
  reopen: "Buka kembali",
  verify: "Verifikasi",
  reverse: "Balikkan",
  import: "Impor",
  match: "Cocokkan",
  review: "Tinjau",
  close: "Tutup",
};

const resourceLabels: Record<string, [string, string, boolean?]> = {
  company_profile: ["Setting", "Profil Perusahaan"],
  user: ["Setting", "Pengguna"],
  user_role: ["Setting", "Penugasan Peran"],
  role: ["Setting", "Peran"],
  role_permission: ["Setting", "Matriks Hak Akses"],
  permission: ["Setting", "Daftar Hak Akses"],
  operational_policy: ["Setting", "Kebijakan Operasional"],
  audit_event: ["Setting", "Audit"],
  master_data: ["Master Data", "Data Induk"],
  crm: ["Sales & Marketing", "CRM"],
  warehouse: ["Warehouse & Logistik", "Gudang"],
  finance: ["Finance", "Keuangan", true],
  hr: ["HRIS", "Sumber Daya Manusia", true],
  sales_order: ["Sales & Marketing", "Sales Order"],
  proforma: ["Sales & Marketing", "Proforma"],
  "sales_order.unlock": ["Sales & Marketing", "Unlock Sales Order"],
  price_request: ["Sales & Marketing", "Permintaan Harga Khusus"],
  "customer.payment_policy": ["Setting", "Kebijakan Pembayaran Pelanggan"],
  fulfillment: ["Warehouse & Logistik", "Pemenuhan Pesanan"],
  delivery_receipt: ["Warehouse & Logistik", "Bukti Serah Terima (POD)"],
  "inventory.quality": ["Warehouse & Logistik", "Kelayakan Stok"],
  purchase_request: ["Warehouse & Logistik", "Permintaan Pembelian"],
  sales_invoice: ["Finance", "Invoice Penjualan"],
  customer_receipt: ["Finance", "Penerimaan Pembayaran"],
  customer_refund: ["Finance", "Pengembalian Dana Pelanggan"],
  sales_tax_rule: ["Finance", "Aturan Pajak Penjualan"],
  tax_rule: ["Finance", "Aturan Pajak"],
  tax_component: ["Finance", "Komponen Pajak"],
  tax_correction: ["Finance", "Koreksi Pajak"],
  journal: ["Finance", "Jurnal"],
  "journal.reverse": ["Finance", "Persetujuan Pembalikan Jurnal"],
  bank_statement: ["Finance", "Rekening Koran"],
  bank_transaction: ["Finance", "Transaksi Bank"],
  bank_reconciliation: ["Finance", "Rekonsiliasi Bank"],
  posting_profile: ["Finance", "Profil Posting"],
  finance_period: ["Setting", "Periode & Closing"],
  numbering_rule: ["Setting", "Penomoran Dokumen"],
  transaction_approval: ["Setting", "Pengaturan Persetujuan"],
};
export function permissionPresentation(permission: Pick<Permission, "resource" | "code">) {
  return (
    resourceLabels[permission.resource] ?? ["Lainnya", permission.resource.replaceAll("_", " ")]
  );
}

export function effectivePermissions(roles: Role[], roleIds: string[]) {
  const codes = new Set<string>();
  for (const role of roles)
    if (roleIds.includes(role.id) && role.active)
      for (const grant of role.permissions) codes.add(grant.code);
  return [...codes].sort();
}

export function effectivePermissionSummary(roles: Role[], roleIds: string[]) {
  const summary = new Map<string, Set<string>>();
  for (const role of roles) {
    if (!roleIds.includes(role.id) || !role.active) continue;
    for (const grant of role.permissions) {
      const resource = grant.code.split(".")[0] ?? "";
      const module = resourceLabels[resource]?.[0] ?? "Lainnya";
      const item = resourceLabels[resource]?.[1] ?? resource.replaceAll("_", " ");
      const action = grant.code.split(".").slice(1).join(".");
      const scope = grant.scope_type === "company" ? "perusahaan" : grant.scope_type;
      const labels = summary.get(module) ?? new Set<string>();
      labels.add(`${item}: ${actionLabels[action] ?? action.replaceAll("_", " ")} (${scope})`);
      summary.set(module, labels);
    }
  }
  return [...summary].map(([module, labels]) => ({ module, labels: [...labels].sort() }));
}
