"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Decimal from "decimal.js";
import { IconPlus as Plus, IconTrash as Trash2 } from "@/components/web/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SelectionField } from "@/components/web/selection-field";
import { ApiError, apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DataTable, Notice } from "../crm/crm-common";
import { Upload, ErrorBox, Evidence } from "./workspace";
import { amount, type Order, type OrderCommand } from "./sales-order-types";

const D = Decimal.clone({ precision: 50 });
type DraftLine = {
  key: string;
  line_id?: string;
  product_id: string;
  quantity: string;
  unit_price: string;
};
type Term = { code: string; label: string; days: number; kind: "COD" | "PREPAY" | "TEMPO" };
export type OrderOptions = {
  currency: string;
  timezone: string;
  customers: {
    id: string;
    name: string;
    shippingAddress?: string | null;
    primaryAddress?: string | null;
    paymentTerm: { code: string; label: string; mode: string; topDays: number } | null;
  }[];
  products: { id: string; name: string; code: string; baseUom: { name: string } }[];
  warehouses: { id: string; code: string; name: string }[];
  terms: Term[];
  defaults: {
    warehouseId: string | null;
    referenceRequired: boolean;
    evidenceRequired: boolean;
  };
  closedThrough: string | null;
  /** Nomor SO berikutnya dari Setting › Penomoran Dokumen; null bila aturan belum aktif. */
  nextNumber: string | null;
};
type FreightPayer = "" | "CUSTOMER" | "COMPANY";
/** Setting › Termin & Kredit (OPS-FLX-04): ongkir bawaan dan posisinya terhadap PPN. */
type FreightPolicy = {
  mode: "COMPANY" | "CHARGE_CUSTOMER";
  tax_position: "BEFORE_TAX" | "AFTER_TAX";
};

const decimalPattern = /^\d{1,14}(\.\d{1,10})?$/;
const validQty = (v: string) => decimalPattern.test(v) && new D(v).gt(0);
const validPrice = (v: string) => /^\d{1,16}(\.\d{1,8})?$/.test(v);
const validFreight = (v: string) => v.trim() === "" || decimalPattern.test(v.trim());
function lineValue(line: DraftLine) {
  return validQty(line.quantity) && validPrice(line.unit_price)
    ? new D(line.quantity).mul(line.unit_price)
    : null;
}

