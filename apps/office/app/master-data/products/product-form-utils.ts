// Pure helpers for the product form; no React so they stay unit-testable.
import Decimal from "decimal.js";

export const productCodePattern = /^[A-Z0-9][A-Z0-9._/-]{0,49}$/;

/** "125.000" or "125.000,50" (Indonesian) → "125000" / "125000.50"; null when not a number. */
export function parseMoney(value: string): string | null {
  const text = value.trim().replace(/\./g, "").replace(",", ".");
  return /^\d{1,14}(\.\d{1,4})?$/.test(text) ? text.replace(/^0+(?=\d)/, "") : null;
}

/** Conversion factor typed with a comma or a dot as the decimal separator ("0,01"). */
export function parseFactor(value: string): string | null {
  const text = value.trim().replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,10})?$/.test(text)) return null;
  return new Decimal(text).gt(0) ? text : null;
}

/** Temperature in °C, negative allowed ("-20", "2,5"). */
export function parseTemperature(value: string): string | null {
  const text = value.trim().replace(",", ".");
  return /^-?\d{1,3}(\.\d{1,2})?$/.test(text) ? text : null;
}

export function marginNote(purchase: string, sale: string) {
  const buy = parseMoney(purchase),
    sell = parseMoney(sale);
  if (!buy || !sell || new Decimal(sell).isZero()) return "Dipakai sebagai harga bawaan di SO.";
  const gap = new Decimal(sell).minus(buy);
  if (gap.isNeg()) return "Harga jual di bawah harga beli acuan.";
  const percent = gap.div(sell).mul(100).toDecimalPlaces(1).toString().replace(".", ",");
  return `Margin kotor ${percent}% · IDR ${new Intl.NumberFormat("id-ID").format(gap.toNumber())}`;
}

export type ReadinessInput = {
  storage_notes: string;
  min_temp: string;
  max_temp: string;
  humidity_limits: string;
  source_document: string;
  expiry_required: boolean;
  shelf_life_days: string;
};

/**
 * Activation conditions enforced by the backend: storage notes plus a storage profile, and a shelf
 * life when expiry is tracked. A marketing permit is optional (decision 31 Oct 2026).
 */
export function productReadiness(v: ReadinessInput) {
  const profile = [v.min_temp, v.max_temp, v.humidity_limits, v.source_document].some((x) =>
    x.trim(),
  );
  const storage = !!v.storage_notes.trim() && profile;
  const shelf = !v.expiry_required || /^[1-9]\d*$/.test(v.shelf_life_days.trim());
  return [
    {
      id: "storage",
      label: "Profil penyimpanan",
      done: storage,
      note: storage
        ? "Profil dan catatan penyimpanan terisi"
        : "Isi suhu atau ketentuan lain dan catatan penyimpanan",
    },
    {
      id: "shelf",
      label: "Masa simpan",
      done: shelf,
      note: !v.expiry_required
        ? "Tidak wajib: kedaluwarsa tidak dilacak"
        : shelf
          ? `${v.shelf_life_days.trim()} hari`
          : "Wajib karena kedaluwarsa dilacak",
    },
  ];
}

export type PermitInput = {
  permit_type: "AKL" | "AKD";
  permit_number: string;
  holder: string;
  issued_on: string;
  expires_on: string;
  evidence: string;
};

/** Optional permit: empty → nothing sent; started → number and holder are required. */
export function permitPayload(p: PermitInput): { error?: string; body: Record<string, string> } {
  const started = [p.permit_number, p.holder, p.issued_on, p.expires_on, p.evidence].some((x) =>
    x.trim(),
  );
  if (!started) return { body: {} };
  if (!p.permit_number.trim() || !p.holder.trim())
    return { error: "Lengkapi nomor dan pemegang izin, atau kosongkan izin edar.", body: {} };
  if (p.issued_on && p.expires_on && p.expires_on < p.issued_on)
    return { error: "Tanggal berlaku sampai harus setelah tanggal terbit.", body: {} };
  return {
    body: {
      permit_type: p.permit_type,
      permit_number: p.permit_number.trim(),
      permit_holder: p.holder.trim(),
      ...(p.issued_on ? { permit_issued_on: p.issued_on } : {}),
      ...(p.expires_on ? { permit_expires_on: p.expires_on } : {}),
      ...(p.evidence ? { permit_evidence_object_key: p.evidence } : {}),
    },
  };
}
