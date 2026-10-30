"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { amount } from "./sales-order-types";
import { dateOnly, dueNote, invoiceStatus, todayLocal } from "./invoice-utils";
import {
  InvoiceFormPage,
  InvoiceLines,
  InvoiceSummary,
  SourceDocuments,
  termText,
  type InvoiceSnapshot,
} from "./invoice-form";
import { useInvoiceCommand } from "./invoice-command";
import { InvoiceEvidenceUpload, InvoiceEvidenceView } from "./invoice-evidence";
import "./sales-order-r1.css";
import "./surat-jalan-form.css";
import "./invoice.css";

const D = Decimal.clone({ precision: 50 });
const base = "/operations/invoices";

type Payment = {
  id: string;
  amount: string;
  receipt: {
    id: string;
    number: string | null;
    receivedAt: string;
    bankReference: string | null;
    externalReference: string | null;
    amount: string;
    evidenceId: string | null;
  };
  bank: { id: string; name: string; lastFour: string | null } | null;
};
type Deduction = {
  id: string;
  receiptId: string;
  sourceType: "TAX" | "DEDUCTION_TYPE";
  mode: "AMOUNT" | "PERCENT";
  value: string;
  amount: string;
  state: "PENDING_PROOF" | "SETTLED";
  evidenceId: string | null;
  proofNumber: string | null;
  proofDate: string | null;
  snapshot: { master?: { name?: string } } | null;
};
type Detail = {
  id: string;
  number: string;
  state: string;
  status: string;
  invoiceDate: string | null;
  postedAt: string | null;
  dueDate: string | null;
  notes: string | null;
  subtotal?: string;
  taxAmount?: string;
  freightAmount?: string;
  freightTaxAmount?: string;
  total?: string;
  outstandingAmount?: string;
  settledAmount?: string;
  snapshot: InvoiceSnapshot | null;
  customer: { id: string; name: string };
  deliveryNote: { id: string; number: string; issuedAt: string | null } | null;
  salesOrder: { id: string; number: string; orderDate: string | null } | null;
  /** Hanya untuk pemegang customer_receipt.read dan sales_invoice.view_price. */
  payments?: Payment[];
  deductions?: Deduction[];
  pendingProofAmount?: string;
};

