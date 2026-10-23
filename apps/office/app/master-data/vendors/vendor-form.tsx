"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormFrame, PageNotice } from "@/components/web/page-frame";
import { SelectionField } from "@/components/web/selection-field";
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
import { base, taxStatuses, vendorTypes, type Vendor } from "./vendor-workspace";

const roles = [
  ["order_contact", "PIC penjualan/pemesanan"],
  ["finance_contact", "PIC keuangan"],
  ["service_contact", "PIC pelaksanaan/pengiriman"],
] as const;
type Role = (typeof roles)[number][0];
const options = (map: Record<string, string>) =>
  Object.entries(map).map(([id, name]) => ({ id, name }));

export function VendorForm({ initial }: { initial?: Vendor | undefined }) {
  const router = useRouter(),
    cache = useQueryClient(),
    duplicate = useDuplicateCheck("vendors", initial);
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    vendor_type: initial?.vendor_type ?? "COMPANY",
    categories: initial?.categories?.join(", ") ?? "",
    primary_address: initial?.primary_address ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    tax_identity: initial?.tax_identity ?? "",
    tax_status: initial?.tax_status ?? "",
    agreement_number: initial?.agreement_number ?? "",
  });
  const [contacts, setContacts] = useState<Record<Role, ContactValues>>(() => ({
    order_contact: contactOf(initial?.order_contact),
    finance_contact: contactOf(initial?.finance_contact),
    service_contact: contactOf(initial?.service_contact),
  }));
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
    const categories = parseCategories(values.categories);
    const found: Record<string, string> = {};
    if (values.name.trim().length < 2) found.name = "Nama vendor wajib diisi.";
    if (!categories.length) found.categories = "Isi minimal satu kategori.";
    if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim()))
      found.email = "Format email tidak valid.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      name: values.name.trim(),
      vendor_type: values.vendor_type,
      categories,
      primary_address: nullableText(values.primary_address),
      phone: nullableText(values.phone),
      email: nullableText(values.email),
      tax_identity: nullableText(values.tax_identity),
      tax_status: nullableText(values.tax_status),
      agreement_number: nullableText(values.agreement_number),
      ...Object.fromEntries(roles.map(([role]) => [role, contactPayload(contacts[role])])),
    };
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<{ data: { id: string } }>(
        initial ? `/master-data/vendors/${initial.id}` : "/master-data/vendors",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(initial ? { ...body, version: initial.version } : body),
        },
      );
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      setDirty(false);
      toast.success(initial ? "Vendor disimpan" : "Vendor dibuat");
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
                  Nama vendor *
                  <Input
                    value={values.name}
                    aria-invalid={!!errors.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => void duplicate.check(values.name)}
                  />
                  {errors.name && <span className="page-frame-field-error">{errors.name}</span>}
                </label>
                <SelectionField
                  label="Jenis vendor *"
                  value={[values.vendor_type]}
                  options={options(vendorTypes)}
                  onChange={(v) => set("vendor_type", (v[0] as Vendor["vendor_type"]) ?? "COMPANY")}
                />
                <DuplicateNotice duplicates={duplicate.duplicates} base={base} />
                <label>
                  Kategori *
                  <Input
                    value={values.categories}
                    placeholder="ATK, Servis"
                    aria-invalid={!!errors.categories}
                    onChange={(e) => set("categories", e.target.value)}
                  />
                  <span className="page-frame-subtitle">Pisahkan beberapa kategori dengan koma.</span>
                  {errors.categories && (
                    <span className="page-frame-field-error">{errors.categories}</span>
                  )}
                </label>
                <label>
                  Email
                  <Input
                    type="email"
                    value={values.email}
                    aria-invalid={!!errors.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                  {errors.email && <span className="page-frame-field-error">{errors.email}</span>}
                </label>
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
            description: "Satu orang boleh mengisi beberapa fungsi, terutama vendor perorangan.",
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
            id: "tax",
            title: "Legalitas & Pajak",
            description: "Status PKP tidak otomatis menentukan tarif atau potongan pajak transaksi.",
            content: (
              <div className="page-frame-fields">
                <label>
                  NPWP
                  <Input value={values.tax_identity} onChange={(e) => set("tax_identity", e.target.value)} />
                </label>
                <SelectionField
                  label="Status PKP"
                  value={values.tax_status ? [values.tax_status] : []}
                  options={options(taxStatuses)}
                  placeholder="Pilih status"
                  onChange={(v) => set("tax_status", v[0] ?? "")}
                />
              </div>
            ),
          },
          {
            id: "agreement",
            title: "Kontrak & Status",
            description: "TOP ditetapkan pada PO atau kontrak terkait. Rekening dan saldo awal utang dikelola Finance.",
            content: (
              <div className="page-frame-fields">
                <label>
                  Nomor kontrak/SPK/perjanjian
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
