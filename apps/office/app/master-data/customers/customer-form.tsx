"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconPlus as Plus, IconTrash as Trash2 } from "@/components/web/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { FormFrame, PageNotice } from "@/components/web/page-frame";
import { useSession } from "../../session-provider";
import { Upload, Evidence } from "../../operations/workspace";
import { CustomerValue, CustomerBadge } from "./customer-workspace";
import {
  type Customer,
  type Pic,
  type Ref,
  type Legal,
  type PaymentTerm,
  onboarding,
  taxInvoiceCodes,
  roles,
} from "./customer-types";
const base = "/master-data/customers";
const fields = [
  "name",
  "legal_name",
  "primary_address",
  "billing_address",
  "shipping_address",
  "phone",
  "email",
  "tax_identity",
  "tax_status",
  "customer_type",
  "potential",
  "collection_schedule",
  "invoice_exchange_schedule",
  "payment_method_preference",
  "payment_tolerance_days",
] as const;
type Values = Record<(typeof fields)[number], string>;
type EditablePic = Pic & { key: string };
export function CustomerForm({ initial }: { initial?: Customer | undefined }) {
  const { principal } = useSession(),
    router = useRouter(),
    cache = useQueryClient();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const permitted = can(initial ? "master_customer.update" : "master_customer.create");
  const [values, setValues] = useState<Values>(
    () => Object.fromEntries(fields.map((f) => [f, String(initial?.[f] ?? "")])) as Values,
  );
  const [channel, setChannel] = useState(initial?.channel_id ?? ""),
    [rayon, setRayon] = useState(initial?.rayon_id ?? "");
  const [billingSame, setBillingSame] = useState(
      !initial?.billing_address || initial.billing_address === initial.primary_address,
    ),
    [shippingSame, setShippingSame] = useState(
      !initial?.shipping_address || initial.shipping_address === initial.primary_address,
    );
  const [pics, setPics] = useState<EditablePic[]>(() =>
    initial?.contacts?.length
      ? initial.contacts.map((p) => ({ ...p, key: p.id! }))
      : Object.keys(roles)
          .slice(0, 3)
          .map((role) => ({
            key: role,
            full_name: "",
            phone: "",
            email: "",
            job_title: "",
            pic_functions: [role],
          })),
  );
  const picSaved = useRef(new Map<string, Pic>());
  const [legal, setLegal] = useState<Legal[]>(
    Array.isArray(initial?.legal_documents) ? initial.legal_documents : [],
  );
  const [person, setPerson] = useState(initial?.responsible_person ?? {}),
    [license, setLicense] = useState(initial?.responsible_license ?? {}),
    [noo, setNoo] = useState(initial?.noo_document ?? {});
  // Kredit & Termin: the backend refuses these fields without customer_credit.update.
  const canCredit = can("customer_credit.update");
  const [credit, setCredit] = useState(() => ({
    term: initial?.default_term_code ?? "",
    taxCode: initial?.default_tax_invoice_code ?? "01",
    limit: initial?.credit_limit ?? "",
    frozen: initial?.credit_frozen ?? false,
    reason: initial?.freeze_reason ?? "",
    grace: initial?.past_due_grace_days == null ? "" : String(initial.past_due_grace_days),
  }));
  const changeCredit = (patch: Partial<typeof credit>) => {
    setDirty(true);
    setCredit((v) => ({ ...v, ...patch }));
  };
  const [dirty, setDirty] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [checks, setChecks] = useState<string[] | null>(null),
    [duplicateTerm, setDuplicateTerm] = useState("");
  const saved = useRef<{ id: string; version: number } | null>(
      initial ? { id: initial.id, version: initial.version } : null,
    ),
    busy = useRef(false),
    replays = useRef(new Map<string, string>());
  const update = (field: (typeof fields)[number], value: string) => {
    setDirty(true);
    setValues((v) => ({ ...v, [field]: value }));
  };
  const refs = useQuery({
    queryKey: ["customer-refs", principal?.company_id, principal?.user_id],
    queryFn: async () => {
      const result = await apiRequest<{
        data: { channels: Ref[]; rayons: Ref[]; payment_terms: PaymentTerm[] };
      }>("/master-data/customer-options");
      return result.data;
    },
    enabled: permitted,
  });
  useEffect(() => {
    const timer = setTimeout(() => setDuplicateTerm(values.name.trim()), 300);
    return () => clearTimeout(timer);
  }, [values.name]);
  const duplicates = useQuery({
    queryKey: [
      "customer-master",
      principal?.company_id,
      principal?.user_id,
      "duplicates",
      duplicateTerm,
    ],
    queryFn: () =>
      apiRequest<{ data: Customer[] }>(
        `/master-data/customer-workspace/list?q=${encodeURIComponent(duplicateTerm)}`,
      ),
    enabled: duplicateTerm.length >= 2 && permitted,
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function check() {
    const missing = [];
    if (values.name.trim().length < 2) missing.push("Nama pelanggan minimal 2 karakter.");
    if (!values.primary_address.trim()) missing.push("Alamat utama belum diisi.");
    if (!channel) missing.push("Channel belum dipilih.");
    for (const role of ["PURCHASING", "RECEIVING", "FINANCE"]) {
      const contacts = pics.filter((p) => p.pic_functions.includes(role) && p.full_name.trim());
      if (!contacts.length) missing.push(`PIC ${roles[role]} belum diisi.`);
      else if (contacts.some((p) => !p.phone?.trim()))
        missing.push(`No. HP/WA PIC ${roles[role]} belum diisi.`);
    }
    setChecks(
      missing.length
        ? missing
        : [
            "Pemeriksaan isian dasar selesai. Verifikasi dokumen per channel dan aktivasi tetap dilakukan melalui proses domain; pemeriksaan ini tidak mengubah status onboarding.",
          ],
    );
    return missing;
  }
  async function save() {
    if (busy.current || !permitted) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const incomplete = pics.some(
        (p) =>
          (p.full_name.trim() || p.phone?.trim() || p.email?.trim() || p.job_title?.trim()) &&
          (!p.full_name.trim() || !p.pic_functions.length),
      );
      if (incomplete)
        throw new Error("Lengkapi nama dan minimal satu fungsi untuk setiap PIC yang diisi.");
      const payload = {
        ...values,
        payment_tolerance_days:
          values.payment_tolerance_days === "" ? null : Number(values.payment_tolerance_days),
        channel_id: channel || null,
        rayon_id: rayon || null,
        billing_address: billingSame ? values.primary_address : values.billing_address,
        shipping_address: shippingSame ? values.primary_address : values.shipping_address,
        legal_documents: legal,
        responsible_person: person,
        responsible_license: license,
        noo_document: noo,
        email: values.email.trim() || null,
        default_tax_invoice_code: credit.taxCode,
      };
      // Credit attributes go only with the update, and only for credit editors.
      const creditPayload =
        initial && canCredit
          ? {
              default_term_code: credit.term || null,
              credit_limit: credit.limit.trim() || null,
              credit_frozen: credit.frozen,
              freeze_reason: credit.frozen ? credit.reason.trim() || null : null,
              past_due_grace_days: credit.grace === "" ? null : Number(credit.grace),
            }
          : {};
      if (creditPayload.credit_limit && !/^\d{1,16}(\.\d{1,8})?$/.test(creditPayload.credit_limit))
        throw new Error("Limit kredit harus berupa angka tanpa pemisah ribuan, contoh 25000000.");
      if (credit.grace !== "" && !/^\d{1,4}$/.test(credit.grace))
        throw new Error("Toleransi jatuh tempo harus berupa jumlah hari.");
      if (canCredit && credit.frozen && !credit.reason.trim())
        throw new Error("Isi alasan bila kredit pelanggan dibekukan.");
      const prior = saved.current;
      const result = await apiRequest<{ data: Customer }>(prior ? `${base}/${prior.id}` : base, {
        method: prior ? "PATCH" : "POST",
        ...(prior ? { version: prior.version } : {}),
        body: JSON.stringify({
          ...payload,
          ...(prior ? { ...creditPayload, version: prior.version } : {}),
        }),
      });
      saved.current = { id: result.data.id, version: result.data.version };
      // Only persist contacts the current user is allowed to change; CRM remains the owner.
      const groups: EditablePic[] = [];
      for (const p of pics.filter((p) => p.full_name.trim())) {
        const same = !p.id
          ? groups.find(
              (g) =>
                !g.id &&
                g.full_name.trim().toLocaleLowerCase() === p.full_name.trim().toLocaleLowerCase() &&
                g.phone?.trim() === p.phone?.trim() &&
                g.email?.trim() === p.email?.trim(),
            )
          : undefined;
        if (same) same.pic_functions = [...new Set([...same.pic_functions, ...p.pic_functions])];
        else groups.push({ ...p, pic_functions: [...p.pic_functions] });
      }
      for (const p of groups) {
        const known = picSaved.current.get(p.key) ?? p;
        if (
          !can("crm_contact.read") ||
          !can(known.id ? "crm_contact.update" : "crm_contact.create")
        )
          continue;
        const body = {
          customer_id: result.data.id,
          full_name: p.full_name.trim(),
          phone: p.phone?.trim() || null,
          email: p.email?.trim() || null,
          job_title: p.job_title?.trim() || null,
          pic_functions: p.pic_functions,
          nickname: p.nickname ?? null,
          department: p.department ?? null,
          birth_date: p.birth_date?.slice(0, 10) ?? null,
          notes: p.notes ?? null,
        };
        if (!replays.current.has(p.key)) replays.current.set(p.key, crypto.randomUUID());
        const response = await apiRequest<{ data: Pic }>(
          known.id ? `/crm/contacts/${known.id}` : "/crm/contacts",
          {
            method: known.id ? "PATCH" : "POST",
            ...(known.id
              ? { version: known.version! }
              : { headers: { "Idempotency-Key": replays.current.get(p.key)! } }),
            body: JSON.stringify(body),
          },
        );
        picSaved.current.set(p.key, response.data);
      }
      await Promise.all([
        cache.invalidateQueries({
          queryKey: ["customer-master", principal?.company_id, principal?.user_id],
        }),
        cache.invalidateQueries({ queryKey: ["crm", principal?.company_id, principal?.user_id] }),
        cache.invalidateQueries({
          queryKey: ["operations", principal?.company_id, principal?.user_id, "so-options"],
        }),
      ]);
      setDirty(false);
      toast.success("Data pelanggan dan PIC berhasil disimpan");
      router.push(`${base}/${result.data.id}`);
    } catch (err) {
      setError(
        `${saved.current && !initial ? "Draft pelanggan sudah tersimpan; periksa rincian yang gagal lalu simpan kembali. " : ""}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const text = (
    key: (typeof fields)[number],
    label: string,
    options: { required?: boolean; type?: string; max?: number } = {},
  ) => (
    <label>
      {label}
      <Input
        value={values[key]}
        onChange={(e) => update(key, e.target.value)}
        required={options.required}
        type={options.type ?? "text"}
        maxLength={options.max ?? 200}
        {...(options.type === "number" ? { min: 0, step: 1 } : {})}
      />
    </label>
  );
  if (!permitted)
    return (
      <p role="alert">
        Anda tidak memiliki izin {initial ? "mengubah" : "membuat"} Master Pelanggan.
      </p>
    );
  return (
    <>
      {error && <PageNotice tone="error">{error}</PageNotice>}
      <FormFrame
        dirty={dirty}
        submitting={pending}
        onSubmit={() => void save()}
        cancelHref={initial ? `${base}/${initial.id}` : base}
        submitLabel={initial ? "Simpan perubahan" : "Simpan draf"}
        footerNote="Draf boleh disimpan sebelum data lengkap. Validasi tidak membuat transaksi, saldo atau jurnal."
        extraActions={
          <Button type="button" variant="outline" disabled={pending} onClick={check}>
            Validasi
          </Button>
        }
        aside={
          checks && (
            <PageNotice>
              {checks.map((c) => (
                <span key={c} className="block">
                  {c}
                </span>
              ))}
            </PageNotice>
          )
        }
        sections={[
          {
            id: "identity",
            title: "Identitas & Wilayah",
            content: (
              <fieldset disabled={pending} className="customer-form">
                <div className="customer-note">
                  {duplicateTerm.length < 2
                    ? "Ketik nama pelanggan untuk memeriksa kandidat yang mirip."
                    : duplicates.isPending
                      ? "Memeriksa kandidat..."
                      : duplicates.isError
                        ? "Pemeriksaan duplikat belum tersedia. Validasi server tetap berlaku."
                        : duplicates.data?.data.filter((c) => c.id !== initial?.id).length
                          ? duplicates.data.data
                              .filter((c) => c.id !== initial?.id)
                              .map((c) => (
                                <p key={c.id}>
                                  <Link href={`${base}/${c.id}`} className="customer-link">
                                    {c.code} · {c.name}
                                  </Link>
                                </p>
                              ))
                          : "Tidak ada kandidat mirip pada pencarian ini."}
                </div>
                <div className="customer-form-grid">
                  <label>
                    Kode pelanggan
                    <Input readOnly value={initial?.code ?? "Diberikan otomatis saat disimpan"} />
                  </label>
                  {text("name", "Nama pelanggan *", { required: true, max: 200 })}
                  <label>
                    Alamat utama *
                    <Textarea
                      maxLength={2000}
                      value={values.primary_address}
                      onChange={(e) => update("primary_address", e.target.value)}
                    />
                  </label>
                  <div>
                    <SelectionField
                      label="Alamat penagihan"
                      value={[billingSame ? "SAME" : "OTHER"]}
                      options={[
                        { id: "SAME", name: "Sama dengan alamat utama" },
                        { id: "OTHER", name: "Alamat berbeda" },
                      ]}
                      onChange={(v) => {
                        setBillingSame(v[0] === "SAME");
                        setDirty(true);
                      }}
                    />
                    {!billingSame && (
                      <label>
                        Alamat penagihan berbeda
                        <Textarea
                          maxLength={2000}
                          value={values.billing_address}
                          onChange={(e) => update("billing_address", e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                  <div>
                    <SelectionField
                      label="Alamat pengantaran barang"
                      value={[shippingSame ? "SAME" : "OTHER"]}
                      options={[
                        { id: "SAME", name: "Sama dengan alamat utama" },
                        { id: "OTHER", name: "Alamat berbeda" },
                      ]}
                      onChange={(v) => {
                        setShippingSame(v[0] === "SAME");
                        setDirty(true);
                      }}
                    />
                    {!shippingSame && (
                      <label>
                        Alamat pengantaran berbeda
                        <Textarea
                          maxLength={2000}
                          value={values.shipping_address}
                          onChange={(e) => update("shipping_address", e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                  <SelectionField
                    label="Channel"
                    value={channel ? [channel] : []}
                    options={
                      refs.data?.channels.filter((r) => r.state === "ACTIVE" || r.id === channel) ??
                      []
                    }
                    onChange={(v) => {
                      setChannel(v[0] ?? "");
                      setDirty(true);
                    }}
                  />
                  <SelectionField
                    label="Rayon"
                    value={rayon ? [rayon] : []}
                    options={
                      refs.data?.rayons.filter((r) => r.state === "ACTIVE" || r.id === rayon) ?? []
                    }
                    onChange={(v) => {
                      setRayon(v[0] ?? "");
                      setDirty(true);
                    }}
                  />
                </div>
                {refs.isError && (
                  <p role="alert">
                    Pilihan channel/rayon gagal dimuat.{" "}
                    <Button type="button" variant="outline" onClick={() => void refs.refetch()}>
                      Coba lagi
                    </Button>
                  </p>
                )}
              </fieldset>
            ),
          },
          {
            id: "contacts",
            title: "Kontak PIC",
            content: (
              <fieldset disabled={pending} className="customer-form">
                <div className="customer-form-grid">
                  {pics.map((p, i) => {
                    const editable =
                      can(p.id ? "crm_contact.update" : "crm_contact.create") &&
                      can("crm_contact.read");
                    const change = (patch: Partial<Pic>) => {
                      setDirty(true);
                      setPics((old) => old.map((x) => (x.key === p.key ? { ...x, ...patch } : x)));
                    };
                    return (
                      <fieldset key={p.key} disabled={!editable} className="customer-pic-card">
                        <h3>PIC {p.pic_functions.map((f) => roles[f] ?? f).join(" / ")}</h3>
                        <label>
                          Nama PIC
                          <Input
                            minLength={2}
                            maxLength={200}
                            value={p.full_name}
                            onChange={(e) => change({ full_name: e.target.value })}
                          />
                        </label>
                        <label>
                          No. Handphone / WA
                          <Input
                            type="tel"
                            maxLength={50}
                            value={p.phone ?? ""}
                            onChange={(e) => change({ phone: e.target.value })}
                          />
                        </label>
                        <label>
                          Jabatan
                          <Input
                            maxLength={150}
                            value={p.job_title ?? ""}
                            onChange={(e) => change({ job_title: e.target.value })}
                          />
                        </label>
                        <label>
                          Email PIC
                          <Input
                            type="email"
                            value={p.email ?? ""}
                            onChange={(e) => change({ email: e.target.value })}
                          />
                        </label>
                        <SelectionField
                          label={`Fungsi PIC ${i + 1}`}
                          multiple
                          value={p.pic_functions}
                          options={Object.entries(roles).map(([id, name]) => ({ id, name }))}
                          onChange={(v) => change({ pic_functions: v })}
                        />
                        {!p.id && i >= 3 && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setPics((old) => old.filter((x) => x.key !== p.key));
                              setDirty(true);
                            }}
                          >
                            <Trash2 />
                            Hapus isian PIC
                          </Button>
                        )}
                      </fieldset>
                    );
                  })}
                </div>
                {can("crm_contact.create") && can("crm_contact.read") && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPics((v) => [
                        ...v,
                        {
                          key: crypto.randomUUID(),
                          full_name: "",
                          phone: "",
                          email: "",
                          pic_functions: ["OTHER"],
                        },
                      ]);
                      setDirty(true);
                    }}
                  >
                    <Plus />
                    Tambah PIC / kontak cadangan
                  </Button>
                )}
                <p className="customer-note">
                  Satu kontak dapat menjalankan beberapa fungsi. Setiap PIC memiliki nomor HP/WA
                  sendiri. Kontak dengan identitas dan nomor yang sama digabung saat disimpan.
                  {!can("crm_contact.read") ? " Akses CRM diperlukan untuk mengelola kontak." : ""}
                </p>
              </fieldset>
            ),
          },
          {
            id: "legal",
            title: "Legalitas & Penanggung Jawab",
            content: (
              <fieldset disabled={pending} className="customer-form">
                <div className="customer-files">
                  {legal.map((doc, i) => (
                    <div key={i} className="customer-legal-row">
                      <div className="customer-form-grid">
                        {[
                          ["type", "Jenis dokumen"],
                          ["number", "Nomor dokumen"],
                          ["issuer", "Penerbit"],
                          ["expires_on", "Berlaku sampai"],
                        ].map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <Input
                              type={key === "expires_on" ? "date" : "text"}
                              value={doc[key as keyof Legal] ?? ""}
                              onChange={(e) => {
                                setLegal((v) =>
                                  v.map((d, j) =>
                                    j === i
                                      ? {
                                          ...d,
                                          [key!]: e.target.value,
                                          verification_state: "UNVERIFIED",
                                        }
                                      : d,
                                  ),
                                );
                                setDirty(true);
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <CustomerBadge value={doc.verification_state ?? "Belum diverifikasi"} />
                      {doc.evidence_id && <Evidence id={doc.evidence_id} />}
                      <Upload
                        purpose="CUSTOMER_MASTER"
                        onChange={(id) => {
                          setLegal((v) =>
                            v.map((d, j) =>
                              j === i
                                ? { ...d, evidence_id: id, verification_state: "UNVERIFIED" }
                                : d,
                            ),
                          );
                          setDirty(true);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setLegal((v) => v.filter((_, j) => j !== i));
                          setDirty(true);
                        }}
                      >
                        Hapus dari draft
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setLegal((v) => [
                        ...v,
                        { type: "", number: "", issuer: "", verification_state: "UNVERIFIED" },
                      ]);
                      setDirty(true);
                    }}
                  >
                    <Plus />
                    Tambah dokumen legalitas
                  </Button>
                </div>
                <div className="customer-form-grid">
                  {text("tax_identity", "NPWP / NIK", { max: 100 })}
                  <SelectionField
                    label="Status pajak"
                    value={values.tax_status ? [values.tax_status] : []}
                    options={[
                      { id: "PKP", name: "PKP" },
                      { id: "NON_PKP", name: "Non-PKP" },
                      { id: "UNVERIFIED", name: "Belum diverifikasi" },
                    ]}
                    onChange={(v) => update("tax_status", v[0] ?? "")}
                  />
                  <label>
                    Penanggung jawab (apoteker / PJT)
                    <Input
                      value={person.name ?? ""}
                      onChange={(e) => {
                        setPerson((v) => ({ ...v, name: e.target.value }));
                        setDirty(true);
                      }}
                    />
                  </label>
                  <label>
                    Izin penanggung jawab
                    <Input
                      value={license.number ?? ""}
                      onChange={(e) => {
                        setLicense((v) => ({ ...v, number: e.target.value }));
                        setDirty(true);
                      }}
                    />
                  </label>
                </div>
                <p className="customer-note">
                  Dokumen wajib mengikuti channel. Unggahan tidak otomatis terverifikasi; status
                  pajak di sini adalah identitas, bukan aturan perhitungan pajak transaksi.
                </p>
              </fieldset>
            ),
          },
          {
            id: "credit",
            title: "Kredit & Termin",
            content: (
              <fieldset disabled={pending} className="customer-form">
                <div className="customer-form-grid">
                  <SelectionField
                    label="Termin bawaan"
                    value={credit.term ? [credit.term] : []}
                    disabled={!canCredit || !initial}
                    options={(refs.data?.payment_terms ?? []).map((t) => ({
                      id: t.code,
                      name: t.label,
                    }))}
                    onChange={(v) => changeCredit({ term: v[0] ?? "" })}
                  />
                  <SelectionField
                    label="Kode faktur bawaan"
                    value={[credit.taxCode]}
                    options={taxInvoiceCodes.map((code) => ({ id: code, name: code }))}
                    onChange={(v) => changeCredit({ taxCode: v[0] ?? "01" })}
                  />
                  {canCredit ? (
                    <>
                      <label>
                        Limit kredit (Rp)
                        <Input
                          inputMode="decimal"
                          value={credit.limit}
                          disabled={!initial}
                          placeholder="Kosongkan bila tanpa limit"
                          onChange={(e) => changeCredit({ limit: e.target.value })}
                        />
                      </label>
                      <label>
                        Toleransi lewat jatuh tempo (hari)
                        <Input
                          inputMode="numeric"
                          value={credit.grace}
                          disabled={!initial}
                          onChange={(e) => changeCredit({ grace: e.target.value })}
                        />
                      </label>
                      <SelectionField
                        label="Status kredit"
                        value={[credit.frozen ? "FROZEN" : "ACTIVE"]}
                        disabled={!initial}
                        options={[
                          { id: "ACTIVE", name: "Aktif" },
                          { id: "FROZEN", name: "Dibekukan" },
                        ]}
                        onChange={(v) => changeCredit({ frozen: v[0] === "FROZEN" })}
                      />
                      {credit.frozen && (
                        <label>
                          Alasan dibekukan *
                          <Textarea
                            maxLength={1000}
                            value={credit.reason}
                            disabled={!initial}
                            onChange={(e) => changeCredit({ reason: e.target.value })}
                          />
                        </label>
                      )}
                    </>
                  ) : (
                    <div className="customer-finance">
                      <CustomerValue label="Limit kredit & status beku">
                        Terbatas · memerlukan izin kredit pelanggan
                      </CustomerValue>
                    </div>
                  )}
                </div>
                <p className="customer-note">
                  {!initial
                    ? "Termin, limit dan status kredit diatur setelah draf pelanggan tersimpan."
                    : canCredit
                      ? "Daftar termin diatur di Setting › Termin & Kredit. Termin tempo memerlukan limit kredit dan toleransi jatuh tempo."
                      : "Termin, limit dan status kredit hanya dapat diubah pemegang izin kredit pelanggan."}{" "}
                </p>
              </fieldset>
            ),
          },
          {
            id: "noo",
            title: "Berkas NOO",
            content: (
              <fieldset disabled={pending} className="customer-form">
                <div className="customer-files">
                  <div className="customer-form-grid">
                    {[
                      ["name", "Nama berkas"],
                      ["date", "Tanggal"],
                      ["version", "Versi"],
                      ["notes", "Catatan"],
                    ].map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <Input
                          type={key === "date" ? "date" : "text"}
                          value={noo[key!] ?? ""}
                          onChange={(e) => {
                            setNoo((v) => ({ ...v, [key!]: e.target.value }));
                            setDirty(true);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  {noo.evidence_id && <Evidence id={noo.evidence_id} />}
                  <Upload
                    purpose="CUSTOMER_MASTER"
                    onChange={(id) => {
                      setNoo((v) => ({ ...v, evidence_id: id }));
                      setDirty(true);
                    }}
                  />
                </div>
              </fieldset>
            ),
          },
          {
            id: "onboarding",
            title: "Onboarding & Penagihan",
            content: (
              <fieldset disabled={pending} className="customer-form">
                <div className="customer-form-grid">
                  {text("customer_type", "Jenis pelanggan")}
                  {text("potential", "Potensi")}
                  {text("invoice_exchange_schedule", "Jadwal tukar faktur")}
                  {text("payment_method_preference", "Metode pembayaran")}
                  {text("payment_tolerance_days", "Toleransi hari", { type: "number" })}
                  <CustomerValue label="PIC penagihan / gudang">
                    {pics
                      .filter((p) =>
                        p.pic_functions.some((f) => ["FINANCE", "RECEIVING"].includes(f)),
                      )
                      .map((p) => p.full_name)
                      .filter(Boolean)
                      .join(", ") || "Isi pada Kontak PIC"}
                  </CustomerValue>
                  <CustomerValue label="Status WAPU">
                    Belum terverifikasi · dikelola Finance
                  </CustomerValue>
                  <CustomerValue label="Status onboarding">
                    {onboarding[initial?.onboarding_state ?? "DRAFT"]}
                  </CustomerValue>
                </div>
              </fieldset>
            ),
          },
        ]}
      />
    </>
  );
}
