"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormFrame, PageNotice } from "@/components/web/page-frame";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import {
  DuplicateNotice,
  nullableText,
  useCan,
  useDuplicateCheck,
  useMasterKey,
  type MasterState,
} from "../master-shared";
import { base, itemKinds, type OperationalItem } from "./item-workspace";

const decimal = /^\d+(\.\d+)?$/;
// Format Indonesia (1.250.000,50) diubah ke string desimal API tanpa melewati number.
const toDecimal = (value: string) => value.trim().replace(/\./g, "").replace(",", ".");
const fromDecimal = (value?: string | null) => {
  if (!value) return "";
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole},${trimmed}` : (whole ?? "");
};

export function ItemForm({ initial }: { initial?: OperationalItem | undefined }) {
  const router = useRouter(),
    cache = useQueryClient(),
    can = useCan(),
    key = useMasterKey(),
    duplicate = useDuplicateCheck("operational-items", initial);
  const uoms = useQuery({
    queryKey: key("uoms", "options"),
    queryFn: () =>
      apiRequest<{ data: { id: string; code: string; name: string; state: MasterState }[] }>(
        "/master-data/uoms",
      ).then((r) => r.data.filter((u) => u.state === "ACTIVE")),
    enabled: !initial && can("master_uom.read"),
  });
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    kind: initial?.kind ?? "SUPPLY",
    category: initial?.category ?? "",
    specification: initial?.specification ?? "",
    base_uom_id: initial?.base_uom?.id ?? "",
    reference_purchase_price: fromDecimal(initial?.reference_purchase_price),
    currency: initial?.currency ?? "",
    minimum_stock: fromDecimal(initial?.minimum_stock),
  });
  const [stockControlled, setStockControlled] = useState(initial?.stock_controlled ?? false);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({});
  const set = (field: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
    setDirty(true);
  };
  const submit = async () => {
    const found: Record<string, string> = {};
    const priceValue = toDecimal(values.reference_purchase_price);
    const minimum = toDecimal(values.minimum_stock);
    if (values.name.trim().length < 2) found.name = "Nama item wajib diisi.";
    if (!values.category.trim()) found.category = "Kategori wajib diisi.";
    if (!initial && !values.base_uom_id) found.base_uom_id = "Pilih satuan dasar aktif.";
    if (priceValue && !decimal.test(priceValue)) found.reference_purchase_price = "Gunakan format 1.250.000,50.";
    if (priceValue && !/^[A-Z]{3}$/.test(values.currency.trim()))
      found.currency = "Isi kode mata uang tiga huruf bila harga diisi.";
    if (stockControlled && minimum && !decimal.test(minimum)) found.minimum_stock = "Gunakan angka desimal.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      name: values.name.trim(),
      kind: values.kind,
      category: values.category.trim(),
      specification: nullableText(values.specification),
      reference_purchase_price: priceValue || null,
      currency: priceValue ? values.currency.trim() : null,
      minimum_stock: stockControlled && minimum ? minimum : null,
      stock_controlled: stockControlled,
    };
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<{ data: { id: string } }>(
        initial ? `/master-data/operational-items/${initial.id}` : "/master-data/operational-items",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(
            initial
              ? { ...body, version: initial.version }
              : { ...body, base_uom_id: values.base_uom_id },
          ),
        },
      );
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      setDirty(false);
      toast.success(initial ? "Item disimpan" : "Item dibuat");
      router.push(`${base}/${saved.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {error && <PageNotice tone="error">{error}</PageNotice>}
      <FormFrame
        dirty={dirty}
        submitting={busy}
        onSubmit={() => void submit()}
        cancelHref={initial ? `${base}/${initial.id}` : base}
        sections={[
          {
            id: "identity",
            title: "Identitas",
            content: (
              <div className="page-frame-fields">
                <label>
                  Nama item *
                  <Input
                    value={values.name}
                    aria-invalid={!!errors.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => void duplicate.check(values.name)}
                  />
                  {errors.name && <span className="page-frame-field-error">{errors.name}</span>}
                </label>
                <SelectionField
                  label="Jenis *"
                  value={[values.kind]}
                  options={Object.entries(itemKinds).map(([id, name]) => ({ id, name }))}
                  onChange={(v) => set("kind", v[0] ?? "SUPPLY")}
                />
                <DuplicateNotice duplicates={duplicate.duplicates} base={base} />
                <label>
                  Kategori *
                  <Input
                    value={values.category}
                    placeholder="ATK"
                    aria-invalid={!!errors.category}
                    onChange={(e) => set("category", e.target.value)}
                  />
                  {errors.category && <span className="page-frame-field-error">{errors.category}</span>}
                </label>
                {initial ? (
                  <label>
                    Satuan dasar
                    <Input value={initial.base_uom?.name ?? ""} disabled />
                  </label>
                ) : uoms.data ? (
                  <SelectionField
                    label="Satuan dasar *"
                    value={values.base_uom_id ? [values.base_uom_id] : []}
                    options={uoms.data.map((u) => ({ id: u.id, name: u.name, code: u.code }))}
                    placeholder="Pilih satuan"
                    error={errors.base_uom_id}
                    onChange={(v) => set("base_uom_id", v[0] ?? "")}
                  />
                ) : (
                  <PageNotice tone={uoms.isError ? "error" : "info"}>
                    {uoms.isError ? uoms.error.message : "Memerlukan izin melihat Satuan untuk memilih satuan dasar."}
                  </PageNotice>
                )}
                <label className="span-full">
                  Spesifikasi/ruang lingkup
                  <Textarea value={values.specification} onChange={(e) => set("specification", e.target.value)} />
                </label>
              </div>
            ),
          },
          {
            id: "price",
            title: "Harga & stok",
            description: "Harga Beli Acuan opsional; kosong berarti belum tersedia, bukan Rp0.",
            content: (
              <div className="page-frame-fields">
                <label>
                  Harga Beli Acuan
                  <Input
                    inputMode="decimal"
                    placeholder="1.250.000"
                    value={values.reference_purchase_price}
                    aria-invalid={!!errors.reference_purchase_price}
                    onChange={(e) => set("reference_purchase_price", e.target.value)}
                  />
                  {errors.reference_purchase_price && (
                    <span className="page-frame-field-error">{errors.reference_purchase_price}</span>
                  )}
                </label>
                <label>
                  Mata uang
                  <Input
                    maxLength={3}
                    placeholder="IDR"
                    value={values.currency}
                    aria-invalid={!!errors.currency}
                    onChange={(e) => set("currency", e.target.value.toUpperCase())}
                  />
                  {errors.currency && <span className="page-frame-field-error">{errors.currency}</span>}
                </label>
                <label className="span-full flex-row items-center gap-2">
                  <Checkbox
                    checked={stockControlled}
                    onCheckedChange={(v) => {
                      setStockControlled(v === true);
                      setDirty(true);
                    }}
                  />
                  Disimpan sebagai stok operasional
                </label>
                {stockControlled && (
                  <label>
                    Stok minimum
                    <Input
                      inputMode="decimal"
                      value={values.minimum_stock}
                      aria-invalid={!!errors.minimum_stock}
                      onChange={(e) => set("minimum_stock", e.target.value)}
                    />
                    {errors.minimum_stock && (
                      <span className="page-frame-field-error">{errors.minimum_stock}</span>
                    )}
                  </label>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