/** Detail Invoice (canvas Invoice-detail); draft dibuka di form. */
export function InvoiceDetailPage({ id }: { id: string }) {
  const { principal } = useSession();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const searchParams = useSearchParams();
  const q = useQuery({
    queryKey: ["invoices", principal?.company_id, "detail", id],
    queryFn: ({ signal }) => apiRequest<{ data: Detail }>(`/sales-invoices/${id}`, { signal }),
  });
  const inv = q.data?.data;
  if (inv?.state === "DRAFT") return <InvoiceFormPage invoiceId={id} />;
  const prices = can("sales_invoice.view_price") && inv?.total !== undefined;
  const status = invoiceStatus(inv?.status ?? "");
  const open =
    !!inv &&
    inv.state === "POSTED" &&
    !!inv.outstandingAmount &&
    new D(inv.outstandingAmount).gt(0);
  const canPay = open && prices && can("customer_receipt.post");
  const today = todayLocal();
  const snap = inv?.snapshot ?? {};
  const invoiceDate = inv?.invoiceDate ?? inv?.postedAt ?? null;
  return (
    <OfficePage
      section="finance"
      crumbs={[
        { label: "Finance" },
        { label: "Invoice & Pembayaran", href: base },
        { label: inv?.number ?? "Invoice" },
      ]}
      title={inv?.number ?? "Invoice"}
      meta={
        inv && (
          <MetaItem label="Status">
            <RecordBadge state={status.tone} label={status.label} />
          </MetaItem>
        )
      }
      actions={
        <>
          <Button variant="outline" asChild>
            <Link href={base}>Kembali</Link>
          </Button>
          {canPay && (
            <Button asChild>
              <Link href={`${base}/${id}/payment`}>Catat pembayaran</Link>
            </Button>
          )}
        </>
      }
    >
      {q.isError ? (
        <PageNotice tone="error" onRetry={() => void q.refetch()}>
          {q.error.message}
        </PageNotice>
      ) : !inv ? (
        <p role="status">Memuat Invoice…</p>
      ) : (
        <>
          {searchParams.get("posted") === "1" && (
            <Done title="Invoice disubmit">
              {inv.number}
              {prices ? ` · ${amount(inv.total!, "IDR")}` : ""} masuk piutang {inv.customer.name},
              jatuh tempo {dateOnly(inv.dueDate)}.
            </Done>
          )}
          {searchParams.get("paid") === "1" && (
            <Done title="Pembayaran tersimpan">
              {open
                ? `Sisa outstanding ${amount(inv.outstandingAmount!, "IDR")}.`
                : "Invoice lunas."}
            </Done>
          )}
          {prices && (
            <div className="inv-stats">
              <div className="inv-stat">
                <span>Total Invoice</span>
                <strong>{amount(inv.total!, "IDR")}</strong>
              </div>
              <div className="inv-stat">
                <span>Sudah dibayar</span>
                <strong className="inv-good">{amount(inv.settledAmount ?? "0", "IDR")}</strong>
              </div>
              <div className="inv-stat">
                <span>Outstanding</span>
                <strong className={open ? "inv-warn" : "inv-good"}>
                  {amount(inv.outstandingAmount!, "IDR")}
                </strong>
              </div>
              <div className="inv-stat">
                <span>Past Due</span>
                <strong
                  className={
                    inv.dueDate && open && inv.dueDate.slice(0, 10) < today ? "inv-bad" : undefined
                  }
                >
                  {open ? dueNote(inv.dueDate, today, true) : "Lunas"}
                </strong>
              </div>
            </div>
          )}
          <div className="sor-layout">
            <div className="sor-main">
              <section className="sor-panel" aria-labelledby="ind-head">
                <h2 id="ind-head">Data invoice</h2>
                <dl className="sor-kv sor-grid">
                  <div>
                    <dt>Nomor Invoice</dt>
                    <dd>{inv.number}</dd>
                  </div>
                  <div>
                    <dt>Tanggal Invoice</dt>
                    <dd>{dateOnly(invoiceDate)}</dd>
                  </div>
                  <div>
                    <dt>Termin</dt>
                    <dd>{termText(snap.payment)}</dd>
                  </div>
                  <div>
                    <dt>Jatuh tempo</dt>
                    <dd>{dateOnly(inv.dueDate)}</dd>
                  </div>
                  <div className="sor-span">
                    <dt>Pelanggan</dt>
                    <dd>{snap.customer?.name ?? inv.customer.name}</dd>
                  </div>
                  <div className="sor-span">
                    <dt>Alamat penagihan</dt>
                    <dd style={{ fontWeight: 400 }}>
                      {snap.customer?.billing_address ?? snap.customer?.primary_address ?? "—"}
                    </dd>
                  </div>
                </dl>
              </section>
              {prices && (
                <section className="sor-panel" aria-labelledby="ind-lines">
                  <h2 id="ind-lines">Barang ditagih</h2>
                  <InvoiceLines lines={snap.lines ?? []} />
                  <dl className="sor-kv" style={{ marginTop: 16 }}>
                    <div>
                      <dt>Catatan pada invoice</dt>
                      <dd style={{ fontWeight: 400 }}>{inv.notes?.trim() || "Tidak ada"}</dd>
                    </div>
                  </dl>
                </section>
              )}
              {inv.payments && (
                <Payments
                  invoiceId={inv.id}
                  payments={inv.payments}
                  deductions={inv.deductions ?? []}
                  canPost={can("customer_receipt.post")}
                  onChanged={() => void q.refetch()}
                />
              )}
            </div>
            <aside className="sor-aside" aria-label="Ringkasan Invoice">
              {prices && (
                <InvoiceSummary
                  subtotal={inv.subtotal!}
                  tax={inv.taxAmount!}
                  freight={new D(inv.freightAmount ?? 0).add(inv.freightTaxAmount ?? 0).toString()}
                  total={inv.total!}
                  lines={snap.lines ?? []}
                />
              )}
              <SourceDocuments
                snap={{
                  ...snap,
                  delivery_note_number: snap.delivery_note_number ?? inv.deliveryNote?.number,
                  sales_order_number: snap.sales_order_number ?? inv.salesOrder?.number,
                  sales_order_date: snap.sales_order_date ?? inv.salesOrder?.orderDate ?? null,
                  delivery_note_issued_at:
                    snap.delivery_note_issued_at ?? inv.deliveryNote?.issuedAt ?? null,
                }}
                noteId={inv.deliveryNote?.id}
                orderId={inv.salesOrder?.id}
                canReadNote={can("outbound_shipping.read")}
                canReadOrder={can("sales_order.read")}
              />
            </aside>
          </div>
        </>
      )}
    </OfficePage>
  );
}

