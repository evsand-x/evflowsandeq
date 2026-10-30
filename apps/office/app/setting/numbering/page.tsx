"use client";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { PageNotice } from "@/components/web/page-frame";
import { IconSearch } from "@/components/web/icons";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../../session-provider";
import {
  documentNumberParts,
  initialResetPeriod,
  nextFromCurrent,
  numberPattern,
} from "../settings-forms";
import { SettingFrame } from "../settings-ui";
import "./numbering.css";

type YearFormat = "YYYY" | "YY";
type MonthFormat = "ARABIC" | "ROMAN";
type ResetPeriod = "YEARLY" | "MONTHLY";
type Row = {
  document_kind: string;
  label: string;
  prefix: string | null;
  digits: number | null;
  year_format: YearFormat | null;
  month_format: MonthFormat | null;
  reset_period: ResetPeriod | null;
  effective_from: string | null;
  /** Nomor terakhir yang sudah terpakai pada periode berjalan (string desimal). */
  current_number: string | null;
  next_preview: string | null;
  pending: { reset_period: ResetPeriod; effective_from: string } | null;
  active: boolean;
};

const key = ["settings", "numbering"] as const;
const today = new Intl.DateTimeFormat("en-CA").format(new Date());

// Pengelompokan modul hanya untuk tab tampilan; server tidak menyimpan modul.
const modules = ["Penjualan", "Gudang", "Keuangan", "Pembelian"] as const;
type Module = (typeof modules)[number];
const moduleOf: Record<string, Module> = {
  sales_order: "Penjualan",
  document_PROFORMA: "Penjualan",
  document_PICKING: "Gudang",
  document_PACKING: "Gudang",
  document_SURAT_JALAN: "Gudang",
  fulfillment: "Gudang",
  goods_receipt: "Gudang",
  sales_invoice: "Keuangan",
  credit_note: "Keuangan",
  customer_receipt: "Keuangan",
  supplier_invoice: "Keuangan",
  purchase_order: "Pembelian",
};
const moduleLabel = (kind: string) => moduleOf[kind] ?? "Lainnya";

