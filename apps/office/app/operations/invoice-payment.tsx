"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetaItem, OfficePage, PageNotice, RecordBadge } from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { amount } from "./sales-order-types";
import { dateOnly, parseRupiah, rupiahInput, todayLocal } from "./invoice-utils";
import { useInvoiceCommand } from "./invoice-command";
import { InvoiceEvidenceUpload } from "./invoice-evidence";
import "./sales-order-r1.css";
import "./surat-jalan-form.css";
import "./invoice.css";

const D = Decimal.clone({ precision: 50 });
const base = "/operations/invoices";
const percentPattern = /^\d{1,3}([.,]\d{1,4})?$/;

type PaymentForm = {
  invoice: {
    id: string;
    number: string;
    customer: { id: string; code: string; name: string };
    subtotal: string;
    currency: string;
    invoiceDate: string | null;
    dueDate: string | null;
    total: string;
    outstandingAmount: string;
    cashPaidAmount: string;
    settledAmount: string;
  };
  banks: { id: string; name: string; bankName: string | null; lastFour: string | null }[];
  taxes: {
    id: string;
    name: string;
    accountId: string;
    percentage: string;
    decimalPlaces: number;
    rounding: string;
  }[];
  accounts: { id: string; code: string; name: string }[];
  deduction_types: {
    id: string;
    name: string;
    settleAccountId: string;
    proofRequired: boolean;
    proofType: string;
  }[];
  pending_proof_amount: string;
};
/** Sumber pemotongan: pajak potong (Setting › Pajak) atau Jenis Potongan (Setting). */
type Source = {
  key: string;
  type: "TAX" | "DEDUCTION_TYPE";
  id: string;
  name: string;
  accountId: string;
  proofRequired: boolean;
  percentage: string | null;
  decimals: number;
  rounding: Decimal.Rounding;
};
type Cut = {
  row: number;
  source: string;
  mode: "PERCENT" | "AMOUNT";
  percent: string;
  nominal: string;
  proofNumber: string;
  proofDate: string;
  evidence: string;
};
const roundingOf: Record<string, Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  DOWN: Decimal.ROUND_DOWN,
};

/** Terima Pembayaran (canvas Payment-form): satu invoice, satu perintah atomik di server. */
export function InvoicePaymentPage({ id }: { id: string }) {
  const { principal } = useSession();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const q = useQuery({
    queryKey: ["invoices", principal?.company_id, "payment-form", id],
    queryFn: ({ signal }) =>
      apiRequest<{ data: PaymentForm }>(`/sales-invoices/${id}/payment-form`, { signal }),
  });
  const data = q.data?.data;
  const allowed = can("customer_receipt.post") && can("sales_invoice.view_price");
  return (
    <OfficePage
      section="finance"
      crumbs={[
        { label: "Finance" },
        { label: "Invoice & Pembayaran", href: base },
        { label: data?.invoice.number ?? "Invoice", href: `${base}/${id}` },
        { label: "Terima Pembayaran" },
      ]}
      title="Terima Pembayaran"
      meta={
        <>
          <MetaItem label="Status">
            <RecordBadge state="neutral" label="Belum disimpan" />
          </MetaItem>
          {data && (
            <MetaItem label="Invoice">
              <span className="inv-meta-text">{data.invoice.number}</span>
            </MetaItem>
          )}
        </>
      }
      actions={
        <Button variant="outline" asChild>
          <Link href={`${base}/${id}`}>Kembali</Link>
        </Button>
      }
    >
      {!allowed ? (
        <PageNotice tone="error">Anda tidak memiliki izin mencatat pembayaran.</PageNotice>
      ) : q.isError ? (
        <PageNotice tone="error" onRetry={() => void q.refetch()}>
          {q.error.message}
        </PageNotice>
      ) : !data ? (
        <p role="status">Memuat invoice…</p>
      ) : new D(data.invoice.outstandingAmount).lte(0) ? (
        <PageNotice tone="info">
          Invoice ini sudah lunas.{" "}
          <Link className="page-frame-link" href={`${base}/${id}`}>
            Lihat invoice
          </Link>
        </PageNotice>
      ) : (
        <PaymentFormBody data={data} />
      )}
    </OfficePage>
  );
}