/** Banner hasil sukses (canvas: kartu bertepi hijau dengan centang). */
export function Done({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section role="status" className="inv-done">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#17663F"
        strokeWidth="2.25"
        aria-hidden="true"
      >
        <path d="M4 12l5 5L20 6" />
      </svg>
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </section>
  );
}

function Payments({
  invoiceId,
  payments,
  deductions,
  canPost,
  onChanged,
}: {
  invoiceId: string;
  payments: Payment[];
  deductions: Deduction[];
  canPost: boolean;
  onChanged: () => void;
}) {
  const [proofFor, setProofFor] = useState<Deduction | null>(null);
  return (
    <section className="sor-panel" aria-labelledby="ind-pay">
      <div className="inv-panel-head">
        <h2 id="ind-pay">Pembayaran</h2>
        <span className="sor-hint">Outstanding dihitung dari pembayaran terposting</span>
      </div>
      {payments.length ? (
        <div className="sj-table-wrap">
          <table className="sj-table inv-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nomor</th>
                <th>Akun kas/bank</th>
                <th>Referensi</th>
                <th className="sor-num">Jumlah</th>
                <th>
                  <span className="sr-only">Bukti</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    {new Date(p.receipt.receivedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="sor-strong">{p.receipt.number ?? "—"}</td>
                  <td>
                    {p.bank
                      ? `${p.bank.name}${p.bank.lastFour ? ` · ****${p.bank.lastFour}` : ""}`
                      : "—"}
                  </td>
                  <td>
                    {p.receipt.bankReference ?? "—"}
                    {p.receipt.externalReference && (
                      <span className="sor-hint" style={{ display: "block" }}>
                        Pelanggan: {p.receipt.externalReference}
                      </span>
                    )}
                  </td>
                  <td className="sor-num sor-strong">{amount(p.amount, "IDR")}</td>
                  <td>
                    {p.receipt.evidenceId && (
                      <InvoiceEvidenceView
                        invoiceId={invoiceId}
                        evidenceId={p.receipt.evidenceId}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="sor-hint">Belum ada pembayaran.</p>
      )}
      {!!deductions.length && (
        <>
          <h3 className="inv-subhead">Pemotongan</h3>
          <div className="sj-table-wrap">
            <table className="sj-table inv-table">
              <thead>
                <tr>
                  <th>Jenis</th>
                  <th className="sor-num">Nilai</th>
                  <th>Status</th>
                  <th>Bukti potong</th>
                  <th>
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((x) => (
                  <tr key={x.id}>
                    <td className="sor-strong">
                      {x.snapshot?.master?.name ?? "Pemotongan"}
                      {x.mode === "PERCENT" && (
                        <span className="sor-hint" style={{ display: "block" }}>
                          {amount(x.value)}% dari DPP
                        </span>
                      )}
                    </td>
                    <td className="sor-num sor-strong">{amount(x.amount, "IDR")}</td>
                    <td>
                      {x.state === "SETTLED" ? (
                        <RecordBadge state="success" label="Selesai" />
                      ) : (
                        <RecordBadge state="warning" label="Menunggu bukti potong" />
                      )}
                    </td>
                    <td>
                      {x.proofNumber ? (
                        <>
                          {x.proofNumber}
                          <span className="sor-hint" style={{ display: "block" }}>
                            {dateOnly(x.proofDate)}
                          </span>
                        </>
                      ) : (
                        <span className="sor-hint">—</span>
                      )}
                      {x.evidenceId && (
                        <InvoiceEvidenceView invoiceId={invoiceId} evidenceId={x.evidenceId} />
                      )}
                    </td>
                    <td className="sor-num">
                      {x.state === "PENDING_PROOF" && canPost && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setProofFor(x)}
                        >
                          Lengkapi bukti
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {deductions.some((x) => x.state === "PENDING_PROOF") && (
            <p className="sor-hint" style={{ marginTop: 10 }}>
              Pemotongan yang menunggu bukti potong belum mengurangi outstanding.
            </p>
          )}
        </>
      )}
      <ProofDialog
        invoiceId={invoiceId}
        deduction={proofFor}
        onClose={() => setProofFor(null)}
        onDone={() => {
          setProofFor(null);
          onChanged();
        }}
      />
    </section>
  );
}

function ProofDialog({
  invoiceId,
  deduction,
  onClose,
  onDone,
}: {
  invoiceId: string;
  deduction: Deduction | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, pending, setError } = useInvoiceCommand();
  const [evidence, setEvidence] = useState("");
  const [proofNumber, setProofNumber] = useState("");
  const [proofDate, setProofDate] = useState(todayLocal);
  const [settlementDate, setSettlementDate] = useState(todayLocal);
  const [localError, setLocalError] = useState("");
  const confirm = async () => {
    setLocalError("");
    setError("");
    if (!proofNumber.trim()) return setLocalError("Isi nomor bukti potong.");
    if (!proofDate || !settlementDate)
      return setLocalError("Isi tanggal bukti dan tanggal penyelesaian.");
    if (!evidence) return setLocalError("Unggah file bukti potong.");
    try {
      await run(`/invoice-payment-deductions/${deduction!.id}/proof`, {
        evidence_id: evidence,
        proof_number: proofNumber.trim(),
        proof_date: proofDate,
        settlement_date: settlementDate,
      });
      onDone();
    } catch {
      // Pesan server tampil di dialog.
    }
  };
  return (
    <Dialog open={!!deduction} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="sj-dialog sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Lengkapi bukti potong</DialogTitle>
          <DialogDescription>
            {deduction?.snapshot?.master?.name ?? "Pemotongan"} ·{" "}
            {deduction ? amount(deduction.amount, "IDR") : ""}. Setelah disimpan, nilai ini
            mengurangi outstanding invoice.
          </DialogDescription>
        </DialogHeader>
        <div className="sor-grid" style={{ marginTop: 0 }}>
          <label className="sor-field">
            Nomor bukti potong *
            <Input
              value={proofNumber}
              maxLength={200}
              onChange={(e) => setProofNumber(e.target.value)}
            />
          </label>
          <label className="sor-field">
            Tanggal bukti *
            <Input type="date" value={proofDate} onChange={(e) => setProofDate(e.target.value)} />
          </label>
          <label className="sor-field">
            Tanggal penyelesaian *
            <Input
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
            />
            <span className="sor-hint">Tanggal jurnal pelunasan pemotongan.</span>
          </label>
          <div className="sor-field">
            File bukti potong *
            <InvoiceEvidenceUpload
              invoiceId={invoiceId}
              purpose="TAX"
              label="Pilih file"
              onChange={(id) => setEvidence(id)}
            />
          </div>
        </div>
        {(localError || error) && (
          <p role="alert" className="sor-err">
            {localError || error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Batal
          </Button>
          <Button type="button" disabled={pending} onClick={() => void confirm()}>
            {pending ? "Menyimpan…" : "Simpan bukti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
