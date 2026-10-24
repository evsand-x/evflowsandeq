"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Decimal from "decimal.js";
import { IconPlus as Plus, IconTrash as Trash2 } from "@/components/web/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AddOrderCustomer } from "./so-add-customer";
import { SelectionField } from "@/components/web/selection-field";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DataTable, Notice } from "../crm/crm-common";
import { Upload, ErrorBox, Evidence } from "./workspace";
import { amount, terms, type Order, type OrderCommand } from "./sales-order-types";

const D = Decimal.clone({ precision: 50 });
type DraftLine = {
  key: string;
  line_id?: string;
  product_id: string;
  quantity: string;
  unit_price: string;
};
type Options = {
  currency: string;
  timezone: string;
  customers: {
    id: string;
    name: string;
    shippingAddress?: string | null;
    primaryAddress?: string | null;
    paymentPolicies: { mode: string; topDays: number | null }[];
  }[];
  products: { id: string; name: string; code: string; baseUom: { name: string } }[];
};
const validQty = (v: string) => /^\d{1,14}(\.\d{1,10})?$/.test(v) && new D(v).gt(0);
const validPrice = (v: string) => /^\d{1,16}(\.\d{1,8})?$/.test(v);
function subtotal(line: DraftLine) {
  return validQty(line.quantity) && validPrice(line.unit_price)
    ? new D(line.quantity).mul(line.unit_price)
    : null;
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Input
      required
      aria-label={label}
      inputMode="decimal"
      value={editing || !validPrice(value) ? value : amount(value)}
      onFocus={() => setEditing(true)}
      onBlur={() => setEditing(false)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

// Seksi bernomor mengikuti canvas "SO-form"; judul membawa angka urut dan aksi opsional.
function FormSection({
  id,
  no,
  title,
  description,
  action,
  children,
}: {
  id: string;
  no: number;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="page-frame-panel so-form-section" aria-labelledby={`${id}-title`}>
      <div className="so-form-section-head">
        <div>
          <h2 id={`${id}-title`}>
            <span className="so-step" aria-hidden="true">
              {no}
            </span>
            {title}
          </h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
type FreightMode = "NONE" | "CUSTOMER" | "COMPANY" | "CARRIER";
const freightModes: Record<FreightMode, string> = {
  NONE: "Belum ditetapkan",
  CUSTOMER: "Ditagihkan ke pelanggan per pengiriman",
  COMPANY: "Ditanggung perusahaan",
  CARRIER: "Ditanggung ekspedisi",
};
function CheckIcon({ tone }: { tone: "success" | "info" | "warning" | "danger" }) {
  return (
    <svg
      className="so-check-icon"
      data-tone={tone}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
    >
      {tone === "success" ? (
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      ) : tone === "warning" ? (
        <>
          <path d="M12 4l9 16H3z" />
          <path d="M12 10v4M12 17v.5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5l3 2" />
        </>
      )}
    </svg>
  );
}
// Form SO mengikuti canvas "SO-form": lima seksi bernomor, ringkasan di kanan, footer draf/ajukan.
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
  const session = useSession();
  const principal = session.principal;
  const router = useRouter();
  const canSubmit = !!principal && hasCompanyPermission(principal, "sales_order.submit");
  const [dirty, setDirty] = useState(false),
    [leaving, setLeaving] = useState(false),
    [localError, setLocalError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [customer, setCustomer] = useState(initial?.customerId ?? ""),
    [reference, setReference] = useState(initial?.customerReference ?? ""),
    [address, setAddress] = useState(initial?.deliveryAddress ?? ""),
    [proof, setProof] = useState(initial?.evidenceId ?? ""),
    [notes, setNotes] = useState(initial?.notes ?? ""),
    [reason, setReason] = useState("");
  const [freightMode, setFreightMode] = useState<FreightMode>(
      initial?.freightEstimate != null
        ? (initial.freightTermsSnapshot?.payer ?? "CUSTOMER")
        : "NONE",
    ),
    [freightAmount, setFreightAmount] = useState(initial?.freightEstimate ?? ""),
    [freightTaxable, setFreightTaxable] = useState(
      initial?.freightTermsSnapshot?.tax_mode === "TAXABLE",
    ),
    [freightTouched, setFreightTouched] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>(
    initial?.lines.map((l) => ({
      key: l.id,
      line_id: l.id,
      product_id: l.productId,
      quantity: l.orderedQuantity,
      unit_price: l.unitPrice,
    })) ?? [{ key: "first", product_id: "", quantity: "", unit_price: "" }],
  );
  const lookup = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, "so-options"],
    queryFn: ({ signal }) => apiRequest<{ data: Options }>("/operations/order-options", { signal }),
    enabled: !!principal,
  });
  const options: Options | undefined = lookup.data?.data;
  const taxes = useQuery({
    queryKey: ["tax-options", principal?.company_id, principal?.user_id, principal?.permissions],
    queryFn: () =>
      apiRequest<{
        data: {
          id: string;
          name: string;
          percentage: string;
          dppFactor: string;
          isDefaultSales: boolean;
        }[];
      }>("/tax/options?usage=SALES"),
    enabled: !!principal,
  });
  const selected = options?.customers.find((c) => c.id === customer);
  const policy = initial?.paymentSnapshot ?? selected?.paymentPolicies[0];
  const currency = initial?.currency ?? options?.currency;
  const freightEnabled = freightMode !== "NONE";
  const productOf = (id: string) =>
    options?.products.find((p) => p.id === id) ??
    initial?.lines.find((l) => l.productId === id)?.product;
  const values = lines.map(subtotal);
  const total = values.every((v) => v !== null)
    ? values.reduce<Decimal>((sum, v) => sum.add(v!), new D(0))
    : undefined;
  // Every line carries the default sales tax (PPN x DPP factor). This is an estimate; the server
  // sets the final amount and keeps the tax snapshot when the order is evaluated.
  const defaultTax = taxes.data?.data.find((t) => t.isDefaultSales);
  const tax =
    total && defaultTax
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
  const units = new Set(
    lines.map((l) => productOf(l.product_id)?.baseUom?.name).filter(Boolean),
  );
  const unit = units.size === 1 ? [...units][0] : "unit";
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
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
  const change = (key: string, field: keyof DraftLine, value: string) => {
    setDirty(true);
    setLines((old) => old.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };
  const back = `/operations/orders${initial ? `/${initial.id}` : ""}`;
  const columns: ColumnDef<DraftLine>[] = [
    {
      id: "product",
      header: "Produk",
      cell: ({ row }) => {
        const product = productOf(row.original.product_id);
        return initial ? (
          <span className="so-product">
            <strong>{product?.name}</strong>
            <small>{product?.code}</small>
          </span>
        ) : (
          <SelectionField
            label={`Produk baris ${row.index + 1}`}
            hideLabel
            placeholder="Cari dan pilih produk"
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
          required
          className="so-num-input"
          aria-label={`Jumlah baris ${row.index + 1}`}
          inputMode="decimal"
          value={row.original.quantity}
          pattern="[0-9]+([.][0-9]{1,10})?"
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
        <PriceInput
          label={`Harga baris ${row.index + 1}`}
          value={row.original.unit_price}
          onChange={(v) => change(row.original.key, "unit_price", v)}
        />
      ),
    },
    {
      id: "net",
      header: "Subtotal",
      cell: ({ row }) => {
        const value = subtotal(row.original);
        return <span className="so-num so-strong">{value ? amount(value.toString(), currency) : "—"}</span>;
      },
    },
    ...(!initial
      ? [
          {
            id: "actions",
            header: "Aksi",
            cell: ({ row }: { row: { index: number; original: DraftLine } }) => (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="so-remove-line"
                aria-label={`Hapus baris ${row.index + 1}`}
                disabled={lines.length === 1 || pending}
                onClick={() => {
                  setDirty(true);
                  setLines((old) => old.filter((l) => l.key !== row.original.key));
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ),
          },
        ]
      : []),
  ];
  const freightPayload = () => ({
    payer: freightMode as Exclude<FreightMode, "NONE">,
    basis: "PER_SHIPMENT",
    estimate: freightAmount.trim() || "0",
    tax_mode: freightTaxable ? "TAXABLE" : "NON_TAXABLE",
  });
  const save = async (submitAfter: boolean) => {
    setLocalError("");
    if (
      !customer ||
      !proof ||
      !currency ||
      (freightEnabled && !/^\d{1,14}(\.\d{1,10})?$/.test(freightAmount.trim() || "0")) ||
      lines.some((l) => !l.product_id || !validQty(l.quantity) || !validPrice(l.unit_price))
    ) {
      setLocalError(
        "Lengkapi pelanggan, bukti SP, produk, jumlah positif, dan harga yang valid. Gunakan titik untuk desimal.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const payload = initial
      ? {
          version: initial.version,
          reason,
          evidence_id: proof,
          customer_reference: reference,
          delivery_address: address,
          ...(freightTouched ? { freight: freightEnabled ? freightPayload() : null } : {}),
          lines: lines.map((l) => ({
            line_id: l.line_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
        }
      : {
          customer_id: customer,
          customer_reference: reference,
          delivery_address: address,
          evidence_id: proof,
          currency,
          notes,
          ...(freightEnabled ? { freight: freightPayload() } : {}),
          lines: lines.map(({ product_id, quantity, unit_price }) => ({
            product_id,
            quantity,
            unit_price,
          })),
        };
    try {
      const saved = await command(
        initial ? `/sales-orders/${initial.id}/revise` : "/sales-orders",
        payload,
      );
      setDirty(false);
      // Ajukan = command submit terpisah; bila gagal, SO tetap tersimpan sebagai Draft.
      if (submitAfter)
        await command(`/sales-orders/${saved.data.id}/submit`).catch(() => undefined);
      onSaved(saved.data.id);
    } catch {
      // Pesan galat ditampilkan oleh useOrderCommand.
    }
  };
  const checks: { tone: "success" | "info" | "warning" | "danger"; text: string }[] = [
    { tone: "success", text: "Produk aktif, harga dan pajak per baris" },
    !customer
      ? { tone: "info", text: "Ketentuan pembayaran mengikuti pelanggan yang dipilih" }
      : !policy
      ? { tone: "danger", text: "Ketentuan pembayaran pelanggan belum ditetapkan" }
      : policy.mode === "PREPAY"
        ? { tone: "info", text: "Bayar sebelum kirim: dana diverifikasi sebelum dispatch" }
        : { tone: "info", text: "Past due dan limit kredit dicek bila tempo" },
    { tone: "warning", text: "Stok per barang dicek; kekurangan menjadi backorder" },
  ];
  return (
    <form
      className="web-form so-order-form so-frame-form"
      onChange={() => setDirty(true)}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        void save(submitter?.value === "submit");
      }}
    >
      {lookup.error && (
        <Notice>
          Pilihan pelanggan dan produk gagal dimuat.{" "}
          <Button type="button" variant="outline" size="sm" onClick={() => void lookup.refetch()}>
            Muat ulang pilihan
          </Button>
        </Notice>
      )}
      {localError && (
        <div ref={errorRef} tabIndex={-1}>
          <ErrorBox message={localError} />
        </div>
      )}
      <fieldset disabled={pending} className="so-form-fields">
        <div className="so-form-main">
          <FormSection id="so-customer" no={1} title="Pelanggan">
            <div className="so-grid2">
              {initial ? (
                <div className="so-static">
                  <span>Pelanggan</span>
                  <strong>{initial.customer?.name}</strong>
                </div>
              ) : (
                <div className="so-field">
                  <SelectionField
                    label="Pelanggan *"
                    options={options?.customers ?? []}
                    value={customer ? [customer] : []}
                    placeholder={lookup.isLoading ? "Memuat pelanggan…" : "Pilih pelanggan"}
                    onChange={(v) => {
                      setDirty(true);
                      const c = options?.customers.find((x) => x.id === v[0]);
                      setCustomer(v[0] ?? "");
                      setAddress(c?.shippingAddress ?? c?.primaryAddress ?? "");
                    }}
                  />
                  <AddOrderCustomer />
                </div>
              )}
              <div className="so-policy">
                <span>Ketentuan pembayaran (snapshot dari Finance)</span>
                <strong>{terms(policy)}</strong>
                <small>
                  {policy
                    ? "Past due dan limit dicek saat diajukan."
                    : customer
                      ? "SO dapat disimpan sebagai Draft, tetapi belum bisa diajukan."
                      : "Pilih pelanggan untuk melihat ketentuan pembayaran."}
                </small>
              </div>
              {initial && (
                <label className="so-field so-span">
                  Alasan revisi *
                  <Textarea
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <small>
                    Revisi membatalkan hasil evaluasi sebelumnya dan memerlukan pengajuan ulang.
                  </small>
                </label>
              )}
            </div>
          </FormSection>
          <FormSection id="so-reference" no={2} title="Referensi pesanan">
            <div className="so-grid2">
              <label className="so-field">
                Nomor SP pelanggan *
                <Input
                  required
                  maxLength={100}
                  placeholder="Nomor surat pesanan"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
              <div className="so-field so-span">
                <Upload
                  purpose="SALES_ORDER"
                  onChange={(id) => {
                    setProof(id || (initial?.evidenceId ?? ""));
                    setDirty(true);
                  }}
                />
                {proof && <Evidence id={proof} />}
              </div>
            </div>
          </FormSection>
          <FormSection
            id="so-lines"
            no={3}
            title="Barang"
            description="Isi jumlah dan harga satuan; PPN memakai pajak penjualan bawaan dari Setting › Pajak. Gunakan titik untuk desimal."
            action={
              !initial && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={lines.length >= 100}
                  onClick={() => {
                    setDirty(true);
                    setLines((old) => [
                      ...old,
                      { key: crypto.randomUUID(), product_id: "", quantity: "", unit_price: "" },
                    ]);
                  }}
                >
                  <Plus aria-hidden="true" />
                  Tambah barang
                </Button>
              )
            }
          >
            <div className="so-edit-lines">
              <DataTable
                data={lines}
                columns={columns}
                total={lines.length}
                formTable
                showColumns={false}
                label="barang"
              />
            </div>
            <small className="so-note">
              Ketersediaan stok tidak dicadangkan dari form ini. Kekurangan tetap dicatat dan
              menjadi backorder setelah diajukan.
            </small>
          </FormSection>
          <FormSection id="so-delivery" no={4} title="Pengiriman">
            <div className="so-grid2">
              <label className="so-field so-span">
                Alamat pengantaran *
                <Textarea
                  required
                  maxLength={1000}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <small>Diambil dari data pelanggan; perubahan di sini hanya untuk SO ini.</small>
              </label>
              <div className="so-field">
                <SelectionField
                  label="Ketentuan ongkir"
                  value={[freightMode]}
                  options={Object.entries(freightModes).map(([id, name]) => ({ id, name }))}
                  onChange={(v) => {
                    setFreightMode((v[0] as FreightMode | undefined) ?? "NONE");
                    setFreightTouched(true);
                    setDirty(true);
                  }}
                />
              </div>
              {freightEnabled && (
                <>
                  <label className="so-field">
                    Estimasi ongkir per pengiriman
                    <Input
                      inputMode="decimal"
                      value={freightAmount}
                      placeholder="0"
                      onChange={(e) => {
                        setFreightAmount(e.target.value);
                        setFreightTouched(true);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <div className="so-switch">
                    <label htmlFor="freight-taxable">Ongkir kena PPN</label>
                    <Switch
                      id="freight-taxable"
                      checked={freightTaxable}
                      onCheckedChange={(checked) => {
                        setFreightTaxable(checked);
                        setFreightTouched(true);
                        setDirty(true);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </FormSection>
          <FormSection id="so-notes" no={5} title="Catatan">
            <label className="so-field">
              Catatan untuk gudang dan finance
              <Textarea
                placeholder="Instruksi khusus penerimaan barang"
                maxLength={2000}
                value={notes}
                readOnly={!!initial}
                onChange={(e) => setNotes(e.target.value)}
              />
              {initial && <small>Catatan asli dipertahankan pada revisi ini.</small>}
            </label>
          </FormSection>
        </div>
        <aside className="so-form-aside" aria-label="Ringkasan SO">
          <section className="page-frame-panel so-form-box" aria-labelledby="so-sum-title">
            <h2 id="so-sum-title">Ringkasan</h2>
            <dl className="so-sums">
              <div>
                <dt>
                  {lines.length} baris
                  {qtyTotal ? ` · ${amount(qtyTotal.toString())} ${unit}` : ""}
                </dt>
                <dd />
              </div>
              <div>
                <dt>Nilai barang</dt>
                <dd>{total ? amount(total.toString(), currency) : "—"}</dd>
              </div>
              <div>
                <dt>
                  {defaultTax
                    ? `PPN ${defaultTax.percentage}%${new D(defaultTax.dppFactor).eq(1) ? "" : " × DPP"} (perkiraan)`
                    : "PPN (perkiraan)"}
                </dt>
                <dd>
                  {tax
                    ? amount(tax.toDecimalPlaces(2).toString(), currency)
                    : taxes.isSuccess && !defaultTax
                      ? "Pajak penjualan bawaan belum diatur"
                      : "—"}
                </dd>
              </div>
              <div className="so-sums-total">
                <dt>Total barang</dt>
                <dd>
                  {total && tax
                    ? amount(total.add(tax).toDecimalPlaces(2).toString(), currency)
                    : "—"}
                </dd>
              </div>
            </dl>
            <small className="so-note">
              Ongkir dihitung per pengiriman, terpisah dari nilai barang. Nilai final ditetapkan
              server saat diajukan.
            </small>
          </section>
          <section className="page-frame-panel so-form-box" aria-labelledby="so-checks-title">
            <h2 id="so-checks-title">Diperiksa saat diajukan</h2>
            <small className="so-note">Server mengulang semua pemeriksaan ini.</small>
            <ul className="so-checks">
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
      <footer className="page-frame-form-footer so-frame-footer">
        <p className="so-save-status">
          {pending
            ? "Menyimpan perubahan…"
            : dirty
              ? "Ada perubahan yang belum disimpan."
              : initial
                ? "Belum ada perubahan pada revisi ini."
                : "Draft dapat disimpan sebelum diajukan."}
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
          variant={canSubmit ? "outline" : "default"}
          disabled={pending || lookup.isLoading || !currency}
        >
          {pending ? "Menyimpan…" : initial ? "Simpan revisi" : "Simpan draf"}
        </Button>
        {canSubmit && (
          <Button type="submit" value="submit" disabled={pending || lookup.isLoading || !currency}>
            {initial ? "Simpan & ajukan" : "Ajukan SO"}
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

export function CloseRemainder({
  row,
  cancel,
  command,
  pending,
  onClose,
}: {
  row: Order;
  cancel: boolean;
  command: OrderCommand;
  pending: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(""),
    [contact, setContact] = useState(""),
    [at, setAt] = useState(""),
    [channel, setChannel] = useState(""),
    [reference, setReference] = useState(""),
    [error, setError] = useState("");
  const remaining = row.lines.filter((l) => new D(l.remainder).gt(0));
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(remaining.map((l) => [l.id, l.remainder])),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="so-action-dialog">
        <DialogHeader>
          <DialogTitle>{cancel ? "Batalkan Sisa" : "Tutup Sisa Pesanan"}</DialogTitle>
          <DialogDescription>
            Jumlah pesanan asli dan dokumen tetap tersimpan. Selesaikan pelepasan alokasi aktif
            melalui gudang sebelum menutup sisa tersebut.
          </DialogDescription>
        </DialogHeader>
        <form
          className="web-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            const lines = remaining
              .filter((l) => quantities[l.id] !== "" && quantities[l.id] !== "0")
              .map((l) => ({ line_id: l.id, quantity: quantities[l.id] }));
            if (!lines.length) {
              setError("Pilih setidaknya satu jumlah sisa yang akan ditutup.");
              return;
            }
            void command(`/sales-orders/${row.id}/close-remainder`, {
              version: row.version,
              reason,
              cancel,
              lines,
              ...(cancel
                ? { confirmation: { contact, at: new Date(at).toISOString(), channel, reference } }
                : {}),
            })
              .then(onClose)
              .catch((e) =>
                setError(e instanceof Error ? e.message : "Penutupan belum terkonfirmasi."),
              );
          }}
        >
          {error && <ErrorBox message={error} />}
          <FieldGroup>
            {remaining.map((l) => (
              <Field key={l.id}>
                <FieldLabel htmlFor={`close-${l.id}`}>
                  {l.product.name} · sisa {amount(l.remainder)}
                </FieldLabel>
                <Input
                  id={`close-${l.id}`}
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,10})?"
                  value={quantities[l.id] ?? ""}
                  onChange={(e) => setQuantities((old) => ({ ...old, [l.id]: e.target.value }))}
                />
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="close-reason">Alasan *</FieldLabel>
              <Textarea
                id="close-reason"
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            {cancel && (
              <>
                {[
                  ["contact", "Pihak pelanggan", contact, setContact],
                  ["channel", "Media konfirmasi", channel, setChannel],
                  ["reference", "Isi / referensi konfirmasi", reference, setReference],
                ].map(([id, label, value, set]) => (
                  <Field key={String(id)}>
                    <FieldLabel htmlFor={`confirm-${id}`}>{String(label)} *</FieldLabel>
                    <Input
                      id={`confirm-${id}`}
                      required
                      maxLength={1000}
                      value={String(value)}
                      onChange={(e) => (set as (v: string) => void)(e.target.value)}
                    />
                  </Field>
                ))}
                <Field>
                  <FieldLabel htmlFor="confirm-at">Waktu konfirmasi pelanggan *</FieldLabel>
                  <Input
                    id="confirm-at"
                    type="datetime-local"
                    required
                    value={at}
                    onChange={(e) => setAt(e.target.value)}
                  />
                </Field>
                <p className="so-help">Waktu mengikuti zona waktu perangkat Anda.</p>
              </>
            )}
          </FieldGroup>
          {!remaining.length && (
            <Notice>
              Tidak ada sisa bebas yang dapat ditutup. Periksa alokasi pada tahap pemenuhan.
            </Notice>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Kembali
            </Button>
            <Button type="submit" disabled={pending || !remaining.length}>
              {pending ? "Menyimpan…" : cancel ? "Konfirmasi Pembatalan" : "Tutup Sisa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
