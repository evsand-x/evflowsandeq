import { formatMoney } from "@/lib/format";
export type Ref = { id: string; name: string; state?: string };
export type Pic = {
  id?: string;
  version?: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  job_title?: string | null;
  nickname?: string | null;
  department?: string | null;
  birth_date?: string | null;
  notes?: string | null;
  pic_functions: string[];
  state?: string;
};
export type Legal = {
  type?: string;
  number?: string;
  issuer?: string;
  expires_on?: string;
  verification_state?: string;
  evidence_id?: string;
};
export type Policy = {
  mode: string;
  top_days: number | null;
  credit_limit: string | null;
  effective_from: string;
};
export type Customer = {
  id: string;
  code: string;
  name: string;
  version: number;
  state: string;
  relationship_stage: string;
  onboarding_state: string;
  channel: Ref | null;
  rayon: Ref | null;
  channel_id?: string | null;
  rayon_id?: string | null;
  primary_address: string | null;
  shipping_address: string | null;
  billing_address: string | null;
  phone?: string | null;
  email?: string | null;
  legal_name?: string | null;
  tax_identity?: string | null;
  tax_status?: string | null;
  customer_type?: string | null;
  potential?: string | null;
  collection_schedule?: string | null;
  invoice_exchange_schedule?: string | null;
  payment_method_preference?: string | null;
  payment_tolerance_days?: number | null;
  legal_documents?: Legal[] | null;
  responsible_person?: Record<string, string> | null;
  responsible_license?: Record<string, string> | null;
  noo_document?: Record<string, string> | null;
  contacts?: Pic[];
  payment_policies?: Policy[];
};
export const relationships: Record<string, string> = {
  PROSPECT: "Prospek",
  REGISTERED: "Terdaftar",
  TRANSACTED: "Bertransaksi",
};
export const onboarding: Record<string, string> = {
  DRAFT: "Draft",
  NEEDS_REVIEW: "Menunggu Verifikasi",
  VERIFIED: "Terverifikasi",
};
export const roles: Record<string, string> = {
  PURCHASING: "Pembelian",
  RECEIVING: "Penerimaan Barang",
  FINANCE: "Pembayaran / Keuangan",
  PRODUCT_USER: "Pengguna Produk",
  OTHER: "Lainnya",
};
export function money(value?: string | null) {
  return formatMoney(value);
}
