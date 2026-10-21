"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../../session-provider";
import { DashboardSidebar } from "../../dashboard-sidebar";
import { ExecutiveTopbar } from "../../dashboard-executive";
import { DataTable } from "../../crm/crm-common";
import { Evidence } from "../../operations/workspace";
import { CustomerForm } from "./customer-form";
import {
  type Customer,
  type Ref,
  type Pic,
  relationships,
  onboarding,
  roles,
  money,
} from "./customer-types";
import "../../crm/crm.css";
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
export function CustomerWorkspace({ path = [] }: { path?: string[] }) {
  const session = useSession(),
    principal = session.principal,
    router = useRouter();
  const id = path[0] && path[0] !== "new" ? path[0] : undefined,
    form = path[0] === "new" || path[1] === "edit";
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
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
  useEffect(() => {
    if (session.state === "anonymous") router.replace("/login?session=ended");
  }, [session.state, router]);
  if (!principal) return <p role="status">Memuat sesi...</p>;
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <a className="sr-only focus:not-sr-only" href="#customer-main">
        Lewati navigasi
      </a>
      <DashboardSidebar principal={principal} activeView="executive" activeSection="master" />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        <main id="customer-main" className="executive-content crm-content customer-workspace">
          <header className="executive-heading">
            <div>
              <Breadcrumb className="customer-breadcrumb" aria-label="Breadcrumb">
                <BreadcrumbList>
                  <BreadcrumbItem>Master Data</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {id || form ? (
                      <BreadcrumbLink asChild>
                        <Link href={base}>Pelanggan</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>Pelanggan</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {id && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {form ? (
                          <BreadcrumbLink asChild>
                            <Link href={`${base}/${id}`}>{detail.data?.data.code ?? "Detail"}</Link>
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>{detail.data?.data.code ?? "Detail"}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </>
                  )}
                  {form && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{id ? "Ubah" : "Tambah"}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
              <h1>
                {form
                  ? id
                    ? "Ubah Pelanggan"
                    : "Tambah Pelanggan"
                  : id
                    ? (detail.data?.data.name ?? "Detail Pelanggan")
                    : "Pelanggan"}
              </h1>
            </div>
            <div className="customer-actions">
              {id || form ? (
                <>
                  <Button variant="outline" asChild>
                    <Link href={id && form ? `${base}/${id}` : base}>
                      <ArrowLeft />
                      Kembali
                    </Link>
                  </Button>
                  {form && <CustomerBadge value="Belum disimpan" />}
                </>
              ) : (
                can("master_customer.create") && (
                  <Button asChild>
                    <Link href={`${base}/new`}>
                      <Plus />
                      Tambah Pelanggan
                    </Link>
                  </Button>
                )
              )}
            </div>
          </header>
          {!can("master_customer.read") ? (
            <p role="alert">Anda tidak memiliki izin melihat Master Pelanggan.</p>
          ) : id && detail.isPending ? (
            <p role="status">Memuat pelanggan...</p>
          ) : id && detail.isError ? (
            <p role="alert">
              {detail.error.message}
              <Button variant="outline" onClick={() => void detail.refetch()}>
                Coba lagi
              </Button>
            </p>
          ) : form ? (
            <CustomerForm key={id ?? "new"} initial={detail.data?.data} />
          ) : id && detail.data ? (
            <CustomerDetail row={detail.data.data} />
          ) : (
            <CustomerList />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
function CustomerList() {
  const { principal } = useSession();
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [stage, setStage] = useState("ALL"),
    [onboard, setOnboard] = useState("ALL"),
    [channel, setChannel] = useState("ALL"),
    [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  const list = useQuery({
    queryKey: [
      "customer-master",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      "list",
      term,
      stage,
      onboard,
      channel,
      page,
    ],
    queryFn: () =>
      apiRequest<{ data: Customer[]; total: number; finance_visible: boolean }>(
        `/master-data/customer-workspace/list?q=${encodeURIComponent(term)}&page=${page}&relationship=${stage}&onboarding=${onboard}&channel=${channel}`,
      ),
  });
  const refs = useQuery({
    queryKey: ["master-refs", principal?.company_id, principal?.user_id, "channels"],
    queryFn: () =>
      apiRequest<{ data: { channels: Ref[] } }>("/master-data/customer-options").then((result) => ({
        data: result.data.channels,
      })),
  });
  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => (
        <Link className="customer-link" href={`${base}/${row.original.id}`}>
          {row.original.code} ↗
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
      header: "Kebijakan pembayaran",
      cell: ({ row }) =>
        list.data?.finance_visible ? (
          <CustomerBadge value={row.original.payment_policies?.[0]?.mode ?? "Belum ditetapkan"} />
        ) : (
          <span title="Memerlukan akses kebijakan pembayaran">Terbatas</span>
        ),
    },
    {
      id: "limit",
      header: "Limit kredit",
      cell: ({ row }) =>
        list.data?.finance_visible
          ? money(row.original.payment_policies?.[0]?.credit_limit)
          : "Terbatas",
    },
  ];
  return (
    <>
      {list.isError && (
        <p role="alert">
          {list.error.message}
          <Button variant="outline" onClick={() => void list.refetch()}>
            Coba lagi
          </Button>
        </p>
      )}
      <DataTable
        data={list.data?.data ?? []}
        columns={columns}
        total={list.data?.total ?? 0}
        page={page}
        onPage={setPage}
        busy={list.isFetching}
        label="pelanggan"
        toolbar={
          <>
            <Input
              aria-label="Cari kode atau nama pelanggan"
              placeholder="Cari kode atau nama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <SelectionField
              label="Status onboarding"
              hideLabel
              value={[onboard]}
              options={[
                { id: "ALL", name: "Semua status" },
                ...Object.entries(onboarding).map(([id, name]) => ({ id, name })),
              ]}
              onChange={(v) => {
                setOnboard(v[0] ?? "ALL");
                setPage(1);
              }}
            />
            <SelectionField
              label="Tahap hubungan"
              hideLabel
              value={[stage]}
              options={[
                { id: "ALL", name: "Semua tahap" },
                ...Object.entries(relationships).map(([id, name]) => ({ id, name })),
              ]}
              onChange={(v) => {
                setStage(v[0] ?? "ALL");
                setPage(1);
              }}
            />
            <SelectionField
              label="Channel"
              hideLabel
              value={[channel]}
              options={[{ id: "ALL", name: "Semua channel" }, ...(refs.data?.data ?? [])]}
              onChange={(v) => {
                setChannel(v[0] ?? "ALL");
                setPage(1);
              }}
            />
          </>
        }
      />
    </>
  );
}
function CustomerDetail({ row }: { row: Customer }) {
  const { principal } = useSession(),
    cache = useQueryClient();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const [action, setAction] = useState(""),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const history = useQuery({
    queryKey: [
      "customer-master",
      principal?.company_id,
      principal?.user_id,
      row.id,
      "history",
      row.version,
    ],
    queryFn: () =>
      apiRequest<{
        data: {
          id: string;
          occurred_at: string;
          actor_id: string;
          action: string;
          reason: string | null;
        }[];
      }>(`${base}/${row.id}/history`),
  });
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
  const policy = row.payment_policies?.[0];
  const pics = row.contacts ?? [];
  const roleSummary = (role: string) => {
    const a = pics.filter((p) => p.state !== "INACTIVE" && p.pic_functions.includes(role));
    return a.length
      ? a.map((p) => `${p.full_name} · ${p.phone ?? "HP/WA belum diisi"}`).join("; ")
      : can("crm_contact.read")
        ? "Belum diisi"
        : "Akses kontak diperlukan";
  };
  async function change() {
    setPending(true);
    setError("");
    try {
      await apiRequest(`${base}/${row.id}/${action}`, {
        method: "POST",
        version: row.version,
        body: JSON.stringify({ reason }),
      });
      await cache.invalidateQueries({
        queryKey: ["customer-master", principal?.company_id, principal?.user_id],
      });
      toast.success("Status pelanggan diperbarui");
      setAction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }
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
  return (
    <>
      <div className="customer-status">
        <strong>{row.code}</strong>
        <span>
          Tahap hubungan: <CustomerBadge value={row.relationship_stage} />
        </span>
        <span>
          Status onboarding: <CustomerBadge value={row.onboarding_state} />
        </span>
        <span>
          Kebijakan pembayaran:{" "}
          <CustomerBadge
            value={
              policy?.mode ??
              (can("customer.payment_policy.manage") ? "Belum ditetapkan" : "Terbatas")
            }
          />
        </span>
        {row.state !== "ACTIVE" && <CustomerBadge value={row.state} />}
      </div>
      <div className="customer-actions">
        {can("master_customer.update") && (
          <Button asChild>
            <Link href={`${base}/${row.id}/edit`}>Ubah</Link>
          </Button>
        )}
        {can("master_customer.activate") && row.state !== "ARCHIVED" && (
          <>
            <Button
              variant="outline"
              disabled={row.state === "INACTIVE" || pending}
              onClick={() => setAction("deactivate")}
            >
              Nonaktifkan
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setAction("archive")}>
              Arsipkan
            </Button>
          </>
        )}
      </div>
      {action && (
        <CustomerPanel
          title={action === "archive" ? "Arsipkan pelanggan" : "Nonaktifkan pelanggan"}
        >
          <p>Riwayat tetap tersimpan. Pelanggan tidak dapat dipilih untuk transaksi baru.</p>
          <Input
            aria-label="Alasan perubahan status"
            placeholder="Alasan perubahan status"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <div className="customer-actions">
            <Button disabled={pending || reason.trim().length < 3} onClick={() => void change()}>
              Konfirmasi
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setAction("")}>
              Batal
            </Button>
          </div>
        </CustomerPanel>
      )}
      <section className="customer-panel customer-overview">
        <CustomerValue label="Kode">{row.code}</CustomerValue>
        <CustomerValue label="Alamat utama">{row.primary_address}</CustomerValue>
        <CustomerValue label="Alamat pengantaran">
          {row.shipping_address ?? row.primary_address}
        </CustomerValue>
        <CustomerValue label="Channel · rayon">
          {[row.channel?.name, row.rayon?.name].filter(Boolean).join(" · ") || "Belum diisi"}
        </CustomerValue>
        <CustomerValue label="Pembelian">{roleSummary("PURCHASING")}</CustomerValue>
        <CustomerValue label="Penerimaan barang">{roleSummary("RECEIVING")}</CustomerValue>
        <CustomerValue label="Pembayaran / keuangan">{roleSummary("FINANCE")}</CustomerValue>
        <CustomerValue label="NPWP · status pajak">
          {[row.tax_identity, row.tax_status].filter(Boolean).join(" · ") || "Belum diisi"}
        </CustomerValue>
        <CustomerValue label="Penanggung jawab">
          {row.responsible_person?.name ?? "Belum diisi"}
        </CustomerValue>
        <CustomerValue label="Dokumen kedaluwarsa dalam 30 hari">{expires} dokumen</CustomerValue>
        <CustomerValue label="Termin">
          {policy
            ? policy.mode === "TEMPO"
              ? `Net ${policy.top_days ?? "—"} hari`
              : policy.mode
            : "Belum tersedia"}
        </CustomerValue>
        <CustomerValue label="Limit kredit">
          {policy ? money(policy.credit_limit) : "Belum tersedia"}
        </CustomerValue>
      </section>
      <Tabs defaultValue="contacts" className="customer-detail-tabs">
        <TabsList aria-label="Detail pelanggan">
          {[
            ["contacts", "Kontak PIC"],
            ["legal", "Legalitas"],
            ["noo", "Berkas NOO"],
            ["sales", "Riwayat Penjualan"],
            ["history", "Riwayat Perubahan"],
          ].map(([v, t]) => (
            <TabsTrigger key={v} value={v!}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="contacts">
          {can("crm_contact.read") ? (
            <DataTable data={pics} columns={contacts} total={pics.length} showColumns={false} />
          ) : (
            <p>Akses CRM diperlukan untuk melihat kontak PIC.</p>
          )}
        </TabsContent>
        <TabsContent value="legal">
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
        </TabsContent>
        <TabsContent value="noo">
          <CustomerPanel title="Berkas NOO">
            {row.noo_document ? (
              <>
                <div className="customer-form-grid">
                  <CustomerValue label="Nama">{row.noo_document.name}</CustomerValue>
                  <CustomerValue label="Tanggal">{row.noo_document.date}</CustomerValue>
                  <CustomerValue label="Versi">{row.noo_document.version}</CustomerValue>
                  <CustomerValue label="Catatan">{row.noo_document.notes}</CustomerValue>
                </div>
                {row.noo_document.evidence_id && <Evidence id={row.noo_document.evidence_id} />}
              </>
            ) : (
              <p>Belum ada berkas NOO.</p>
            )}
          </CustomerPanel>
        </TabsContent>
        <TabsContent value="sales">
          {sales.isPending ? (
            <p role="status">Memuat penjualan...</p>
          ) : sales.isError ? (
            <p role="alert">{sales.error.message}</p>
          ) : (
            <>
              {sales.data?.data.orders && (
                <SalesTable title="Sales Order" rows={sales.data.data.orders} type="orders" />
              )}
              {sales.data?.data.invoices && (
                <SalesTable title="Invoice" rows={sales.data.data.invoices} type="invoices" />
              )}
              {!sales.data?.data.orders && !sales.data?.data.invoices && (
                <p>Izin Sales Order atau Invoice diperlukan.</p>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="history">
          {history.isError ? (
            <p role="alert">{history.error.message}</p>
          ) : (
            <DataTable
              busy={history.isPending}
              data={history.data?.data ?? []}
              total={history.data?.data.length ?? 0}
              showColumns={false}
              columns={[
                {
                  id: "date",
                  header: "Waktu",
                  cell: ({ row: r }) => new Date(r.original.occurred_at).toLocaleString("id-ID"),
                },
                { accessorKey: "action", header: "Perubahan" },
                { accessorKey: "actor_id", header: "Pengguna" },
                { accessorKey: "reason", header: "Alasan" },
              ]}
            />
          )}
        </TabsContent>
      </Tabs>
    </>
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
    <CustomerPanel title={title}>
      <DataTable
        data={rows}
        total={rows.length}
        showColumns={false}
        columns={[
          {
            id: "number",
            header: "Nomor",
            cell: ({ row }) => (
              <Link className="customer-link" href={`/operations/${type}/${row.original.id}`}>
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
      <p className="customer-note">Maksimal 100 dokumen terbaru sesuai izin.</p>
    </CustomerPanel>
  );
}
