"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { InvoiceListPage } from "./invoice-list";
import { InvoiceFormPage } from "./invoice-form";
import { InvoiceDetailPage } from "./invoice-detail";
import { InvoicePaymentPage } from "./invoice-payment";
import "./outbound.css";

/**
 * Invoice & Pembayaran Release 1: /operations/invoices (daftar), /new?surat_jalan_id= (form),
 * /:id (detail; draft dibuka di form) dan /:id/payment (Terima Pembayaran).
 */
export function InvoiceWorkspace({ path }: { path: string[] }) {
  const { principal, state } = useSession();
  const searchParams = useSearchParams();
  if (!principal)
    return (
      <main className="ob-auth">
        <p>{state === "loading" ? "Memuat sesi…" : "Silakan masuk."}</p>
        <Link href="/login">Masuk</Link>
      </main>
    );
  if (!hasCompanyPermission(principal, "sales_invoice.read"))
    return (
      <main className="ob-auth">
        <p role="alert">Anda tidak memiliki izin melihat Invoice.</p>
      </main>
    );
  const id = path[1];
  if (!id) return <InvoiceListPage />;
  if (id === "new")
    return <InvoiceFormPage suratJalanId={searchParams.get("surat_jalan_id") ?? undefined} />;
  if (path[2] === "payment") return <InvoicePaymentPage id={id} />;
  return <InvoiceDetailPage id={id} />;
}
