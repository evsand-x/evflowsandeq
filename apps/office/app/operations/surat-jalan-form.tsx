"use client";
import { useEffect, useMemo, useState } from "react";
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
import { useNoteCommand } from "./surat-jalan-command";
import { amount, effectiveTaxPercent } from "./sales-order-types";
import { quantityText } from "./surat-jalan-utils";
import "./sales-order-r1.css";
import "./surat-jalan-form.css";

const D = Decimal.clone({ precision: 50 });
const base = "/operations/delivery-notes";
const api = "/delivery-notes";
const qtyPattern = /^\d{1,14}(\.\d{1,10})?$/;
const moneyPattern = /^\d{1,16}(\.\d{1,8})?$/;

type FormLine = {
  id: string;
  productId: string;
  product: { code: string; name: string };
  unit: string;
  ordered: string;
  issued: string;
  remaining: string;
  unitPrice: string;
  tax: { rate: string; dppFactor: string } | null;
  stock: string | null;
};
type FormNote = {
  id: string;
  number: string;
  state: "DRAFT" | "ISSUED" | "CANCELLED";
  notes: string | null;
  documentDate: string | null;
  shipDate: string | null;
  freightAmount: string | null;
  carrierName: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  warehouseId: string | null;
  lines: { salesOrderLineId: string; quantity: string; warehouseId: string | null }[];
};
type FormData = {
  order: {
    id: string;
    number: string;
    state: string;
    orderDate: string;
    currency: string;
    customer: { id: string; name: string };
    deliveryAddress: string | null;
    paymentTerm: string | null;
    freight: { payer?: string } | null;
    freightEstimate: string | null;
  };
  lines: FormLine[];
  note: FormNote | null;
  warehouseId: string | null;
  warehouses: { id: string; code: string; name: string }[];
  nextNumber: string | null;
  today: string;
  timezone: string | null;
  carriers: string[];
};
type Carrier = { name: string; vehicle: string; driver: string };

const dateText = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
/** Form Surat Jalan (canvas SJ-form): draft baru dari SO atau ubah draft, lalu terbitkan. */
export function SuratJalanFormPage({ orderId, noteId }: { orderId?: string; noteId?: string }) {
  const { principal } = useSession();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const canDispatch = can("fulfillment.dispatch");
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const params = new URLSearchParams(
    noteId ? { delivery_note_id: noteId } : { sales_order_id: orderId ?? "" },
  );
  if (warehouseId) params.set("warehouse_id", warehouseId);
  const endpoint = `/delivery-notes/form?${params}`;
  const form = useQuery({
    queryKey: ["surat-jalan", "form", principal?.company_id, endpoint],
    queryFn: ({ signal }) => apiRequest<{ data: FormData }>(endpoint, { signal }),
    placeholderData: (previous) => previous,
  });
  const data = form.data?.data;
  const status = data?.note
    ? data.note.state === "ISSUED"
      ? { label: "Terbit", tone: "success" }
      : { label: "Draft", tone: "info" }
    : { label: "Draft baru", tone: "neutral" };
  return (
    <OfficePage
      section="warehouse"
      crumbs={[
        { label: "Warehouse & Logistik" },
        { label: "Surat Jalan", href: base },
        { label: data?.note?.number ?? "Baru" },
      ]}
      title={data?.note?.number ?? "Surat Jalan baru"}
      meta={
        <>
          <MetaItem label="Status">
            <RecordBadge state={status.tone} label={status.label} />
          </MetaItem>
          <MetaItem label="Stok & saldo">
            <RecordBadge state="neutral" label="Belum berubah (draft)" />
          </MetaItem>
        </>
      }
      actions={
        <Button variant="outline" asChild>
          <Link href={base}>Kembali</Link>
        </Button>
      }
    >
      {!can("outbound_shipping.read") ? (
        <PageNotice tone="error">Anda tidak memiliki izin melihat Surat Jalan.</PageNotice>
      ) : form.isError ? (
        <PageNotice tone="error" onRetry={() => void form.refetch()}>
          {form.error.message}
        </PageNotice>
      ) : !data ? (
        <p role="status">Memuat data Surat Jalan…</p>
      ) : data.note && data.note.state !== "DRAFT" ? (
        <PageNotice tone="info">
          Surat Jalan ini sudah terbit dan tidak dapat diubah.{" "}
          <Link className="page-frame-link" href={`${base}/${data.note.id}`}>
            Buka Surat Jalan
          </Link>
        </PageNotice>
      ) : (
        <SuratJalanForm
          key={`${data.note?.id ?? "new"}`}
          data={data}
          canDispatch={canDispatch}
          canReadOrder={can("sales_order.read")}
          onWarehouse={setWarehouseId}
        />
      )}
    </OfficePage>
  );
}

