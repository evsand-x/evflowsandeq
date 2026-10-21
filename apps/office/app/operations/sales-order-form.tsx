"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Decimal from "decimal.js";
import { Trash2, Plus, Paperclip, Check } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddOrderCustomer } from "./so-add-customer";
import { SelectionField } from "@/components/web/selection-field";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/api";
import { useSession } from "../session-provider";
import { DataTable, Notice } from "../crm/crm-common";
import { Upload, ErrorBox, Evidence } from "./workspace";
import { Panel, Totals, Value } from "./sales-order";
import { amount, terms, type Order, type OrderCommand } from "./sales-order-types";

const D = Decimal.clone({ precision: 50 });
type DraftLine = {
  key: string;
  line_id?: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  tax_master_id?: string;
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
  const [freightEnabled, setFreightEnabled] = useState(initial?.freightEstimate != null),
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
      ...(l.taxSnapshot?.operational_tax_id
        ? { tax_master_id: l.taxSnapshot.operational_tax_id }
        : {}),
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
      apiRequest<{ data: { id: string; name: string; percentage: string }[] }>("/tax/options?usage=SALES"),
    enabled: !!principal,
  });
  const selected = options?.customers.find((c) => c.id === customer);
  const currency = initial?.currency ?? options?.currency;
  const values = lines.map(subtotal),
    total = values.every((v) => v !== null)
      ? values.reduce<Decimal>((sum, v) => sum.add(v!), new D(0)).toString()
      : undefined;
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
      id: "code",
      header: "Kode produk",
      cell: ({ row }) => (
        <span className="so-code">
          {(
            options?.products.find((p) => p.id === row.original.product_id) ??
            initial?.lines.find((l) => l.productId === row.original.product_id)?.product
          )?.code ?? "—"}
        </span>
      ),
    },
    {
      id: "name",
      header: "Nama produk",
      cell: ({ row }) => {
        const product =
          options?.products.find((p) => p.id === row.original.product_id) ??
          initial?.lines.find((l) => l.productId === row.original.product_id)?.product;
        return (
          <div className="so-product-choice">
            {initial ? (
              <strong>{product?.name}</strong>
            ) : (
              <SelectionField
                label={`Produk baris ${row.index + 1}`}
                hideLabel
                placeholder="Cari dan pilih produk"
                options={options?.products ?? []}
                value={row.original.product_id ? [row.original.product_id] : []}
                onChange={(v) => change(row.original.key, "product_id", v[0] ?? "")}
              />
            )}
          </div>
        );
      },
    },
    {
      id: "unit",
      header: "Satuan",
      cell: ({ row }) =>
        (
          options?.products.find((p) => p.id === row.original.product_id) ??
          initial?.lines.find((l) => l.productId === row.original.product_id)?.product
        )?.baseUom?.name ?? "—",
    },
    {
      id: "qty",
      header: "Jumlah",
      cell: ({ row }) => (
        <Input
          required
          aria-label={`Jumlah baris ${row.index + 1}`}
          inputMode="decimal"
          value={row.original.quantity}
          pattern="[0-9]+([.][0-9]{1,10})?"
          onChange={(e) => change(row.original.key, "quantity", e.target.value)}
        />
      ),
    },
    {
      id: "price",
      header: "Harga satuan",
      cell: ({ row }) => (
        <PriceInput
          label={`Harga baris ${row.index + 1}`}
          value={row.original.unit_price}
          onChange={(v) => change(row.original.key, "unit_price", v)}
        />
      ),
    },
    {
      id: "discount",
      header: "Diskon",
      cell: () => <span className="so-unavailable">Belum didukung</span>,
    },
    {
      id: "tax",
      header: "Pajak",
      cell: ({ row }) => (
        <SelectionField
          hideLabel
          label={`Pajak baris ${row.index + 1}`}
          value={row.original.tax_master_id ? [row.original.tax_master_id] : []}
          options={(taxes.data?.data ?? []).map((t) => ({
            id: t.id,
            name: `${t.name} (${t.percentage}%)`,
          }))}
          onChange={(v) => change(row.original.key, "tax_master_id", v[0] ?? "")}
          placeholder="Pilih pajak"
        />
      ),
    },
    {
      id: "net",
      header: "Subtotal",
      cell: ({ row }) => amount(subtotal(row.original)?.toString()),
    },
    ...(!initial
      ? [
          {
            id: "actions",
            header: "",
            cell: ({ row }: { row: { index: number; original: DraftLine } }) => (
              <Button
                type="button"
                variant="ghost"
                className="so-remove-line"
                aria-label={`Hapus produk baris ${row.index + 1}`}
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
  return (
    <form
      className="web-form so-order-form"
      onChange={() => setDirty(true)}
      onSubmit={(event) => {
        event.preventDefault();

        setLocalError("");
        if (
          !customer ||
          !proof ||
          !currency ||
          (freightEnabled && !/^\d{1,14}(\.\d{1,10})?$/.test(freightAmount.trim())) ||
          lines.some((l) => !l.product_id || !validQty(l.quantity) || !validPrice(l.unit_price))
        ) {
          setLocalError(
            "Lengkapi pelanggan, lampiran SP, produk, jumlah positif, dan harga yang valid. Gunakan titik untuk desimal.",
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
              ...(freightTouched
                ? {
                    freight: freightEnabled
                      ? {
                          payer: initial.freightTermsSnapshot?.payer ?? "CUSTOMER",
                          basis: "PER_SHIPMENT",
                          estimate: freightAmount.trim(),
                          tax_mode: freightTaxable ? "TAXABLE" : "NON_TAXABLE",
                          ...(initial.freightTermsSnapshot?.tax_rule_id
                            ? { tax_rule_id: initial.freightTermsSnapshot.tax_rule_id }
                            : {}),
                        }
                      : null,
                  }
                : {}),
              lines: lines.map((l) => ({
                line_id: l.line_id,
                quantity: l.quantity,
                unit_price: l.unit_price,
                ...(l.tax_master_id ? { tax_master_id: l.tax_master_id } : {}),
              })),
            }
          : {
              customer_id: customer,
              customer_reference: reference,
              delivery_address: address,
              evidence_id: proof,
              currency,
              notes,
              ...(freightEnabled
                ? {
                    freight: {
                      payer: "CUSTOMER",
                      basis: "PER_SHIPMENT",
                      estimate: freightAmount || "0",
                      tax_mode: freightTaxable ? "TAXABLE" : "NON_TAXABLE",
                    },
                  }
                : {}),
              lines: lines.map(({ product_id, quantity, unit_price, tax_master_id }) => ({
                product_id,
                quantity,
                unit_price,
                ...(tax_master_id ? { tax_master_id } : {}),
              })),
            };
        void command(initial ? `/sales-orders/${initial.id}/revise` : "/sales-orders", payload)
          .then((r) => {
            setDirty(false);
            onSaved(r.data.id);
          })
          .catch(() => undefined);
      }}
    >
      {lookup.error && (
        <>
          <ErrorBox message={String(lookup.error)} />
          <Button type="button" variant="outline" onClick={() => void lookup.refetch()}>
            Muat ulang pilihan
          </Button>
        </>
      )}
      {localError && (
        <div ref={errorRef} tabIndex={-1}>
          <ErrorBox message={localError} />
        </div>
      )}
      <Button
        className="sales-back"
        type="button"
        variant="outline"
        onClick={() => {
          setLeaveTo(null);
          if (dirty) setLeaving(true);
          else router.push(back);
        }}
      >
        Kembali ke daftar
      </Button>
      <fieldset disabled={pending} className="so-form-fields">
        <div className="so-form-main">
          <Panel title="1 · Pelanggan">
            <p className="so-help">Field bertanda * wajib diisi.</p>
            <FieldGroup className="sales-customer-fields">
              {initial ? (
                <Value label="Pelanggan">{initial.customer?.name}</Value>
              ) : (
                <div className="so-customer-picker">
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

              <Value label="Termin">
                {terms(initial?.paymentSnapshot ?? selected?.paymentPolicies[0])}
              </Value>
            </FieldGroup>
            <Value label="Sisa limit kredit">Belum tersedia</Value>
            {initial && (
              <Field>
                <FieldLabel htmlFor="so-reason">Alasan revisi *</FieldLabel>
                <Textarea
                  id="so-reason"
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <p className="so-help">
                  Revisi membatalkan hasil evaluasi sebelumnya dan memerlukan pengajuan ulang.
                </p>
              </Field>
            )}
          </Panel>
          <Panel title="2 · Referensi SP/PO">
            {" "}
            <Field>
              <FieldLabel htmlFor="so-reference">Referensi SP/PO pelanggan *</FieldLabel>
              <Input
                id="so-reference"
                required
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>{" "}
            <div className="so-document-links">
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline">
                    {proof ? (
                      <Check data-icon="inline-start" aria-hidden="true" />
                    ) : (
                      <Paperclip data-icon="inline-start" aria-hidden="true" />
                    )}
                    {proof ? "Lampiran SP/PO tersimpan" : "Unggah SP/PO pelanggan *"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Lampiran SP Pelanggan</DialogTitle>
                    <DialogDescription>
                      Unggah bukti SP/PO pelanggan berupa JPEG atau PNG, maksimal 2 MB.
                    </DialogDescription>
                  </DialogHeader>
                  {
                    <Upload
                      purpose="SALES_ORDER"
                      onChange={(id) => {
                        setProof(id);
                        setDirty(true);
                      }}
                    />
                  }
                  {proof && <Evidence id={proof} />}
                </DialogContent>
              </Dialog>
            </div>
          </Panel>
          <Panel title="3 · Barang">
            <p className="so-help">
              {lines.length} baris produk · Isi jumlah dan harga satuan. Gunakan titik untuk
              desimal.
            </p>
            <div className="so-edit-lines">
              <DataTable
                data={lines}
                columns={columns}
                total={lines.length}
                formTable
                showColumns={false}
                label="produk pesanan"
              />
            </div>
            {!initial && (
              <Button
                variant="outline"
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
                <Plus data-icon="inline-start" aria-hidden="true" />
                Tambah Produk
              </Button>
            )}
          </Panel>
          <Panel title="4 · Pengiriman & ongkos kirim" className="so-freight-card">
            {" "}
            <Field>
              <FieldLabel htmlFor="so-address">Alamat pengiriman *</FieldLabel>
              <Input
                id="so-address"
                required
                maxLength={1000}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Tambahkan ongkos kirim</p>
                <p className="text-muted-foreground text-xs">Ditagihkan per pengiriman.</p>
              </div>
              <Switch
                checked={freightEnabled}
                onCheckedChange={(checked) => {
                  setFreightEnabled(checked);
                  setFreightTouched(true);
                  setDirty(true);
                }}
                aria-label="Aktifkan ongkos kirim"
              />
            </div>
            {freightEnabled && (
              <FieldGroup className="mt-4">
                <Field>
                  <FieldLabel htmlFor="freight-amount">Nominal ongkos kirim</FieldLabel>
                  <Input
                    id="freight-amount"
                    inputMode="decimal"
                    value={freightAmount}
                    onChange={(e) => {
                      setFreightAmount(e.target.value);
                      setFreightTouched(true);
                      setDirty(true);
                    }}
                    placeholder="0"
                  />
                </Field>
                <Field>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <FieldLabel htmlFor="freight-taxable">Kena PPN</FieldLabel>
                    <Switch
                      id="freight-taxable"
                      checked={freightTaxable}
                      onCheckedChange={(checked) => {
                        setFreightTaxable(checked);
                        setFreightTouched(true);
                        setDirty(true);
                      }}
                      aria-label="Ongkos kirim kena PPN"
                    />
                  </div>
                </Field>
              </FieldGroup>
            )}
          </Panel>
          <Panel title="5 · Catatan">
            <Field>
              <FieldLabel htmlFor="so-notes">Catatan (opsional)</FieldLabel>
              <Textarea
                id="so-notes"
                placeholder="Tambahkan instruksi atau informasi untuk pesanan ini…"
                maxLength={2000}
                value={notes}
                readOnly={!!initial}
                onChange={(e) => setNotes(e.target.value)}
              />
              {initial && <p className="so-help">Catatan asli dipertahankan pada revisi ini.</p>}
            </Field>
          </Panel>
        </div>
        <aside className="so-form-aside" aria-label="Ringkasan dan informasi dokumen">
          <Panel title="Ringkasan">
            <Totals
              subtotal={total}
              currency={currency}
              freight={freightEnabled && validPrice(freightAmount) ? freightAmount : null}
            />
          </Panel>

          <Panel title="Diperiksa saat diajukan">
            <Value label="Aturan pembayaran">Dicek</Value>
            <Value label="Past due / limit kredit">Dicek bila tempo</Value>
            <Value label="Stok per item">Dicek</Value>
          </Panel>
        </aside>
      </fieldset>
      <footer className="so-footer so-save-bar">
        <p className="so-save-status">
          {pending
            ? "Menyimpan perubahan…"
            : dirty
              ? "Ada perubahan yang belum disimpan"
              : initial
                ? "Belum ada perubahan pada revisi ini"
                : "Draft baru · belum disimpan"}
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
        <Button type="submit" disabled={pending || lookup.isLoading || !currency}>
          {pending ? "Menyimpan…" : initial ? "Simpan Revisi" : "Simpan Draft"}
        </Button>
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
