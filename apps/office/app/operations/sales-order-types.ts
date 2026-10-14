import type { Row } from "./workspace";
import Decimal from "decimal.js";
export type OrderLine = NonNullable<Row["lines"]>[number] & {
  productId: string;
  product: { name: string; code: string; baseUom?: { name: string } };
  closedQuantity: string;
  remainder: string;
  subtotal: string;
  taxAmount: string | null;
  taxSnapshot?: { name: string; rate: string } | null;
};
export type Order = Omit<Row, "lines" | "total" | "taxAmount"> & {
  lines: OrderLine[];
  createdAt: string;
  createdByName: string | null;
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
export function taxLabel(snapshot?: { rate: string } | null) {
  return snapshot
    ? `${amount(new Decimal(snapshot.rate).mul(100).toString())}%`
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
