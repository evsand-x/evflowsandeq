import Decimal from "decimal.js";

export const releaseOneOutboundStages = [
  { key: "shipping", label: "Surat Jalan", href: "/operations/delivery-notes" },
] as const;

export function remainingQuantity(ordered: string, delivered: string): string {
  const value = new Decimal(ordered).sub(delivered);
  return (value.isNegative() ? new Decimal(0) : value).toString();
}

export type DeliveryNoteState = "DRAFT" | "ISSUED" | "CANCELLED";
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** Status dokumen Surat Jalan di daftar (canvas SJ-list): Draft, Terbit, Dibatalkan. */
export function deliveryNoteStatus(state: DeliveryNoteState): { label: string; tone: Tone } {
  if (state === "ISSUED") return { label: "Terbit", tone: "success" };
  if (state === "CANCELLED") return { label: "Dibatalkan", tone: "danger" };
  return { label: "Draft", tone: "warning" };
}

/** Kolom Serah terima: waktu serah terima, atau "Belum diserahkan" selama draft. */
export function handoverText(at: string | null | undefined, timeZone?: string) {
  if (!at) return "Belum diserahkan";
  return new Date(at)
    .toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    })
    .replace(" pukul", ",");
}

/** Kolom Barang: jumlah dikelompokkan ribuan tanpa angka biner, plus satuan bila seragam. */
export function quantityText(quantity: string, unit: string | null | undefined) {
  const [whole, fraction] = quantity.split(".");
  const digits = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const tail = fraction?.replace(/0+$/, "");
  return `${digits}${tail ? `,${tail}` : ""} ${unit || "unit"}`;
}
