"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { CrmContact } from "@evflow/contracts";
import { IconPencil as Pencil, IconPlus as Plus } from "@/components/web/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataTable,
  DetailTabs,
  HistoryList,
  OfficePage,
  PageNotice,
  RecordBadge,
  SubNav,
  SummaryStrip,
  ValueGrid,
  ValueItem,
} from "@/components/web/page-frame";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../../session-provider";
import { Evidence } from "../../operations/workspace";
import { ReferenceWorkspace, type ReferenceConfig } from "../reference-workspace";
import { ListFilters, useListParams } from "../master-shared";
import { CustomerForm } from "./customer-form";
import {
  type Customer,
  type Ref,
  type Pic,
  type PaymentTerm,
  relationships,
  onboarding,
  roles,
  money,
  termLabel,
} from "./customer-types";
import "./customer.css";
const base = "/master-data/customers";
export function CustomerBadge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`customer-badge ${["VERIFIED", "TRANSACTED", "ACTIVE"].includes(value) ? "is-success" : ["NEEDS_REVIEW", "REGISTERED"].includes(value) ? "is-warning" : ["INACTIVE", "ARCHIVED"].includes(value) ? "is-danger" : ""}`}
    >
      {label ??
        onboarding[value] ??
        relationships[value] ??
        { ACTIVE: "Aktif", INACTIVE: "Nonaktif", ARCHIVED: "Diarsipkan" }[value] ??
        value}
    </span>
  );
}
export function CustomerPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="customer-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function CustomerValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="customer-value">
      <span>{label}</span>
      <strong>{children ?? "Belum tersedia"}</strong>
    </div>
  );
}
function useCan() {
  const { principal } = useSession();
  return (p: string) => !!principal && hasCompanyPermission(principal, p);
}
export function CustomerSubNav({
  active,
}: {
  active: "customers" | "channels" | "rayons" | "contacts";
}) {
  const can = useCan();
  return (
    <SubNav
      items={[
        ...(can("master_customer.read")
          ? [{ label: "Pelanggan", href: base, active: active === "customers" }]
          : []),
        ...(can("master_customer_channel.read")
          ? [{ label: "Channel", href: `${base}/channels`, active: active === "channels" }]
          : []),
        ...(can("master_rayon.read")
          ? [{ label: "Rayon", href: `${base}/rayons`, active: active === "rayons" }]
          : []),
        // Kontak memakai data CRM yang sama dan izin crm_contact sendiri, bukan master_customer.
        ...(can("crm_contact.read")
          ? [{ label: "Kontak", href: `${base}/contacts`, active: active === "contacts" }]
          : []),
      ]}
    />
  );
}
const references: Record<string, ReferenceConfig> = {
  channels: {
    resource: "customer-channels",
    permission: "master_customer_channel",
    title: "Channel",
    singular: "channel",
    description: "Saluran pelanggan yang dipilih pada data pelanggan.",
    base: `${base}/channels`,
    parent: { label: "Pelanggan", href: base },
    subnav: <CustomerSubNav active="channels" />,
    usageLabel: "Jumlah pelanggan",
  },
  rayons: {
    resource: "rayons",
    permission: "master_rayon",
    title: "Rayon",
    singular: "rayon",
    description: "Wilayah layanan pelanggan.",
    base: `${base}/rayons`,
    parent: { label: "Pelanggan", href: base },
    subnav: <CustomerSubNav active="rayons" />,
    usageLabel: "Jumlah pelanggan",
    coverage: true,
  },
};
const crumbs = [{ label: "Master Data" }, { label: "Pelanggan", href: base }];
export function CustomerWorkspace({ path = [] }: { path?: string[] }) {
  const { principal } = useSession(),
    can = useCan();
  const reference = path[0] ? references[path[0]] : undefined,
    contactTab = path[0] === "contacts";
  const id =
      !reference && !contactTab && path[0] && path[0] !== "new" ? path[0] : undefined,
    form = !reference && !contactTab && (path[0] === "new" || path[1] === "edit");
  const detail = useQuery({
    queryKey: [
      "customer-master",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      id,
    ],
    queryFn: () => apiRequest<{ data: Customer }>(`${base}/${id}`),
    enabled: !!id && can("master_customer.read"),
  });
  if (reference) return <ReferenceWorkspace config={reference} path={path.slice(1)} />;
  if (contactTab) return <CustomerContactList />;
  const row = detail.data?.data;
  if (!can("master_customer.read"))
    return (
      <OfficePage section="master" crumbs={crumbs} title="Pelanggan">
        <CustomerSubNav active="customers" />
        <PageNotice tone="error">Anda tidak memiliki izin melihat Master Pelanggan.</PageNotice>
      </OfficePage>
    );
  if (id && !row)
    return (
      <OfficePage section="master" crumbs={[...crumbs, { label: "Detail" }]} title="Pelanggan">
        {detail.isError ? (
          <PageNotice tone="error" onRetry={() => void detail.refetch()}>
            {detail.error.message}
          </PageNotice>
        ) : (
          <p role="status">Memuat pelanggan…</p>
        )}
      </OfficePage>
    );
  if (form)
    return (
      <OfficePage
        section="master"
        crumbs={[
          ...crumbs,
          ...(row ? [{ label: row.code, href: `${base}/${row.id}` }] : []),
          { label: row ? "Ubah" : "Baru" },
        ]}
        title={row ? `Ubah ${row.name}` : "Pelanggan baru"}
        subtitle={row ? row.code : "Kode dibuat otomatis saat disimpan."}
      >
        <CustomerForm key={id ?? "new"} initial={row} />
      </OfficePage>
    );
  if (row) return <CustomerDetail row={row} />;
  return <CustomerList />;
}
function CustomerList() {
  const { principal } = useSession(),
    can = useCan(),
    list = useListParams();
  const relationship = list.get("relationship"),
    onboard = list.get("onboarding"),
    channel = list.get("channel");
  const query = new URLSearchParams({
    q: list.q,
    page: String(list.page),
    relationship,
    onboarding: onboard,
    channel,
  }).toString();
  const rows = useQuery({
    queryKey: [
      "customer-master",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      "list",
      query,
    ],
    queryFn: () =>
      apiRequest<{ data: Customer[]; total: number; finance_visible: boolean }>(
        `/master-data/customer-workspace/list?${query}`,
      ),
  });
  const refs = useQuery({
    queryKey: ["master-refs", principal?.company_id, principal?.user_id, "channels"],
    queryFn: () =>
      apiRequest<{ data: { channels: Ref[] } }>("/master-data/customer-options").then(
        (result) => result.data.channels,
      ),
  });
  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => (
        <Link className="page-frame-link" href={`${base}/${row.original.id}`}>
          {row.original.code}
        </Link>
      ),
    },
    { accessorKey: "name", header: "Nama pelanggan" },
    { id: "channel", header: "Channel", cell: ({ row }) => row.original.channel?.name ?? "—" },
    { id: "rayon", header: "Rayon", cell: ({ row }) => row.original.rayon?.name ?? "—" },
    {
      id: "relationship",
      header: "Tahap hubungan",
      cell: ({ row }) => <CustomerBadge value={row.original.relationship_stage} />,
    },
    {
      id: "onboarding",
      header: "Status onboarding",
      cell: ({ row }) => <CustomerBadge value={row.original.onboarding_state} />,
    },
    {
      id: "payment",
      header: "Termin bawaan",
      cell: ({ row }) => row.original.default_term_code ?? "Belum ditetapkan",
    },
    {
      id: "limit",
      header: "Limit kredit",
      cell: ({ row }) =>
        rows.data?.finance_visible ? (
          row.original.credit_frozen ? (
            <CustomerBadge value="INACTIVE" label="Dibekukan" />
          ) : (
            money(row.original.credit_limit)
          )
        ) : (
          <span title="Memerlukan izin kredit pelanggan">Terbatas</span>
        ),
    },
  ];
  const filter = (
    label: string,
    key: string,
    value: string,
    options: { id: string; name: string }[],
  ) => (
    <SelectionField
      label={label}
      value={[value]}
      options={options}
      onChange={(v) => list.set({ [key]: v[0] ?? "ALL", page: 1 })}
    />
  );
  return (
    <OfficePage
      section="master"
      crumbs={[{ label: "Master Data" }, { label: "Pelanggan" }]}
      title="Pelanggan"
      subtitle="Institusi pelanggan dan prospek yang dipakai Sales dan Finance."
      actions={
        can("master_customer.create") && (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus aria-hidden="true" />
              Tambah pelanggan
            </Link>
          </Button>
        )
      }
    >
      <CustomerSubNav active="customers" />
      {rows.isError && (
        <PageNotice tone="error" onRetry={() => void rows.refetch()}>
          {rows.error.message}
        </PageNotice>
      )}
      <DataTable
        data={rows.data?.data ?? []}
        columns={columns}
        total={rows.data?.total ?? 0}
        page={list.page}
        onPage={(page) => list.set({ page })}
        busy={rows.isFetching}
        label="pelanggan"
        toolbar={
          <ListFilters
            list={list}
            searchLabel="Cari kode atau nama pelanggan"
            status={false}
            filterKeys={["onboarding", "relationship", "channel"]}
          >
            {filter("Status onboarding", "onboarding", onboard, [
              { id: "ALL", name: "Semua status onboarding" },
              ...Object.entries(onboarding).map(([id, name]) => ({ id, name })),
            ])}
            {filter("Tahap hubungan", "relationship", relationship, [
              { id: "ALL", name: "Semua tahap" },
              ...Object.entries(relationships).map(([id, name]) => ({ id, name })),
            ])}
            {filter("Channel", "channel", channel, [
              { id: "ALL", name: "Semua channel" },
              ...(refs.data ?? []),
            ])}
          </ListFilters>
        }
      />
    </OfficePage>
  );
}
const contactStates = { ALL: "Semua status", ACTIVE: "Aktif", INACTIVE: "Nonaktif" };
// Tab Kontak membaca /crm/workspace/contacts; tambah/ubah tetap lewat command kontak CRM.
function CustomerContactList() {
  const { principal } = useSession(),
    can = useCan(),
    list = useListParams();
  const status = list.get("status");
  const allowed = can("crm_contact.read");
  const query = new URLSearchParams({
    q: list.q,
    page: String(list.page),
    status: status === "ALL" ? "all" : status,
  }).toString();
  const rows = useQuery({
    queryKey: [
      "crm-contacts",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      "master-tab",
      query,
    ],
    queryFn: () =>
      apiRequest<{ data: CrmContact[]; total: number }>(`/crm/workspace/contacts?${query}`),
    enabled: allowed,
  });
  const columns: ColumnDef<CrmContact>[] = [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => (
        <Link className="page-frame-link" href={`/crm/contacts/${row.original.id}`}>
          {row.original.code}
        </Link>
      ),
    },
    { accessorKey: "full_name", header: "Nama kontak" },
    { id: "job", header: "Jabatan", cell: ({ row }) => row.original.job_title ?? "—" },
    {
      id: "functions",
      header: "Fungsi PIC",
      cell: ({ row }) =>
        row.original.pic_functions.map((f) => roles[f] ?? f).join(", ") || "—",
    },
    { id: "phone", header: "HP/WA", cell: ({ row }) => row.original.phone ?? "—" },
    { id: "email", header: "Email", cell: ({ row }) => row.original.email ?? "—" },
    {
      id: "customer",
      header: "Pelanggan",
      cell: ({ row }) => {
        const customer = row.original.customer;
        if (!customer) return "—";
        return customer.id && can("master_customer.read") ? (
          <Link className="page-frame-link" href={`${base}/${customer.id}`}>
            {customer.name}
          </Link>
        ) : (
          customer.name
        );
      },
    },
    {
      id: "state",
      header: "Status",
      cell: ({ row }) => (row.original.state === "ACTIVE" ? "Aktif" : "Nonaktif"),
    },
  ];
  return (
    <OfficePage
      section="master"
      crumbs={[...crumbs, { label: "Kontak" }]}
      title="Kontak"
      subtitle="Kontak pelanggan dari CRM. Data yang sama dengan menu CRM › Kontak."
      actions={
        allowed &&
        can("crm_contact.create") && (
          <Button asChild>
            <Link href="/crm/contacts/new">
              <Plus aria-hidden="true" />
              Tambah kontak
            </Link>
          </Button>
        )
      }
    >
      <CustomerSubNav active="contacts" />
      {!allowed ? (
        <PageNotice tone="error">Anda tidak memiliki izin melihat Kontak.</PageNotice>
      ) : (
        <>
          {rows.isError && (
            <PageNotice tone="error" onRetry={() => void rows.refetch()}>
              {rows.error.message}
            </PageNotice>
          )}
          <DataTable
            data={rows.data?.data ?? []}
            columns={columns}
            total={rows.data?.total ?? 0}
            page={list.page}
            onPage={(page) => list.set({ page })}
            busy={rows.isFetching}
            label="kontak"
            toolbar={
              <ListFilters
                list={list}
                searchLabel="Cari nama, HP, atau email kontak"
                status={false}
                filterKeys={["status"]}
              >
                <SelectionField
                  label="Status kontak"
                  value={[status]}
                  options={Object.entries(contactStates).map(([id, name]) => ({ id, name }))}
                  onChange={(v) => list.set({ status: v[0] ?? "ALL", page: 1 })}
                />
              </ListFilters>
            }
          />
        </>
      )}
    </OfficePage>
  );
}
// Nonaktifkan dan Arsipkan wajib beralasan; backend memeriksa izin dan versi.
function CustomerStatusActions({ row }: { row: Customer }) {
  const { principal } = useSession(),
    can = useCan(),
    cache = useQueryClient();
  const [action, setAction] = useState<"" | "activate" | "deactivate" | "archive">(""),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function change() {
    setPending(true);
    setError("");
    try {
      await apiRequest(`${base}/${row.id}/${action}`, {
        method: "POST",
        version: row.version,
        // Arsip hanya menerima alasan; nonaktifkan memakai skema status bersama yang mewajibkan versi.
        body: JSON.stringify(
          action === "archive"
            ? { reason: reason.trim() }
            : { version: row.version, reason: reason.trim() },
        ),
      });
      await cache.invalidateQueries({
        queryKey: ["customer-master", principal?.company_id, principal?.user_id],
      });
      toast.success(labels[action as Exclude<typeof action, "">].done);
      setAction("");
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }
  if (row.state === "ARCHIVED") return null;
  const labels = {
    activate: { title: "Aktifkan kembali", done: "Pelanggan diaktifkan" },
    deactivate: { title: "Nonaktifkan", done: "Pelanggan dinonaktifkan" },
    archive: { title: "Arsipkan", done: "Pelanggan diarsipkan" },
  };
  return (
    <>
      {can("master_customer.activate") && row.state === "INACTIVE" && (
        <Button variant="outline" onClick={() => setAction("activate")}>
          Aktifkan kembali
        </Button>
      )}
      {can("master_customer.update") && row.state !== "INACTIVE" && (
        <Button variant="outline" onClick={() => setAction("deactivate")}>
          Nonaktifkan
        </Button>
      )}
      {can("master_customer.activate") && (
        <Button variant="outline" onClick={() => setAction("archive")}>
          Arsipkan
        </Button>
      )}
      <Dialog open={!!action} onOpenChange={(open) => !open && setAction("")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action && labels[action].title} {row.name}?
            </DialogTitle>
            <DialogDescription>
              {action === "activate"
                ? "Status aktif tidak sama dengan siap transaksi; verifikasi onboarding tetap berlaku."
                : "Riwayat tetap tersimpan. Pelanggan tidak dapat dipilih untuk transaksi baru."}
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-2 text-xs font-medium">
            Alasan *
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {error && (
            <p role="alert" className="page-frame-field-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setAction("")}>
              Batal
            </Button>
            <Button disabled={pending || reason.trim().length < 3} onClick={() => void change()}>
              {pending ? "Menyimpan…" : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function CustomerDetail({ row }: { row: Customer }) {
  const { principal } = useSession(),
    can = useCan();
  const sales = useQuery({
    queryKey: [
      "customer-master",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      row.id,
      "sales",
    ],
    queryFn: () =>
      apiRequest<{ data: { orders: Sale[] | null; invoices: Sale[] | null } }>(
        `${base}/${row.id}/sales`,
      ),
  });
  const terms = useQuery({
    queryKey: ["customer-refs", principal?.company_id, principal?.user_id],
    queryFn: async () =>
      (
        await apiRequest<{
          data: { channels: Ref[]; rayons: Ref[]; payment_terms: PaymentTerm[] };
        }>("/master-data/customer-options")
      ).data,
  });
  const term = termLabel(row.default_term_code, terms.data?.payment_terms);
  const pics = row.contacts ?? [];
  const roleSummary = (role: string) => {
    const a = pics.filter((p) => p.state !== "INACTIVE" && p.pic_functions.includes(role));
    return a.length
      ? a.map((p) => `${p.full_name} · ${p.phone ?? "HP/WA belum diisi"}`).join("; ")
      : can("crm_contact.read")
        ? undefined
        : "Akses kontak diperlukan";
  };
  const legal = row.legal_documents ?? [];
  const expires = legal.filter(
    (l) =>
      l.expires_on &&
      new Date(l.expires_on).getTime() > Date.now() &&
      new Date(l.expires_on).getTime() < Date.now() + 30 * 86400000,
  ).length;
  const contacts: ColumnDef<Pic>[] = [
    {
      id: "role",
      header: "Fungsi PIC",
      cell: ({ row: r }) => r.original.pic_functions.map((f) => roles[f] ?? f).join(", "),
    },
    { accessorKey: "full_name", header: "Nama" },
    {
      accessorKey: "phone",
      header: "Telepon / WA",
      cell: ({ row: r }) => r.original.phone ?? "Belum diisi",
    },
    { accessorKey: "email", header: "Email", cell: ({ row: r }) => r.original.email ?? "—" },
    {
      id: "backup",
      header: "Kontak cadangan",
      cell: ({ row: r }) =>
        pics
          .filter(
            (p) =>
              p.id !== r.original.id &&
              p.state !== "INACTIVE" &&
              p.pic_functions.some((f) => r.original.pic_functions.includes(f)),
          )
          .map((p) => p.full_name)
          .join(", ") || "—",
    },
  ];
  const finance = can("customer_credit.update");
  return (
    <OfficePage
      section="master"
      crumbs={[...crumbs, { label: row.code }]}
      title={row.name}
      status={<RecordBadge state={row.state} />}
      subtitle={row.code}
      actions={
        <>
          <CustomerStatusActions row={row} />
          {can("master_customer.update") && (
            <Button asChild>
              <Link href={`${base}/${row.id}/edit`}>
                <Pencil aria-hidden="true" />
                Ubah
              </Link>
            </Button>
          )}
        </>
      }
    >
      <SummaryStrip>
        <ValueItem label="Tahap hubungan">
          <CustomerBadge value={row.relationship_stage} />
        </ValueItem>
        <ValueItem label="Status onboarding">
          <CustomerBadge value={row.onboarding_state} />
        </ValueItem>
        <ValueItem label="Channel · rayon">
          {[row.channel?.name, row.rayon?.name].filter(Boolean).join(" · ") || undefined}
        </ValueItem>
        <ValueItem label="Termin bawaan">{term ?? "Belum ditetapkan"}</ValueItem>
      </SummaryStrip>
      <DetailTabs
        tabs={[
          {
            id: "info",
            label: "Informasi",
            content: (
              <ValueGrid>
                <ValueItem label="Alamat utama">{row.primary_address}</ValueItem>
                <ValueItem label="Alamat pengantaran">
                  {row.shipping_address ?? row.primary_address}
                </ValueItem>
                <ValueItem label="PIC pembelian">{roleSummary("PURCHASING")}</ValueItem>
                <ValueItem label="PIC penerimaan barang">{roleSummary("RECEIVING")}</ValueItem>
                <ValueItem label="PIC pembayaran / keuangan">{roleSummary("FINANCE")}</ValueItem>
                <ValueItem label="NPWP · status pajak">
                  {[row.tax_identity, row.tax_status].filter(Boolean).join(" · ") || undefined}
                </ValueItem>
                <ValueItem label="Penanggung jawab">{row.responsible_person?.name}</ValueItem>
                <ValueItem label="Dokumen kedaluwarsa dalam 30 hari">{`${expires} dokumen`}</ValueItem>
                <ValueItem label="Kode faktur bawaan">{row.default_tax_invoice_code}</ValueItem>
                <ValueItem label="Limit kredit">
                  {finance
                    ? row.credit_limit
                      ? money(row.credit_limit)
                      : "Tanpa limit"
                    : "Terbatas"}
                </ValueItem>
                <ValueItem label="Status kredit">
                  {finance
                    ? row.credit_frozen
                      ? `Dibekukan · ${row.freeze_reason ?? ""}`
                      : "Aktif"
                    : "Terbatas"}
                </ValueItem>
                <ValueItem label="Toleransi lewat jatuh tempo">
                  {finance
                    ? row.past_due_grace_days == null
                      ? undefined
                      : `${row.past_due_grace_days} hari`
                    : "Terbatas"}
                </ValueItem>
              </ValueGrid>
            ),
          },
          {
            id: "contacts",
            label: "Kontak PIC",
            content: can("crm_contact.read") ? (
              <DataTable data={pics} columns={contacts} total={pics.length} showColumns={false} />
            ) : (
              <p className="page-frame-subtitle">Akses CRM diperlukan untuk melihat kontak PIC.</p>
            ),
          },
          {
            id: "legal",
            label: "Legalitas",
            content: (
              <DataTable
                data={legal}
                total={legal.length}
                showColumns={false}
                columns={[
                  { accessorKey: "type", header: "Dokumen" },
                  { accessorKey: "number", header: "Nomor" },
                  { accessorKey: "issuer", header: "Penerbit" },
                  { accessorKey: "expires_on", header: "Berlaku sampai" },
                  {
                    id: "state",
                    header: "Status verifikasi",
                    cell: ({ row: r }) => (
                      <CustomerBadge value={r.original.verification_state ?? "Belum diverifikasi"} />
                    ),
                  },
                  {
                    id: "proof",
                    header: "Berkas",
                    cell: ({ row: r }) =>
                      r.original.evidence_id ? <Evidence id={r.original.evidence_id} /> : "—",
                  },
                ]}
              />
            ),
          },
          {
            id: "noo",
            label: "Berkas NOO",
            content: row.noo_document ? (
              <>
                <ValueGrid>
                  <ValueItem label="Nama">{row.noo_document.name}</ValueItem>
                  <ValueItem label="Tanggal">{row.noo_document.date}</ValueItem>
                  <ValueItem label="Versi">{row.noo_document.version}</ValueItem>
                  <ValueItem label="Catatan">{row.noo_document.notes}</ValueItem>
                </ValueGrid>
                {row.noo_document.evidence_id && <Evidence id={row.noo_document.evidence_id} />}
              </>
            ) : (
              <p className="page-frame-subtitle">Belum ada berkas NOO.</p>
            ),
          },
          {
            id: "sales",
            label: "Riwayat penjualan",
            content: sales.isPending ? (
              <p role="status">Memuat penjualan…</p>
            ) : sales.isError ? (
              <PageNotice tone="error" onRetry={() => void sales.refetch()}>
                {sales.error.message}
              </PageNotice>
            ) : (
              <>
                {sales.data?.data.orders && (
                  <SalesTable title="Sales Order" rows={sales.data.data.orders} type="orders" />
                )}
                {sales.data?.data.invoices && (
                  <SalesTable title="Invoice" rows={sales.data.data.invoices} type="invoices" />
                )}
                {!sales.data?.data.orders && !sales.data?.data.invoices && (
                  <p className="page-frame-subtitle">Izin Sales Order atau Invoice diperlukan.</p>
                )}
              </>
            ),
          },
          {
            id: "history",
            label: "Riwayat perubahan",
            content: (
              <HistoryList
                queryKey={[
                  "customer-master",
                  principal?.company_id,
                  principal?.user_id,
                  row.id,
                  "history",
                  row.version,
                ]}
                path={`${base}/${row.id}/history`}
              />
            ),
          },
        ]}
      />
    </OfficePage>
  );
}
type Sale = {
  id: string;
  number: string;
  created_at: string;
  state: string;
  total?: string;
  currency: string;
};
function SalesTable({ title, rows, type }: { title: string; rows: Sale[]; type: string }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <DataTable
        data={rows}
        total={rows.length}
        showColumns={false}
        columns={[
          {
            id: "number",
            header: "Nomor",
            cell: ({ row }) => (
              <Link className="page-frame-link" href={`/operations/${type}/${row.original.id}`}>
                {row.original.number}
              </Link>
            ),
          },
          {
            id: "date",
            header: "Tanggal",
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString("id-ID"),
          },
          { accessorKey: "state", header: "Status" },
          {
            id: "total",
            header: "Total",
            cell: ({ row }) => (row.original.total ? money(row.original.total) : "Lihat dokumen"),
          },
        ]}
      />
      <p className="page-frame-subtitle" style={{ marginTop: 8 }}>
        Maksimal 100 dokumen terbaru sesuai izin.
      </p>
    </section>
  );
}
