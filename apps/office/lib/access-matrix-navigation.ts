import type { Permission } from "./iam";
import { dashboardViews } from "./navigation";

type Entry = { path: string; resource?: string };
const entry = (path: string, resource?: string): Entry => ({
  path,
  ...(resource ? { resource } : {}),
});

// The matrix follows the Office menu. A blank resource means that the menu
// does not yet have an independently enforceable backend permission.
const navigation: Entry[] = [
  ...dashboardViews.map((view) => entry(`Dashboard › ${view.label}`, `dashboard_${view.id}`)),
  entry("Sales & Marketing › CRM › Prospek", "crm_prospect"),
  entry("Sales & Marketing › CRM › Prospek › Institusi terkait", "crm_customer"),
  entry("Sales & Marketing › CRM › Peluang", "crm_opportunity"),
  entry("Sales & Marketing › CRM › Kontak", "crm_contact"),
  entry("Sales & Marketing › Aktivitas Sales", "crm_activity"),
  entry("Sales & Marketing › Penawaran & Harga › Penawaran", "crm_quote"),
  entry("Sales & Marketing › Pesanan Pelanggan › PO/SP Pelanggan", "crm_customer_order"),
  entry("Sales & Marketing › Penawaran & Harga", "price_request"),
  entry("Sales & Marketing › Sampel & Trial"),
  entry("Sales & Marketing › Pesanan Pelanggan › Sales Order", "sales_order"),
  entry("Sales & Marketing › Pesanan Pelanggan › Pengajuan Unlock", "sales_order.unlock"),
  entry("Sales & Marketing › Pesanan Pelanggan › Proforma", "proforma"),
  entry("Sales & Marketing › Pesanan Pelanggan › Backorder & Sisa Pesanan", "sales_backorder"),
  entry("Sales & Marketing › Target & Estimasi"),
  entry("Warehouse & Logistik › Pengadaan", "purchase_request"),
  entry("Warehouse & Logistik › Barang Masuk"),
  entry("Warehouse & Logistik › Barang Keluar › Backorder & Alokasi Stok", "warehouse_allocation"),
  entry("Warehouse & Logistik › Barang Keluar › Pick Slip", "outbound_picking"),
  entry("Warehouse & Logistik › Barang Keluar › Checking / Packing", "outbound_checking"),
  entry("Warehouse & Logistik › Barang Keluar › Pengiriman", "outbound_shipping"),
  entry("Warehouse & Logistik › Barang Keluar › POD", "delivery_receipt"),
  entry("Warehouse & Logistik › Barang Keluar › Retur", "customer_return"),
  entry("Warehouse & Logistik › Persediaan", "warehouse"),
  entry("Warehouse & Logistik › Persediaan › Kelayakan Stok", "inventory.quality"),
  entry("Finance › Piutang (AR) › Invoice", "sales_invoice"),
  entry("Finance › Piutang (AR) › Penerimaan Pembayaran", "customer_receipt"),
  entry("Finance › Piutang (AR) › Pengembalian Dana", "customer_refund"),
  entry("Finance › Kredit & TOP Pelanggan"),
  entry("Finance › Utang (AP)"),
  entry("Finance › Kas & Bank › Rekening Koran", "bank_statement"),
  entry("Finance › Kas & Bank › Mutasi", "bank_transaction"),
  entry("Finance › Kas & Bank › Rekonsiliasi", "bank_reconciliation"),
  entry("Finance › Akuntansi › Akun", "account"),
  entry("Finance › Akuntansi › Jurnal", "journal"),
  entry("Finance › Akuntansi › Pembalikan Jurnal", "journal.reverse"),
  entry("Finance › Akuntansi › Pengaturan Jurnal Otomatis", "posting_profile"),
  entry("Finance › Pajak › Daftar & Aturan Pajak", "tax_master"),
  entry("Finance › Pajak › Faktur Keluaran", "tax_output"),
  entry("Finance › Pajak › Faktur Masukan", "tax_input"),
  ...["Closing", "Aset", "Anggaran", "Biaya & Klaim", "Laporan", "Daftar Arsip"].map((label) =>
    entry(`Finance › ${label}`),
  ),
  entry("HRIS › Karyawan & Kontrak", "hr"),
  ...[
    "Rekrutmen",
    "Onboarding",
    "Waktu & Kehadiran",
    "Payroll",
    "Perjalanan Dinas",
    "Resign & Offboarding",
    "Reimbursement Saya",
    "Laporan HRIS",
  ].map((label) => entry(`HRIS › ${label}`)),
  ...Object.entries({
    Produk: "master_product",
    Pelanggan: "master_customer",
    Supplier: "master_supplier",
    Vendor: "master_vendor",
    Gudang: "master_warehouse",
    "Item Operasional": "master_operational_item",
  }).map(([label, resource]) => entry(`Master Data › ${label}`, resource)),
  entry("Master Data › Pelanggan › Kredit & Termin", "customer_credit"),
  entry("Master Data › Gudang › Lokator", "master_locator"),
  ...Object.entries({
    "Kategori Produk": "master_product_category",
    Satuan: "master_uom",
    "Channel Pelanggan": "master_customer_channel",
    Rayon: "master_rayon",
  }).map(([label, resource]) => entry(`Setting › Daftar Referensi & Alasan › ${label}`, resource)),
  entry("Setting › Profil Perusahaan", "company_profile"),
  entry("Setting › Pengguna", "user"),
  entry("Setting › Pengguna › Penugasan Peran", "user_role"),
  entry("Setting › Peran", "role"),
  entry("Setting › Peran › Matriks Hak Akses", "role_permission"),
  entry("Setting › Peran › Katalog Izin", "permission"),
  entry("Setting › Kebijakan Umum", "setting_general"),
  entry("Setting › Termin & Kredit", "terms_credit"),
  entry("Setting › Kebijakan Pelanggan Baru", "customer.payment_policy"),
  entry("Setting › Kredit & Exposure"),
  entry("Setting › Pengaturan Persetujuan", "transaction_approval"),
  entry("Setting › Template Cetak"),
  entry("Setting › Penomoran Dokumen", "numbering_rule"),
  entry("Setting › Pajak", "tax_setting"),
  entry("Setting › Jenis Potongan", "deduction_type"),
  entry("Setting › Daftar Referensi & Alasan"),
  entry("Setting › Periode & Closing", "finance_period"),
  entry("Setting › Impor/Ekspor & Arsip"),
  entry("Setting › Audit", "audit_event"),
];

