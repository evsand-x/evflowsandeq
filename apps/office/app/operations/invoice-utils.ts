import Decimal from "decimal.js";

/** Status Invoice dari read model (`status`), ditampilkan sesuai canvas Invoice-list/detail. */
export type InvoiceStatus = "DRAFT" | "UNPAID" | "PARTIAL" | "PAID" | "VOID" | "PENDING_PROOF";
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export function invoiceStatus(status: string): { label: string; tone: Tone } {
  return (
    (
      {
        DRAFT: { label: "Draft", tone: "info" },
        UNPAID: { label: "Belum dibayar", tone: "neutral" },
        PARTIAL: { label: "Sebagian dibayar", tone: "warning" },
        PENDING_PROOF: { label: "Menunggu bukti potong", tone: "warning" },
        PAID: { label: "Lunas", tone: "success" },
        VOID: { label: "Dibatalkan", tone: "danger" },
      } as Record<string, { label: string; tone: Tone }>
    )[status] ?? { label: status, tone: "neutral" }
  );
}

const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Tanggal kalender dari kolom DATE (ISO tengah malam UTC) tanpa geser zona waktu. */
export function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${d} ${months[m - 1]} ${y}`;
}

/** Selisih hari kalender `to - from` untuk dua tanggal YYYY-MM-DD. */
export function dayDiff(from: string, to: string) {
  return Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86400000);
}

/** Tanggal hari ini di perangkat (YYYY-MM-DD) untuk default isian tanggal. */
export function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Keterangan jatuh tempo relatif hari ini, mis. "3 hari lagi" / "5 hari terlambat". */
export function dueNote(due: string | null | undefined, today: string, open: boolean) {
  if (!due) return "";
  if (!open) return "";
  const diff = dayDiff(today, due);
  if (diff > 0) return `${diff} hari lagi`;
  if (diff === 0) return "Jatuh tempo hari ini";
  return `${-diff} hari terlambat`;
}

/** Pesan Indonesia untuk kode galat Invoice dan Terima Pembayaran dari server. */
const messages: Record<string, string> = {
  INVOICE_NUMBER_EXISTS: "Nomor Invoice sudah dipakai invoice lain. Gunakan nomor lain.",
  INVOICE_VERSION_CONFLICT: "Invoice ini baru saja diubah orang lain. Muat ulang lalu ulangi.",
  INVOICE_NOT_DRAFT: "Invoice sudah disubmit dan tidak bisa diubah.",
  INVOICE_SOURCE_CHANGED: "Nilai Surat Jalan berubah sejak draft disimpan. Simpan ulang draft.",
  INVOICE_DATE_REQUIRED: "Isi tanggal invoice lalu simpan draft.",
  INVOICE_QUANTITY_REQUIRED: "Surat Jalan ini tidak punya barang yang bisa ditagih.",
  DELIVERY_NOTE_ALREADY_INVOICED: "Surat Jalan ini sudah punya invoice.",
  DELIVERY_NOTE_NOT_ISSUED: "Invoice hanya bisa dibuat dari Surat Jalan yang sudah terbit.",
  PAYMENT_SNAPSHOT_REQUIRED: "Termin pembayaran Surat Jalan tidak lengkap.",
  FINANCE_PERIOD_NOT_OPEN: "Periode akuntansi untuk tanggal ini sudah ditutup atau belum dibuka.",
  BANK_ACCOUNT_REQUIRED: "Akun kas/bank tidak aktif atau mata uangnya berbeda.",
  BANK_REFERENCE_DUPLICATE:
    "Referensi bank ini sudah tercatat di penerimaan lain pada akun yang sama.",
  PAYMENT_EXCEEDS_OUTSTANDING:
    "Nominal diterima ditambah pemotongan melebihi outstanding terbaru. Muat ulang lalu periksa.",
  DUPLICATE_DEDUCTION: "Jenis pemotongan yang sama dipilih lebih dari sekali.",
  DEDUCTION_SOURCE_INVALID: "Jenis pemotongan tidak aktif lagi. Pilih jenis lain.",
  DEDUCTION_ACCOUNT_INVALID: "Akun jenis pemotongan tidak aktif. Periksa Setting.",
  DEDUCTION_PERCENT_INVALID: "Persen pemotongan maksimal 100.",
  DEDUCTION_AMOUNT_INVALID: "Nilai pemotongan harus lebih dari 0.",
  DEDUCTION_ALREADY_SETTLED: "Bukti potong ini sudah dilengkapi.",
  INVOICE_NOT_POSTED: "Pembayaran hanya untuk invoice yang sudah disubmit.",
  TAX_ROUNDING_REQUIRED: "Aturan pembulatan pajak belum diatur di Setting › Pajak.",
};
export function invoiceMessage(error: unknown) {
  const text = error instanceof Error ? error.message : "Permintaan belum terkonfirmasi.";
  return messages[text] ?? text;
}

const D = Decimal.clone({ precision: 50 });
/** Nominal rupiah yang diketik bebas ("Rp 1.250.000", "1250000") menjadi string desimal. */
export function parseRupiah(raw: string): string | null {
  const digits = raw.replace(/[^\d,]/g, "").replace(",", ".");
  if (!digits || !/^\d{1,16}(\.\d{1,2})?$/.test(digits)) return null;
  return new D(digits).toString();
}
/** Tampilan isian nominal: pemisah ribuan titik, desimal koma. */
export function rupiahInput(value: string) {
  const parsed = parseRupiah(value);
  if (parsed === null) return value;
  const [int, frac] = parsed.split(".");
  return `${int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${frac ? `,${frac}` : ""}`;
}
