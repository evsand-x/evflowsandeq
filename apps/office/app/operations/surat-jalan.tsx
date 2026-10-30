"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { ErrorBox, Evidence } from "./workspace";
import { SuratJalanListPage } from "./surat-jalan-list";
import { SuratJalanFormPage } from "./surat-jalan-form";
import { ReceiptDialog } from "./surat-jalan-receipt";
import { handoverText, quantityText } from "./surat-jalan-utils";
import "./outbound.css";

type Note = {
  id: string;
  number: string;
  state: "DRAFT" | "ISSUED";
  salesOrderId: string;
  salesOrder: { number: string; customer?: { name: string } };
  lines: {
    id: string;
    salesOrderLineId: string;
    quantity: string;
    unit?: string | null;
    deliveredQuantity?: string;
    product?: { name: string; code: string };
  }[];
  receipt?: {
    handoverAt: string;
    receiverName: string;
    receiverTitle?: string | null;
    evidenceId: string;
    lines: {
      sales_order_line_id: string;
      delivered_quantity: string;
      discrepancy_reason?: string | null;
    }[];
  } | null;
  issuedAt?: string | null;
  receiverName?: string | null;
  evidenceId?: string | null;
  notes?: string | null;
};

export function SuratJalanWorkspace({ path }: { path: string[] }) {
  const id = path[1];
  const fromOrder = path[1] === "from-order" ? path[2] : undefined;
  const { principal, state } = useSession();
  const canRead = !!principal && hasCompanyPermission(principal, "outbound_shipping.read");
  const canInvoice =
    !!principal &&
    hasCompanyPermission(principal, "sales_invoice.post") &&
    hasCompanyPermission(principal, "sales_invoice.view_price");
  if (!principal)
    return (
      <main className="ob-auth">
        <p>{state === "loading" ? "Memuat sesi…" : "Silakan masuk."}</p>
        <Link href="/login">Masuk</Link>
      </main>
    );
  if (!canRead)
    return (
      <main className="ob-auth">
        <p role="alert">Anda tidak memiliki izin melihat Surat Jalan.</p>
      </main>
    );
  if (!id) return <SuratJalanListPage />;
  if (fromOrder) return <SuratJalanFormPage orderId={fromOrder} />;
  return <SuratJalanDetail key={id} id={id} canInvoice={canInvoice} />;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="ob-page">
      <header className="ob-page-header">
        <div>
          <p className="ob-eyebrow">Warehouse & Logistik · Barang Keluar</p>
          <h1>{title}</h1>
          <p className="ob-page-subtitle">
            Surat Jalan terbit menjadi sumber Invoice. Penerimaan barang dicatat terpisah.
          </p>
        </div>
        <Link className="ob-link" href="/operations/orders">
          Kembali ke Sales Order
        </Link>
      </header>
      {children}
    </main>
  );
}
function SuratJalanDetail({ id, canInvoice }: { id: string; canInvoice: boolean }) {
  const { principal } = useSession();
  const q = useQuery({
    queryKey: ["surat-jalan", principal?.company_id, principal?.user_id, id],
    queryFn: () => apiRequest<{ data: Note }>(`/delivery-notes/${id}`),
  });
  const [receiptOpen, setReceiptOpen] = useState(false);
  const canReceive = !!principal && hasCompanyPermission(principal, "fulfillment.dispatch");
  const note = q.data?.data;
  // Draft dibuka di form (canvas SJ-form); detail lama tetap untuk Surat Jalan terbit.
  if (note?.state === "DRAFT") return <SuratJalanFormPage noteId={id} />;
  return (
    <Shell title={note ? `${note.number} · Surat Jalan` : "Surat Jalan"}>
      {q.isPending && <p>Memuat Surat Jalan…</p>}
      {q.isError && <ErrorBox message="Surat Jalan belum dapat dimuat." />}
      {note && (
        <>
          <section className="ob-panel">
            <dl className="ob-summary">
              <div>
                <dt>Sales Order</dt>
                <dd>{note.salesOrder.number}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{note.state === "ISSUED" ? "Terbit" : "Draf"}</dd>
              </div>
            </dl>
            {note.state === "ISSUED" && (
              <>
                <p className="ob-success">Surat Jalan sudah terbit.</p>
                <div className="flex flex-wrap gap-3">
                  {!note.receipt && canReceive && (
                    <Button onClick={() => setReceiptOpen(true)}>Penerimaan Barang</Button>
                  )}
                  {/* Invoice dibuat lewat form (draft lalu Submit), bukan langsung terposting. */}
                  {canInvoice && (
                    <Button asChild>
                      <Link href={`/operations/invoices/new?surat_jalan_id=${id}`}>
                        Buat Invoice
                      </Link>
                    </Button>
                  )}
                </div>
              </>
            )}
          </section>
          <section className="ob-panel">
            <h2>Penerimaan barang</h2>
            {note.receipt ? (
              <>
                <dl className="ob-summary">
                  <div>
                    <dt>Waktu penerimaan</dt>
                    <dd>{handoverText(note.receipt.handoverAt)}</dd>
                  </div>
                  <div>
                    <dt>Nama penerima</dt>
                    <dd>{note.receipt.receiverName}</dd>
                  </div>
                  <div>
                    <dt>Jabatan / unit</dt>
                    <dd>{note.receipt.receiverTitle || "—"}</dd>
                  </div>
                </dl>
                <Evidence id={note.receipt.evidenceId} />
              </>
            ) : (
              <p>Penerimaan belum dicatat.</p>
            )}
          </section>
          <section className="ob-panel">
            <h2>Rincian barang</h2>
            <ul>
              {note.lines.map((l) => (
                <li key={l.id}>
                  {l.product?.name ?? l.salesOrderLineId} · Dikirim{" "}
                  {quantityText(l.deliveredQuantity ?? l.quantity, l.unit)}
                  {note.receipt &&
                    (() => {
                      const received = note.receipt.lines.find(
                        (r) => r.sales_order_line_id === l.salesOrderLineId,
                      );
                      return received ? (
                        <span>
                          {" "}
                          · Diterima {quantityText(received.delivered_quantity, l.unit)}
                          {received.discrepancy_reason && <> · {received.discrepancy_reason}</>}
                        </span>
                      ) : null;
                    })()}
                </li>
              ))}
            </ul>
          </section>
          {canReceive && !note.receipt && note.state === "ISSUED" && (
            <ReceiptDialog
              open={receiptOpen}
              noteId={note.id}
              lines={note.lines.map((l) => ({
                id: l.salesOrderLineId,
                name: l.product?.name ?? "Barang",
                unit: l.unit ?? "unit",
                sent: l.deliveredQuantity ?? l.quantity,
              }))}
              onClose={() => setReceiptOpen(false)}
              onReceived={() => {
                setReceiptOpen(false);
                void q.refetch();
              }}
            />
          )}
        </>
      )}
    </Shell>
  );
}