export type NavigationMatrixRow = {
  path: string;
  resource: string;
  items: Permission[];
};

/** Missing catalog entries are not evidence that an action is inapplicable. */
export function missingMatrixActionLabel(row: NavigationMatrixRow, action: string) {
  const readOnly =
    row.resource.startsWith("dashboard_") || ["audit_event", "permission"].includes(row.resource);
  if (
    readOnly &&
    ["create", "update", "delete", "submit", "approve", "post", "cancel"].includes(action)
  )
    return "Tidak berlaku";
  return "Belum tersedia";
}

export type MatrixTreeRow = NavigationMatrixRow & {
  label: string;
  depth: number;
  children: MatrixTreeRow[];
};

export function matrixSubtreePermissions(row: MatrixTreeRow): Permission[] {
  return [...row.items, ...row.children.flatMap(matrixSubtreePermissions)];
}

export function matrixSelectionState(
  items: Permission[],
  checked: (p: Permission) => boolean,
): boolean | "indeterminate" {
  const count = items.filter(checked).length;
  return count === 0 ? false : count === items.length ? true : "indeterminate";
}

/** Materialize missing menu parents while keeping each grant on its original row. */
export function matrixTree(rows: NavigationMatrixRow[]): MatrixTreeRow[] {
  const roots: MatrixTreeRow[] = [];
  const nodes = new Map<string, MatrixTreeRow>();
  for (const row of rows) {
    const segments = row.path.split(" › ");
    let siblings = roots;
    segments.forEach((label, depth) => {
      const path = segments.slice(0, depth + 1).join(" › ");
      let node = nodes.get(path);
      if (!node) {
        node = { path, resource: path, items: [], label, depth, children: [] };
        nodes.set(path, node);
        siblings.push(node);
      }
      if (depth === segments.length - 1) Object.assign(node, row);
      siblings = node.children;
    });
  }
  return roots;
}

export function visibleMatrixTree(
  tree: MatrixTreeRow[],
  expanded: Record<string, boolean>,
  matches?: (row: MatrixTreeRow) => boolean,
): MatrixTreeRow[] {
  const relevant = (row: MatrixTreeRow): boolean =>
    !matches || matches(row) || row.children.some(relevant);
  return tree.flatMap((row) =>
    relevant(row)
      ? [
          row,
          ...((expanded[row.path] ?? !!matches)
            ? visibleMatrixTree(row.children, expanded, matches)
            : []),
        ]
      : [],
  );
}

/** Match sidebar accordion behavior: only one sibling branch remains open. */
export function toggleMatrixBranch(
  expanded: Record<string, boolean>,
  path: string,
  currentlyOpen: boolean,
) {
  const parent = path.split(" › ").slice(0, -1).join(" › ");
  const next = { ...expanded };
  for (const key of Object.keys(next)) {
    const sibling = key
      .split(" › ")
      .slice(0, parent ? parent.split(" › ").length + 1 : 1)
      .join(" › ");
    if (sibling !== path && sibling.split(" › ").slice(0, -1).join(" › ") === parent)
      next[key] = false;
    if (key.startsWith(`${path} › `) && currentlyOpen) next[key] = false;
  }
  next[path] = !currentlyOpen;
  return next;
}

export function matrixPermissionChecked(
  adminRole: boolean,
  permissionId: string,
  grants: { permission_id: string; scope_type: string; scope_id: string | null }[],
  draft: Record<string, boolean>,
) {
  return (
    adminRole ||
    (draft[permissionId] ??
      grants.some(
        (grant) =>
          grant.permission_id === permissionId && grant.scope_type === "company" && !grant.scope_id,
      ))
  );
}

export function navigationMatrixRows(permissions: Permission[]): NavigationMatrixRow[] {
  const byResource = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const items = byResource.get(permission.resource) ?? [];
    items.push(permission);
    byResource.set(permission.resource, items);
  }
  const mapped = new Set(navigation.flatMap(({ resource }) => (resource ? [resource] : [])));
  // CFG-10: menus without a backend capability are not built yet and get no matrix row.
  const rows = navigation
    .filter(({ resource }) => resource)
    .map(({ path, resource }) => ({
      path,
      resource: resource ?? path,
      items: resource ? (byResource.get(resource) ?? []) : [],
    }));
  for (const [resource, items] of byResource)
    if (!mapped.has(resource))
      rows.push({ path: `Fitur lain › ${resource.replaceAll("_", " ")}`, resource, items });
  return rows;
}
