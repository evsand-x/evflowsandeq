"use client";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormFrame, PageNotice } from "@/components/web/page-frame";
import { IconPlus } from "@/components/web/icons";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { Upload } from "../../operations/workspace";
import {
  formatDecimal,
  nullableText,
  useCan,
  useMasterKey,
  type MasterState,
} from "../master-shared";
import {
  marginNote,
  parseFactor,
  parseMoney,
  parseTemperature,
  permitPayload,
  productCodePattern,
  productReadiness,
  type PermitInput,
} from "./product-form-utils";
import { base, registrationLabel, type Product } from "./product-workspace";
import "./product-form.css";

type Option = { id: string; code: string; name: string; state: MasterState };
type Conversion = { key: number; uom_id: string; factor: string };
const text = (value: unknown) => (value == null ? "" : String(value));
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";

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

function Hint({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <span className={error ? "page-frame-field-error" : "page-frame-subtitle"}>{children}</span>
  );
}

function ActivationTag() {
  return <span className="pf-tag">Aktivasi</span>;
}

/** Form produk (mockup Form · Produk baru): Draft disimpan dulu, aktivasi dari detail. */
export function ProductForm({ initial }: { initial?: Product | undefined }) {
  const router = useRouter(),
    cache = useQueryClient(),
    can = useCan();
  const categories = useOptions("product-categories", "master_product_category"),
    uoms = useOptions("uoms", "master_uom");
  const creating = !initial;
  const profile = (initial?.storage_profile ?? {}) as Record<string, unknown>;
  const [values, setValues] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    category_id: initial?.category?.id ?? "",
    base_uom_id: initial?.base_uom?.id ?? "",
    shelf_life_days: initial?.shelf_life_days?.toString() ?? "",
    minimum_stock: formatDecimal(initial?.minimum_stock) ?? "",
    storage_notes: initial?.storage_notes ?? "",
    min_temp: text(profile.min_temp),
    max_temp: text(profile.max_temp),
    humidity_limits: text(profile.humidity_limits),
    source_document: text(profile.source_document),
    purchase_price: "",
    sale_price: "",
    discount_limit: text(initial?.discount_limit),
  });
  const [flags, setFlags] = useState({
    batch_required: initial?.batch_required ?? true,
    expiry_required: (initial?.expiry_required ?? true) && (initial?.batch_required ?? true),
  });
  const [conversions, setConversions] = useState<Conversion[]>([]),
    [seq, setSeq] = useState(0);
  const [permit, setPermit] = useState<PermitInput>({
    permit_type: "AKL",
    permit_number: "",
    holder: "",
    issued_on: "",
    expires_on: "",
    evidence: "",
  });
  const canDiscountLimit = can("discount_limit.manage");
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [duplicates, setDuplicates] = useState<{ id: string; code: string; name: string }[]>([]);
  const touch = () => setDirty(true);
  const set = (field: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
    touch();
  };
  const setPermitField = (field: keyof PermitInput, value: string) => {
    setPermit((p) => ({ ...p, [field]: value }));
    setErrors((e) => ({ ...e, permit: "" }));
    touch();
  };
  // Kode dan satuan dasar hanya bisa diganti selama Draft; backend juga menolak bila sudah dipakai transaksi.
  const locked = !!initial && initial.state !== "DRAFT";
  const baseUom = uoms.data?.find((u) => u.id === values.base_uom_id) ?? initial?.base_uom;
  const baseName = baseUom?.name ?? "satuan dasar";
  const readiness = productReadiness({ ...values, expiry_required: flags.expiry_required });
  const doneCount = readiness.filter((r) => r.done).length;

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
    const code = values.code.trim();
    const codeChanged = creating || code !== initial?.code;
    if (codeChanged && !productCodePattern.test(code))
      found.code = "Isi kode: huruf besar, angka, atau . _ / - (maks. 50).";
    if (values.name.trim().length < 2) found.name = "Nama produk minimal 2 karakter.";
    if (!values.category_id) found.category_id = "Pilih kategori aktif.";
    if (!values.base_uom_id) found.base_uom_id = "Pilih satuan dasar aktif.";
    const factors = conversions.map((c) => ({ ...c, value: parseFactor(c.factor) }));
    if (
      factors.some((c) => !c.uom_id || !c.value) ||
      factors.some((c) => c.uom_id === values.base_uom_id) ||
      new Set(factors.map((c) => c.uom_id)).size !== factors.length
    )
      found.conversions =
        "Setiap konversi perlu satuan berbeda (bukan satuan dasar) dan faktor lebih dari nol.";
    if (values.shelf_life_days && !/^\d+$/.test(values.shelf_life_days))
      found.shelf_life_days = "Masa simpan berupa jumlah hari.";
    const minimum = values.minimum_stock ? parseMoney(values.minimum_stock) : null;
    if (values.minimum_stock && minimum === null) found.minimum_stock = "Isi angka stok minimum.";
    const temps = { min_temp: values.min_temp, max_temp: values.max_temp };
    for (const field of ["min_temp", "max_temp"] as const)
      if (temps[field] && parseTemperature(temps[field]) === null) found[field] = "Isi angka suhu.";
    const tMin = parseTemperature(values.min_temp),
      tMax = parseTemperature(values.max_temp);
    if (tMin !== null && tMax !== null && Number(tMax) <= Number(tMin))
      found.max_temp = "Suhu maksimum harus lebih tinggi dari minimum.";
    const permitResult = creating ? permitPayload(permit) : { body: {} };
    if (permitResult.error) found.permit = permitResult.error;
    const buy = values.purchase_price ? parseMoney(values.purchase_price) : null,
      sell = values.sale_price ? parseMoney(values.sale_price) : null;
    if ((values.purchase_price && !buy) || (values.sale_price && !sell))
      found.prices = "Isi harga dengan angka, misalnya 125.000.";
    const discount = values.discount_limit.trim().replace(",", ".").replace(/\.$/, "");
    if (
      canDiscountLimit &&
      discount &&
      (!/^\d{1,3}(\.\d{1,4})?$/.test(discount) || Number(discount) > 100)
    )
      found.discount_limit = "Isi persen 0–100, maksimal empat desimal.";
    setErrors(found);
    if (Object.keys(found).length) {
      setError("Periksa isian yang ditandai.");
      return;
    }
    const storage = {
      ...profile,
      min_temp: tMin,
      max_temp: tMax,
      humidity_limits: nullableText(values.humidity_limits),
      source_document: nullableText(values.source_document),
    };
    const hasStorage = Object.values(storage).some((v) => v != null && v !== "");
    const body = {
      ...(codeChanged ? { code } : {}),
      name: values.name.trim(),
      category_id: values.category_id,
      base_uom_id: values.base_uom_id,
      batch_required: flags.batch_required,
      expiry_required: flags.batch_required && flags.expiry_required,
      serial_required: initial?.serial_required ?? false,
      storage_notes: nullableText(values.storage_notes),
      storage_profile: hasStorage ? storage : null,
      shelf_life_days:
        flags.expiry_required && values.shelf_life_days ? Number(values.shelf_life_days) : null,
      minimum_stock: minimum,
      ...(canDiscountLimit ? { discount_limit: discount || null } : {}),
      ...(creating
        ? {
            ...(factors.length
              ? { uoms: factors.map((c) => ({ uom_id: c.uom_id, factor_to_base: c.value! })) }
              : {}),
            ...permitResult.body,
            ...(buy ? { purchase_price: buy } : {}),
            ...(sell ? { sale_price: sell } : {}),
          }
        : { version: initial.version }),
    };
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<{ data: { id: string } }>(
        creating ? "/master-data/products" : `/master-data/products/${initial.id}`,
        { method: creating ? "POST" : "PATCH", body: JSON.stringify(body) },
      );
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      setDirty(false);
      toast.success(creating ? "Produk disimpan sebagai Draft" : "Produk disimpan", {
        description:
          doneCount === readiness.length
            ? "Aktifkan dari halaman detail agar bisa dipakai di SO dan SJ."
            : "Lengkapi syarat aktivasi agar bisa dipakai di SO dan SJ.",
      });
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
        <Hint>Terkunci karena produk sudah aktif atau dipakai transaksi.</Hint>
      </label>
    ) : query.data ? (
      <div className="pf-field">
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
        {field === "base_uom_id" && <Hint>Stok, HPP dan saldo dihitung dalam satuan ini.</Hint>}
      </div>
    ) : (
      <PageNotice tone={query.isError ? "error" : "info"}>
        {query.isError ? query.error.message : `Memerlukan izin melihat ${label}.`}
      </PageNotice>
    );

  const suffix = (
    field: keyof typeof values,
    unit: string,
    props: ComponentProps<typeof Input> = {},
  ) => (
    <span className="pf-affix" data-side="right">
      <Input
        value={values[field]}
        aria-invalid={!!errors[field]}
        onChange={(e) => set(field, e.target.value)}
        {...props}
      />
      <span aria-hidden="true">{unit}</span>
    </span>
  );
  const money = (field: "purchase_price" | "sale_price") => (
    <span className="pf-affix" data-side="left">
      <span aria-hidden="true">IDR</span>
      <Input
        inputMode="decimal"
        placeholder="0"
        value={values[field]}
        aria-invalid={!!errors.prices}
        onChange={(e) => set(field, e.target.value)}
      />
    </span>
  );
  const toggle = (
    field: "batch_required" | "expiry_required",
    title: string,
    description: string,
    disabled = false,
  ) => (
    <div className="pf-toggle" data-off={disabled ? "" : undefined}>
      <span>
        <strong id={`pf-${field}`}>{title}</strong>
        <Hint>{description}</Hint>
      </span>
      <Switch
        aria-labelledby={`pf-${field}`}
        checked={flags[field]}
        disabled={disabled}
        onCheckedChange={(on) => {
          setFlags((f) =>
            field === "batch_required"
              ? { batch_required: on, expiry_required: on ? f.expiry_required : false }
              : { ...f, expiry_required: on },
          );
          touch();
        }}
      />
    </div>
  );

  const readinessCard = (
    <section className="pf-ready" aria-labelledby="pf-ready-title">
      <h2 id="pf-ready-title">Kesiapan aktivasi</h2>
      <p>
        {initial && initial.state !== "DRAFT"
          ? doneCount === readiness.length
            ? "Semua syarat aktivasi tetap terpenuhi."
            : "Syarat aktivasi berkurang; produk aktif tetap aktif, tetapi lengkapi kembali datanya."
          : doneCount === readiness.length
            ? "Siap diaktifkan dari halaman detail."
            : `${doneCount} dari ${readiness.length} syarat terpenuhi. Draft tetap bisa disimpan.`}
      </p>
      <ul>
        {readiness.map((r) => (
          <li key={r.id} data-done={r.done ? "" : undefined}>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2.2"
              strokeLinecap="square"
            >
              <path d={r.done ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"} />
            </svg>
            <span>
              {r.label}
              <span className="sr-only">{r.done ? " (terpenuhi)" : " (belum terpenuhi)"}</span>
              <small>{r.note}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );

  const conversionSection = creating ? (
    <div className="pf-sub">
      <h3>Konversi satuan</h3>
      <Hint>
        Satuan lain yang dipakai di SO atau pembelian. Konversi baru hanya berlaku untuk dokumen
        baru.
      </Hint>
      {conversions.length > 0 && (
        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead>
              <tr>
                <th scope="col">Satuan</th>
                <th scope="col">1 satuan = … {baseName}</th>
                <th scope="col">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((c) => (
                <tr key={c.key}>
                  <td>
                    <SelectionField
                      label="Satuan konversi"
                      hideLabel
                      value={c.uom_id ? [c.uom_id] : []}
                      options={(uoms.data ?? [])
                        .filter((u) => u.id !== values.base_uom_id)
                        .map((u) => ({ id: u.id, name: u.name, code: u.code }))}
                      placeholder="Pilih satuan"
                      onChange={(v) => {
                        setConversions((list) =>
                          list.map((x) => (x.key === c.key ? { ...x, uom_id: v[0] ?? "" } : x)),
                        );
                        setErrors((e) => ({ ...e, conversions: "" }));
                        touch();
                      }}
                    />
                  </td>
                  <td>
                    <Input
                      inputMode="decimal"
                      aria-label="Faktor konversi"
                      className="pf-num"
                      placeholder="0,01"
                      value={c.factor}
                      aria-invalid={!!c.factor && !parseFactor(c.factor)}
                      onChange={(e) => {
                        setConversions((list) =>
                          list.map((x) => (x.key === c.key ? { ...x, factor: e.target.value } : x)),
                        );
                        setErrors((er) => ({ ...er, conversions: "" }));
                        touch();
                      }}
                    />
                  </td>
                  <td className="pf-actions">
                    <button
                      type="button"
                      className="pf-link-danger"
                      onClick={() => {
                        setConversions((list) => list.filter((x) => x.key !== c.key));
                        touch();
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {errors.conversions && <Hint error>{errors.conversions}</Hint>}
      <button
        type="button"
        className="pf-link"
        disabled={!uoms.data}
        onClick={() => {
          setConversions((list) => [...list, { key: seq + 1, uom_id: "", factor: "" }]);
          setSeq(seq + 1);
          touch();
        }}
      >
        <IconPlus aria-hidden="true" />
        Tambah konversi
      </button>
    </div>
  ) : (
    <div className="pf-sub">
      <h3>Konversi satuan</h3>
      <Hint>
        {(initial.uoms ?? [])
          .filter((u) => u.active && u.uom.id !== initial.base_uom.id)
          .map(
            (u) => `1 ${u.uom.name} = ${formatDecimal(u.factor_to_base)} ${initial.base_uom.name}`,
          )
          .join(" · ") || "Belum ada konversi"}
        . Konversi dikelola dari tab Satuan di detail produk.
      </Hint>
    </div>
  );

  const permitSection = creating ? (
    <div className="page-frame-fields">
      <div className="pf-field">
        <span className="pf-label" id="pf-permit-type">
          Jenis izin
        </span>
        <div className="pf-seg" role="group" aria-labelledby="pf-permit-type">
          {(
            [
              ["AKL", "AKL (Impor)"],
              ["AKD", "AKD (Dalam Negeri)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={permit.permit_type === id}
              onClick={() => setPermitField("permit_type", id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label>
        Nomor izin edar
        <Input
          className="pf-mono"
          maxLength={100}
          placeholder={permit.permit_type === "AKL" ? "AKL 20901234567" : "AKD 20303123456"}
          value={permit.permit_number}
          onChange={(e) => setPermitField("permit_number", e.target.value.toUpperCase())}
        />
      </label>
      <label className="span-full">
        Pemegang izin
        <Input
          maxLength={200}
          placeholder="Nama perusahaan pemegang izin edar"
          value={permit.holder}
          onChange={(e) => setPermitField("holder", e.target.value)}
        />
      </label>
      <label>
        Tanggal terbit
        <Input
          type="date"
          value={permit.issued_on}
          onChange={(e) => setPermitField("issued_on", e.target.value)}
        />
      </label>
      <label>
        Berlaku sampai
        <Input
          type="date"
          value={permit.expires_on}
          onChange={(e) => setPermitField("expires_on", e.target.value)}
        />
        <Hint>Kosongkan bila berlaku tanpa batas.</Hint>
      </label>
      <div className="span-full pf-field">
        <Upload purpose="PRODUCT_MASTER" onChange={(id) => setPermitField("evidence", id)} />
      </div>
      {errors.permit && (
        <div className="span-full">
          <Hint error>{errors.permit}</Hint>
        </div>
      )}
    </div>
  ) : (
    <Hint>
      {initial.registrations.length
        ? initial.registrations
            .map(
              (r) =>
                `${r.permit_type} ${r.permit_number} · ${registrationLabel[r.status] ?? r.status}`,
            )
            .join(" · ")
        : "Belum ada izin edar"}
      . Izin edar ditambahkan dan diverifikasi dari tab Izin edar di detail produk.
    </Hint>
  );

  const priceSection = (
    <div className="page-frame-fields pf-three">
      {creating ? (
        <>
          <label>
            Harga beli acuan
            {money("purchase_price")}
          </label>
          <label>
            Harga jual standar
            {money("sale_price")}
            <Hint error={!!errors.prices}>
              {errors.prices || marginNote(values.purchase_price, values.sale_price)}
            </Hint>
          </label>
        </>
      ) : (
        <div className="span-two">
          <Hint>
            {(initial.reference_prices ?? [])
              .filter((p) => !p.effective_to)
              .map(
                (p) =>
                  `${p.kind === "PURCHASE" ? "Harga beli acuan" : "Harga jual standar"} ${formatDecimal(p.unit_price, p.currency)} per ${p.uom.name} sejak ${date(p.effective_from)}`,
              )
              .join(" · ") || "Belum ada harga acuan"}
            . Harga acuan bertanggal dikelola dari tab Harga di detail produk.
          </Hint>
        </div>
      )}
      {canDiscountLimit && (
        <label>
          Batas diskon produk
          <span className="pf-affix" data-side="right">
            <Input
              inputMode="decimal"
              placeholder="Tanpa batas"
              value={values.discount_limit}
              aria-invalid={!!errors.discount_limit}
              onChange={(e) => set("discount_limit", e.target.value)}
            />
            <span aria-hidden="true">%</span>
          </span>
          <Hint error={!!errors.discount_limit}>
            {errors.discount_limit ||
              "Plafon produk; batas efektif SO adalah yang terkecil dari peran, orang dan produk."}
          </Hint>
        </label>
      )}
    </div>
  );

  return (
    <>
      {error && <PageNotice tone="error">{error}</PageNotice>}
      <FormFrame
        dirty={dirty}
        submitting={busy}
        onSubmit={() => void submit()}
        cancelHref={initial ? `${base}/${initial.id}` : base}
        submitLabel="Simpan produk"
        footerNote={
          dirty
            ? "Ada perubahan yang belum disimpan."
            : "Bertanda * wajib untuk menyimpan; bertanda Aktivasi wajib sebelum produk diaktifkan."
        }
        navAside={readinessCard}
        sections={[
          {
            id: "identitas",
            title: "Identitas & satuan",
            description:
              "Kode diisi sendiri dan unik per perusahaan. Kode dan satuan dasar terkunci setelah produk aktif atau dipakai transaksi.",
            content: (
              <>
                <div className="page-frame-fields">
                  <label>
                    Kode produk *
                    <Input
                      className="pf-mono"
                      maxLength={50}
                      placeholder="Contoh: SPU-003"
                      value={values.code}
                      disabled={locked}
                      aria-invalid={!!errors.code}
                      onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                    />
                    <Hint error={!!errors.code}>
                      {errors.code ||
                        (locked
                          ? "Terkunci karena produk sudah aktif."
                          : "Huruf besar, angka, atau . _ / - · maks. 50 karakter.")}
                    </Hint>
                  </label>
                  <label>
                    Nama produk *
                    <Input
                      maxLength={200}
                      placeholder="Nama sesuai izin edar"
                      value={values.name}
                      aria-invalid={!!errors.name}
                      onChange={(e) => set("name", e.target.value)}
                      onBlur={() => void checkDuplicates()}
                    />
                    {errors.name && <Hint error>{errors.name}</Hint>}
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
                  {select("Satuan dasar", "base_uom_id", uoms, initial?.base_uom, locked)}
                </div>
                {conversionSection}
              </>
            ),
          },
          {
            id: "pelacakan",
            title: "Pelacakan & penyimpanan",
            description:
              "Lot/batch dan kedaluwarsa menentukan apa yang wajib diisi saat barang masuk dan cara stok dikeluarkan (FEFO).",
            content: (
              <>
                <div className="pf-toggles">
                  {toggle(
                    "batch_required",
                    "Lacak lot/batch",
                    "Setiap barang masuk wajib mencatat nomor lot/batch.",
                  )}
                  {toggle(
                    "expiry_required",
                    "Wajib tanggal kedaluwarsa",
                    flags.batch_required
                      ? "Barang masuk wajib mencatat tanggal kedaluwarsa; SJ mengeluarkan lot yang paling dulu kedaluwarsa."
                      : "Aktifkan lacak lot/batch terlebih dulu.",
                    !flags.batch_required,
                  )}
                </div>
                <div className="page-frame-fields pf-three">
                  {flags.expiry_required && (
                    <label>
                      <span className="pf-label">
                        Masa simpan <ActivationTag />
                      </span>
                      {suffix("shelf_life_days", "hari", {
                        inputMode: "numeric",
                        placeholder: "730",
                      })}
                      <Hint error={!!errors.shelf_life_days}>
                        {errors.shelf_life_days || "Dari produksi sampai kedaluwarsa."}
                      </Hint>
                    </label>
                  )}
                  <label>
                    Stok minimum
                    {suffix("minimum_stock", baseName, {
                      inputMode: "decimal",
                      placeholder: "0",
                      className: "pf-num",
                    })}
                    <Hint error={!!errors.minimum_stock}>
                      {errors.minimum_stock || "Memunculkan produk di tab Stok rendah."}
                    </Hint>
                  </label>
                </div>
                <div className="pf-sub">
                  <h3>Profil penyimpanan</h3>
                  <div className="page-frame-fields pf-three">
                    <label>
                      Suhu minimum
                      {suffix("min_temp", "°C", { inputMode: "decimal", placeholder: "2" })}
                      {errors.min_temp && <Hint error>{errors.min_temp}</Hint>}
                    </label>
                    <label>
                      Suhu maksimum
                      {suffix("max_temp", "°C", { inputMode: "decimal", placeholder: "30" })}
                      {errors.max_temp && <Hint error>{errors.max_temp}</Hint>}
                    </label>
                    <label>
                      Batas kelembapan
                      <Input
                        placeholder="Contoh: ≤ 75% RH"
                        value={values.humidity_limits}
                        onChange={(e) => set("humidity_limits", e.target.value)}
                      />
                    </label>
                    <label className="span-full">
                      Sumber ketentuan
                      <Input
                        placeholder="Contoh: IFU produsen, label kemasan"
                        value={values.source_document}
                        onChange={(e) => set("source_document", e.target.value)}
                      />
                    </label>
                    <label className="span-full">
                      <span className="pf-label">
                        Catatan penyimpanan <ActivationTag />
                      </span>
                      <Textarea
                        placeholder="Contoh: simpan kering, hindari sinar matahari langsung"
                        value={values.storage_notes}
                        onChange={(e) => set("storage_notes", e.target.value)}
                      />
                      <Hint>Tampil di picking dan Surat Jalan.</Hint>
                    </label>
                  </div>
                </div>
              </>
            ),
          },
          {
            id: "izin",
            title: "Izin edar (NIE) · opsional",
            description:
              "Tidak wajib untuk menyimpan maupun mengaktifkan produk. Bila diisi, izin menunggu verifikasi dan statusnya tampil di detail produk.",
            content: permitSection,
          },
          {
            id: "harga",
            title: "Harga & diskon",
            description: `Harga acuan per ${baseName}. Bukan HPP atau nilai stok; HPP berasal dari barang masuk.`,
            content: priceSection,
          },
        ]}
      />
    </>
  );
}