/** Input angka yang tampil berkelompok saat tidak difokuskan; nilai tetap string desimal bertitik. */
function DecimalInput({
  label,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Input
      aria-label={label}
      aria-invalid={invalid || undefined}
      inputMode="decimal"
      className="sor-num"
      placeholder={placeholder}
      value={editing || !value || !validPrice(value) ? value : amount(value)}
      onFocus={() => setEditing(true)}
      onBlur={() => setEditing(false)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function CheckIcon({ tone }: { tone: "success" | "info" | "danger" }) {
  const stroke = tone === "success" ? "#17663F" : tone === "danger" ? "#B42318" : "#0B4DA2";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
    >
      {tone === "success" ? (
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      ) : (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5l3 2" />
        </>
      )}
    </svg>
  );
}

function today(timezone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Form SO mengikuti canvas "SO-form": Informasi Utama, Referensi pesanan, Barang, Pengiriman,
 * Catatan, lalu Ringkasan di kanan. Isian hanya yang diterima POST /sales-orders dan
 * POST /sales-orders/:id/revise; server tetap memeriksa harga, pajak, termin dan izin.
 */
export function SalesOrderForm({
  initial,
  command,
  pending,
  onSaved,
}: {
  initial?: Order | undefined;
  command: OrderCommand;
  pending: boolean;
  onSaved: (id: string) => void;
}) {
  const { principal } = useSession();
  const router = useRouter();
  const canSubmit = !!principal && hasCompanyPermission(principal, "sales_order.submit");
  const editing = !!initial;
  const [dirty, setDirty] = useState(false),
    [tried, setTried] = useState(false),
    [leaving, setLeaving] = useState(false),
    [leaveTo, setLeaveTo] = useState<string | null>(null),
    [localError, setLocalError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  const lookup = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, "so-options"],
    queryFn: ({ signal }) =>
      apiRequest<{ data: OrderOptions }>("/operations/order-options", { signal }),
    enabled: !!principal,
  });
  const options = lookup.data?.data;
  const taxes = useQuery({
    queryKey: ["tax-options", principal?.company_id, principal?.user_id, principal?.permissions],
    queryFn: ({ signal }) =>
      apiRequest<{
        data: {
          id: string;
          name: string;
          percentage: string;
          dppFactor: string;
          isDefaultSales: boolean;
        }[];
      }>("/tax/options?usage=SALES", { signal }),
    enabled: !!principal,
  });
  const freightSetting = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, "policy", "OPS-FLX-04"],
    queryFn: ({ signal }) =>
      apiRequest<{ data: { active_version?: { value: FreightPolicy } | null } }>(
        "/operational-policies/OPS-FLX-04",
        { signal },
      ),
    enabled: !!principal,
    retry: (count, error) => !(error instanceof ApiError && error.status === 403) && count < 2,
  });
  const freightPolicy = freightSetting.data?.data.active_version?.value ?? null;

  const numberEditable = !initial || initial.state === "DRAFT";
  const [number, setNumber] = useState(initial?.number ?? ""),
    [numberTouched, setNumberTouched] = useState(false);
  const [customer, setCustomer] = useState(initial?.customerId ?? ""),
    [orderDate, setOrderDate] = useState(initial?.orderDate?.slice(0, 10) ?? ""),
    [termCode, setTermCode] = useState(initial?.paymentTermCode ?? ""),
    [reference, setReference] = useState(initial?.customerReference ?? ""),
    [proof, setProof] = useState(initial?.evidenceId ?? ""),
    [address, setAddress] = useState(initial?.deliveryAddress ?? ""),
    [notes, setNotes] = useState(initial?.notes ?? ""),
    [reason, setReason] = useState(""),
    [payer, setPayer] = useState<FreightPayer>(
      initial?.freightTermsSnapshot?.payer === "CUSTOMER" ||
        initial?.freightTermsSnapshot?.payer === "COMPANY"
        ? initial.freightTermsSnapshot.payer
        : "",
    ),
    [freight, setFreight] = useState(initial?.freightEstimate ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    initial?.lines.map((l) => ({
      key: l.id,
      line_id: l.id,
      product_id: l.productId,
      quantity: l.orderedQuantity,
      unit_price: l.unitPrice,
    })) ?? [{ key: "first", product_id: "", quantity: "", unit_price: "" }],
  );

  // Nilai bawaan dari server: tanggal hari ini (zona perusahaan) dan ongkir bawaan Setting.
  useEffect(() => {
    if (!orderDate && options) setOrderDate(today(options.timezone));
  }, [options, orderDate]);
  useEffect(() => {
    if (!initial && !numberTouched && options?.nextNumber) setNumber(options.nextNumber);
  }, [initial, numberTouched, options]);
  useEffect(() => {
    if (!payer && !initial && freightPolicy)
      setPayer(freightPolicy.mode === "COMPANY" ? "COMPANY" : "CUSTOMER");
  }, [freightPolicy, payer, initial]);

  const selected = options?.customers.find((c) => c.id === customer);
  const currency = initial?.currency ?? options?.currency;
  const terms = options?.terms ?? [];
  const term = terms.find((t) => t.code === termCode);
  const defaultTax = taxes.data?.data.find((t) => t.isDefaultSales);
  const productOf = (id: string) =>
    options?.products.find((p) => p.id === id) ??
    initial?.lines.find((l) => l.productId === id)?.product;
  const values = lines.map(lineValue);
  const goods = values.every((v) => v !== null)
    ? values.reduce<Decimal>((sum, v) => sum.add(v!), new D(0))
    : undefined;
  // Perkiraan PPN per baris (DPP x tarif bawaan); server menetapkan nilai final saat diajukan.
  const tax =
    goods && defaultTax
      ? values.reduce<Decimal>(
          (sum, v) =>
            sum.add(
              v!
                .mul(defaultTax.dppFactor)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                .mul(defaultTax.percentage)
                .div(100)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
            ),
          new D(0),
        )
      : undefined;
  const qtyTotal = lines.every((l) => validQty(l.quantity))
    ? lines.reduce((sum, l) => sum.add(l.quantity), new D(0))
    : undefined;
  const units = new Set(lines.map((l) => productOf(l.product_id)?.baseUom?.name).filter(Boolean));
  const unit = units.size === 1 ? [...units][0] : "unit";

  // Ongkir dibebankan ke pelanggan mengikuti posisi PPN di Setting (Sebelum PPN = masuk DPP).
  const initialTaxMode =
    initial?.freightTermsSnapshot?.payer === payer ? initial.freightTermsSnapshot.tax_mode : null;
  const customerTaxMode = freightPolicy
    ? freightPolicy.tax_position === "BEFORE_TAX"
      ? "TAXABLE"
      : "NON_TAXABLE"
    : initialTaxMode;
  const freightBlocked = payer === "CUSTOMER" && !customerTaxMode;
  const freightBlockedShown = freightBlocked && !freightSetting.isPending;
  const warehouseBlocked =
    !!options && !options.defaults.warehouseId && options.warehouses.length !== 1;

  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", prevent);
    const navigate = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.origin !== window.location.origin ||
        anchor.pathname === window.location.pathname
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(anchor.pathname + anchor.search + anchor.hash);
      setLeaving(true);
    };
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", prevent);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);

  const touch = () => setDirty(true);
  const change = (key: string, field: keyof DraftLine, value: string) => {
    touch();
    setLines((old) => old.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };
  const back = initial ? `/operations/orders/${initial.id}` : "/operations/orders";

  const missing = {
    customer: !customer,
    date: !orderDate,
    term: !termCode,
    reference: !!options?.defaults.referenceRequired && !reference.trim(),
    evidence: !!options?.defaults.evidenceRequired && !proof,
    payer: !payer,
    freight: !validFreight(freight),
    reason: editing && !reason.trim(),
  };
  const columns: ColumnDef<DraftLine>[] = [
    {
      id: "product",
      header: "Produk",
      cell: ({ row }) => {
        const product = productOf(row.original.product_id);
        return editing ? (
          <span className="sor-product">
            <strong>{product?.name}</strong>
            <small>{product?.code}</small>
          </span>
        ) : (
          <SelectionField
            label={`Produk baris ${row.index + 1}`}
            hideLabel
            placeholder="Cari dan pilih produk"
            error={tried && !row.original.product_id ? "Pilih produk." : undefined}
            options={(options?.products ?? []).map((p) => ({
              id: p.id,
              name: `${p.code} · ${p.name}`,
            }))}
            value={row.original.product_id ? [row.original.product_id] : []}
            onChange={(v) => change(row.original.key, "product_id", v[0] ?? "")}
          />
        );
      },
    },
    {
      id: "qty",
      header: "Jumlah",
      cell: ({ row }) => (
        <Input
          aria-label={`Jumlah baris ${row.index + 1}`}
          aria-invalid={(tried && !validQty(row.original.quantity)) || undefined}
          inputMode="decimal"
          className="sor-num"
          value={row.original.quantity}
          onChange={(e) => change(row.original.key, "quantity", e.target.value)}
        />
      ),
    },
    {
      id: "unit",
      header: "Satuan",
      cell: ({ row }) => productOf(row.original.product_id)?.baseUom?.name ?? "—",
    },
    {
      id: "price",
      header: "Harga",
      cell: ({ row }) => (
        <DecimalInput
          label={`Harga baris ${row.index + 1}`}
          value={row.original.unit_price}
          invalid={tried && !validPrice(row.original.unit_price)}
          onChange={(v) => change(row.original.key, "unit_price", v)}
        />
      ),
    },
    {
      id: "tax",
      header: "PPN",
      cell: () => (
        <span className="sor-num">{defaultTax ? `${amount(defaultTax.percentage)}%` : "—"}</span>
      ),
    },
    {
      id: "net",
      header: "Subtotal",
      cell: ({ row }) => {
        const value = lineValue(row.original);
        return (
          <span className="sor-num sor-strong">
            {value ? amount(value.toString(), currency) : "—"}
          </span>
        );
      },
    },
    ...(!editing
      ? [
          {
            id: "actions",
            header: () => <span className="sr-only">Aksi</span>,
            cell: ({ row }: { row: { index: number; original: DraftLine } }) => (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Hapus baris ${row.index + 1}`}
                disabled={lines.length === 1 || pending}
                onClick={() => {
                  touch();
                  setLines((old) => old.filter((l) => l.key !== row.original.key));
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ),
          } satisfies ColumnDef<DraftLine>,
        ]
      : []),
  ];

  const freightPayload = () =>
    payer
      ? {
          payer,
          basis: "PER_SHIPMENT" as const,
          estimate: freight.trim() || "0",
          tax_mode: payer === "CUSTOMER" ? customerTaxMode! : "NON_TAXABLE",
        }
      : undefined;

  const save = async (submitAfter: boolean) => {
    setLocalError("");
    setTried(true);
    if (
      Object.values(missing).some(Boolean) ||
      freightBlocked ||
      !currency ||
      lines.some((l) => !l.product_id || !validQty(l.quantity) || !validPrice(l.unit_price))
    ) {
      setLocalError(
        freightBlocked
          ? "Posisi PPN ongkir belum dapat dibaca dari Setting › Termin & Kredit. Hubungi admin atau pilih Ditanggung perusahaan."
          : "Lengkapi isian bertanda * dan periksa jumlah serta harga setiap barang. Gunakan titik untuk desimal.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    // Nomor hanya dikirim bila diubah pengguna; tanpa itu server memakai urutan Setting.
    const typedNumber =
      numberEditable && numberTouched && number.trim() && number.trim() !== initial?.number
        ? { number: number.trim() }
        : {};
    const header = {
      ...typedNumber,
      order_date: orderDate,
      payment_term_code: termCode,
      customer_reference: reference.trim(),
      delivery_address: address.trim(),
    };
    const payload = editing
      ? {
          version: initial.version,
          reason: reason.trim(),
          evidence_id: proof || null,
          ...header,
          freight: freightPayload() ?? null,
          lines: lines.map((l) => ({
            line_id: l.line_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
        }
      : {
          customer_id: customer,
          ...header,
          ...(proof ? { evidence_id: proof } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(freightPayload() ? { freight: freightPayload() } : {}),
          currency,
          lines: lines.map(({ product_id, quantity, unit_price }) => ({
            product_id,
            quantity,
            unit_price,
          })),
        };
    try {
      const saved = await command(
        editing ? `/sales-orders/${initial.id}/revise` : "/sales-orders",
        payload,
      );
      setDirty(false);
      // Ajukan adalah perintah terpisah; bila ditolak, SO tetap tersimpan sebagai Draft.
      if (submitAfter)
        await command(`/sales-orders/${saved.data.id}/submit`).catch(() => undefined);
      onSaved(saved.data.id);
    } catch {
      // Pesan galat dari server ditampilkan halaman (useOrderCommand).
    }
  };

  const checks: { tone: "success" | "info" | "danger"; text: string }[] = [
    { tone: "success", text: "Harga dan satuan dari price list" },
    term
      ? { tone: "info", text: "Termin dari daftar aktif Setting" }
      : { tone: "danger", text: "Termin belum dipilih" },
    { tone: "info", text: "Pajak, ongkir, akun dan nomor dokumen dari Setting aktif" },
  ];

  return (
    <form
      className="web-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        void save(submitter?.value === "submit");
      }}
    >
      {lookup.error && (
        <Notice>
          Pilihan pelanggan, produk dan termin gagal dimuat.{" "}
          <Button type="button" variant="outline" size="sm" onClick={() => void lookup.refetch()}>
            Muat ulang pilihan
          </Button>
        </Notice>
      )}
      {warehouseBlocked && (
        <ErrorBox
          message="Gudang bawaan penjualan belum diatur. SO tidak dapat disimpan sampai gudang bawaan dipilih."
          settingsHref="/setting/sales"
        />
      )}
      {localError && (
        <div ref={errorRef} tabIndex={-1}>
          <ErrorBox message={localError} />
        </div>
      )}
      <fieldset
        disabled={pending}
        className="sor-layout"
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <div className="sor-main">
          <section className="sor-panel" aria-labelledby="so-g1">
            <h2 id="so-g1">Informasi Utama</h2>
            <div className="sor-grid">
              <label className="sor-field">
                Nomor SO *
                <Input
                  value={number}
                  maxLength={60}
                  readOnly={!numberEditable}
                  className={numberEditable ? undefined : "sor-readonly"}
                  onChange={(e) => {
                    touch();
                    setNumberTouched(true);
                    setNumber(e.target.value.toUpperCase());
                  }}
                />
                <span className="sor-hint">
                  {!numberEditable
                    ? "Nomor tidak dapat diubah setelah SO diajukan."
                    : options && !options.nextNumber && !initial
                      ? "Penomoran SO belum diatur di Setting › Penomoran Dokumen."
                      : "Usulan dari penomoran di Setting; boleh diubah, harus unik."}
                </span>
              </label>
              <label className="sor-field">
                Tanggal SO *
                <Input
                  type="date"
                  value={orderDate}
                  aria-invalid={(tried && missing.date) || undefined}
                  onChange={(e) => {
                    touch();
                    setOrderDate(e.target.value);
                  }}
                />
                <span className={tried && missing.date ? "sor-err" : "sor-hint"}>
                  {tried && missing.date
                    ? "Isi tanggal SO."
                    : "Default hari ini; tidak boleh di periode tertutup."}
                </span>
              </label>
              {editing ? (
                <label className="sor-field">
                  Pelanggan
                  <Input readOnly className="sor-readonly" value={initial.customer?.name ?? ""} />
                  <span className="sor-hint">Pelanggan tidak dapat diganti setelah SO dibuat.</span>
                </label>
              ) : (
                <div className="sor-field">
                  <SelectionField
                    label="Pelanggan *"
                    options={options?.customers ?? []}
                    value={customer ? [customer] : []}
                    error={tried && missing.customer ? "Pilih pelanggan." : undefined}
                    placeholder={lookup.isLoading ? "Memuat pelanggan…" : "Pilih pelanggan"}
                    onChange={(v) => {
                      touch();
                      const c = options?.customers.find((x) => x.id === v[0]);
                      setCustomer(v[0] ?? "");
                      setAddress(c?.shippingAddress ?? c?.primaryAddress ?? "");
                      if (c?.paymentTerm && terms.some((t) => t.code === c.paymentTerm!.code))
                        setTermCode(c.paymentTerm.code);
                    }}
                  />
                  {principal &&
                    hasCompanyPermission(principal, "master_customer.create") &&
                    hasCompanyPermission(principal, "master_customer.read") && (
                      <span className="sor-hint">
                        Belum ada?{" "}
                        <Link className="page-frame-link" href="/master-data/customers/new">
                          Tambah pelanggan
                        </Link>{" "}
                        lalu kembali ke SO ini.
                      </span>
                    )}
                </div>
              )}
              <div className="sor-field">
                <SelectionField
                  label="Termin / TOP *"
                  options={terms.map((t) => ({ id: t.code, name: t.label }))}
                  value={termCode ? [termCode] : []}
                  placeholder="Pilih termin"
                  error={tried && missing.term ? "Pilih termin sebelum menyimpan." : undefined}
                  onChange={(v) => {
                    touch();
                    setTermCode(v[0] ?? "");
                  }}
                />
                {!(tried && missing.term) && (
                  <span className="sor-hint">
                    Daftar dari Setting › Termin. Default mengikuti pelanggan; nilai dikunci saat SO
                    diajukan.
                  </span>
                )}
              </div>
              {!editing && (
                <label className="sor-field sor-span">
                  Alamat utama
                  <Input
                    readOnly
                    className="sor-readonly"
                    value={selected?.primaryAddress ?? ""}
                    placeholder={customer ? "Belum tersedia" : "Pilih pelanggan"}
                  />
                  <span className="sor-hint">
                    Terisi otomatis saat pelanggan dipilih. Ubah alamat lewat data pelanggan.
                  </span>
                </label>
              )}
              {editing && (
                <label className="sor-field sor-span">
                  Alasan perubahan *
                  <Textarea
                    maxLength={1000}
                    value={reason}
                    aria-invalid={(tried && missing.reason) || undefined}
                    onChange={(e) => {
                      touch();
                      setReason(e.target.value);
                    }}
                  />
                  <span className={tried && missing.reason ? "sor-err" : "sor-hint"}>
                    {tried && missing.reason
                      ? "Isi alasan perubahan."
                      : "Perubahan SO yang sudah diajukan memerlukan pengajuan ulang."}
                  </span>
                </label>
              )}
            </div>
          </section>

          <section className="sor-panel" aria-labelledby="so-g2">
            <h2 id="so-g2">Referensi pesanan</h2>
            <div className="sor-grid">
              <label className="sor-field">
                Nomor SP pelanggan{options?.defaults.referenceRequired ? " *" : ""}
                <Input
                  maxLength={100}
                  placeholder="Nomor surat pesanan"
                  value={reference}
                  aria-invalid={(tried && missing.reference) || undefined}
                  onChange={(e) => {
                    touch();
                    setReference(e.target.value);
                  }}
                />
                {tried && missing.reference && (
                  <span className="sor-err">Nomor SP wajib diisi sesuai pengaturan penjualan.</span>
                )}
              </label>
              <div className="sor-field sor-span">
                <Upload
                  purpose="SALES_ORDER"
                  onChange={(id) => {
                    touch();
                    setProof(id || (initial?.evidenceId ?? ""));
                  }}
                />
                {proof ? (
                  <Evidence id={proof} />
                ) : (
                  <span className={tried && missing.evidence ? "sor-err" : "sor-hint"}>
                    {tried && missing.evidence
                      ? "Bukti SP wajib dilampirkan sesuai pengaturan penjualan."
                      : "Belum ada bukti."}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="sor-panel" aria-labelledby="so-g3">
            <h2 id="so-g3">Barang</h2>
            <p className="sor-desc">
              PPN memakai pajak penjualan bawaan di Setting. Server memeriksa harga terhadap price
              list saat SO diajukan.
            </p>
            <DataTable
              data={lines}
              columns={columns}
              total={lines.length}
              formTable
              showColumns={false}
              label="barang"
            />
            {!editing && (
              <div className="sor-lines-add">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={lines.length >= 100}
                  onClick={() => {
                    touch();
                    setLines((old) => [
                      ...old,
                      { key: crypto.randomUUID(), product_id: "", quantity: "", unit_price: "" },
                    ]);
                  }}
                >
                  <Plus aria-hidden="true" />
                  Tambah barang
                </Button>
              </div>
            )}
            <p className="sor-hint" style={{ marginTop: 14 }}>
              Stok tidak dicadangkan dari form ini. Stok diperiksa saat Surat Jalan diterbitkan.
            </p>
          </section>

          <section className="sor-panel" aria-labelledby="so-g4">
            <h2 id="so-g4">Pengiriman</h2>
            <div className="sor-grid">
              <label className="sor-field sor-span">
                Alamat pengantaran
                <Textarea
                  maxLength={1000}
                  value={address}
                  onChange={(e) => {
                    touch();
                    setAddress(e.target.value);
                  }}
                />
                <span className="sor-hint">
                  Diambil dari data pelanggan; perubahan di sini hanya untuk SO ini.
                </span>
              </label>
              <div className="sor-field">
                <SelectionField
                  label="Ongkir *"
                  options={[
                    { id: "CUSTOMER", name: "Ditanggung pelanggan" },
                    { id: "COMPANY", name: "Ditanggung perusahaan" },
                  ]}
                  value={payer ? [payer] : []}
                  placeholder="Pilih penanggung ongkir"
                  error={
                    tried && missing.payer
                      ? "Pilih penanggung ongkir."
                      : freightBlockedShown
                        ? "Posisi PPN ongkir di Setting › Termin & Kredit tidak dapat dibaca akun ini."
                        : undefined
                  }
                  onChange={(v) => {
                    touch();
                    setPayer((v[0] as FreightPayer | undefined) ?? "");
                  }}
                />
                {!(tried && missing.payer) && !freightBlockedShown && (
                  <span className="sor-hint">
                    Default dari Setting. Nilai ongkir diisi di Ringkasan.
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="sor-panel" aria-labelledby="so-g5">
            <h2 id="so-g5">Catatan</h2>
            <label className="sor-field">
              Catatan untuk gudang dan finance
              <Textarea
                placeholder="Instruksi khusus penerimaan barang"
                maxLength={2000}
                value={notes}
                readOnly={editing}
                className={editing ? "sor-readonly" : undefined}
                onChange={(e) => {
                  touch();
                  setNotes(e.target.value);
                }}
              />
              {editing && (
                <span className="sor-hint">Catatan tidak dapat diubah setelah SO dibuat.</span>
              )}
            </label>
          </section>
        </div>

        <aside className="sor-aside" aria-label="Ringkasan SO">
          <section className="sor-side" aria-labelledby="so-sum">
            <h2 id="so-sum">Ringkasan</h2>
            <dl style={{ margin: 0 }}>
              <div className="sor-sum">
                <dt>
                  {lines.length} baris
                  {qtyTotal ? ` · ${amount(qtyTotal.toString())} ${unit}` : ""}
                </dt>
                <dd />
              </div>
              <div className="sor-sum">
                <dt>Nilai barang</dt>
                <dd>{goods ? amount(goods.toString(), currency) : "—"}</dd>
              </div>
              <div className="sor-sum">
                <dt>{defaultTax ? `PPN ${amount(defaultTax.percentage)}%` : "PPN"}</dt>
                <dd>
                  {tax
                    ? amount(tax.toString(), currency)
                    : taxes.isSuccess && !defaultTax
                      ? "Belum diatur"
                      : "—"}
                </dd>
              </div>
            </dl>
            <label className="sor-field sor-freight">
              Ongkos kirim
              <DecimalInput
                label="Ongkos kirim"
                placeholder="Rp 0"
                value={freight}
                invalid={tried && missing.freight}
                onChange={(v) => {
                  touch();
                  setFreight(v);
                }}
              />
              <span className={tried && missing.freight ? "sor-err" : "sor-hint"}>
                {tried && missing.freight
                  ? "Isi angka tanpa pemisah ribuan; gunakan titik untuk desimal."
                  : "Dihitung per pengiriman, terpisah dari Total SO."}
              </span>
            </label>
            <dl style={{ margin: 0 }}>
              <div className="sor-sum sor-sum-total">
                <dt>Total SO</dt>
                <dd>{goods && tax ? amount(goods.add(tax).toString(), currency) : "—"}</dd>
              </div>
              <div className="sor-sum">
                <dt>Termin</dt>
                <dd>{term?.label ?? "—"}</dd>
              </div>
            </dl>
            <p className="sor-hint" style={{ marginTop: 8 }}>
              Nilai final ditetapkan server saat SO diajukan dan diwariskan ke Surat Jalan dan
              Invoice.
            </p>
          </section>
          <section className="sor-side" aria-labelledby="so-checks">
            <h2 id="so-checks" style={{ marginBottom: 4 }}>
              Diperiksa saat diajukan
            </h2>
            <p className="sor-hint">Server mengulang semua pemeriksaan ini.</p>
            <ul className="sor-checks">
              {checks.map((check) => (
                <li key={check.text}>
                  <CheckIcon tone={check.tone} />
                  {check.text}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </fieldset>

      <footer className="sor-footer">
        <p>
          {pending
            ? "Menyimpan…"
            : dirty
              ? "Ada perubahan yang belum disimpan."
              : "Draft dapat disimpan sebelum data lengkap."}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setLeaveTo(null);
            if (dirty) setLeaving(true);
            else router.push(back);
          }}
        >
          Batal
        </Button>
        <Button
          type="submit"
          value="draft"
          variant="outline"
          disabled={pending || lookup.isLoading || !currency}
        >
          {editing ? "Simpan perubahan" : "Simpan draf"}
        </Button>
        {canSubmit && (
          <Button type="submit" value="submit" disabled={pending || lookup.isLoading || !currency}>
            {pending ? "Memproses…" : editing ? "Simpan & ajukan" : "Ajukan SO"}
          </Button>
        )}
      </footer>

      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan perubahan?</DialogTitle>
            <DialogDescription>
              Isian yang belum disimpan akan hilang. Dokumen tersimpan tidak akan dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLeaving(false)}>
              Lanjutkan mengisi
            </Button>
            <Button
              type="button"
              onClick={() => {
                setDirty(false);
                router.push(leaveTo ?? back);
              }}
            >
              Buang perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