function PaymentFormBody({ data }: { data: PaymentForm }) {
  const router = useRouter();
  const inv = data.invoice;
  const { run, error, pending } = useInvoiceCommand();
  const [date, setDate] = useState(todayLocal);
  const [bank, setBank] = useState(data.banks.length === 1 ? data.banks[0]!.id : "");
  const [amountRaw, setAmountRaw] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [extRef, setExtRef] = useState("");
  const [proof, setProof] = useState({ id: "", name: "" });
  const [cutOn, setCutOn] = useState(false);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [seq, setSeq] = useState(1);
  const [tried, setTried] = useState(false);

  const accountName = (accountId: string) => {
    const a = data.accounts.find((x) => x.id === accountId);
    return a ? `${a.code} · ${a.name}` : "Akun tidak aktif";
  };
  const sources: Source[] = [
    ...data.taxes.map((t) => ({
      key: `TAX:${t.id}`,
      type: "TAX" as const,
      id: t.id,
      name: t.name,
      accountId: t.accountId,
      proofRequired: true,
      percentage: t.percentage,
      decimals: t.decimalPlaces,
      rounding: roundingOf[t.rounding] ?? Decimal.ROUND_HALF_UP,
    })),
    ...data.deduction_types.map((t) => ({
      key: `DEDUCTION_TYPE:${t.id}`,
      type: "DEDUCTION_TYPE" as const,
      id: t.id,
      name: t.name,
      accountId: t.settleAccountId,
      proofRequired: t.proofRequired,
      percentage: null,
      decimals: 8,
      rounding: Decimal.ROUND_HALF_UP,
    })),
  ];
  const outstanding = new D(inv.outstandingAmount);
  const amountValue = parseRupiah(amountRaw);
  const received = amountValue ? new D(amountValue) : new D(0);
  // Sama dengan server: persen dihitung dari DPP (subtotal) invoice, dibulatkan per aturan pajak.
  const rows = (cutOn ? cuts : []).map((c) => {
    const source = sources.find((s) => s.key === c.source);
    const percent = c.percent.replace(",", ".");
    const valid =
      c.mode === "PERCENT"
        ? percentPattern.test(c.percent) && new D(percent).gt(0) && new D(percent).lte(100)
        : !!parseRupiah(c.nominal) && new D(parseRupiah(c.nominal)!).gt(0);
    const value = !valid
      ? new D(0)
      : c.mode === "PERCENT"
        ? new D(inv.subtotal)
            .mul(percent)
            .div(100)
            .toDecimalPlaces(source?.decimals ?? 8, source?.rounding ?? Decimal.ROUND_HALF_UP)
        : new D(parseRupiah(c.nominal)!);
    const withProof = !!c.evidence;
    const pendingProof = !!source?.proofRequired && !withProof;
    return { ...c, source, valid, value, pendingProof, percentText: percent };
  });
  const cutTotal = rows.reduce((s, r) => s.add(r.value), new D(0));
  const settledCuts = rows
    .filter((r) => !r.pendingProof)
    .reduce((s, r) => s.add(r.value), new D(0));
  const pendingCuts = cutTotal.sub(settledCuts);
  const proposed = received.add(cutTotal);
  const rest = outstanding.sub(received).sub(settledCuts);
  const after = rest.lte(0)
    ? { label: "Lunas", tone: "success" }
    : pendingCuts.gt(0) && rest.eq(pendingCuts)
      ? { label: "Menunggu bukti potong", tone: "warning" }
      : { label: "Dibayar sebagian", tone: "warning" };
  const invDate = inv.invoiceDate?.slice(0, 10) ?? "";
  const e = {
    date: !date
      ? "Isi tanggal terima."
      : invDate && date < invDate
        ? "Tanggal terima tidak boleh sebelum tanggal invoice."
        : "",
    bank: !bank ? "Pilih akun kas/bank." : "",
    amount: !amountValue || received.lte(0) ? "Nominal diterima harus lebih dari 0." : "",
    ref: !bankRef.trim() ? "Isi referensi bank." : "",
    proof: !proof.id ? "Unggah bukti transfer." : "",
    cut:
      cutOn &&
      (!rows.length ||
        rows.some((r) => !r.source || !r.valid) ||
        new Set(rows.map((r) => r.source?.key)).size !== rows.length)
        ? "Lengkapi jenis dan nilai setiap pemotongan; satu jenis hanya sekali."
        : cutOn && rows.some((r) => r.evidence && (!r.proofNumber.trim() || !r.proofDate))
          ? "Isi nomor dan tanggal bukti potong untuk bukti yang diunggah."
          : "",
    exceed: proposed.gt(outstanding)
      ? `Nominal diterima ditambah pemotongan melebihi outstanding ${amount(outstanding.toString(), "IDR")}.`
      : "",
  };
  const show = (k: keyof typeof e) => tried && !!e[k];
  const errorCount = Object.values(e).filter(Boolean).length;
  const updateCut = (row: number, patch: Partial<Cut>) =>
    setCuts((old) => old.map((c) => (c.row === row ? { ...c, ...patch } : c)));
  const addCut = () => {
    setCuts((old) => [
      ...old,
      {
        row: seq,
        source: "",
        mode: "PERCENT",
        percent: "",
        nominal: "",
        proofNumber: "",
        proofDate: todayLocal(),
        evidence: "",
      },
    ]);
    setSeq(seq + 1);
  };

  const save = async () => {
    setTried(true);
    if (errorCount) return;
    try {
      await run(`/sales-invoices/${inv.id}/payments`, {
        received_date: date,
        bank_account_id: bank,
        amount: received.toString(),
        bank_reference: bankRef.trim(),
        ...(extRef.trim() ? { external_reference: extRef.trim() } : {}),
        evidence_id: proof.id,
        deductions: rows.map((r) => ({
          source_type: r.source!.type,
          source_id: r.source!.id,
          mode: r.mode,
          value: r.mode === "PERCENT" ? new D(r.percentText).toString() : r.value.toString(),
          ...(r.evidence
            ? {
                evidence_id: r.evidence,
                proof_number: r.proofNumber.trim(),
                proof_date: r.proofDate,
              }
            : {}),
        })),
      });
      router.push(`${base}/${inv.id}?paid=1`);
    } catch {
      // Pesan server tampil di atas form; tidak ada yang tersimpan bila ditolak.
    }
  };

  return (
    <form
      className="web-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {error && <PageNotice tone="error">{error}</PageNotice>}
      <fieldset
        disabled={pending}
        className="sor-layout"
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <div className="sor-main">
          <section className="sor-panel" aria-labelledby="pay-inv">
            <h2 id="pay-inv">Invoice</h2>
            <p className="sor-desc">Diisi dari invoice yang dipilih; tidak dapat diubah di sini.</p>
            <dl className="sor-kv sor-grid">
              <div>
                <dt>Nomor Invoice</dt>
                <dd>
                  <Link className="page-frame-link" href={`${base}/${inv.id}`}>
                    {inv.number}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Pelanggan</dt>
                <dd>{inv.customer.name}</dd>
              </div>
              <div>
                <dt>Tanggal Invoice</dt>
                <dd>{dateOnly(inv.invoiceDate)}</dd>
              </div>
              <div>
                <dt>Jatuh tempo</dt>
                <dd>{dateOnly(inv.dueDate)}</dd>
              </div>
              <div>
                <dt>Total Invoice</dt>
                <dd>{amount(inv.total, "IDR")}</dd>
              </div>
              <div>
                <dt>Sudah dibayar</dt>
                <dd>{amount(inv.settledAmount, "IDR")}</dd>
              </div>
              <div>
                <dt>Outstanding</dt>
                <dd className="inv-warn">{amount(inv.outstandingAmount, "IDR")}</dd>
              </div>
              {new D(data.pending_proof_amount).gt(0) && (
                <div>
                  <dt>Pemotongan menunggu bukti</dt>
                  <dd>{amount(data.pending_proof_amount, "IDR")}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="sor-panel" aria-labelledby="pay-recv">
            <h2 id="pay-recv">Penerimaan</h2>
            <p className="sor-desc">
              Isi sesuai mutasi rekening. Invoice berubah setelah pembayaran disimpan.
            </p>
            <div className="sor-grid">
              <label className="sor-field">
                Tanggal terima *
                <Input
                  type="date"
                  value={date}
                  aria-invalid={show("date") || undefined}
                  onChange={(ev) => setDate(ev.target.value)}
                />
                <span className={show("date") ? "sor-err" : "sor-hint"}>
                  {show("date") ? e.date : "Tanggal uang masuk ke rekening."}
                </span>
              </label>
              <label className="sor-field">
                Akun kas/bank *
                <select
                  className="sj-select"
                  value={bank}
                  aria-invalid={show("bank") || undefined}
                  onChange={(ev) => setBank(ev.target.value)}
                >
                  <option value="">Pilih akun kas/bank</option>
                  {data.banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.lastFour ? ` · ****${b.lastFour}` : ""}
                    </option>
                  ))}
                </select>
                <span className={show("bank") ? "sor-err" : "sor-hint"}>
                  {show("bank")
                    ? e.bank
                    : data.banks.length
                      ? "Daftar dari Setting › Kas & Bank."
                      : "Belum ada akun kas/bank aktif. Tambahkan di Setting › Kas & Bank."}
                </span>
              </label>
              <label className="sor-field">
                Nominal diterima *
                <span className="inv-amount">
                  <Input
                    inputMode="decimal"
                    className="sor-num"
                    placeholder="Rp 0"
                    value={amountRaw ? `Rp ${rupiahInput(amountRaw)}` : ""}
                    aria-invalid={show("amount") || undefined}
                    onChange={(ev) => setAmountRaw(ev.target.value.replace(/^Rp\s?/, ""))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setAmountRaw(D.max(0, outstanding.sub(cutTotal)).toString().replace(".", ","))
                    }
                  >
                    Lunasi
                  </Button>
                </span>
                <span className={show("amount") ? "sor-err" : "sor-hint"}>
                  {show("amount")
                    ? e.amount
                    : received.gt(0) && rest.gt(0)
                      ? `Pembayaran sebagian. Sisa ${amount(rest.toString(), "IDR")} tetap outstanding.`
                      : received.gt(0) && rest.lte(0) && !e.exceed
                        ? "Invoice akan lunas."
                        : "Uang yang benar-benar masuk ke rekening."}
                </span>
              </label>
              <label className="sor-field">
                Referensi bank *
                <Input
                  value={bankRef}
                  maxLength={200}
                  placeholder="Nomor mutasi / referensi transfer"
                  aria-invalid={show("ref") || undefined}
                  onChange={(ev) => setBankRef(ev.target.value)}
                />
                <span className={show("ref") ? "sor-err" : "sor-hint"}>
                  {show("ref") ? e.ref : "Harus unik per akun kas/bank."}
                </span>
              </label>
              <label className="sor-field">
                <span>
                  Referensi pelanggan <span className="sor-hint">Opsional</span>
                </span>
                <Input
                  value={extRef}
                  maxLength={200}
                  onChange={(ev) => setExtRef(ev.target.value)}
                />
              </label>
              <div className="sor-field">
                Bukti transfer *
                <InvoiceEvidenceUpload
                  invoiceId={inv.id}
                  purpose="PAYMENT"
                  label={proof.id ? "Ganti file" : "Pilih file"}
                  invalid={show("proof")}
                  onChange={(id, name) => setProof({ id, name })}
                />
                {show("proof") && <span className="sor-err">{e.proof}</span>}
              </div>
            </div>
          </section>

          <section className="sor-panel inv-cuts" aria-labelledby="pay-cut">
            <label className="inv-toggle">
              <input
                type="checkbox"
                checked={cutOn}
                onChange={(ev) => {
                  setCutOn(ev.target.checked);
                  if (ev.target.checked && !cuts.length) addCut();
                }}
              />
              <span>
                <strong id="pay-cut">Pemotongan</strong>
                <span className="sor-hint">
                  Aktifkan bila pelanggan memotong pembayaran, misalnya PPh 23 atau biaya bank.
                </span>
              </span>
            </label>
            {cutOn && (
              <>
                <div className="sj-table-wrap">
                  <table className="sj-table inv-cut-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th>Jenis Pemotongan</th>
                        <th>Akun</th>
                        <th>Nilai (% atau Nominal)</th>
                        <th>
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    {rows.map((r, i) => (
                      <tbody key={r.row}>
                        <tr>
                          <td>{i + 1}</td>
                          <td>
                            <select
                              className="sj-select"
                              aria-label={`Jenis pemotongan baris ${i + 1}`}
                              value={r.source?.key ?? ""}
                              onChange={(ev) => {
                                const s = sources.find((x) => x.key === ev.target.value);
                                updateCut(r.row, {
                                  source: ev.target.value,
                                  mode: s?.percentage ? "PERCENT" : "AMOUNT",
                                  percent: s?.percentage
                                    ? new D(s.percentage).toString().replace(".", ",")
                                    : "",
                                  nominal: "",
                                  evidence: "",
                                });
                              }}
                            >
                              <option value="">Pilih jenis</option>
                              {sources.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="inv-cut-account">
                            {r.source ? (
                              accountName(r.source.accountId)
                            ) : (
                              <span className="sor-hint">Dari jenis</span>
                            )}
                          </td>
                          <td>
                            <span className="inv-cut-value">
                              <span
                                className="inv-seg"
                                role="group"
                                aria-label={`Satuan nilai baris ${i + 1}`}
                              >
                                <button
                                  type="button"
                                  aria-pressed={r.mode === "PERCENT"}
                                  onClick={() => updateCut(r.row, { mode: "PERCENT" })}
                                >
                                  %
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={r.mode === "AMOUNT"}
                                  onClick={() =>
                                    updateCut(r.row, {
                                      mode: "AMOUNT",
                                      nominal:
                                        r.nominal || (r.value.gt(0) ? r.value.toString() : ""),
                                    })
                                  }
                                >
                                  Rp
                                </button>
                              </span>
                              <Input
                                inputMode="decimal"
                                className="sor-num"
                                aria-label={
                                  r.mode === "PERCENT"
                                    ? `Persen pemotongan baris ${i + 1}`
                                    : `Nominal pemotongan baris ${i + 1}`
                                }
                                placeholder={r.mode === "PERCENT" ? "0" : "Rp 0"}
                                value={
                                  r.mode === "PERCENT"
                                    ? r.percent
                                    : r.nominal
                                      ? rupiahInput(r.nominal)
                                      : ""
                                }
                                onChange={(ev) =>
                                  updateCut(
                                    r.row,
                                    r.mode === "PERCENT"
                                      ? { percent: ev.target.value.trim() }
                                      : { nominal: ev.target.value },
                                  )
                                }
                              />
                            </span>
                            <span className="sor-hint" style={{ display: "block", marginTop: 4 }}>
                              {r.mode === "PERCENT"
                                ? `= ${amount(r.value.toString(), "IDR")} dari DPP`
                                : "Nominal tetap"}
                            </span>
                          </td>
                          <td className="sor-num">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Hapus pemotongan baris ${i + 1}`}
                              onClick={() => setCuts((old) => old.filter((c) => c.row !== r.row))}
                            >
                              Hapus
                            </Button>
                          </td>
                        </tr>
                        {r.source?.proofRequired && (
                          <tr className="inv-proof-row">
                            <td />
                            <td colSpan={4}>
                              <div className="inv-proof">
                                <label className="sor-field">
                                  Nomor bukti potong
                                  <Input
                                    value={r.proofNumber}
                                    maxLength={200}
                                    onChange={(ev) =>
                                      updateCut(r.row, { proofNumber: ev.target.value })
                                    }
                                  />
                                </label>
                                <label className="sor-field">
                                  Tanggal bukti
                                  <Input
                                    type="date"
                                    value={r.proofDate}
                                    onChange={(ev) =>
                                      updateCut(r.row, { proofDate: ev.target.value })
                                    }
                                  />
                                </label>
                                <div className="sor-field">
                                  File bukti potong
                                  <InvoiceEvidenceUpload
                                    invoiceId={inv.id}
                                    purpose="TAX"
                                    label={r.evidence ? "Ganti file" : "Pilih file"}
                                    onChange={(id) => updateCut(r.row, { evidence: id })}
                                  />
                                </div>
                              </div>
                              <p className="sor-hint">
                                {r.evidence
                                  ? "Bukti potong lengkap: pemotongan langsung mengurangi outstanding."
                                  : "Boleh menyusul. Tanpa bukti, pemotongan tercatat menunggu bukti dan belum mengurangi outstanding."}
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    ))}
                  </table>
                </div>
                <div className="inv-cut-foot">
                  <Button type="button" variant="outline" size="sm" onClick={addCut}>
                    + Pemotongan
                  </Button>
                  <span className="sor-hint">
                    Pilih % (dihitung dari DPP invoice {amount(inv.subtotal, "IDR")}) atau Rp untuk
                    nominal tetap. Akun mengikuti jenis pemotongan.
                  </span>
                </div>
                {show("cut") && <p className="sor-err">{e.cut}</p>}
              </>
            )}
          </section>
        </div>

        <aside className="sor-aside" aria-label="Ringkasan pembayaran">
          <section className="sor-side" aria-labelledby="pay-sum">
            <h2 id="pay-sum">Ringkasan</h2>
            <dl style={{ margin: 0 }}>
              <div className="sor-sum">
                <dt>Outstanding</dt>
                <dd>{amount(outstanding.toString(), "IDR")}</dd>
              </div>
              <div className="sor-sum">
                <dt>Nominal diterima</dt>
                <dd>{amount(received.toString(), "IDR")}</dd>
              </div>
              <div className="sor-sum">
                <dt>Pemotongan</dt>
                <dd>{amount(settledCuts.toString(), "IDR")}</dd>
              </div>
              {pendingCuts.gt(0) && (
                <div className="sor-sum">
                  <dt>Pemotongan menunggu bukti</dt>
                  <dd>{amount(pendingCuts.toString(), "IDR")}</dd>
                </div>
              )}
              <div className="sor-sum sor-sum-total">
                <dt>Sisa outstanding</dt>
                <dd>{amount(D.max(0, rest).toString(), "IDR")}</dd>
              </div>
              <div className="sor-sum inv-after">
                <dt>Status setelah disimpan</dt>
                <dd>
                  <RecordBadge state={after.tone} label={after.label} />
                </dd>
              </div>
            </dl>
            {e.exceed && (
              <p role="alert" className="sor-err" style={{ marginTop: 8 }}>
                {e.exceed}
              </p>
            )}
          </section>
          <section className="sor-side" aria-labelledby="pay-checks">
            <h2 id="pay-checks">Diperiksa saat disimpan</h2>
            <p className="sor-hint" style={{ marginBottom: 10 }}>
              Server mengulang semua pemeriksaan ini.
            </p>
            <ul className="inv-checks">
              <li>Periode akuntansi tanggal terima masih terbuka</li>
              <li>Akun kas/bank aktif dari Setting</li>
              <li>Alokasi tidak melebihi outstanding terbaru</li>
              <li>Satu penerimaan tidak tercatat dua kali</li>
            </ul>
          </section>
        </aside>
      </fieldset>

      <footer className="sor-footer">
        <p>
          {pending
            ? "Menyimpan…"
            : tried && errorCount
              ? `${errorCount} isian perlu diperbaiki.`
              : "Penerimaan, alokasi dan jurnal tersimpan sekaligus."}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => router.push(`${base}/${inv.id}`)}
        >
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan Pembayaran"}
        </Button>
      </footer>
    </form>
  );
}
