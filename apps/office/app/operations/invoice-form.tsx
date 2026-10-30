"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MetaItem, OfficePage, PageNotice, RecordBadge } from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { amount, effectiveTaxPercent } from "./sales-order-types";
import { dateOnly } from "./invoice-utils";
import { useInvoiceCommand } from "./invoice-command";
import "./sales-order-r1.css";
import "./surat-jalan-form.css";
import "./invoice.css";

const D = Decimal.clone({ precision: 50 });
const base = "/operations/invoices";
const numberPattern = /^[A-Za-z0-9][A-Za-z0-9./_-]*$/;

export type InvoiceLine = {
  sales_order_line_id: string;
  product_code?: string;
  product: string;
  unit: string;
  quantity: string;
  unit_price: string;
  tax_snapshot?: { rate: string; dpp_factor?: string } | null;
  amounts?: { net: string; tax: string; total: string };
};
/** Snapshot sumber Invoice (Surat Jalan + SO) yang dibekukan saat draft/submit. */
export type InvoiceSnapshot = {
  delivery_note_number?: string | undefined;
  delivery_note_date?: string | null | undefined;
  delivery_note_issued_at?: string | null | undefined;
  sales_order_number?: string | undefined;
  sales_order_date?: string | null | undefined;
  payment?: { mode?: string; top_days?: number | null; term_label?: string };
  customer?: {
    name?: string;
    billing_address?: string | null;
    primary_address?: string | null;
  };
  lines?: InvoiceLine[];
};
type Draft = {
  id: string;
  number: string;
  state: string;
  invoiceDate: string | null;
  notes: string | null;
  version: number;
  salesOrderId: string;
};
type FormData = {
  nextNumber: string | null;
  invoiceDate: string;
  draft: Draft | null;
  source: {
    deliveryNoteId: string;
    total: string;
    subtotal: string;
    taxAmount: string;
    freightAmount: string;
    freightTaxAmount: string;
    dueDate: string;
    snapshot: InvoiceSnapshot;
  };
};

/** Termin dari snapshot pembayaran SO. */
export function termText(payment?: InvoiceSnapshot["payment"]) {
  if (!payment) return "—";
  if (payment.term_label) return payment.term_label;
  if (payment.mode === "COD") return "COD";
  if (payment.mode === "PREPAY") return "Bayar di muka";
  return payment.top_days != null ? `${payment.top_days} Hari` : "—";
}
/** Label PPN efektif dari baris pertama yang berpajak, mis. "PPN 11%". */
export function taxText(lines?: InvoiceLine[]) {
  const tax = lines?.find((l) => l.tax_snapshot)?.tax_snapshot;
  return tax
    ? `PPN ${amount(effectiveTaxPercent(new D(tax.rate).mul(100).toString(), tax.dpp_factor))}%`
    : "PPN";
}
export function qtyText(lines?: InvoiceLine[]) {
  const list = lines ?? [];
  const qty = list.reduce((s, l) => s.add(l.quantity), new D(0));
  const units = new Set(list.map((l) => l.unit));
  return `${amount(qty.toString())} ${units.size === 1 ? [...units][0] : "unit"}`;
}

