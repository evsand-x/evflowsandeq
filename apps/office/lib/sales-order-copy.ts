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
      OPEN: "Diajukan",
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

/** Status dokumen SO di kolom Status: kemajuan kirim tampil di kolom Pengiriman, bukan di sini. */
export const orderDocumentStatus = (code: string) =>
  ["DRAFT", "WAITING_APPROVAL", "CANCELLED"].includes(code)
    ? { label: orderStatusLabel(code), tone: code === "CANCELLED" ? "danger" : "warning" }
    : { label: "Diajukan", tone: "info" };

export type OrderShipping = {
  status: "NOT_SHIPPED" | "PARTIAL" | "SHIPPED";
  remainingQuantity: string;
  remainingUnit: string | null;
  draftDeliveryNotes: number;
} | null;
export type OrderBilling = {
  status: "NONE" | "UNINVOICED" | "UNPAID" | "PARTIAL" | "PAID";
  invoiceCount: number;
  uninvoicedDeliveryNotes: number;
} | null;

function quantity(value: string) {
  const [whole, fraction] = value.split(".");
  const tail = fraction?.replace(/0+$/, "");
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${tail ? `,${tail}` : ""}`;
}

/** Teks kolom Pengiriman (canvas SO-list): dihitung server dari Surat Jalan terbit. */
export function shippingLabel(shipping: OrderShipping | undefined) {
  if (!shipping) return { label: "—", tone: "neutral" };
  if (shipping.status === "SHIPPED") return { label: "Terkirim penuh", tone: "success" };
  if (shipping.status === "PARTIAL")
    return {
      label: `Sebagian · sisa ${quantity(shipping.remainingQuantity)}${shipping.remainingUnit ? ` ${shipping.remainingUnit}` : ""}`,
      tone: "warning",
    };
  return {
    label: shipping.draftDeliveryNotes ? "Belum dikirim · ada draft SJ" : "Belum dikirim",
    tone: "neutral",
  };
}

/** Teks kolom Tagihan: hanya tersedia untuk pengguna yang boleh membaca invoice. */
export function billingLabel(billing: OrderBilling | undefined) {
  switch (billing?.status) {
    case "UNINVOICED":
      return { label: "Belum diinvoice", tone: "warning" };
    case "UNPAID":
      return { label: "Belum dibayar", tone: "neutral" };
    case "PARTIAL":
      return { label: "Dibayar sebagian", tone: "warning" };
    case "PAID":
      return { label: "Lunas", tone: "success" };
    default:
      return { label: "—", tone: "neutral" };
  }
}