function SuratJalanForm({
  data,
  canDispatch,
  canReadOrder,
  onWarehouse,
}: {
  data: FormData;
  canDispatch: boolean;
  canReadOrder: boolean;
  onWarehouse: (id: string) => void;
}) {
  const router = useRouter();
  const note = data.note;
  const [savedId, setSavedId] = useState(note?.id);
  const { run, error, pending, setError } = useNoteCommand();
  const [number, setNumber] = useState(note?.number ?? data.nextNumber ?? "");
  const [documentDate, setDocumentDate] = useState(note?.documentDate ?? data.today);
  const [shipDate, setShipDate] = useState(note?.shipDate ?? data.today);
  const [notes, setNotes] = useState(note?.notes ?? "");
  const [freight, setFreight] = useState(
    note?.freightAmount ??
      (data.order.freight?.payer === "CUSTOMER" ? (data.order.freightEstimate ?? "") : ""),
  );
  const [carrier, setCarrier] = useState<Carrier>({
    name: note?.carrierName ?? "",
    vehicle: note?.vehicleNumber ?? "",
    driver: note?.driverName ?? "",
  });
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      data.lines.map((l) => {
        const draft = note?.lines.find((n) => n.salesOrderLineId === l.id);
        return [
          l.id,
          draft ? new D(draft.quantity).toString() : new D(l.remaining).gt(0) ? l.remaining : "",
        ];
      }),
    ),
  );
  const [tried, setTried] = useState(false);
  const [dirty, setDirty] = useState(!note);
  const [carrierOpen, setCarrierOpen] = useState(false);
  const touch = () => setDirty(true);

  const freightPayer = data.order.freight?.payer;
  const lines = data.lines.map((l) => {
    const open = new D(l.remaining).gt(0);
    const raw = qty[l.id] ?? "";
    const value = qtyPattern.test(raw) ? new D(raw) : null;
    let message = "";
    let tone: "hint" | "warn" | "err" = "hint";
    if (open && raw) {
      if (!value || value.lte(0)) {
        message = "Isi angka lebih dari 0, titik untuk desimal.";
        tone = "err";
      } else if (value.gt(l.remaining)) {
        message = `Maksimal sisa SO ${quantityText(l.remaining, l.unit)}.`;
        tone = "err";
      } else if (l.stock !== null && value.gt(l.stock)) {
        message = `Stok layak hanya ${quantityText(l.stock, l.unit)}. Penerbitan akan ditolak.`;
        tone = "warn";
      } else if (value.lt(l.remaining)) {
        message = `Sisa ${quantityText(new D(l.remaining).sub(value).toString(), l.unit)} tetap terbuka di SO.`;
      }
    }
    return { ...l, open, raw, value, message, tone };
  });
  const sending = lines.filter((l) => l.open && l.value && l.value.gt(0) && l.tone !== "err");
  const lineErrors = lines.some((l) => l.tone === "err");
  const goods = sending.reduce((s, l) => s.add(l.value!.mul(l.unitPrice)), new D(0));
  const tax = sending.reduce(
    (s, l) =>
      l.tax
        ? s.add(
            l
              .value!.mul(l.unitPrice)
              .mul(l.tax.dppFactor)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
              .mul(l.tax.rate)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          )
        : s,
    new D(0),
  );
  const firstTax = data.lines.find((l) => l.tax)?.tax;
  const freightValid = !freight.trim() || moneyPattern.test(freight.trim());
  // Sama dengan server: ongkir ditagihkan hanya bila ongkir SO ditanggung pelanggan; nilai yang
  // diisi menggantikan estimasi SO. Bila ditanggung perusahaan, nilai hanya dicatat sebagai biaya.
  const freightBilled =
    freightPayer !== "CUSTOMER"
      ? new D(0)
      : freightValid && freight.trim()
        ? new D(freight)
        : new D(data.order.freightEstimate ?? 0);
  const totalQty = sending.reduce((s, l) => s.add(l.value!), new D(0));
  const units = new Set(sending.map((l) => l.unit));
  const numberError = !number.trim() ? "Nomor SJ wajib diisi." : "";
  const missing = {
    number: !!numberError,
    lines: !sending.length || lineErrors,
    warehouse: !data.warehouseId,
    dates: !documentDate || !shipDate,
    freight: !freightValid,
  };

  const payload = () => ({
    sales_order_id: data.order.id,
    // Nomor hanya dikirim bila diubah: tanpa nomor server memakai urutan Setting.
    ...((note ? number.trim() !== note.number : number.trim() !== data.nextNumber)
      ? { number: number.trim() }
      : {}),
    warehouse_id: data.warehouseId!,
    document_date: documentDate,
    ship_date: shipDate,
    ...(freight.trim() ? { freight_amount: freight.trim() } : {}),
    ...(carrier.name.trim() ? { carrier_name: carrier.name.trim() } : {}),
    ...(carrier.vehicle.trim() ? { vehicle_number: carrier.vehicle.trim() } : {}),
    ...(carrier.driver.trim() ? { driver_name: carrier.driver.trim() } : {}),
    ...(notes.trim() ? { notes: notes.trim() } : {}),
    lines: sending.map((l) => ({
      sales_order_line_id: l.id,
      quantity: l.value!.toString(),
      warehouse_id: data.warehouseId!,
    })),
  });
  const save = async (forIssue = false) => {
    setTried(true);
    if (Object.values(missing).some(Boolean)) {
      setError(
        missing.lines
          ? "Isi qty kirim minimal satu barang, tidak melebihi sisa SO."
          : "Lengkapi isian bertanda * sebelum menyimpan.",
      );
      return null;
    }
    const saved = savedId
      ? await run(`${api}/${savedId}`, payload(), "PATCH")
      : await run(api, payload());
    setSavedId(saved.id);
    setDirty(false);
    if (!note && !forIssue) router.replace(`${base}/${saved.id}`);
    return saved;
  };
  const readOnly = !canDispatch;

  return (
    <form
      className="web-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save().catch(() => undefined);
      }}
    >
      {error && <PageNotice tone="error">{error}</PageNotice>}
      {note && !dirty && (
        <section className="sor-next sor-next-compact" aria-label="Status draft">
          <div>
            <strong>Draft disimpan</strong>
            <span>
              {" "}
              Stok dan saldo belum berubah. Penerimaan barang dapat dicatat setelah SJ terbit.
            </span>
          </div>
        </section>
      )}
      <fieldset
        disabled={pending || readOnly}
        className="sor-layout"
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <div className="sor-main">
          <section className="sor-panel" aria-labelledby="sj-g1">
            <h2 id="sj-g1">Data pengiriman</h2>
            <div className="sor-grid">
              <label className="sor-field">
                Nomor SJ *
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
                Tanggal SJ *
                <Input
                  type="date"
                  value={documentDate}
                  aria-invalid={(tried && !documentDate) || undefined}
                  onChange={(e) => {
                    touch();
                    setDocumentDate(e.target.value);
                  }}
                />
              </label>
              <label className="sor-field">
                Tanggal kirim *
                <Input
                  type="date"
                  value={shipDate}
                  aria-invalid={(tried && !shipDate) || undefined}
                  onChange={(e) => {
                    touch();
                    setShipDate(e.target.value);
                  }}
                />
              </label>
              <label className="sor-field">
                Gudang asal *
                <select
                  className="sj-select"
                  value={data.warehouseId ?? ""}
                  aria-invalid={(tried && !data.warehouseId) || undefined}
                  onChange={(e) => {
                    touch();
                    onWarehouse(e.target.value);
                  }}
                >
                  {!data.warehouseId && <option value="">Pilih gudang</option>}
                  {data.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <span className="sor-hint">Stok di tabel barang mengikuti gudang ini.</span>
              </label>
              <div className="sor-field">
                Ekspedisi
                <button
                  type="button"
                  className="sj-carrier"
                  aria-haspopup="dialog"
                  onClick={() => setCarrierOpen(true)}
                >
                  <span className={carrier.name ? undefined : "sor-hint"}>
                    {carrier.name
                      ? [carrier.name, carrier.vehicle, carrier.driver].filter(Boolean).join(" · ")
                      : "Pilih ekspedisi, kendaraan dan pengemudi"}
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              </div>
              <label className="sor-field" style={{ gridColumn: "1 / -1" }}>
                Alamat pengantaran
                <Textarea
                  readOnly
                  className="sor-readonly"
                  value={data.order.deliveryAddress ?? "—"}
                />
                <span className="sor-hint">Dari SO</span>
              </label>
            </div>
          </section>

          <section className="sor-panel" aria-labelledby="sj-g2">
            <h2 id="sj-g2">Barang dikirim</h2>
            <p className="sor-desc">
              Isi jumlah yang benar-benar dikirim. Sisa tetap terbuka di SO.
            </p>
            <div className="sj-table-wrap">
              <table className="sj-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th className="sor-num">Dipesan</th>
                    <th className="sor-num">Terbit</th>
                    <th className="sor-num">Sisa SO</th>
                    <th className="sor-num">Stok</th>
                    <th className="sor-num" style={{ width: 132 }}>
                      Qty kirim
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong className="sj-product">{l.product.name}</strong>
                        <span className="sor-hint">
                          {l.product.code} · {l.unit}
                        </span>
                      </td>
                      <td className="sor-num">{amount(l.ordered)}</td>
                      <td className="sor-num">{amount(l.issued)}</td>
                      <td className="sor-num sor-strong">{amount(l.remaining)}</td>
                      <td className={`sor-num ${l.tone === "warn" ? "sj-warn" : ""}`}>
                        {l.stock === null ? "—" : amount(l.stock)}
                      </td>
                      <td className="sor-num">
                        {l.open ? (
                          <>
                            <Input
                              aria-label={`Qty kirim ${l.product.name}`}
                              inputMode="decimal"
                              className="sor-num"
                              value={l.raw}
                              aria-invalid={l.tone === "err" || undefined}
                              onChange={(e) => {
                                touch();
                                setQty((old) => ({ ...old, [l.id]: e.target.value.trim() }));
                              }}
                            />
                            {l.message && (
                              <span className={`sj-line-msg sj-${l.tone}`}>{l.message}</span>
                            )}
                          </>
                        ) : (
                          <RecordBadge state="success" label="Terkirim penuh" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="sor-field" style={{ marginTop: 16 }}>
              <span>
                Catatan untuk penerima <span className="sor-hint">Opsional, ikut tercetak</span>
              </span>
              <Textarea
                value={notes}
                maxLength={2000}
                onChange={(e) => {
                  touch();
                  setNotes(e.target.value);
                }}
              />
            </label>
          </section>
        </div>

        <aside className="sor-aside" aria-label="Ringkasan Surat Jalan">
          <section className="sor-side" aria-labelledby="sj-sum">
            <h2 id="sj-sum">Nilai kiriman ini</h2>
            <dl style={{ margin: 0 }}>
              <div className="sor-sum">
                <dt>
                  Barang · {amount(totalQty.toString())} {units.size === 1 ? [...units][0] : "unit"}
                </dt>
                <dd>{amount(goods.toFixed(2), data.order.currency)}</dd>
              </div>
              <div className="sor-sum">
                <dt>
                  {firstTax
                    ? `PPN ${amount(effectiveTaxPercent(new D(firstTax.rate).mul(100).toString(), firstTax.dppFactor))}%`
                    : "PPN"}
                </dt>
                <dd>{amount(tax.toFixed(2), data.order.currency)}</dd>
              </div>
              <div className="sor-sum">
                <dt>Ongkir</dt>
                <dd>
                  {freightPayer !== "CUSTOMER"
                    ? "Ditanggung perusahaan"
                    : amount(freightBilled.toString(), data.order.currency)}
                </dd>
              </div>
              <div className="sor-sum sor-sum-total">
                <dt>Total</dt>
                <dd>{amount(goods.add(tax).add(freightBilled).toFixed(2), data.order.currency)}</dd>
              </div>
            </dl>
            <p className="sor-hint" style={{ marginTop: 8 }}>
              Harga, pajak, ongkir dan termin {data.order.paymentTerm ?? ""} diwarisi dari SO.
              Perubahan Setting tidak memengaruhi dokumen ini.
            </p>
          </section>
          <section className="sor-side" aria-labelledby="sj-freight">
            <h2 id="sj-freight">Ongkos kirim</h2>
            <label className="sor-field">
              Nilai ongkos kirim (Rp)
              <Input
                inputMode="decimal"
                className="sor-num"
                placeholder="0"
                value={freight}
                aria-invalid={!freightValid || undefined}
                onChange={(e) => {
                  touch();
                  setFreight(e.target.value.trim());
                }}
              />
              <span className={freightValid ? "sor-hint" : "sor-err"}>
                {freightValid
                  ? freightPayer === "CUSTOMER"
                    ? "Biaya pengiriman Surat Jalan ini, ditagihkan ke pelanggan. Kosong = estimasi SO."
                    : "Ongkir SO ditanggung perusahaan: nilai ini dicatat sebagai biaya kirim dan tidak ditagihkan ke pelanggan."
                  : "Isi angka tanpa pemisah ribuan; titik untuk desimal."}
              </span>
            </label>
          </section>
          <section className="sor-side" aria-labelledby="sj-source">
            <h2 id="sj-source">Dokumen Asal</h2>
            <dl className="sj-source">
              <div>
                <dt>Nomor SO</dt>
                <dd>
                  {canReadOrder ? (
                    <Link className="page-frame-link" href={`/operations/orders/${data.order.id}`}>
                      {data.order.number}
                    </Link>
                  ) : (
                    data.order.number
                  )}
                </dd>
              </div>
              <div>
                <dt>Tanggal SO</dt>
                <dd>{dateText(data.order.orderDate)}</dd>
              </div>
              <div>
                <dt>Pelanggan</dt>
                <dd>{data.order.customer.name}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </fieldset>

      <footer className="sor-footer">
        <p>
          {pending
            ? "Memproses…"
            : dirty
              ? "Ada perubahan yang belum disimpan."
              : "Draft tersimpan. Stok berubah saat Surat Jalan diterbitkan."}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => router.push(base)}
        >
          Batal
        </Button>
        {canDispatch && (
          <>
            <Button type="submit" variant="outline" disabled={pending}>
              Simpan draft
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={async () => {
                try {
                  const saved = dirty || !savedId ? await save(true) : { id: savedId };
                  if (!saved) return;
                  const issued = await run(`${api}/${saved.id}/issue`, {});
                  router.push(`${base}/${issued.id}`);
                } catch {
                  // Pesan server tetap tampil; retry memakai Idempotency-Key yang sama.
                }
              }}
            >
              {pending ? "Memproses…" : "Terbitkan Surat Jalan"}
            </Button>
          </>
        )}
      </footer>

      <CarrierDialog
        open={carrierOpen}
        value={carrier}
        suggestions={data.carriers}
        onClose={() => setCarrierOpen(false)}
        onSave={(value) => {
          touch();
          setCarrier(value);
          setCarrierOpen(false);
        }}
      />
    </form>
  );
}