const resetName: Record<ResetPeriod, string> = { MONTHLY: "Bulanan", YEARLY: "Tahunan" };
const dateText = (day: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day));
/** Awal periode berikutnya: bulan depan untuk reset bulanan, 1 Januari untuk tahunan. */
function boundary(reset: ResetPeriod) {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return reset === "YEARLY" || m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function NumberSegments({
  parts,
  label,
}: {
  parts: ReturnType<typeof documentNumberParts>;
  label: string;
}) {
  const items: [string, string][] = [
    [parts.prefix, "Prefix"],
    [parts.year, "Tahun"],
    [parts.month, "Bulan"],
    [parts.sequence, "Urutan"],
  ];
  return (
    <div className="nb-segments" role="img" aria-label={label}>
      {items.map(([value, name], index) => (
        <span key={name} className="nb-segment-wrap" aria-hidden="true">
          {index > 0 && <span className="nb-dot">.</span>}
          <span className="nb-segment">
            <b>{value || "—"}</b>
            <small>{name}</small>
          </span>
        </span>
      ))}
    </div>
  );
}

export default function NumberingPage() {
  const { principal } = useSession();
  const canEdit = principal ? hasCompanyPermission(principal, "numbering_rule.manage") : false;
  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await apiRequest<{ data: Row[] }>("/settings/numbering")).data,
  });
  const [tab, setTab] = useState<"Semua" | Module>("Semua");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const rows = query.data ?? [];
  const q = search.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (tab === "Semua" || moduleLabel(r.document_kind) === tab) &&
      (!q || `${r.label} ${r.prefix ?? ""}`.toLowerCase().includes(q)),
  );
  const count = (m: "Semua" | Module) =>
    m === "Semua" ? rows.length : rows.filter((r) => moduleLabel(r.document_kind) === m).length;
  // Contoh susunan memakai Sales Order bila aktif.
  const sample = rows.find((r) => r.document_kind === "sales_order" && r.active);
  const sampleParts = sample
    ? documentNumberParts(
        sample.prefix!,
        sample.year_format!,
        sample.digits!,
        today,
        (BigInt(sample.current_number ?? "0") + 1n).toString(),
        sample.month_format ?? "ARABIC",
      )
    : documentNumberParts("SO", "YYYY", 4, today, "1");
  return (
    <SettingFrame
      title="Penomoran Dokumen"
      subtitle="Format nomor untuk setiap jenis dokumen. Perubahan berlaku untuk dokumen baru."
      permission="numbering_rule.read"
      tabs={
        <nav className="page-frame-subnav" aria-label="Modul">
          {(["Semua", ...modules] as const).map((m) => (
            <a
              key={m}
              href="#"
              aria-current={tab === m ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setTab(m);
              }}
            >
              {m}
              {query.data && <span className="nb-count">{count(m)}</span>}
            </a>
          ))}
        </nav>
      }
    >
      {query.isError ? (
        <PageNotice tone="error" onRetry={() => void query.refetch()}>
          Penomoran belum dapat dimuat.
        </PageNotice>
      ) : !query.data ? (
        <p role="status">Memuat…</p>
      ) : (
        <div className="nb-stack">
          <section className="nb-card nb-layout" aria-labelledby="nb-layout-title">
            <div>
              <h2 id="nb-layout-title">Susunan nomor</h2>
              <p>
                Prefix, tahun dan bulan dokumen (angka atau Romawi), lalu nomor urut. Urutan kembali
                ke 1 setiap awal bulan (reset bulanan) atau awal tahun (reset tahunan).
              </p>
            </div>
            <NumberSegments
              parts={sampleParts}
              label={`Contoh ${sampleParts.prefix}.${sampleParts.year}.${sampleParts.month}.${sampleParts.sequence}`}
            />
          </section>
          <section className="nb-card nb-list" aria-label="Daftar penomoran">
            <div className="nb-toolbar">
              <div className="page-frame-search">
                <IconSearch />
                <Input
                  type="search"
                  aria-label="Cari jenis dokumen atau prefix"
                  placeholder="Cari jenis dokumen atau prefix"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <span className="nb-range">
                {shown.length} dari {rows.length} jenis dokumen
              </span>
            </div>
            <div className="nb-table-wrap">
              <table className="nb-table">
                <thead>
                  <tr>
                    <th scope="col">Jenis dokumen</th>
                    <th scope="col">Format</th>
                    <th scope="col">Reset urutan</th>
                    <th scope="col">Nomor berikutnya</th>
                    <th scope="col">Berlaku sejak</th>
                    {canEdit && (
                      <th scope="col">
                        <span className="sr-only">Aksi</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.document_kind}>
                      <td>
                        <strong className="nb-name">{row.label}</strong>
                        <span className="nb-sub">{moduleLabel(row.document_kind)}</span>
                      </td>
                      <td>
                        {row.active ? (
                          <>
                            <span className="nb-code">
                              {numberPattern(
                                row.prefix!,
                                row.year_format!,
                                row.month_format ?? "ARABIC",
                                row.digits!,
                              )}
                            </span>
                            <span className="nb-sub">
                              {row.digits} digit urutan · bulan{" "}
                              {row.month_format === "ROMAN" ? "Romawi" : "angka"}
                            </span>
                          </>
                        ) : (
                          <span className="nb-sub">Belum diatur</span>
                        )}
                      </td>
                      <td>
                        {row.reset_period ? (
                          <span className="nb-badge">{resetName[row.reset_period]}</span>
                        ) : (
                          "—"
                        )}
                        {row.pending && (
                          <span className="nb-pending">
                            Reset {resetName[row.pending.reset_period].toLowerCase()} mulai{" "}
                            {dateText(row.pending.effective_from)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="nb-code nb-next">{row.next_preview ?? "—"}</span>
                      </td>
                      <td>{row.effective_from ? dateText(row.effective_from) : "—"}</td>
                      {canEdit && (
                        <td className="nb-action">
                          <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                            {row.active ? "Ubah" : "Atur"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!shown.length && (
                <p className="nb-empty">
                  Tidak ada jenis dokumen yang cocok.{" "}
                  <button
                    type="button"
                    className="page-frame-link"
                    onClick={() => {
                      setSearch("");
                      setTab("Semua");
                    }}
                  >
                    Tampilkan semua
                  </button>
                </p>
              )}
            </div>
            <p className="nb-foot">
              Nomor berikutnya adalah perkiraan; nomor final diberikan server saat dokumen disimpan.
              {canEdit ? "" : " Hanya pengguna dengan izin kelola penomoran yang dapat mengubah."}
            </p>
          </section>
        </div>
      )}
      {editing && (
        <EditDialog key={editing.document_kind} row={editing} onClose={() => setEditing(null)} />
      )}
    </SettingFrame>
  );
}

function EditDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const cache = useQueryClient();
  const used = row.current_number ?? "0";
  const [prefix, setPrefix] = useState(row.prefix ?? ""),
    [digits, setDigits] = useState(row.digits ?? 4),
    [yearFormat, setYearFormat] = useState<YearFormat>(row.year_format ?? "YYYY"),
    [monthFormat, setMonthFormat] = useState<MonthFormat>(row.month_format ?? "ARABIC"),
    [resetPeriod, setResetPeriod] = useState<ResetPeriod>(initialResetPeriod(row)),
    [current, setCurrent] = useState(used),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // Satu kunci per dialog: klik ganda atau ulang kirim tidak membuat dua revisi.
  const idempotency = useRef(crypto.randomUUID());
  const prefixOk = /^[A-Z0-9/._-]{1,20}$/.test(prefix);
  const next = nextFromCurrent(current, used);
  const minDigits = Math.max(3, (next ?? used).length);
  const digitsOk = digits >= minDigits && digits <= 10;
  const valid = prefixOk && digitsOk && next !== null;
  const resetChanges = row.active && row.reset_period !== null && resetPeriod !== row.reset_period;
  const parts = useMemo(
    () =>
      documentNumberParts(
        prefixOk ? prefix : "",
        yearFormat,
        digits,
        today,
        next ?? (BigInt(used) + 1n).toString(),
        monthFormat,
      ),
    [prefixOk, prefix, yearFormat, digits, next, used, monthFormat],
  );
  const yearSample = { YYYY: today.slice(0, 4), YY: today.slice(2, 4) };
  const monthSample = documentNumberParts("X", "YYYY", 1, today, "1", "ROMAN").month;
  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/settings/numbering/${row.document_kind}`, {
        method: "PUT",
        headers: { "Idempotency-Key": idempotency.current },
        body: JSON.stringify({
          prefix,
          year_format: yearFormat,
          month_format: monthFormat,
          digits,
          reset_period: resetPeriod,
          ...(current !== used ? { current_number: current } : {}),
        }),
      });
      await cache.invalidateQueries({ queryKey: key });
      toast.success("Format nomor disimpan");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="nb-dialog">
        <DialogHeader>
          <DialogTitle>
            {row.active ? "Ubah" : "Atur"} format {row.label}
          </DialogTitle>
          <DialogDescription>
            Urutan nomor tetap berlanjut; nomor yang sudah terpakai tidak berubah.
          </DialogDescription>
        </DialogHeader>
        <form
          className="nb-form"
          id="nb-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="nb-grid">
            <label className="nb-field">
              <span className="nb-label">Prefix *</span>
              <Input
                className="nb-mono"
                value={prefix}
                maxLength={20}
                aria-invalid={!prefixOk}
                aria-describedby="nb-prefix-hint"
                onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/\s/g, ""))}
              />
              <span id="nb-prefix-hint" className={prefixOk ? "nb-hint" : "nb-hint nb-bad"}>
                {prefixOk
                  ? "Huruf besar, angka, atau / . _ - (maks. 20)."
                  : "Isi prefix: huruf besar, angka, atau / . _ - saja."}
              </span>
            </label>
            <div className="nb-field" role="group" aria-labelledby="nb-digits-label">
              <span className="nb-label" id="nb-digits-label">
                Jumlah digit urutan *
              </span>
              <div className="nb-stepper">
                <button
                  type="button"
                  aria-label="Kurangi digit"
                  disabled={digits <= 3}
                  onClick={() => setDigits((d) => Math.max(3, d - 1))}
                >
                  −
                </button>
                <span aria-live="polite">{digits}</span>
                <button
                  type="button"
                  aria-label="Tambah digit"
                  disabled={digits >= 10}
                  onClick={() => setDigits((d) => Math.min(10, d + 1))}
                >
                  +
                </button>
              </div>
              <span className={digitsOk ? "nb-hint" : "nb-hint nb-bad"}>
                {digitsOk
                  ? "Antara 3 dan 10."
                  : `Minimal ${minDigits} digit agar nomor ${next ?? ""} muat.`}
              </span>
            </div>
          </div>
          <div className="nb-grid">
            <div className="nb-field" role="group" aria-labelledby="nb-year-label">
              <span className="nb-label" id="nb-year-label">
                Format tahun
              </span>
              <div className="nb-seg">
                {(["YYYY", "YY"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={yearFormat === f}
                    aria-label={f === "YYYY" ? "4 digit" : "2 digit"}
                    onClick={() => setYearFormat(f)}
                  >
                    {yearSample[f]}
                  </button>
                ))}
              </div>
            </div>
            <div className="nb-field" role="group" aria-labelledby="nb-month-label">
              <span className="nb-label" id="nb-month-label">
                Format bulan
              </span>
              <div className="nb-seg">
                <button
                  type="button"
                  aria-pressed={monthFormat === "ARABIC"}
                  onClick={() => setMonthFormat("ARABIC")}
                >
                  Angka · {today.slice(5, 7)}
                </button>
                <button
                  type="button"
                  aria-pressed={monthFormat === "ROMAN"}
                  onClick={() => setMonthFormat("ROMAN")}
                >
                  Romawi · {monthSample}
                </button>
              </div>
            </div>
          </div>
          <fieldset className="nb-field">
            <legend className="nb-label">Reset urutan</legend>
            <div className="nb-options">
              {(["MONTHLY", "YEARLY"] as const).map((p) => (
                <label key={p} className="nb-option" data-on={resetPeriod === p}>
                  <input
                    type="radio"
                    name="nb-reset"
                    checked={resetPeriod === p}
                    onChange={() => setResetPeriod(p)}
                  />
                  <span>
                    <strong>{resetName[p]}</strong>
                    <span className="nb-hint">
                      Kembali ke 1 setiap awal {p === "MONTHLY" ? "bulan" : "tahun"}.
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {resetChanges && (
              <span className="nb-hint nb-warn">
                Perubahan reset berlaku mulai {dateText(boundary(resetPeriod))}; sampai saat itu
                urutan tetap reset {resetName[row.reset_period!].toLowerCase()}.
              </span>
            )}
          </fieldset>
          <label className="nb-field">
            <span className="nb-label">Nomor saat ini *</span>
            <Input
              className="nb-mono nb-current"
              inputMode="numeric"
              value={current}
              aria-invalid={next === null}
              aria-describedby="nb-current-hint"
              onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
            />
            <span id="nb-current-hint" className={next === null ? "nb-hint nb-bad" : "nb-hint"}>
              {next === null
                ? `Tidak boleh lebih kecil dari ${used}, nomor terakhir yang sudah terpakai.`
                : `Nomor terakhir yang sudah terpakai pada periode ini. Dokumen berikutnya memakai ${next}.`}
            </span>
          </label>
          <div className="nb-preview">
            <span className="nb-hint nb-strong">Contoh nomor berikutnya</span>
            <NumberSegments
              parts={parts}
              label={`${parts.prefix}.${parts.year}.${parts.month}.${parts.sequence}`}
            />
            {row.next_preview && (
              <span className="nb-hint">
                Sebelumnya: <span className="nb-code">{row.next_preview}</span>
              </span>
            )}
          </div>
          {error && <PageNotice tone="error">{error}</PageNotice>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="nb-form" disabled={!valid || busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
