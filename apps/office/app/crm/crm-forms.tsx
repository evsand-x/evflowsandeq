"use client";
import { useEffect, useId, useRef, useState, type ReactNode, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  createContactSchema,
  createProspectSchema,
  createOpportunitySchema,
  winOpportunitySchema,
  loseOpportunitySchema,
  addProspectNeedsSchema,
  type AuthPrincipal,
  type CrmContact,
  type CrmProspect,
  type CrmOpportunity,
} from "@evflow/contracts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError, apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { SelectionField } from "@/components/web/selection-field";
import { Choice, Notice, DataTable } from "./crm-common";
import { customers, functionLabels, statusLabels } from "./crm-fixtures";

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="crm-form-section">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  error,
  disabled,
  area,
  fullWidth,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string | undefined;
  disabled?: boolean;
  area?: boolean;
  fullWidth?: boolean;
}) {
  const id = useId();
  const common = {
    id,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    placeholder,
    required,
    disabled,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
  return (
    <Field data-invalid={!!error} className={fullWidth ? "web-field-full" : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </FieldLabel>
      {area ? <Textarea {...common} /> : <Input {...common} type={type} />}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
type Lookup = {
  id: string;
  name: string;
  primary_address?: string | null;
  channel?: { name: string } | null;
  rayon?: { name: string } | null;
};
type Options = {
  channels?: Lookup[];
  rayons?: Lookup[];
  customers: Lookup[];
  owners: Lookup[];
  products: Lookup[];
  uoms: Lookup[];
  contacts: Lookup[];
};
function LookupField({
  label,
  value,
  onChange,
  options,
  error,
  onSearch,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Lookup[];
  error?: string | undefined;
  onSearch?: ((value: string) => void) | undefined;
}) {
  return (
    <SelectionField
      label={label}
      value={value ? [value] : []}
      onChange={(next) => onChange(next[0] ?? "")}
      options={options}
      error={error}
      onSearch={onSearch}
    />
  );
}
export function CrmForm({
  kind,
  principal,
  preview,
  back,
  prospect,
  contact,
}: {
  kind: "prospect" | "contact" | "status" | "need";
  principal: AuthPrincipal;
  preview: boolean;
  back: string;
  prospect?: CrmProspect | undefined;
  contact?: CrmContact | undefined;
}) {
  const router = useRouter();
  const routeParams = useSearchParams();
  const client = useQueryClient();
  const errorRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<string | null>(null);
  const payloadRef = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [newInstitution, setNewInstitution] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    customer_id: contact?.customer.id ?? prospect?.customer.id ?? routeParams.get("customer") ?? "",
    owner_id: principal.user_id,
    approach_status: prospect?.approach_status ?? "NEW",
    full_name: contact?.full_name ?? "",
    nickname: contact?.nickname ?? "",
    job_title: contact?.job_title ?? "",
    department: contact?.department ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    birth_date: contact?.birth_date?.slice(0, 10) ?? "",
    notes: contact?.notes ?? "",
    source: "",
    next_action: "",
    next_action_at: "",
  });
  const [functions, setFunctions] = useState(contact?.pic_functions ?? ["PURCHASING"]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [needs, setNeeds] = useState([
    {
      key: 0,
      product_id: "",
      description: "",
      estimated_qty: "",
      uom_id: "",
      needed_period: "",
      notes: "",
    },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const permissionResource = kind === "contact" ? "crm_contact" : "crm_prospect";
  const canCreate = hasCompanyPermission(principal, `${permissionResource}.create`);
  const canUpdate = hasCompanyPermission(principal, `${permissionResource}.update`);
  const optionsQuery = useQuery({
    queryKey: [
      "crm",
      principal.company_id,
      principal.user_id,
      "options",
      kind,
      search,
      values.customer_id,
    ],
    enabled: !preview && canCreate && kind !== "status",
    queryFn: ({ signal }) =>
      apiRequest<{ data: Options }>(
        `/crm/options?resource=${kind === "contact" ? "contacts" : "prospects"}&q=${encodeURIComponent(search)}${values.customer_id ? `&customer_id=${encodeURIComponent(values.customer_id)}` : ""}`,
        { signal },
      ),
  });
  const previewOptions: Options = {
    customers,
    owners: [{ id: principal.user_id, name: "Rina" }],
    channels: [{ id: "preview-channel", name: "Rumah Sakit" }],
    rayons: [{ id: "preview-rayon", name: "Makassar" }],
    products: [
      { id: "p1", name: "Reagen hematologi 3-part" },
      { id: "p2", name: "Tabung EDTA 3 ml" },
    ],
    uoms: [
      { id: "u1", name: "kit" },
      { id: "u2", name: "box" },
    ],
    contacts: [
      { id: "preview-contact-1", name: "Andi · Pengadaan" },
      { id: "preview-contact-2", name: "Sari · Keuangan" },
    ],
  };
  const serverOptions = optionsQuery.data?.data;
  const options: Options = preview
    ? previewOptions
    : {
        customers: serverOptions?.customers ?? [],
        owners: serverOptions?.owners ?? [],
        products: serverOptions?.products ?? [],
        uoms: serverOptions?.uoms ?? [],
        contacts: serverOptions?.contacts ?? [],
        channels: serverOptions?.channels ?? [],
        rayons: serverOptions?.rayons ?? [],
      };
  const set = (name: string, value: string) => setValues((old) => ({ ...old, [name]: value }));
  const text = (
    name: string,
    label: string,
    extra: { required?: boolean; type?: string; area?: boolean; disabled?: boolean } = {},
  ) => (
    <TextField
      label={label}
      value={values[name] ?? ""}
      onChange={(value) => set(name, value)}
      error={errors[name]}
      {...extra}
    />
  );
  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const payload = JSON.stringify(body);
      if (payloadRef.current && payloadRef.current !== payload)
        throw new Error(
          "Hasil penyimpanan sebelumnya belum pasti. Coba ulang dengan isian yang sama atau periksa daftar sebelum membuat permintaan baru.",
        );
      payloadRef.current = payload;
      keyRef.current ??= crypto.randomUUID();
      return apiRequest<{ data: { id: string } }>(
        kind === "status"
          ? `/crm/prospects/${prospect!.id}/status`
          : kind === "need"
            ? `/crm/prospects/${prospect!.id}/needs`
            : `/crm/${kind === "prospect" ? "prospects" : "contacts"}`,
        {
          method: kind === "status" ? "PATCH" : "POST",
          ...(kind === "status"
            ? { version: prospect!.version }
            : { headers: { "Idempotency-Key": keyRef.current } }),
          body: payload,
        },
      );
    },
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["crm"] });
      await client.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Data tersimpan.");
      router.push(kind === "prospect" ? `/crm/prospects/${result.data.id}` : back);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status < 500 && error.status !== 408) {
        payloadRef.current = null;
        keyRef.current = null;
      }
      setFailure(error.message);
      requestAnimationFrame(() => errorRef.current?.focus());
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure("");
    setErrors({});
    if (contact) {
      setFailure("Penyimpanan perubahan ini belum tersedia. Data belum disimpan.");
      return;
    }
    if (kind === "status") {
      if (["DEFERRED", "DROPPED"].includes(values.approach_status!) && !values.notes?.trim()) {
        setErrors({ notes: "Alasan wajib diisi." });
        setFailure("Lengkapi alasan perubahan status.");
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      if (preview) {
        toast.info("Pratinjau formulir. Perubahan tidak disimpan.");
        return;
      }
      mutation.mutate({
        approach_status: values.approach_status,
        notes: values.notes?.trim() || null,
      });
      return;
    }
    if (kind === "need") {
      const parsed = addProspectNeedsSchema.safeParse({
        version: prospect?.version,
        needs: needs.map(({ key: _key, ...need }) =>
          Object.fromEntries(Object.entries(need).map(([k, v]) => [k, v || null])),
        ),
      });
      if (preview) {
        toast.info("Pratinjau. Kebutuhan tidak disimpan.");
        return;
      }
      if (!parsed.success) {
        setFailure(parsed.error.issues[0]?.message ?? "Periksa kebutuhan.");
        return;
      }
      mutation.mutate(parsed.data);
      return;
    }
    const payload =
      kind === "contact"
        ? {
            customer_id: values.customer_id,
            full_name: values.full_name,
            nickname: values.nickname || null,
            job_title: values.job_title || null,
            department: values.department || null,
            pic_functions: functions,
            phone: values.phone || null,
            email: values.email || null,
            birth_date: values.birth_date || null,
            notes: values.notes || null,
          }
        : {
            ...(newInstitution
              ? {
                  new_customer: {
                    name: values.institution_name,
                    channel_id: values.channel_id,
                    rayon_id: values.rayon_id || null,
                    primary_address: values.primary_address || null,
                  },
                }
              : { customer_id: values.customer_id }),
            contact_ids: newInstitution ? [] : contactIds,
            owner_id: values.owner_id,
            source: values.source || null,
            approach_status: values.approach_status,
            next_action: values.next_action || null,
            next_action_at: values.next_action_at
              ? new Date(`${values.next_action_at}+08:00`).toISOString()
              : null,
            notes: values.notes || null,
            needs: needs
              .filter(
                (n) =>
                  n.product_id ||
                  n.description ||
                  n.estimated_qty ||
                  n.uom_id ||
                  n.needed_period ||
                  n.notes,
              )
              .map(({ key: _key, ...n }) =>
                Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v || null])),
              ),
          };
    if (preview) {
      toast.info("Data simulasi. Formulir tidak menyimpan ke server.");
      return;
    }
    const result = (kind === "contact" ? createContactSchema : createProspectSchema).safeParse(
      payload,
    );
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      );
      setFailure("Periksa isian yang ditandai sebelum menyimpan.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    mutation.mutate(result.data);
  }
  const blocked = !!contact;
  return (
    <form
      className={kind === "contact" ? "web-form crm-form crm-contact-form" : "web-form crm-form"}
      onSubmit={submit}
    >
      {(failure || optionsQuery.isError) && (
        <div tabIndex={-1} ref={errorRef}>
          <Alert variant="destructive">
            <AlertDescription>
              {failure || "Pilihan formulir gagal dimuat."}
              {optionsQuery.isError && (
                <Button type="button" variant="outline" onClick={() => void optionsQuery.refetch()}>
                  Coba lagi
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
      {blocked && (
        <Notice>
          {contact
            ? "Detail kontak dapat ditinjau. Pembaruan kontak belum tersedia."
            : "Penambahan kebutuhan pada prospek tersimpan belum tersedia. Kebutuhan dapat dicatat saat membuat prospek."}
        </Notice>
      )}
      {kind === "contact" && (
        <FormSection title="Identitas, institusi & komunikasi">
          <FieldGroup className="web-form-grid">
            {text("full_name", "Nama lengkap", { required: true })}
            {text("nickname", "Nama panggilan")}
            <LookupField
              label="Nama pelanggan *"
              value={values.customer_id!}
              onChange={(v) => set("customer_id", v)}
              options={
                contact && !options.customers.some((c) => c.id === contact.customer.id)
                  ? [contact.customer, ...options.customers]
                  : options.customers
              }
              error={errors.customer_id}
              onSearch={setSearch}
            />
            {text("job_title", "Jabatan")}
            {text("department", "Unit/Bagian")}
            <SelectionField
              label="Fungsi PIC *"
              multiple
              value={functions}
              onChange={setFunctions}
              options={Object.entries(functionLabels).map(([id, name]) => ({ id, name }))}
              error={errors.pic_functions}
              placeholder="Pilih satu atau beberapa"
            />
            <TextField
              label="Kode kontak"
              value={contact?.code ?? "Otomatis saat disimpan"}
              onChange={() => undefined}
              disabled
            />
            {text("phone", "Nomor HP/WA")}
            {text("email", "Email", { type: "email" })}
            {text("birth_date", "Tanggal lahir", { type: "date" })}
            <TextField
              label="Status kontak"
              value={contact ? (statusLabels[contact.state] ?? contact.state) : "Aktif"}
              onChange={() => undefined}
              disabled
            />
            {text("notes", "Catatan")}
          </FieldGroup>
        </FormSection>
      )}
      {kind === "prospect" && (
        <FormSection title="Institusi & wilayah">
          <FieldGroup className="web-form-grid">
            {newInstitution ? (
              text("institution_name", "Institusi / pelanggan", { required: true })
            ) : (
              <LookupField
                label="Institusi / pelanggan *"
                value={values.customer_id!}
                onChange={(v) => {
                  set("customer_id", v);
                  setContactIds([]);
                }}
                options={options.customers}
                error={errors.customer_id}
                onSearch={setSearch}
              />
            )}
            <TextField
              label="Kode prospek"
              value="Otomatis saat disimpan"
              onChange={() => undefined}
              disabled
            />
            {newInstitution ? (
              <>
                <LookupField
                  label="Channel *"
                  value={values.channel_id ?? ""}
                  onChange={(v) => set("channel_id", v)}
                  options={options.channels ?? []}
                />
                <LookupField
                  label="Rayon"
                  value={values.rayon_id ?? ""}
                  onChange={(v) => set("rayon_id", v)}
                  options={options.rayons ?? []}
                />
                {text("primary_address", "Alamat")}
              </>
            ) : (
              <>
                <TextField
                  label="Channel *"
                  value={
                    options.customers.find((c) => c.id === values.customer_id)?.channel?.name ??
                    "Mengikuti institusi yang dipilih"
                  }
                  onChange={() => undefined}
                  disabled
                />
                <TextField
                  label="Rayon"
                  value={
                    options.customers.find((c) => c.id === values.customer_id)?.rayon?.name ??
                    "Mengikuti institusi yang dipilih"
                  }
                  onChange={() => undefined}
                  disabled
                />
                <TextField
                  label="Alamat"
                  value={
                    options.customers.find((c) => c.id === values.customer_id)?.primary_address ??
                    "Mengikuti institusi yang dipilih"
                  }
                  onChange={() => undefined}
                  disabled
                />
              </>
            )}
            <TextField
              label="Lokasi"
              value="Pemetaan lokasi belum tersedia"
              onChange={() => undefined}
              disabled
            />
            <SelectionField
              label="Kontak / PIC"
              value={contactIds}
              onChange={setContactIds}
              multiple
              options={newInstitution ? [] : options.contacts}
              error={errors.contact_ids}
              placeholder={
                values.customer_id ? "Pilih kontak terdaftar" : "Pilih pelanggan terlebih dahulu"
              }
            />
            {text("source", "Sumber prospek")}
            <Field orientation="horizontal" className="web-field-full">
              <Checkbox
                id="crm-new-institution"
                disabled={!hasCompanyPermission(principal, "crm_customer.create")}
                checked={newInstitution}
                onCheckedChange={(v) => {
                  const creating = v === true;
                  setNewInstitution(creating);
                  if (creating) setContactIds([]);
                }}
              />
              <FieldLabel htmlFor="crm-new-institution">
                Institusi belum terdaftar — buat baru
              </FieldLabel>
            </Field>
          </FieldGroup>
        </FormSection>
      )}
      {(kind === "prospect" || kind === "status") && (
        <FormSection title={kind === "status" ? "Status pendekatan" : "Penanganan"}>
          <FieldGroup className="web-form-grid">
            {kind === "status" ? (
              <TextField
                label="Institusi / prospek"
                value={`${prospect?.customer.name ?? ""} · ${prospect?.code ?? ""}`}
                onChange={() => undefined}
                disabled
              />
            ) : (
              <LookupField
                label="Penanggung jawab *"
                value={values.owner_id!}
                onChange={(v) => set("owner_id", v)}
                options={options.owners}
                error={errors.owner_id}
              />
            )}
            <Field>
              <FieldLabel>Status pendekatan *</FieldLabel>
              <Choice
                label="Status pendekatan"
                value={values.approach_status!}
                onChange={(v) => set("approach_status", v)}
                options={Object.fromEntries(
                  ["NEW", "IN_PROGRESS", "POTENTIAL", "DEFERRED", "DROPPED"].map((s) => [
                    s,
                    statusLabels[s]!,
                  ]),
                )}
              />
            </Field>
            {kind !== "status" && (
              <>
                {text("next_action", "Tindak lanjut berikutnya")}
                {text("next_action_at", "Tanggal & waktu tindak lanjut (WITA)", {
                  type: "datetime-local",
                })}
              </>
            )}
            {text("notes", kind === "status" ? "Alasan perubahan" : "Catatan / alasan", {
              area: true,
              required: ["DEFERRED", "DROPPED"].includes(values.approach_status!),
            })}
            {kind !== "status" && (
              <TextField
                label="Lampiran"
                value="Unggah lampiran belum tersedia"
                onChange={() => undefined}
                disabled
              />
            )}
          </FieldGroup>
        </FormSection>
      )}
      {(kind === "prospect" || kind === "need") && (
        <FormSection title="Kebutuhan produk">
          <DataTable
            data={needs}
            total={needs.length}
            label="kebutuhan"
            showColumns={false}
            formTable
            columns={[
              {
                id: "product",
                header: "Produk / kategori / uraian",
                cell: ({ row }) => (
                  <FieldGroup className="crm-product-cell">
                    <LookupField
                      label="Produk"
                      value={row.original.product_id}
                      onChange={(v) =>
                        setNeeds((old) =>
                          old.map((n) =>
                            n.key === row.original.key ? { ...n, product_id: v } : n,
                          ),
                        )
                      }
                      options={options.products}
                      onSearch={setSearch}
                    />
                    {!row.original.product_id && (
                      <TextField
                        label="Uraian / kategori"
                        value={row.original.description}
                        onChange={(v) =>
                          setNeeds((old) =>
                            old.map((n) =>
                              n.key === row.original.key ? { ...n, description: v } : n,
                            ),
                          )
                        }
                        error={errors[`needs.${row.index}.description`]}
                      />
                    )}
                  </FieldGroup>
                ),
              },
              {
                id: "qty",
                header: "Estimasi jumlah",
                cell: ({ row }) => (
                  <TextField
                    label="Estimasi jumlah"
                    value={row.original.estimated_qty}
                    placeholder="Belum diketahui"
                    onChange={(v) =>
                      setNeeds((old) =>
                        old.map((n) =>
                          n.key === row.original.key ? { ...n, estimated_qty: v } : n,
                        ),
                      )
                    }
                    error={errors[`needs.${row.index}.estimated_qty`]}
                  />
                ),
              },
              {
                id: "uom",
                header: "Satuan",
                cell: ({ row }) => (
                  <LookupField
                    label="Satuan"
                    value={row.original.uom_id}
                    options={options.uoms}
                    onChange={(v) =>
                      setNeeds((old) =>
                        old.map((n) => (n.key === row.original.key ? { ...n, uom_id: v } : n)),
                      )
                    }
                  />
                ),
              },
              {
                id: "period",
                header: "Waktu kebutuhan",
                cell: ({ row }) => (
                  <TextField
                    label="Waktu kebutuhan"
                    value={row.original.needed_period}
                    placeholder="Tanggal / periode"
                    onChange={(v) =>
                      setNeeds((old) =>
                        old.map((n) =>
                          n.key === row.original.key ? { ...n, needed_period: v } : n,
                        ),
                      )
                    }
                  />
                ),
              },
              {
                id: "notes",
                header: "Catatan",
                cell: ({ row }) => (
                  <TextField
                    label="Catatan kebutuhan"
                    value={row.original.notes}
                    placeholder="Opsional"
                    onChange={(v) =>
                      setNeeds((old) =>
                        old.map((n) => (n.key === row.original.key ? { ...n, notes: v } : n)),
                      )
                    }
                  />
                ),
              },
              {
                id: "remove",
                header: "",
                cell: ({ row }) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus kebutuhan ${row.index + 1}`}
                    onClick={() => setNeeds((old) => old.filter((n) => n.key !== row.original.key))}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ),
              },
            ]}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setNeeds((old) => [
                ...old,
                {
                  key: Date.now(),
                  product_id: "",
                  description: "",
                  estimated_qty: "",
                  uom_id: "",
                  needed_period: "",
                  notes: "",
                },
              ])
            }
          >
            <Plus aria-hidden="true" />
            Tambah Kebutuhan
          </Button>
          <p className="crm-muted">
            Jumlah yang belum diketahui boleh dikosongkan. Pencatatan tidak memesan stok.
          </p>
        </FormSection>
      )}
      {kind === "status" && (
        <Notice>
          Status sebelumnya: {statusLabels[prospect?.approach_status ?? "NEW"]}. Riwayat perubahan
          tetap disimpan. Jadwal tinjau ulang memerlukan layanan tindak lanjut.
        </Notice>
      )}
      <div className="web-form-footer">
        <Button variant="outline" asChild>
          <Link href={back}>Batal</Link>
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending || blocked || (kind === "status" ? !canUpdate : !canCreate)}
        >
          {mutation.isPending
            ? "Menyimpan…"
            : kind === "status"
              ? "Simpan Status"
              : kind === "contact"
                ? "Simpan Kontak"
                : kind === "need"
                  ? "Simpan Kebutuhan"
                  : "Simpan Prospek"}
        </Button>
      </div>
      {!preview && !(kind === "status" ? canUpdate : canCreate) && (
        <Notice>Anda tidak memiliki izin menyimpan data ini.</Notice>
      )}
    </form>
  );
}

export function OpportunityForm({
  win,
  back,
  principal,
  prospect,
  preview,
}: {
  win: boolean;
  back: string;
  principal: AuthPrincipal;
  prospect?: (CrmProspect & { contacts?: CrmContact[] }) | undefined;
  preview: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const [period, setPeriod] = useState("");
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(
    prospect?.needs.map((n) => n.id) ?? [],
  );
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [failure, setFailure] = useState("");
  const [orderKind, setOrderKind] = useState<"PO" | "SP">("PO");
  const [referenceNo, setReferenceNo] = useState("");
  const [maintainStrategy, setMaintainStrategy] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [evidenceName, setEvidenceName] = useState("");
  const [winReason, setWinReason] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [responsible, setResponsible] = useState(principal.display_name);
  const [firstSchedule, setFirstSchedule] = useState("");
  const [targetContact, setTargetContact] = useState("");
  const [closePeriod, setClosePeriod] = useState("September 2026");
  const [lostReason, setLostReason] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [continuation, setContinuation] = useState("Buat peluang lanjutan setelah review");
  const [newPeriod, setNewPeriod] = useState("Oktober 2026");
  const [continuationReason, setContinuationReason] = useState("");
  const [winQuantities, setWinQuantities] = useState<Record<string, string>>({});
  const opportunityId = params.get("opportunity_id");
  const lost = params.get("outcome") === "lost";
  const opportunityQuery = useQuery({
    queryKey: [
      "crm",
      principal.company_id,
      principal.user_id,
      "opportunity",
      prospect?.id,
      opportunityId,
    ],
    enabled: win && !preview && !!prospect?.id && !!opportunityId,
    queryFn: ({ signal }) =>
      apiRequest<{ data: CrmOpportunity[] }>(`/crm/prospects/${prospect!.id}/opportunities`, {
        signal,
      }),
    select: (result) => result.data.find((item) => item.id === opportunityId),
  });
  const opportunityData = preview
    ? prospect && opportunityId
      ? {
          id: opportunityId,
          code: "OPP/0042",
          period: "2026-09",
          owner_id: prospect.owner_id,
          contact_ids: [],
          state: "OPEN",
          version: 1,
          notes: "Kebutuhan laboratorium",
          customer: prospect.customer,
          lines: prospect.needs.slice(0, 2).map((need) => ({
            id: need.id,
            source_need_id: need.id,
            description: need.description,
            estimated_qty: need.estimated_qty,
            notes: need.notes,
            product: need.product,
            uom: need.uom,
          })),
        }
      : undefined
    : opportunityQuery.data;
  useEffect(() => {
    if (opportunityData && Object.keys(winQuantities).length === 0) {
      setWinQuantities(
        Object.fromEntries(
          opportunityData.lines.map((line) => [line.id, line.estimated_qty ?? "1"]),
        ),
      );
    }
  }, [opportunityData?.id, winQuantities]);
  const request = useRef<{ key: string; payload: string } | null>(null);
  const canCreate = hasCompanyPermission(principal, "crm_opportunity.create");
  const mutation = useMutation({
    mutationFn: (body: unknown) => {
      const payload = JSON.stringify(body);
      if (request.current && request.current.payload !== payload)
        throw new Error(
          "Hasil penyimpanan belum pasti. Ulangi isian yang sama atau periksa daftar peluang.",
        );
      request.current ??= { key: crypto.randomUUID(), payload };
      return apiRequest<{ data: { id: string } }>("/crm/opportunities", {
        method: "POST",
        headers: { "Idempotency-Key": request.current.key },
        body: payload,
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Peluang draft tersimpan.");
      router.push(`${back}/opportunities`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status < 500 && error.status !== 408)
        request.current = null;
      setFailure(error.message);
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure("");
    if (win) return;
    if (preview) {
      toast.info("Data simulasi. Peluang tidak disimpan.");
      return;
    }
    const parsed = createOpportunitySchema.safeParse({
      prospect_id: prospect?.id,
      period,
      source_need_ids: selectedNeeds,
      contact_ids: contactIds,
      notes: notes || null,
    });
    if (!parsed.success) {
      setFailure(parsed.error.issues[0]?.message ?? "Periksa isian peluang.");
      return;
    }
    mutation.mutate(parsed.data);
  }
  async function submitWin(event: FormEvent) {
    event.preventDefault();
    setFailure("");
    const opportunity = opportunityData;
    const parsed = winOpportunitySchema.safeParse({
      version: opportunity?.version,
      customer_order_id: crypto.randomUUID(),
      maintain_strategy: maintainStrategy,
      lines:
        opportunity?.lines.map((line) => ({
          opportunity_line_id: line.id,
          quantity: winQuantities[line.id] ?? line.estimated_qty ?? "1",
        })) ?? [],
    });
    if (!opportunity || !parsed.success || !referenceNo.trim()) {
      setFailure("Pilih peluang, isi nomor PO/SP dan strategi maintain.");
      return;
    }
    if (preview) {
      toast.info("Preview mockup. Data Win tidak disimpan.");
      return;
    }
    try {
      const order = await apiRequest<{ data: { id: string } }>("/crm/customer-orders", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          opportunity_id: opportunity.id,
          kind: orderKind,
          reference_no: referenceNo.trim(),
          evidence_attachment_ids: [],
        }),
      });
      await apiRequest(`/crm/customer-orders/${order.data.id}/verify`, { method: "POST" });
      await apiRequest(`/crm/opportunities/${opportunity.id}/win`, {
        method: "POST",
        body: JSON.stringify({ ...parsed.data, customer_order_id: order.data.id }),
      });
      toast.success("Peluang berhasil dicatat sebagai Win.");
      await client.invalidateQueries({ queryKey: ["crm"] });
      router.push(back);
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : "Win tidak dapat disimpan.");
    }
  }
  async function submitLost(event: FormEvent) {
    event.preventDefault();
    setFailure("");
    const opportunity = opportunityData;
    const parsed = loseOpportunitySchema.safeParse({
      version: opportunity?.version,
      reason: notes || lostReason,
      maintain_strategy: maintainStrategy || continuationReason || null,
    });
    if (!opportunity || !parsed.success) {
      setFailure("Isi alasan Lost sebelum menyimpan.");
      return;
    }
    if (preview) {
      toast.info("Preview mockup. Data Lost tidak disimpan.");
      return;
    }
    try {
      await apiRequest(`/crm/opportunities/${opportunity.id}/lose`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success("Peluang berhasil dicatat sebagai Lost.");
      await client.invalidateQueries({ queryKey: ["crm"] });
      router.push(back);
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : "Lost tidak dapat disimpan.");
    }
  }
  if (win && lost)
    return (
      <form className="web-form crm-form" onSubmit={submitLost}>
        {failure && (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}
        {!opportunityId ? (
          <Notice>Pilih peluang dari tab Peluang &amp; Pipeline untuk mencatat Lost.</Notice>
        ) : !preview && opportunityQuery.isLoading ? (
          <p role="status">Memuat peluang…</p>
        ) : !opportunityData ? (
          <Notice>Peluang tidak ditemukan atau belum dapat diakses.</Notice>
        ) : (
          <>
            <FormSection title="Penutupan jumlah sisa">
              <FieldGroup className="web-form-grid">
                <TextField label="Periode asal" value={closePeriod} onChange={setClosePeriod} />
                <Choice
                  label="Jumlah sisa yang ditutup *"
                  value={opportunityData.lines[0]?.id ?? "none"}
                  onChange={() => undefined}
                  options={Object.fromEntries(
                    opportunityData.lines.map((line) => [
                      line.id,
                      `${line.estimated_qty ?? "Belum diketahui"} ${line.uom?.name ?? ""} · ${line.product?.name ?? line.description ?? "Produk"}`,
                    ]),
                  )}
                />
                <Choice
                  label="Alasan Lost *"
                  value={lostReason || "deadline"}
                  onChange={setLostReason}
                  options={{
                    deadline: "Tenggat akhir bulan",
                    budget: "Anggaran pelanggan belum tersedia",
                    competitor: "Memilih pemasok lain",
                  }}
                />
                <TextField
                  label="Catatan *"
                  value={notes}
                  onChange={setNotes}
                  area
                  required
                  fullWidth
                />
                <TextField
                  label="Tanggal penutupan"
                  value={closeDate}
                  onChange={setCloseDate}
                  type="date"
                />
                <TextField
                  label="Stage terakhir"
                  value="Penawaran · 40%"
                  onChange={() => undefined}
                  disabled
                />
              </FieldGroup>
            </FormSection>
            <FormSection title="Salin sisa ke periode berikutnya">
              <FieldGroup className="web-form-grid">
                <Choice
                  label="Tindak lanjut"
                  value={continuation}
                  onChange={setContinuation}
                  options={{
                    "Buat peluang lanjutan setelah review": "Buat peluang lanjutan setelah review",
                    none: "Tidak dilanjutkan",
                  }}
                />
                <Choice
                  label="Periode baru *"
                  value={newPeriod}
                  onChange={setNewPeriod}
                  options={{ "Oktober 2026": "Oktober 2026", "November 2026": "November 2026" }}
                />
                <TextField
                  label="Penanggung jawab *"
                  value={responsible}
                  onChange={setResponsible}
                  required
                />
                <TextField
                  label="Alasan melanjutkan *"
                  value={continuationReason}
                  onChange={setContinuationReason}
                  area
                  required
                  fullWidth
                />
              </FieldGroup>
            </FormSection>
            <p className="crm-form-note">
              Peluang lama tetap Lost. Peluang baru menautkan sisa yang disalin; jumlah yang sudah
              Win tidak ikut disalin.
            </p>
            <div className="web-form-footer">
              <Button type="button" variant="outline" asChild>
                <Link href={back}>Batal</Link>
              </Button>
              <Button type="submit" variant="outline">
                Catat Lost Saja
              </Button>
              <Button type="submit">Catat Lost &amp; Buat Lanjutan</Button>
            </div>
          </>
        )}
      </form>
    );
  if (win)
    return (
      <form className="web-form crm-form" onSubmit={submitWin}>
        {failure && (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}
        {!opportunityId ? (
          <Notice>Pilih peluang dari tab Peluang &amp; Pipeline untuk mencatat Win.</Notice>
        ) : !preview && opportunityQuery.isLoading ? (
          <p role="status">Memuat peluang…</p>
        ) : !opportunityData ? (
          <Notice>Peluang tidak ditemukan atau belum dapat diakses.</Notice>
        ) : (
          <>
            <FormSection title="Bukti pesanan pelanggan">
              <FieldGroup className="web-form-grid">
                <TextField
                  label="Pelanggan"
                  value={prospect?.customer.name ?? ""}
                  onChange={() => undefined}
                  disabled
                />
                <Choice
                  label="PO/SP pelanggan terverifikasi *"
                  value={orderKind}
                  onChange={(value) => setOrderKind(value as "PO" | "SP")}
                  options={{
                    PO: referenceNo ? `${referenceNo} · Terverifikasi` : "PO pelanggan",
                    SP: referenceNo ? `${referenceNo} · Terverifikasi` : "SP pelanggan",
                  }}
                />
                <TextField
                  label="Nomor PO/SP *"
                  value={referenceNo}
                  onChange={setReferenceNo}
                  required
                />
                <TextField
                  label="Tanggal diterima *"
                  value={receivedDate}
                  onChange={setReceivedDate}
                  type="date"
                  required
                />
                <TextField
                  label="Bukti PO/SP *"
                  value={evidenceName || "Unggah bukti PO/SP"}
                  onChange={setEvidenceName}
                  placeholder="PO-RBS-0928.pdf"
                />
              </FieldGroup>
            </FormSection>
            <FormSection title="Jumlah yang menjadi Win">
              <DataTable<CrmOpportunity["lines"][number]>
                data={opportunityData.lines}
                total={opportunityData.lines.length}
                label="baris peluang"
                showColumns={false}
                formTable
                columns={[
                  {
                    id: "product",
                    header: "Produk / baris sumber",
                    cell: ({ row }) =>
                      `${row.original.product?.name ?? row.original.description ?? "Kebutuhan"}`,
                  },
                  {
                    id: "opportunity",
                    header: "Jumlah peluang",
                    cell: ({ row }) =>
                      `${row.original.estimated_qty ?? "Belum diketahui"} ${row.original.uom?.name ?? ""}`,
                  },
                  { id: "won", header: "Sudah Win", cell: () => "0" },
                  {
                    id: "quantity",
                    header: "Jumlah Win baru *",
                    cell: ({ row }) => (
                      <Input
                        aria-label={`Jumlah Win ${row.original.product?.name ?? "kebutuhan"}`}
                        value={winQuantities[row.original.id] ?? row.original.estimated_qty ?? "1"}
                        onChange={(event) =>
                          setWinQuantities((current) => ({
                            ...current,
                            [row.original.id]: event.target.value,
                          }))
                        }
                        inputMode="decimal"
                      />
                    ),
                  },
                  {
                    id: "remaining",
                    header: "Sisa",
                    cell: ({ row }) =>
                      `${row.original.estimated_qty ?? "Belum diketahui"} ${row.original.uom?.name ?? ""}`,
                  },
                ]}
              />
            </FormSection>
            <FormSection title="Alasan & rencana maintain">
              <FieldGroup className="web-form-grid">
                <Choice
                  label="Alasan Win *"
                  value={winReason || "fit"}
                  onChange={setWinReason}
                  options={{
                    fit: "Spesifikasi sesuai kebutuhan",
                    price: "Harga disepakati",
                    timing: "Waktu pengiriman sesuai",
                  }}
                />
                <TextField
                  label="Catatan keputusan *"
                  value={decisionNote}
                  onChange={setDecisionNote}
                  area
                  required
                  fullWidth
                />
                <TextField
                  label="Tindakan maintain *"
                  value={maintainStrategy}
                  onChange={setMaintainStrategy}
                  area
                  required
                  fullWidth
                />
                <TextField
                  label="Penanggung jawab *"
                  value={responsible}
                  onChange={setResponsible}
                  required
                />
                <TextField
                  label="Jadwal pertama *"
                  value={firstSchedule}
                  onChange={setFirstSchedule}
                  type="date"
                  required
                />
                <TextField
                  label="Kontak tujuan"
                  value={targetContact}
                  onChange={setTargetContact}
                  placeholder="Pilih kontak"
                />
              </FieldGroup>
            </FormSection>
            <p className="crm-form-note">
              Sisa peluang tetap ditangani terpisah. Win tidak menambah aktual penjualan.
            </p>
            <div className="web-form-footer">
              <Button type="button" variant="outline" asChild>
                <Link href={back}>Batal</Link>
              </Button>
              <Button type="submit">Simpan Win</Button>
            </div>
          </>
        )}
      </form>
    );
  return (
    <form className="web-form crm-form" onSubmit={submit}>
      {failure && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <FormSection title="Peluang & periode">
        <FieldGroup className="web-form-grid">
          <TextField
            label="Institusi / prospek *"
            value={`${prospect?.customer.name ?? ""} · ${prospect?.code ?? ""}`}
            onChange={() => undefined}
            disabled
          />
          <TextField
            label="Penanggung jawab *"
            value={prospect?.owner_name ?? principal.display_name}
            onChange={() => undefined}
            disabled
          />
          <TextField
            label="Periode pipeline"
            value={period}
            onChange={setPeriod}
            type="month"
            required
          />
          <TextField
            label="Perkiraan tanggal Win"
            value="Belum tersedia pada draft"
            onChange={() => undefined}
            disabled
          />
          <SelectionField
            label="Kontak terkait"
            value={contactIds}
            onChange={setContactIds}
            multiple
            options={(prospect?.contacts ?? [])
              .filter((c) => c.state === "ACTIVE")
              .map((c) => ({
                id: c.id,
                name: [c.full_name, c.job_title].filter(Boolean).join(" · "),
              }))}
            placeholder="Pilih kontak terkait"
          />
          <SelectionField
            label="Sumber kebutuhan"
            value={selectedNeeds}
            onChange={setSelectedNeeds}
            multiple
            options={(prospect?.needs ?? []).map((n) => ({
              id: n.id,
              name: n.product?.name ?? n.description ?? "Kebutuhan",
            }))}
            placeholder="Pilih kebutuhan dari prospek"
          />
          <TextField
            label="Catatan"
            value={notes}
            onChange={setNotes}
            area
            fullWidth
            placeholder="Konteks dan strategi pendekatan"
          />
        </FieldGroup>
      </FormSection>
      <FormSection title="Produk / kebutuhan peluang">
        <DataTable
          data={(prospect?.needs ?? []).filter((need) => selectedNeeds.includes(need.id))}
          showColumns={false}
          formTable
          total={prospect?.needs.length ?? 0}
          label="kebutuhan"
          columns={[
            {
              id: "product",
              header: "Produk / kebutuhan",
              cell: ({ row }) => (
                <Input
                  aria-label="Produk / kebutuhan"
                  readOnly
                  value={row.original.product?.name ?? row.original.description ?? ""}
                />
              ),
            },
            {
              id: "qty",
              header: "Jumlah",
              cell: ({ row }) => (
                <Input
                  aria-label="Jumlah"
                  readOnly
                  value={row.original.estimated_qty ?? "Belum diketahui"}
                />
              ),
            },
            {
              id: "uom",
              header: "Satuan",
              cell: ({ row }) => (
                <Input aria-label="Satuan" readOnly value={row.original.uom?.name ?? "—"} />
              ),
            },
            {
              id: "value",
              header: "Nilai net estimasi",
              cell: () => <Input aria-label="Nilai net estimasi" disabled value="Belum tersedia" />,
            },
            {
              id: "stage",
              header: "Stage",
              cell: () => <Input aria-label="Stage" disabled value="Draft" />,
            },
            {
              id: "action",
              header: "Tindak lanjut",
              cell: () => <Input aria-label="Tindak lanjut" disabled value="Belum tersedia" />,
            },
          ]}
        />
        <Button variant="outline" asChild>
          <Link href={`${back}/needs/new`}>Tambah Kebutuhan</Link>
        </Button>
      </FormSection>
      <p className="crm-form-note">
        Draft belum mengaktifkan pipeline. Nilai estimasi, stage aktif, tindak lanjut dan lampiran
        belum tersedia.
      </p>
      <FormSection title="Revisi peluang">
        <FieldGroup className="web-form-grid">
          <TextField
            label="Alasan revisi"
            area
            value=""
            placeholder="Isi saat mengubah peluang yang sudah disimpan"
            onChange={() => undefined}
            disabled
          />
          <TextField
            label="Lampiran"
            value="Unggah bukti pendukung belum tersedia"
            onChange={() => undefined}
            disabled
          />
        </FieldGroup>
      </FormSection>
      <div className="web-form-footer">
        <Button variant="outline" asChild>
          <Link href={back}>Batal</Link>
        </Button>
        <Button
          type="submit"
          disabled={!canCreate || mutation.isPending || !prospect || !selectedNeeds.length}
        >
          {mutation.isPending ? "Menyimpan…" : "Simpan Peluang"}
        </Button>
      </div>
    </form>
  );
}