/** Form Invoice (canvas Invoice-form): draft dari Surat Jalan terbit, lalu Submit ke piutang. */
export function InvoiceFormPage({
  suratJalanId,
  invoiceId,
}: {
  suratJalanId?: string | undefined;
  invoiceId?: string | undefined;
}) {
  const { principal } = useSession();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const params = new URLSearchParams(
    invoiceId ? { invoice_id: invoiceId } : { surat_jalan_id: suratJalanId ?? "" },
  );
  const endpoint = `/sales-invoices/form?${params}`;
  const form = useQuery({
    queryKey: ["invoices", "form", principal?.company_id, endpoint],
    queryFn: ({ signal }) => apiRequest<{ data: FormData }>(endpoint, { signal }),
    enabled: !!(invoiceId || suratJalanId),
  });
  const data = form.data?.data;
  const draft = data?.draft;
  const status = draft
    ? { label: "Draft", tone: "info" as const }
    : { label: "Draft baru", tone: "neutral" as const };
  return (
    <OfficePage
      section="finance"
      crumbs={[
        { label: "Finance" },
        { label: "Invoice & Pembayaran", href: base },
        { label: draft?.number ?? "Baru" },
      ]}
      title={draft?.number ?? "Invoice baru"}
      meta={
        <>
          <MetaItem label="Status">
            <RecordBadge state={status.tone} label={status.label} />
          </MetaItem>
          <MetaItem label="Piutang">
            <RecordBadge state="neutral" label="Belum diposting" />
          </MetaItem>
        </>
      }
      actions={
        <Button variant="outline" asChild>
          <Link href={base}>Kembali</Link>
        </Button>
      }
    >
      {!invoiceId && !suratJalanId ? (
        <PageNotice tone="info">
          Pilih Surat Jalan terbit yang belum diinvoice.{" "}
          <Link className="page-frame-link" href="/operations/delivery-notes?tab=UNINVOICED">
            Buka daftar Surat Jalan
          </Link>
        </PageNotice>
      ) : !can("sales_invoice.view_price") ? (
        <PageNotice tone="error">Anda tidak memiliki izin melihat nilai Invoice.</PageNotice>
      ) : form.isError ? (
        <PageNotice tone="error" onRetry={() => void form.refetch()}>
          {form.error.message}
        </PageNotice>
      ) : !data ? (
        <p role="status">Memuat data Invoice…</p>
      ) : draft && draft.state !== "DRAFT" ? (
        <PageNotice tone="info">
          Invoice ini sudah disubmit dan tidak dapat diubah.{" "}
          <Link className="page-frame-link" href={`${base}/${draft.id}`}>
            Buka Invoice
          </Link>
        </PageNotice>
      ) : (
        <InvoiceForm
          key={`${draft?.id ?? "new"}:${draft?.version ?? 0}`}
          data={data}
          canPost={can("sales_invoice.post")}
          canReadNote={can("outbound_shipping.read")}
          canReadOrder={can("sales_order.read")}
        />
      )}
    </OfficePage>
  );
}

