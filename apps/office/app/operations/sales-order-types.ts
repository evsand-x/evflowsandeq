import type { Row } from "./workspace";
import Decimal from "decimal.js";
export type OrderLine = NonNullable<Row["lines"]>[number] & {
  productId: string;
  product: { name: string; code: string; baseUom?: { name: string } };
  allocations?: { acceptedQuantity: string; inTransitQuantity: string; returnedQuantity: string }[];
  closedQuantity: string;
  remainder: string;
  subtotal: string;
  taxAmount: string | null;
  taxSnapshot?: {
    name: string;
    rate: string;
    dpp_factor?: string;
    operational_tax_id?: string;
  } | null;
  /** Diskon baris dalam persen (OTC-18). */
  discountRate?: string;
};
export type Order = Omit<Row, "lines" | "total" | "taxAmount"> & {
  lines: OrderLine[];
  createdAt: string;
  createdByName: string | null;
  orderDate?: string;
  paymentTermCode?: string | null;
  displayStatus?: string;
  notes?: string | null;
  freightEstimate?: string | null;
  freightTermsSnapshot?: {
    payer: "CUSTOMER" | "COMPANY" | "CARRIER";
    basis: "PER_SHIPMENT";
    tax_mode: "NON_TAXABLE" | "TAXABLE";
    tax_rule_id?: string | null;
  } | null;
  paymentSnapshot?: { mode: string; top_days?: number } | null;
  total: string | null;
  taxAmount: string | null;
  fulfillment: string;
  remainderStatus: string;
};
export type OrderCommand = (path: string, body?: unknown) => Promise<{ data: Row }>;
/**
 * Tarif PPN efektif yang ditampilkan: tarif x faktor DPP, dibulatkan dua desimal
 * (PPN 12% x DPP 11/12 tampil 11%). Nilai pajak tetap dihitung server dari snapshot.
 */
export function effectiveTaxPercent(percentage: string, dppFactor?: string | null) {
  return new Decimal(percentage)
    .mul(dppFactor ?? "1")
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toString();
}
export function taxLabel(snapshot?: { rate: string; dpp_factor?: string } | null) {
  return snapshot
    ? `${amount(effectiveTaxPercent(new Decimal(snapshot.rate).mul(100).toString(), snapshot.dpp_factor))}%`
    : "Belum ditetapkan";
}
export const orderStates: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  CANCELLED: "Dibatalkan",
  COMPLETED: "Selesai",
};
/** Group decimal strings without converting financial values to binary floating point. */
export function amount(value: string | null | undefined, currency?: string) {
  if (value == null) return "—";
  const [whole, fraction] = value.split(".");
  const digits = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const tail = fraction?.replace(/0+$/, "");
  return `${currency ? (currency === "IDR" ? "Rp" : `${currency} `) : ""}${digits}${tail ? `,${tail}` : ""}`;
}
export function terms(
  policy?: { mode: string; top_days?: number; topDays?: number | null } | null,
) {
  if (!policy) return "Belum ditetapkan";
  if (policy.mode === "PREPAY") return "Bayar sebelum pengiriman";
  if (policy.mode === "COD") return "COD · TOP 0";
  return `Tempo · ${policy.top_days ?? policy.topDays ?? "—"} hari dari POD`;
}
