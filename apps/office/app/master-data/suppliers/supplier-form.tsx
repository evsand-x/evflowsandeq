"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormFrame, PageNotice } from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import {
  ContactFieldset,
  contactOf,
  contactPayload,
  DuplicateNotice,
  nullableText,
  parseCategories,
  useDuplicateCheck,
  type ContactValues,
} from "../master-shared";
import { base, type Supplier } from "./supplier-workspace";

type LegalRow = { key: string; type: string; number: string; expires_on: string; rest: Record<string, unknown> };
const roles = [
  ["sales_contact", "PIC penjualan"],
  ["finance_contact", "PIC keuangan"],
  ["shipping_contact", "PIC pengiriman barang"],
] as const;
type Role = (typeof roles)[number][0];

const text = (value: unknown) => (typeof value === "string" ? value : "");
const legalOf = (rows: Supplier["legal_documents"]): LegalRow[] =>
  (rows ?? []).map((row, index) => {
    const { type, number, expires_on, ...rest } = row;
    return { key: `legal-${index}`, type: text(type), number: text(number), expires_on: text(expires_on), rest };
  });

export function SupplierForm({ initial }: { initial?: Supplier | undefined }) {
  const router = useRouter(),
    cache = useQueryClient(),
    duplicate = useDuplicateCheck("suppliers", initial);
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    categories: initial?.categories?.join(", ") ?? "",
    primary_address: initial?.primary_address ?? "",
    phone: initial?.phone ?? "",
    tax_identity: initial?.tax_identity ?? "",
    technical_responsible_name: initial?.technical_responsible_name ?? "",
    agreement_number: initial?.agreement_number ?? "",
  });
  const [contacts, setContacts] = useState<Record<Role, ContactValues>>(() => ({
    sales_contact: contactOf(initial?.sales_contact),
    finance_contact: contactOf(initial?.finance_contact),
    shipping_contact: contactOf(initial?.shipping_contact),
  }));
  const [legal, setLegal] = useState<LegalRow[]>(() => legalOf(initial?.legal_documents));
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({});
  const set = (field: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
    setDirty(true);
  };
  const setRow = (index: number, patch: Partial<LegalRow>) => {
    setLegal((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setDirty(true);
  };
  const submit = async () => {
    const categories = parseCategories(values.categories);
    const found: Record<string, string> = {};
    if (values.name.trim().length < 2) found.name = "Nama supplier wajib diisi.";
    if (!categories.length) found.categories = "Isi minimal satu kategori.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      name: values.name.trim(),
      categories,
      primary_address: nullableText(values.primary_address),
      phone: nullableText(values.phone),
      tax_identity: nullableText(values.tax_identity),
      technical_responsible_name: nullableText(values.technical_responsible_name),
      agreement_number: nullableText(values.agreement_number),
      ...Object.fromEntries(roles.map(([role]) => [role, contactPayload(contacts[role])])),
      legal_documents: legal
        .filter((row) => row.type.trim() || row.number.trim())
        .map((row) => ({
          ...row.rest,
          type: row.type.trim(),
          number: row.number.trim(),
          ...(row.expires_on ? { expires_on: row.expires_on } : {}),
        })),
      // Field yang belum punya isian di form dikirim ulang agar update tidak menghapusnya.
      technical_responsible_license: initial?.technical_responsible_license ?? null,
      agreement_details: initial?.agreement_details ?? null,
    };
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<{ data: { id: string } }>(
        initial ? `/master-data/suppliers/${initial.id}` : "/master-data/suppliers",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(initial ? { ...body, version: initial.version } : body),
        },
      );
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      setDirty(false);
      toast.success(initial ? "Supplier disimpan" : "Supplier dibuat");
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
                  Nama badan usaha *
                  <Input
                    value={values.name}
                    aria-invalid={!!errors.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => void duplicate.check(values.name)}
                  />
                  {errors.name && <span className="page-frame-field-error">{errors.name}</span>}
                </label>
                <label>
                  Kategori *
                  <Input
                    value={values.categories}
                    placeholder="Pabrik, Importir"
                    aria-invalid={!!errors.categories}
                    onChange={(e) => set("categories", e.target.value)}
                  />
                  <span className="page-frame-subtitle">Pisahkan beberapa kategori dengan koma.</span>
                  {errors.categories && (
                    <span className="page-frame-field-error">{errors.categories}</span>
                  )}
                </label>
                <DuplicateNotice duplicates={duplicate.duplicates} base={base} />
                <label className="span-full">
                  Alamat utama
                  <Textarea
                    value={values.primary_address}
                    onChange={(e) => set("primary_address", e.target.value)}
                  />
                </label>
                <label>
                  Telepon
                  <Input inputMode="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
                </label>
              </div>
            ),
          },
          {
            id: "contacts",
            title: "Kontak PIC",
            description: "Satu orang boleh mengisi beberapa fungsi.",
            content: roles.map(([role, label]) => (
              <ContactFieldset
                key={role}
                label={label}
                value={contacts[role]}
                onChange={(field, value) => {
                  setContacts((c) => ({ ...c, [role]: { ...c[role], [field]: value } }));
                  setDirty(true);
                }}
              />
            )),
          },
          {
            id: "legal",
            title: "Legalitas & PJT",
            content: (
              <>
                <div className="page-frame-fields">
                  <label>
                    NPWP
                    <Input value={values.tax_identity} onChange={(e) => set("tax_identity", e.target.value)} />
                  </label>
                  <label>
                    Nama penanggung jawab teknis
                    <Input
                      value={values.technical_responsible_name}
                      onChange={(e) => set("technical_responsible_name", e.target.value)}
                    />
                  </label>
                </div>
                {legal.map((row, index) => (
                  <div key={row.key} className="page-frame-fields">
                    <label>
                      Jenis dokumen
                      <Input value={row.type} onChange={(e) => setRow(index, { type: e.target.value })} />
                    </label>
                    <label>
                      Nomor dokumen
                      <Input value={row.number} onChange={(e) => setRow(index, { number: e.target.value })} />
                    </label>
                    <label>
                      Berlaku sampai
                      <Input
                        type="date"
                        value={row.expires_on}
                        onChange={(e) => setRow(index, { expires_on: e.target.value })}
                      />
                    </label>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setLegal((rows) => rows.filter((_, i) => i !== index));
                          setDirty(true);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                        Hapus baris
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="page-frame-fields">
                  <div className="span-full">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setLegal((rows) => [
                          ...rows,
                          { key: `legal-new-${Date.now()}`, type: "", number: "", expires_on: "", rest: {} },
                        ])
                      }
                    >
                      <Plus aria-hidden="true" />
                      Tambah dokumen legalitas
                    </Button>
                  </div>
                </div>
              </>
            ),
          },
          {
            id: "agreement",
            title: "Kontrak/MOU",
            description: "Isi MOU, harga dan TOP dikelola di Pengadaan; TOP ditetapkan pada setiap PO.",
            content: (
              <div className="page-frame-fields">
                <label>
                  Nomor kontrak kerja sama / MOU
                  <Input
                    value={values.agreement_number}
                    onChange={(e) => set("agreement_number", e.target.value)}
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