function InvoiceForm({
  data,
  canPost,
  canReadNote,
  canReadOrder,
}: {
  data: FormData;
  canPost: boolean;
  canReadNote: boolean;
  canReadOrder: boolean;
}) {
  const router = useRouter();
  const draft = data.draft;
  const snap = data.source.snapshot;
  const { run, error, pending, setError } = useInvoiceCommand();
  const [number, setNumber] = useState(draft?.number ?? data.nextNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(
    (draft?.invoiceDate ?? data.invoiceDate).slice(0, 10),
  );
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [dirty, setDirty] = useState(!draft);
  const [tried, setTried] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const touch = () => setDirty(true);

  const noteDate = (snap.delivery_note_date ?? snap.delivery_note_issued_at ?? "").slice(0, 10);
  const trimmed = number.trim();
  const numberError = !trimmed
    ? "Nomor Invoice wajib diisi."
    : !numberPattern.test(trimmed)
      ? "Hanya huruf, angka, titik, garis miring, garis bawah dan tanda hubung."
      : "";
  const dateError = !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)
    ? "Isi tanggal invoice."
    : noteDate && invoiceDate < noteDate
      ? `Tidak boleh sebelum tanggal Surat Jalan (${dateOnly(noteDate)}).`
      : "";
  const hasError = !!(numberError || dateError);
  const lines = snap.lines ?? [];
  const freight = new D(data.source.freightAmount).add(data.source.freightTaxAmount);
  const total = amount(data.source.total, "IDR");

  const payload = () => ({
    surat_jalan_id: data.source.deliveryNoteId,
    // Nomor baru hanya dikirim bila diubah: tanpa nomor server memakai urutan Setting.
    ...(draft || trimmed !== data.nextNumber ? { number: trimmed } : {}),
    invoice_date: invoiceDate,
    notes: notes.trim(),
    ...(draft ? { version: draft.version } : {}),
  });
  const save = async () => {
    setTried(true);
    if (hasError) {
      setError("Perbaiki isian bertanda merah sebelum menyimpan.");
      return null;
    }
    const saved = draft
      ? await run(`/sales-invoices/${draft.id}/draft`, payload(), "PATCH")
      : await run("/sales-invoices/drafts", payload());
    setDirty(false);
    return saved;
  };
  const submit = async () => {
    let saved: { id: string; version: number } | null = null;
    try {
      // Submit memakai draft tersimpan; simpan dulu bila ada perubahan.
      saved = dirty || !draft ? await save() : draft;
      if (!saved) return;
      const posted = await run(`/sales-invoices/${saved.id}/submit`, { version: saved.version });
      router.push(`${base}/${posted.id}?posted=1`);
    } catch {
      // Pesan server tampil di dialog. Draft baru yang sudah tersimpan dibuka sebagai draft.
      if (saved && !draft) router.replace(`${base}/${saved.id}`);
    }
  };

  return (
    <form
      className="web-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save()
          .then((saved) => {
            if (saved && !draft) router.replace(`${base}/${saved.id}`);
          })
          .catch(() => undefined);
      }}
    >
      {error && !postOpen && <PageNotice tone="error">{error}</PageNotice>}
      {draft && !dirty && (
        <section className="sor-next sor-next-compact" aria-label="Status draft">
          <div>
            <strong>Draft disimpan</strong>
            <span> Piutang belum berubah. Submit invoice untuk menagih pelanggan.</span>
          </div>
        </section>
      )}
      <fieldset
        disabled={pending || !canPost}
        className="sor-layout"
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <div className="sor-main">
          <section className="sor-panel" aria-labelledby="inv-head">
            <h2 id="inv-head">Data invoice</h2>
            <div className="sor-grid">
              <label className="sor-field">
                Nomor Invoice *
                <Input
                  value={number}
                  maxLength={60}
                  aria-invalid={(tried && !!numberError) || undefined}
                  onChange={(e) => {
                    touch();
                    setNumber(e.target.value.toUpperCase());
                  }}
                />
                <span className={tried && numberError ? "sor-err" : "sor-hint"}>
                  {tried && numberError
                    ? numberError
                    : "Usulan dari penomoran di Setting; boleh diubah, harus unik."}
                </span>
              </label>
              <label className="sor-field">
                Tanggal Invoice *
                <Input
                  type="date"
                  value={invoiceDate}
                  aria-invalid={!!dateError || undefined}
                  onChange={(e) => {
                    touch();
                    setInvoiceDate(e.target.value);
                  }}
                />
                <span className={dateError ? "sor-err" : "sor-hint"}>
                  {dateError || "Default hari ini; tidak boleh di periode tertutup."}
                </span>
              </label>
              <label className="sor-field">
                <span>
                  Termin <span className="sor-hint">Dari SO</span>
                </span>
                <Input readOnly className="sor-readonly" value={termText(snap.payment)} />
              </label>
              <label className="sor-field">
                <span>
                  Jatuh tempo <span className="sor-hint">Tanggal Surat Jalan + termin</span>
                </span>
                <Input readOnly className="sor-readonly" value={dateOnly(data.source.dueDate)} />
              </label>
              <label className="sor-field sor-span">
                Pelanggan
                <Input readOnly className="sor-readonly" value={snap.customer?.name ?? "—"} />
              </label>
              <label className="sor-field sor-span">
                <span>
                  Alamat penagihan <span className="sor-hint">Dari data pelanggan</span>
                </span>
                <Input
                  readOnly
                  className="sor-readonly"
                  value={snap.customer?.billing_address ?? snap.customer?.primary_address ?? "—"}
                />
              </label>
            </div>
          </section>

          <section className="sor-panel" aria-labelledby="inv-lines">
            <div className="inv-panel-head">
              <h2 id="inv-lines">Barang ditagih</h2>
              <span className="sor-hint">
                Jumlah dan harga disalin dari Surat Jalan dan tidak bisa diubah.
              </span>
            </div>
            <InvoiceLines lines={lines} />
            <label className="sor-field" style={{ marginTop: 16 }}>
              <span>
                Catatan pada invoice <span className="sor-hint">Opsional, ikut tercetak</span>
              </span>
              <Textarea
                value={notes}
                maxLength={2000}
                placeholder="Contoh: instruksi pembayaran"
                onChange={(e) => {
                  touch();
                  setNotes(e.target.value);
                }}
              />
            </label>
          </section>
        </div>

        <aside className="sor-aside" aria-label="Ringkasan Invoice">
          <InvoiceSummary
            subtotal={data.source.subtotal}
            tax={data.source.taxAmount}
            freight={freight.toString()}
            total={data.source.total}
            lines={lines}
          />
          <SourceDocuments
            snap={snap}
            noteId={data.source.deliveryNoteId}
            orderId={draft?.salesOrderId}
            canReadNote={canReadNote}
            canReadOrder={canReadOrder}
          />
        </aside>
      </fieldset>

      {canPost && (
        <footer className="sor-footer">
          <p>
            {pending
              ? "Memproses…"
              : dirty
                ? "Ada perubahan yang belum disimpan."
                : "Draft tersimpan. Piutang berubah saat invoice disubmit."}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => router.push(base)}
          >
            Batal
          </Button>
          <Button type="submit" variant="outline" disabled={pending}>
            Simpan draft
          </Button>
          <Button
            type="button"
            aria-haspopup="dialog"
            disabled={pending}
            onClick={() => {
              setTried(true);
              if (hasError) return setError("Perbaiki isian bertanda merah sebelum submit.");
              setError("");
              setPostOpen(true);
            }}
          >
            Submit
          </Button>
        </footer>
      )}

      <Dialog open={postOpen} onOpenChange={(next) => !next && !pending && setPostOpen(false)}>
        <DialogContent className="sj-dialog sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Submit invoice ini?</DialogTitle>
            <DialogDescription>
              Invoice langsung masuk piutang pelanggan dan tidak bisa diedit. Koreksi dilakukan
              lewat dokumen pembatalan.
            </DialogDescription>
          </DialogHeader>
          <dl className="inv-confirm">
            <div className="sor-sum">
              <dt>Nomor</dt>
              <dd>{trimmed}</dd>
            </div>
            <div className="sor-sum">
              <dt>Total tagihan</dt>
              <dd className="sor-strong">{total}</dd>
            </div>
            <div className="sor-sum">
              <dt>Jatuh tempo</dt>
              <dd>{dateOnly(data.source.dueDate)}</dd>
            </div>
          </dl>
          {error && (
            <p role="alert" className="sor-err">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setPostOpen(false)}
            >
              Batal
            </Button>
            <Button type="button" disabled={pending} onClick={() => void submit()}>
              {pending ? "Memproses…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

export function InvoiceLines({ lines }: { lines: InvoiceLine[] }) {
  return (
    <div className="sj-table-wrap">
      <table className="sj-table inv-table">
        <thead>
          <tr>
            <th>Produk</th>
            <th className="sor-num">Qty</th>
            <th>Satuan</th>
            <th className="sor-num">Harga</th>
            <th className="sor-num">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.sales_order_line_id}>
              <td>
                <strong className="sj-product">{l.product}</strong>
                {l.product_code && <span className="sor-hint">{l.product_code}</span>}
              </td>
              <td className="sor-num sor-strong">{amount(l.quantity)}</td>
              <td>{l.unit}</td>
              <td className="sor-num">{amount(l.unit_price, "IDR")}</td>
              <td className="sor-num sor-strong">
                {amount(l.amounts?.net ?? new D(l.quantity).mul(l.unit_price).toString(), "IDR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvoiceSummary({
  subtotal,
  tax,
  freight,
  total,
  lines,
}: {
  subtotal: string;
  tax: string;
  freight: string;
  total: string;
  lines: InvoiceLine[];
}) {
  return (
    <section className="sor-side" aria-labelledby="inv-sum">
      <h2 id="inv-sum">Ringkasan tagihan</h2>
      <dl style={{ margin: 0 }}>
        <div className="sor-sum">
          <dt>DPP · {qtyText(lines)}</dt>
          <dd>{amount(subtotal, "IDR")}</dd>
        </div>
        <div className="sor-sum">
          <dt>{taxText(lines)}</dt>
          <dd>{amount(tax, "IDR")}</dd>
        </div>
        <div className="sor-sum">
          <dt>Ongkir</dt>
          <dd>{amount(freight, "IDR")}</dd>
        </div>
        <div className="sor-sum sor-sum-total">
          <dt>Total tagihan</dt>
          <dd>{amount(total, "IDR")}</dd>
        </div>
      </dl>
    </section>
  );
}

export function SourceDocuments({
  snap,
  noteId,
  orderId,
  canReadNote,
  canReadOrder,
}: {
  snap: InvoiceSnapshot;
  noteId?: string | null | undefined;
  orderId?: string | null | undefined;
  canReadNote: boolean;
  canReadOrder: boolean;
}) {
  return (
    <section className="sor-side" aria-labelledby="inv-source">
      <h2 id="inv-source">Dokumen Asal</h2>
      <dl className="sj-source">
        <div>
          <dt>Nomor Surat Jalan</dt>
          <dd>
            {noteId && canReadNote ? (
              <Link className="page-frame-link" href={`/operations/delivery-notes/${noteId}`}>
                {snap.delivery_note_number ?? "—"}
              </Link>
            ) : (
              (snap.delivery_note_number ?? "—")
            )}
          </dd>
        </div>
        <div>
          <dt>Tanggal Surat Jalan</dt>
          <dd>{dateOnly(snap.delivery_note_date ?? snap.delivery_note_issued_at)}</dd>
        </div>
        <div>
          <dt>Nomor SO</dt>
          <dd>
            {orderId && canReadOrder ? (
              <Link className="page-frame-link" href={`/operations/orders/${orderId}`}>
                {snap.sales_order_number ?? "—"}
              </Link>
            ) : (
              (snap.sales_order_number ?? "—")
            )}
          </dd>
        </div>
        <div>
          <dt>Tanggal SO</dt>
          <dd>{dateOnly(snap.sales_order_date)}</dd>
        </div>
      </dl>
    </section>
  );
}