function CarrierDialog({
  open,
  value,
  suggestions,
  onClose,
  onSave,
}: {
  open: boolean;
  value: Carrier;
  suggestions: string[];
  onClose: () => void;
  onSave: (value: Carrier) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(value);
      setTried(false);
    }
  }, [open, value]);
  const listId = useMemo(() => `carriers-${Math.random().toString(36).slice(2)}`, []);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sj-dialog">
        <DialogHeader>
          <DialogTitle>Ekspedisi</DialogTitle>
          <DialogDescription>
            Ekspedisi, kendaraan dan pengemudi ikut tercetak di Surat Jalan.
          </DialogDescription>
        </DialogHeader>
        <div className="sor-grid" style={{ marginTop: 0 }}>
          <label className="sor-field" style={{ gridColumn: "1 / -1" }}>
            Nama ekspedisi *
            <Input
              list={listId}
              value={draft.name}
              maxLength={200}
              placeholder="Contoh: Armada internal"
              aria-invalid={(tried && !draft.name.trim()) || undefined}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <datalist id={listId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <span className={tried && !draft.name.trim() ? "sor-err" : "sor-hint"}>
              {tried && !draft.name.trim()
                ? "Isi nama ekspedisi."
                : "Pilih dari yang pernah dipakai atau ketik baru."}
            </span>
          </label>
          <label className="sor-field">
            Kendaraan
            <Input
              value={draft.vehicle}
              maxLength={100}
              placeholder="Nomor polisi"
              onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })}
            />
          </label>
          <label className="sor-field">
            Pengemudi
            <Input
              value={draft.driver}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, driver: e.target.value })}
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            onClick={() => {
              setTried(true);
              if (!draft.name.trim()) return;
              onSave(draft);
            }}
          >
            Simpan ekspedisi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
