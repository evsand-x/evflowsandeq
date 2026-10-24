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
import { nullableText, useCan, useMasterKey, type MasterState } from "../master-shared";
import { base, type Product } from "./product-workspace";

type Option = { id: string; code: string; name: string; state: MasterState };
const text = (value: unknown) => (value == null ? "" : String(value));

function useOptions(resource: "product-categories" | "uoms", permission: string) {
  const can = useCan(),
    key = useMasterKey();
  return useQuery({
    queryKey: key(resource, "options"),
    queryFn: () =>
      apiRequest<{ data: Option[] }>(`/master-data/${resource}`).then((r) =>
        r.data.filter((o) => o.state === "ACTIVE"),
      ),
    enabled: can(`${permission}.read`),
  });
}

export function ProductForm({ initial }: { initial?: Product | undefined }) {
  const router = useRouter(),
    cache = useQueryClient();
  const categories = useOptions("product-categories", "master_product_category"),
    uoms = useOptions("uoms", "master_uom");
  const profile = (initial?.storage_profile ?? {}) as Record<string, unknown>;
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    category_id: initial?.category?.id ?? "",
    base_uom_id: initial?.base_uom?.id ?? "",
    shelf_life_days: initial?.shelf_life_days?.toString() ?? "",
    storage_notes: initial?.storage_notes ?? "",
    min_temp: text(profile.min_temp),
    max_temp: text(profile.max_temp),
    humidity_limits: text(profile.humidity_limits),
    source_document: text(profile.source_document),
    discount_limit: text(initial?.discount_limit),
  });
  const canDiscountLimit = useCan()("discount_limit.manage");
  const [flags, setFlags] = useState({
    batch_required: initial?.batch_required ?? true,
    expiry_required: initial?.expiry_required ?? true,
    serial_required: initial?.serial_required ?? false,
  });
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [duplicates, setDuplicates] = useState<{ id: string; code: string; name: string }[]>([]);
  const set = (field: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
    setDirty(true);
  };
  const baseUomLocked = !!initial && initial.state !== "DRAFT";
  const checkDuplicates = async () => {
    const name = values.name.trim();
    if (name.length < 2 || name === initial?.name) return setDuplicates([]);
    try {
      const result = await apiRequest<{ data: { id: string; code: string; name: string }[] }>(
        "/master-data/products/duplicate-check",
        { method: "POST", body: JSON.stringify({ name }) },
      );
      setDuplicates(result.data.filter((d) => d.id !== initial?.id));
    } catch {
      setDuplicates([]);
    }
  };
  const submit = async () => {
    const found: Record<string, string> = {};
    if (values.name.trim().length < 2) found.name = "Nama produk wajib diisi.";
    if (!values.category_id) found.category_id = "Pilih kategori aktif.";
    if (!values.base_uom_id) found.base_uom_id = "Pilih satuan dasar aktif.";
    if (
      canDiscountLimit &&
      values.discount_limit &&
      !/^\d{1,3}([.,]\d{1,4})?$/.test(values.discount_limit)
    )
      found.discount_limit = "Isi persen 0-100, maksimal empat desimal.";
    if (
      canDiscountLimit &&
      /^\d+([.,]\d+)?$/.test(values.discount_limit) &&
      Number(values.discount_limit.replace(",", ".")) > 100
    )
      found.discount_limit = "Batas diskon maksimal 100%.";
    if (values.shelf_life_days && !/^\d+$/.test(values.shelf_life_days))
      found.shelf_life_days = "Masa simpan berupa jumlah hari.";
    for (const field of ["min_temp", "max_temp"] as const)
      if (values[field] && !/^-?\d+([.,]\d+)?$/.test(values[field]))
        found[field] = "Isi angka suhu.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const storage = {
      ...profile,
      min_temp: values.min_temp.replace(",", ".") || null,
      max_temp: values.max_temp.replace(",", ".") || null,
      humidity_limits: nullableText(values.humidity_limits),
      source_document: nullableText(values.source_document),
    };
    const hasStorage = Object.values(storage).some((v) => v != null && v !== "");
    const body = {
      name: values.name.trim(),
      category_id: values.category_id,
      base_uom_id: values.base_uom_id,
      ...flags,
      storage_notes: nullableText(values.storage_notes),
      storage_profile: hasStorage ? storage : null,
      shelf_life_days: values.shelf_life_days ? Number(values.shelf_life_days) : null,
      ...(canDiscountLimit
        ? {
            discount_limit: values.discount_limit
              ? values.discount_limit.replace(",", ".").replace(/\.$/, "")
              : null,
          }
        : {}),
    };
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<{ data: { id: string } }>(
        initial ? `/master-data/products/${initial.id}` : "/master-data/products",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(initial ? { ...body, version: initial.version } : body),
        },
      );
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      setDirty(false);
      toast.success(initial ? "Produk disimpan" : "Produk dibuat");
      router.push(`${base}/${saved.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const select = (
    label: string,
    field: "category_id" | "base_uom_id",
    query: ReturnType<typeof useOptions>,
    current?: { id: string; name: string },
    disabled = false,
  ) =>
    disabled ? (
      <label>
        {label}
        <Input value={current?.name ?? ""} disabled />
        <span className="page-frame-subtitle">
          Hanya dapat diganti selama produk berstatus Draf dan belum dipakai transaksi.
        </span>
      </label>
    ) : query.data ? (
      <SelectionField
        label={`${label} *`}
        value={values[field] ? [values[field]] : []}
        options={[
          ...query.data.map((o) => ({ id: o.id, name: o.name, code: o.code })),
          ...(current && !query.data.some((o) => o.id === current.id)
            ? [{ id: current.id, name: current.name }]
            : []),
        ]}
        placeholder={`Pilih ${label.toLowerCase()}`}
        error={errors[field]}
        onChange={(v) => set(field, v[0] ?? "")}
      />
    ) : (
      <PageNotice tone={query.isError ? "error" : "info"}>
        {query.isError ? query.error.message : `Memerlukan izin melihat ${label}.`}
      </PageNotice>
    );
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
                <label className="span-full">
                  Nama produk *
                  <Input
                    value={values.name}
                    aria-invalid={!!errors.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => void checkDuplicates()}
                  />
                  {errors.name && <span className="page-frame-field-error">{errors.name}</span>}
                </label>
                {duplicates.length > 0 && (
                  <div className="span-full">
                    <PageNotice>
                      Nama mirip sudah terdaftar:{" "}
                      {duplicates.map((d) => `${d.code} ${d.name}`).join(", ")}
                    </PageNotice>
                  </div>
                )}
                {select("Kategori", "category_id", categories, initial?.category)}
                {select("Satuan dasar", "base_uom_id", uoms, initial?.base_uom, baseUomLocked)}
              </div>
            ),
          },
          {
            id: "tracking",
            title: "Penanganan batch",
            content: (
              <div className="page-frame-fields">
                {(
                  [
                    ["batch_required", "Wajib nomor batch"],
                    ["expiry_required", "Wajib tanggal kedaluwarsa"],
                    ["serial_required", "Wajib nomor seri"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="flex-row items-center gap-2">
                    <Checkbox
                      checked={flags[field]}
                      onCheckedChange={(v) => {
                        setFlags((f) => ({ ...f, [field]: v === true }));
                        setDirty(true);
                      }}
                    />
                    {label}
                  </label>
                ))}
                <label>
                  Masa simpan (hari){flags.expiry_required ? " — wajib sebelum aktivasi" : ""}
                  <Input
                    inputMode="numeric"
                    value={values.shelf_life_days}
                    aria-invalid={!!errors.shelf_life_days}
                    onChange={(e) => set("shelf_life_days", e.target.value)}
                  />
                  {errors.shelf_life_days && (
                    <span className="page-frame-field-error">{errors.shelf_life_days}</span>
                  )}
                </label>
              </div>
            ),
          },
          ...(canDiscountLimit
            ? [
                {
                  id: "discount",
                  title: "Batas diskon",
                  description:
                    "Batas atas diskon produk ini. Batas efektif adalah yang terkecil antara batas orang dan batas produk; kosong berarti tidak ada batas produk.",
                  content: (
                    <div className="page-frame-fields">
                      <label>
                        Batas diskon produk (%)
                        <Input
                          inputMode="decimal"
                          value={values.discount_limit}
                          aria-invalid={!!errors.discount_limit}
                          onChange={(e) => set("discount_limit", e.target.value)}
                        />
                        {errors.discount_limit && (
                          <span className="page-frame-field-error">{errors.discount_limit}</span>
                        )}
                      </label>
                    </div>
                  ),
                },
              ]
            : []),
          {
            id: "storage",
            title: "Penyimpanan & mutu",
            description:
              "Isi dari izin edar atau ketentuan produsen. Data yang belum lengkap menahan aktivasi, bukan diisi perkiraan.",
            content: (
              <div className="page-frame-fields">
                <label>
                  Suhu minimum (°C)
                  <Input
                    inputMode="decimal"
                    value={values.min_temp}
                    aria-invalid={!!errors.min_temp}
                    onChange={(e) => set("min_temp", e.target.value)}
                  />
                  {errors.min_temp && (
                    <span className="page-frame-field-error">{errors.min_temp}</span>
                  )}
                </label>
                <label>
                  Suhu maksimum (°C)
                  <Input
                    inputMode="decimal"
                    value={values.max_temp}
                    aria-invalid={!!errors.max_temp}
                    onChange={(e) => set("max_temp", e.target.value)}
                  />
                  {errors.max_temp && (
                    <span className="page-frame-field-error">{errors.max_temp}</span>
                  )}
                </label>
                <label>
                  Batas kelembapan
                  <Input
                    value={values.humidity_limits}
                    onChange={(e) => set("humidity_limits", e.target.value)}
                  />
                </label>
                <label>
                  Sumber ketentuan
                  <Input
                    placeholder="Nomor izin edar atau dokumen produsen"
                    value={values.source_document}
                    onChange={(e) => set("source_document", e.target.value)}
                  />
                </label>
                <label className="span-full">
                  Catatan penanganan *
                  <Textarea
                    value={values.storage_notes}
                    onChange={(e) => set("storage_notes", e.target.value)}
                  />
                </label>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
