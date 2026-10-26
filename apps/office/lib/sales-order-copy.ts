const lineLabels: Record<string, string> = {
  CLOSED: "Ditutup",
  DONE: "Selesai",
  IN_DELIVERY: "Dalam perjalanan",
  READY: "Siap dipenuhi",
  WAITING_STOCK: "Menunggu stok",
};
const documentLabels: Record<string, string> = {
  PROFORMA: "Proforma",
  PICK_SLIP: "Pick Slip",
  PACKING_LIST: "Packing List",
  SURAT_JALAN: "Surat Jalan",
  POD: "Barang diterima",
  INVOICE: "Invoice",
  CREDIT_NOTE: "Nota kredit",
  ADVANCE: "Uang muka",
};
export const lineStatusLabel = (code: string) => lineLabels[code] ?? "Belum tersedia";
export const relatedKindLabel = (code: string) => documentLabels[code] ?? "Dokumen";
export const orderStatusLabel = (code: string) =>
  (
    ({
      DRAFT: "Draft",
      WAITING_APPROVAL: "Menunggu persetujuan",
      OPEN: "Open",
      PARTIALLY_SHIPPED: "Dikirim sebagian",
      IN_DELIVERY: "Dalam pengiriman",
      COMPLETED: "Selesai",
      CANCELLED: "Dibatalkan",
    }) as Record<string, string>
  )[code] ?? "Belum tersedia";
export const documentStatusLabel = (code: string) =>
  (
    ({
      PENDING_VERIFICATION: "Menunggu verifikasi",
      VERIFIED: "Terverifikasi",
      REJECTED: "Ditolak",
      DRAFT: "Draft",
      OPEN: "Terbuka",
      PICKED: "Sudah diambil",
      CHECKED: "Sudah diperiksa",
      ISSUED: "Diterbitkan",
      ISSUED_WAITING_POD: "Menunggu barang diterima",
      POSTED: "Dibukukan",
      PAID: "Lunas",
      PARTIALLY_PAID: "Dibayar sebagian",
      CANCELLED: "Dibatalkan",
      ACTIVE: "Aktif",
      REVISION_REQUIRED: "Perlu revisi",
      EXPIRED: "Kedaluwarsa",
      CONFIRMED: "Dikonfirmasi",
      REVERSED: "Dikoreksi",
      VOID: "Dibatalkan",
      SUPERSEDED: "Digantikan revisi baru",
    }) as Record<string, string>
  )[code] ?? "Belum tersedia";
