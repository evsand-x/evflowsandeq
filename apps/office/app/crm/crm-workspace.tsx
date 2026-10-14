"use client";
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  AuthPrincipal,
  CrmContact,
  CrmCustomer,
  CrmPage,
  CrmProspect,
  CrmOpportunity,
  CrmSummary,
} from "@evflow/contracts";
import {
  Search,
  Plus,
  ArrowLeft,
  RefreshCw,
  Building2,
  Users,
  CalendarClock,
  ArrowUpRight,
  X,
} from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { apiRequest } from "@/lib/api";
import { useSession } from "../session-provider";
import { DashboardSidebar } from "../dashboard-sidebar";
import { ExecutiveTopbar } from "../dashboard-executive";
import { Choice, DataTable, Notice } from "./crm-common";
import { CrmForm, OpportunityForm } from "./crm-forms";
import {
  contacts,
  customers,
  prospects,
  previewPrincipal,
  statusLabels,
  functionLabels,
} from "./crm-fixtures";
import "./crm.css";
import "./crm-modern.css";

type Row = CrmProspect | CrmContact | CrmCustomer;
type Detail = CrmProspect & CrmContact & CrmCustomer & { contacts?: CrmContact[] };
function allowed(principal: AuthPrincipal, code: string) {
  return principal.permissions.some(
    (p) =>
      p.code === code &&
      ["company", "privileged"].includes(p.scope_type) &&
      (!p.scope_id || p.scope_id === principal.company_id),
  );
}
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Makassar",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "Belum dijadwalkan";
}
function StateBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={`crm-status crm-status-${value.toLowerCase()}`}>
      {statusLabels[value] ?? value}
    </Badge>
  );
}
function RecordIdentity({
  name,
  code,
  person = false,
}: {
  name: string;
  code: string;
  person?: boolean;
}) {
  return (
    <span className="crm-identity">
      <span className={`crm-identity-icon ${person ? "is-person" : ""}`} aria-hidden="true">
        {person ? (
          name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((v) => v[0])
            .join("")
        ) : (
          <Building2 />
        )}
      </span>
      <span>
        <strong>{name}</strong>
        <small>{code}</small>
      </span>
      <ArrowUpRight className="crm-row-arrow" aria-hidden="true" />
    </span>
  );
}
function FollowUpDate({ value }: { value: string | null }) {
  const overdue = !!value && new Date(value).getTime() < Date.now();
  return (
    <small className={`crm-next-date ${overdue ? "crm-next-overdue" : ""}`}>
      <CalendarClock aria-hidden="true" />
      {date(value)}
      {overdue && <span>Terlewat</span>}
    </small>
  );
}
function Missing({ title, reason }: { title: string; reason: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{reason}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function CrmWorkspace(props: { path: string[]; preview?: boolean }) {
  return (
    <Suspense fallback={<main role="status">Menyiapkan CRM…</main>}>
      <Workspace key={props.path.join("/")} {...props} />
    </Suspense>
  );
}
function Workspace({ path, preview = false }: { path: string[]; preview?: boolean }) {
  const session = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const principal = preview ? previewPrincipal : session.principal;
  const resource = path[0] ?? "prospects";
  const isCustomer = resource === "customers";
  const isContact = resource === "contacts";
  const label = isCustomer ? "Pelanggan" : isContact ? "Kontak" : "Prospek";
  const base = preview
    ? `/preview/crm/${resource}`
    : isCustomer
      ? "/master-data/customers"
      : `/crm/${resource}`;
  const id = path[1] && path[1] !== "new" ? path[1] : undefined;
  const form =
    path.includes("new") ||
    path.includes("edit") ||
    path.includes("status") ||
    path.includes("win") ||
    path.includes("needs");
  const opportunity = path.includes("opportunities") || path.includes("win");
  const state = preview ? params.get("state") : null;
  const outcomeLost = params.get("outcome") === "lost";
  const permitted =
    !!principal &&
    allowed(principal, isCustomer ? "master_data.read" : "crm.read") &&
    state !== "denied";
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(isContact ? "ACTIVE" : "all");
  const [sort, setSort] = useState("updated");
  const [needSearch, setNeedSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!preview && session.state === "anonymous") router.replace("/login?session=ended");
  }, [preview, router, session.state]);
  const endpoint = isCustomer ? "/crm/master/customers" : `/crm/workspace/${resource}`;
  const listQuery = useQuery<CrmPage<Row>>({
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === principal?.company_id &&
      previousQuery?.queryKey[2] === principal?.user_id &&
      previousQuery?.queryKey[3] === resource
        ? previous
        : undefined,
    queryKey: [
      "crm",
      principal?.company_id,
      principal?.user_id,
      resource,
      { query, status, sort, page },
    ],
    enabled: !preview && permitted && !id && !form,
    queryFn: ({ signal }) =>
      apiRequest<CrmPage<Row>>(
        `${endpoint}?q=${encodeURIComponent(query)}&status=${status}&sort=${sort}&page=${page}`,
        { signal },
      ),
  });
  const detailQuery = useQuery({
    queryKey: ["crm", principal?.company_id, principal?.user_id, resource, id],
    enabled: !preview && permitted && !!id,
    queryFn: ({ signal }) => apiRequest<{ data: Detail }>(`${endpoint}/${id}`, { signal }),
  });
  const summaryQuery = useQuery({
    queryKey: ["crm", principal?.company_id, principal?.user_id, "summary"],
    enabled: !preview && permitted && resource === "prospects" && !id && !form,
    queryFn: ({ signal }) => apiRequest<{ data: CrmSummary }>("/crm/workspace/summary", { signal }),
  });
  const simulated = isCustomer ? customers : isContact ? contacts : prospects;
  const previewRows = simulated
    .filter((row) => {
      const title =
        "full_name" in row ? row.full_name : "customer" in row ? row.customer.name : row.name;
      return (
        `${title} ${row.code}`.toLowerCase().includes(query.toLowerCase()) &&
        (status === "all" ||
          ("approach_status" in row ? row.approach_status : row.state) === status)
      );
    })
    .sort((a, b) =>
      sort === "name"
        ? ("full_name" in a
            ? a.full_name
            : "customer" in a
              ? a.customer.name
              : a.name
          ).localeCompare(
            "full_name" in b ? b.full_name : "customer" in b ? b.customer.name : b.name,
          )
        : 0,
    );
  const rows = preview ? (state === "empty" ? [] : previewRows) : (listQuery.data?.data ?? []);
  const sample = simulated.find((row) => row.id === id);
  const detail = preview
    ? sample
      ? ({
          ...sample,
          contacts: contacts.filter(
            (c) =>
              c.customer.id === (isCustomer ? id : "customer" in sample ? sample.customer.id : ""),
          ),
        } as Detail)
      : undefined
    : detailQuery.data?.data;
  const failed =
    state === "error" || (!preview && (id ? detailQuery.isError : !form && listQuery.isError));
  const loading =
    state === "loading" ||
    (!preview && (id ? detailQuery.isLoading : !form && listQuery.isLoading));
  const total = preview ? rows.length : (listQuery.data?.total ?? 0);
  const customerHref = (customerId?: string) =>
    `${preview ? "/preview/crm/customers" : "/master-data/customers"}${customerId ? `/${customerId}` : ""}`;
  const contactColumns = useMemo<ColumnDef<CrmContact>[]>(
    () => [
      {
        id: "name",
        header: "Nama / kode",
        cell: ({ row }) => (
          <Link
            className="crm-record-link"
            href={`${preview ? "/preview/crm" : "/crm"}/contacts/${row.original.id}`}
          >
            <RecordIdentity name={row.original.full_name} code={row.original.code} person />
          </Link>
        ),
      },
      { id: "customer", header: "Institusi", cell: ({ row }) => row.original.customer.name },
      {
        id: "job",
        header: "Jabatan / unit",
        cell: ({ row }) => (
          <>
            {row.original.job_title ?? "—"}
            <small>{row.original.department ?? "—"}</small>
          </>
        ),
      },
      {
        id: "function",
        header: "Fungsi PIC",
        cell: ({ row }) => (
          <span className="crm-role-chips">
            {row.original.pic_functions.length ? (
              row.original.pic_functions.map((v) => <span key={v}>{functionLabels[v] ?? v}</span>)
            ) : (
              <span>Belum ditentukan</span>
            )}
          </span>
        ),
      },
      {
        id: "phone",
        header: "HP / email",
        cell: ({ row }) => (
          <>
            {row.original.phone ?? "—"}
            <small>{row.original.email ?? "—"}</small>
          </>
        ),
      },
    ],
    [preview],
  );
  const columns: ColumnDef<Row>[] = isContact
    ? (contactColumns as ColumnDef<Row>[])
    : isCustomer
      ? [
          {
            id: "name",
            header: "Nama / kode",
            cell: ({ row }) => (
              <Link className="crm-record-link" href={`${base}/${row.original.id}`}>
                <strong>{(row.original as CrmCustomer).name}</strong>
                <small>{row.original.code}</small>
              </Link>
            ),
          },
          {
            id: "channel",
            header: "Channel / rayon",
            cell: ({ row }) => (
              <>
                {(row.original as CrmCustomer).channel?.name ?? "—"}
                <small>{(row.original as CrmCustomer).rayon?.name ?? "—"}</small>
              </>
            ),
          },
          {
            id: "stage",
            header: "Tahap hubungan",
            cell: ({ row }) => (
              <StateBadge value={(row.original as CrmCustomer).relationship_stage} />
            ),
          },
          {
            id: "state",
            header: "Status",
            cell: ({ row }) => <StateBadge value={(row.original as CrmCustomer).state} />,
          },
        ]
      : [
          {
            id: "name",
            header: "Institusi / kode",
            cell: ({ row }) => (
              <Link className="crm-record-link" href={`${base}/${row.original.id}`}>
                <RecordIdentity
                  name={(row.original as CrmProspect).customer.name}
                  code={row.original.code}
                />
              </Link>
            ),
          },
          {
            id: "channel",
            header: "Channel / rayon",
            cell: ({ row }) => (
              <>
                {(row.original as CrmProspect).customer.channel?.name ?? "—"}
                <small>{(row.original as CrmProspect).customer.rayon?.name ?? "—"}</small>
              </>
            ),
          },
          {
            id: "owner",
            header: "Penanggung jawab",
            cell: ({ row }) => (
              <span className="crm-owner">
                <span aria-hidden="true">
                  {(row.original as CrmProspect).owner_name.slice(0, 1)}
                </span>
                {(row.original as CrmProspect).owner_name}
              </span>
            ),
          },
          {
            id: "status",
            header: "Status pendekatan",
            cell: ({ row }) => <StateBadge value={(row.original as CrmProspect).approach_status} />,
          },
          {
            id: "next",
            header: "Tindak lanjut",
            cell: ({ row }) => (
              <>
                {(row.original as CrmProspect).next_action ?? "Belum ditentukan"}
                <FollowUpDate value={(row.original as CrmProspect).next_action_at} />
              </>
            ),
          },
        ];
  const customerColumns: ColumnDef<CrmCustomer>[] = [
    {
      id: "name",
      header: "Kode / Nama",
      cell: ({ row }) => (
        <Link className="crm-record-link" href={`${base}/${row.original.id}`}>
          <strong>
            {row.original.code} · {row.original.name}
          </strong>
        </Link>
      ),
    },
    {
      id: "channel",
      header: "Channel · Rayon",
      cell: ({ row }) => (
        <>
          {row.original.channel?.name ?? "—"} · {row.original.rayon?.name ?? "—"}
        </>
      ),
    },
    {
      id: "stage",
      header: "Tahap hubungan",
      cell: ({ row }) => <StateBadge value={row.original.relationship_stage} />,
    },
    {
      id: "onboarding",
      header: "Onboarding",
      cell: ({ row }) => (
        <StateBadge
          value={row.original.onboarding_state ?? (preview ? "DRAFT" : "Belum tersedia")}
        />
      ),
    },
    { id: "state", header: "Status", cell: ({ row }) => <StateBadge value={row.original.state} /> },
  ];
  if (!preview && session.state === "error")
    return (
      <main className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Sesi gagal dimuat.<Button onClick={() => void session.reload()}>Coba lagi</Button>
          </AlertDescription>
        </Alert>
      </main>
    );
  if (!principal)
    return (
      <main role="status" className="p-6">
        Menyiapkan akses CRM…
      </main>
    );
  const title = form
    ? opportunity
      ? path.includes("win")
        ? outcomeLost
          ? "Catat Lost / Lanjutkan Sisa"
          : "Catat Win Parsial"
        : "Buat / Revisi Peluang"
      : path.includes("status")
        ? "Ubah Status Pendekatan"
        : path.includes("needs")
          ? "Tambah Produk / Kebutuhan"
          : `${id ? "Detail" : "Tambah"} ${label}`
    : id && detail
      ? isContact
        ? detail.full_name
        : isCustomer
          ? detail.name
          : opportunity
            ? `Peluang · ${detail.customer.name}`
            : detail.customer.name
      : label;
  const formBack = id ? `${base}/${id}` : base;
  const requiredPermission = path.includes("status") ? "crm.update" : "crm.create";
  const invalidRoute =
    !["prospects", "contacts", "customers"].includes(resource) ||
    (id && !detail && !loading && !failed);
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <a className="sr-only focus:not-sr-only" href="#crm-main">
        Lewati navigasi
      </a>
      <DashboardSidebar
        principal={principal}
        activeView="executive"
        activeSection={isCustomer ? "master" : "sales"}
        preview={preview}
      />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} preview={preview} />
        <main
          id="crm-main"
          className={`executive-content crm-content ${isCustomer ? "" : "crm-saas"}`}
        >
          <header className="executive-heading">
            <div>
              <nav className="executive-breadcrumb" aria-label="Breadcrumb">
                {isCustomer ? "Master Data" : "Sales & Marketing / CRM"} /{" "}
                <Link href={base}>{label}</Link>
                {id ? ` / ${detail?.code ?? "Detail"}` : ""}
                {form && opportunity
                  ? ` / ${path.includes("win") ? (outcomeLost ? "Hasil" : "Win") : "Peluang baru"}`
                  : ""}
              </nav>
              <h1>{title}</h1>
            </div>
            <div className="crm-actions">
              {(id || form) && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={form ? formBack : base}>
                    <ArrowLeft aria-hidden="true" />
                    Kembali
                  </Link>
                </Button>
              )}
              {!id &&
                !form &&
                (isCustomer
                  ? allowed(principal, "master_data.read")
                  : allowed(principal, "crm.create")) && (
                  <Button asChild>
                    <Link href={`${base}/new`}>
                      <Plus aria-hidden="true" />
                      Tambah {label}
                    </Link>
                  </Button>
                )}
              {form && (
                <Badge variant="outline" className="web-draft-badge">
                  Belum disimpan
                </Badge>
              )}
              {id && !form && !isContact && !isCustomer && (
                <Button disabled title="Layanan penawaran belum tersedia">
                  Buat Penawaran
                </Button>
              )}
            </div>
          </header>
          {!isCustomer && !id && !form && (
            <nav className="crm-section-nav" aria-label="Bagian CRM">
              <Link
                href={preview ? "/preview/crm/prospects" : "/crm/prospects"}
                aria-current={!isContact ? "page" : undefined}
              >
                <Building2 aria-hidden="true" />
                Prospek
              </Link>
              <Link
                href={preview ? "/preview/crm/contacts" : "/crm/contacts"}
                aria-current={isContact ? "page" : undefined}
              >
                <Users aria-hidden="true" />
                Kontak
              </Link>
              <span>Hubungan pelanggan, dalam satu tempat</span>
            </nav>
          )}
          {!permitted ? (
            <Alert variant="destructive">
              <AlertDescription>
                Anda tidak memiliki izin {isCustomer ? "Master Pelanggan" : "CRM"}. Hubungi
                administrator untuk akses.
              </AlertDescription>
            </Alert>
          ) : invalidRoute ? (
            <Missing
              title="Halaman tidak ditemukan"
              reason="Data mungkin tidak tersedia dalam cakupan perusahaan Anda."
            />
          ) : failed ? (
            <Alert variant="destructive">
              <AlertDescription>
                Data CRM gagal dimuat.{" "}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (preview) router.replace(`${base}${id ? `/${id}` : ""}`);
                    else void (id ? detailQuery.refetch() : listQuery.refetch());
                  }}
                >
                  Coba lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading ? (
            <div role="status" aria-label="Memuat CRM" className="crm-loading">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : form ? (
            opportunity ? (
              <OpportunityForm
                win={path.includes("win")}
                back={formBack}
                principal={principal}
                prospect={detail}
                preview={preview}
              />
            ) : isCustomer ? (
              <Notice>Form kelengkapan Master Pelanggan belum tersedia.</Notice>
            ) : !allowed(principal, requiredPermission) && !isContact ? (
              <Notice>Anda tidak memiliki izin untuk tindakan ini.</Notice>
            ) : (
              <CrmForm
                key={path.join("/")}
                kind={
                  isContact
                    ? "contact"
                    : path.includes("status")
                      ? "status"
                      : path.includes("needs")
                        ? "need"
                        : "prospect"
                }
                principal={principal}
                preview={preview}
                back={formBack}
                prospect={detail}
                contact={isContact ? detail : undefined}
              />
            )
          ) : id && detail ? (
            isContact ? (
              <>
                <div className="crm-meta">
                  <StateBadge value={detail.state} />
                  <span>{detail.customer.name}</span>
                </div>
                <CrmForm
                  key={id}
                  kind="contact"
                  principal={principal}
                  preview={preview}
                  back={base}
                  contact={detail}
                />
              </>
            ) : isCustomer ? (
              <>
                <div className="crm-meta">
                  <StateBadge value={detail.relationship_stage} />
                  <StateBadge value={detail.state} />
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Profil pelanggan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="crm-profile-grid">
                      <InfoPair label="Nama institusi" value={detail.name} />
                      <InfoPair
                        label="Alamat utama"
                        value={detail.primary_address ?? "Belum dilengkapi"}
                      />
                      <InfoPair
                        label="Saluran"
                        value={detail.channel?.name ?? "Belum dilengkapi"}
                      />
                      <InfoPair label="Rayon" value={detail.rayon?.name ?? "Belum dilengkapi"} />
                    </div>
                  </CardContent>
                </Card>
                <Tabs defaultValue="contacts">
                  <TabsList>
                    <TabsTrigger value="contacts">Kontak PIC</TabsTrigger>
                    <TabsTrigger value="sales">Riwayat penjualan</TabsTrigger>
                  </TabsList>
                  <TabsContent value="contacts">
                    {allowed(principal, "crm.read") ? (
                      <DataTable
                        data={detail.contacts ?? []}
                        columns={contactColumns}
                        total={detail.contacts?.length ?? 0}
                        label="kontak"
                      />
                    ) : (
                      <Notice>Kontak PIC memerlukan izin CRM.</Notice>
                    )}
                  </TabsContent>
                  <TabsContent value="sales">
                    <Missing
                      title="Riwayat penjualan belum tersedia"
                      reason="Sumber invoice diposting belum tersedia. Registrasi institusi bukan realisasi penjualan."
                    />
                  </TabsContent>
                </Tabs>
                <Notice>
                  Kelengkapan legalitas, kredit, saldo, dan dokumen pelanggan mengikuti modul Master
                  Data serta izin domain terkait.
                </Notice>
              </>
            ) : (
              <>
                <div className="crm-meta">
                  <span>
                    {detail.code} · Penanggung jawab {detail.owner_name} ·{" "}
                    {detail.customer.channel?.name ?? "—"} / {detail.customer.rayon?.name ?? "—"}
                  </span>
                </div>
                <div className="crm-detail-actions">
                  <div className="crm-actions">
                    <StateBadge value={detail.customer.relationship_stage} />
                    <StateBadge value={detail.approach_status} />
                    {allowed(principal, "crm.update") && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`${base}/${id}/status`}>Ubah Status</Link>
                      </Button>
                    )}
                  </div>
                  <div className="crm-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="Layanan kunjungan belum tersedia"
                    >
                      Jadwalkan Kunjungan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="Layanan follow-up belum tersedia"
                    >
                      Catat Follow-up
                    </Button>
                    {allowed(principal, "master_data.read") && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={customerHref(detail.customer.id)}>Lengkapi Data Pelanggan</Link>
                      </Button>
                    )}
                  </div>
                </div>
                <section
                  className="crm-profile-grid crm-profile-panel"
                  aria-label="Ringkasan prospek"
                >
                  <InfoPair
                    label="Kontak institusi"
                    value={
                      detail.contacts?.[0]
                        ? `${detail.contacts[0].full_name} · ${detail.contacts[0].job_title ?? ""}`
                        : "Belum ada kontak"
                    }
                  />
                  <InfoPair
                    label="Alamat"
                    value={detail.customer.primary_address ?? "Belum dilengkapi"}
                  />
                  <InfoPair label="Sumber prospek" value={detail.source ?? "Belum tersedia"} />
                  <InfoPair
                    label="Tindak lanjut berikutnya"
                    value={`${detail.next_action ?? "Belum ditentukan"} · ${date(detail.next_action_at)}`}
                  />
                </section>
                <Tabs
                  defaultValue={opportunity ? "opportunities" : "needs"}
                  className="crm-detail-tabs"
                >
                  <TabsList>
                    <TabsTrigger value="needs">Kebutuhan Produk</TabsTrigger>
                    <TabsTrigger value="opportunities">Peluang & Pipeline</TabsTrigger>
                    <TabsTrigger value="contacts">Kontak</TabsTrigger>
                    <TabsTrigger value="history">Riwayat Aktivitas</TabsTrigger>
                  </TabsList>
                  <TabsContent value="needs">
                    <DataTable
                      data={detail.needs.filter((n) =>
                        `${n.product?.name ?? ""} ${n.description ?? ""} ${n.notes ?? ""}`
                          .toLowerCase()
                          .includes(needSearch.toLowerCase()),
                      )}
                      total={
                        detail.needs.filter((n) =>
                          `${n.product?.name ?? ""} ${n.description ?? ""} ${n.notes ?? ""}`
                            .toLowerCase()
                            .includes(needSearch.toLowerCase()),
                        ).length
                      }
                      label="kebutuhan"
                      columns={[
                        {
                          id: "product",
                          header: "Produk / kebutuhan",
                          cell: ({ row }) => row.original.product?.name ?? row.original.description,
                        },
                        {
                          id: "qty",
                          header: "Est. jumlah",
                          cell: ({ row }) => row.original.estimated_qty ?? "Belum diketahui",
                        },
                        {
                          id: "uom",
                          header: "Satuan",
                          cell: ({ row }) => row.original.uom?.name ?? "—",
                        },
                        {
                          id: "time",
                          header: "Waktu kebutuhan",
                          cell: ({ row }) =>
                            row.original.needed_period ??
                            row.original.needed_on?.slice(0, 10) ??
                            "Belum diketahui",
                        },
                        {
                          id: "notes",
                          header: "Catatan",
                          cell: ({ row }) => row.original.notes ?? "—",
                        },
                      ]}
                      toolbar={
                        <>
                          <InputGroup>
                            <InputGroupAddon>
                              <Search aria-hidden="true" />
                            </InputGroupAddon>
                            <InputGroupInput
                              aria-label="Cari kebutuhan"
                              placeholder="Cari produk atau kebutuhan…"
                              value={needSearch}
                              onChange={(e) => setNeedSearch(e.target.value)}
                            />
                          </InputGroup>
                        </>
                      }
                      {...(preview
                        ? {
                            footerLabel: `${detail.needs.length} kebutuhan · Belum mereservasi stok`,
                          }
                        : {})}
                    />
                    <div className="crm-actions crm-below-table">
                      {allowed(principal, "crm.create") && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`${base}/${id}/needs/new`}>Tambah Produk / Kebutuhan</Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`${base}/${id}/opportunities/new`}>
                              Buat Peluang Penjualan
                            </Link>
                          </Button>
                        </>
                      )}
                    </div>
                    <Notice>
                      Kebutuhan produk tidak mereservasi stok atau membuat permintaan pengadaan.
                    </Notice>
                  </TabsContent>
                  <TabsContent value="opportunities">
                    <Pipeline
                      preview={preview}
                      principal={principal}
                      prospectId={id!}
                      base={`${base}/${id}`}
                      canCreate={allowed(principal, "crm.create")}
                    />
                  </TabsContent>
                  <TabsContent value="contacts">
                    <DataTable
                      data={detail.contacts ?? []}
                      columns={contactColumns}
                      total={detail.contacts?.length ?? 0}
                      label="kontak"
                    />
                    {allowed(principal, "crm.create") && (
                      <Button className="crm-below-table" variant="outline" size="sm" asChild>
                        <Link
                          href={`${preview ? "/preview/crm" : "/crm"}/contacts/new?customer=${detail.customer.id}`}
                        >
                          Tambah Kontak
                        </Link>
                      </Button>
                    )}
                  </TabsContent>
                  <TabsContent value="history">
                    {preview ? (
                      <DataTable
                        data={[
                          {
                            time: "28 Sep · 10.00",
                            kind: "Kunjungan",
                            actor: "Rina Lestari",
                            summary: "Bertemu dr. Maya dan Andi Saputra",
                            next: "Kirim lembar produk · 29 Sep",
                          },
                          {
                            time: "27 Sep · 14.10",
                            kind: "Tanggapan penawaran",
                            actor: "Rina Lestari",
                            summary: "Penawaran laboratorium dicatat",
                            next: "Tunggu tanggapan pelanggan",
                          },
                          {
                            time: "25 Sep · 09.30",
                            kind: "Kebutuhan produk",
                            actor: "Rina Lestari",
                            summary: "Reagen hematologi dan tabung EDTA",
                            next: "Buat peluang OPP/0042",
                          },
                          {
                            time: "23 Sep · 16.00",
                            kind: "Follow-up",
                            actor: "Rina Lestari",
                            summary: "Jadwal presentasi disepakati",
                            next: "Selesaikan presentasi",
                          },
                        ]}
                        total={4}
                        label="aktivitas simulasi"
                        columns={[
                          { accessorKey: "time", header: "Waktu (WITA)" },
                          { accessorKey: "kind", header: "Jenis" },
                          { accessorKey: "actor", header: "Pelaku" },
                          { accessorKey: "summary", header: "Ringkasan" },
                          { accessorKey: "next", header: "Tindak lanjut" },
                        ]}
                      />
                    ) : (
                      <Missing
                        title="Riwayat aktivitas terpadu belum tersedia"
                        reason="Kunjungan, komunikasi, penawaran dan tindak lanjut akan dirangkai dari transaksi sumber. Audit perubahan status tetap dicatat oleh server."
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )
          ) : (
            <>
              <p className="crm-subtitle">
                {isContact
                  ? "Database PIC terhubung ke identitas Master Pelanggan."
                  : isCustomer
                    ? "Identitas institusi tetap sama dari prospek hingga pelanggan bertransaksi."
                    : "Institusi dan kontak tetap terhubung saat menjadi pelanggan."}
              </p>
              {!isContact && !isCustomer && (
                <div className="crm-kpis">
                  {[
                    [
                      "Prospek aktif",
                      preview ? 24 : summaryQuery.data?.data.active,
                      "Dalam cakupan Anda",
                    ],
                    [
                      "Perlu tindak lanjut",
                      preview ? 8 : summaryQuery.data?.data.follow_up,
                      "Hari ini dan terlambat",
                    ],
                    [
                      "Peluang bulan ini",
                      preview ? 12 : null,
                      preview ? "September 2026" : "Sumber belum tersedia",
                    ],
                    [
                      "Penawaran berjalan",
                      preview ? 6 : null,
                      preview ? "Masih berlaku" : "Sumber belum tersedia",
                    ],
                  ].map(([name, value, note]) => (
                    <Card key={String(name)} className="executive-card executive-kpi">
                      <CardHeader className="executive-card-header">
                        <CardTitle>{name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <strong
                          className={
                            value == null ? "executive-unavailable-value" : "executive-value"
                          }
                        >
                          {summaryQuery.isLoading && !preview
                            ? "Memuat…"
                            : (value ?? "Belum tersedia")}
                        </strong>
                        <p className="executive-muted">{note}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {isCustomer && (
                <div className="crm-kpis">
                  {[
                    ["Pelanggan aktif", 84],
                    ["Belum verifikasi onboarding", 12],
                    ["Prospek", 19],
                  ].map(([name, value]) => (
                    <Card key={String(name)} className="executive-card executive-kpi">
                      <CardHeader className="executive-card-header">
                        <CardTitle>{name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <strong className="executive-value">
                          {preview ? value : "Belum tersedia"}
                        </strong>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {summaryQuery.isError && (
                <Notice>
                  Ringkasan gagal dimuat.{" "}
                  <Button variant="outline" size="sm" onClick={() => void summaryQuery.refetch()}>
                    Coba lagi
                  </Button>
                </Notice>
              )}
              {!isCustomer && (
                <div className="crm-list-heading">
                  <div>
                    <h2>
                      {isContact ? "Direktori kontak" : "Daftar prospek"}
                      <span>{total}</span>
                    </h2>
                    <p>
                      {isContact
                        ? "Temukan PIC dan perannya di setiap institusi."
                        : "Pantau pendekatan dan rencana tindak lanjut setiap institusi."}
                    </p>
                  </div>
                  <span className="crm-list-hint">
                    {listQuery.isFetching ? "Memperbarui…" : "Data dalam cakupan akses Anda"}
                  </span>
                </div>
              )}
              <DataTable
                data={rows}
                columns={isCustomer ? (customerColumns as ColumnDef<Row>[]) : columns}
                total={total}
                page={page}
                onPage={setPage}
                busy={listQuery.isFetching}
                label={label.toLowerCase()}
                densityControl={!isCustomer}
                {...(preview
                  ? { footerLabel: `${rows.length} data ditampilkan · Data simulasi` }
                  : {})}
                toolbar={
                  <>
                    <InputGroup>
                      <InputGroupAddon>
                        <Search aria-hidden="true" />
                      </InputGroupAddon>
                      <InputGroupInput
                        aria-label={isCustomer ? "Cari kode / nama" : `Cari ${label.toLowerCase()}`}
                        placeholder={
                          isCustomer
                            ? "Cari kode / nama"
                            : isContact
                              ? "Cari nama, institusi, atau kode kontak…"
                              : "Cari institusi atau kode prospek…"
                        }
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </InputGroup>
                    <div className="crm-toolbar-filters">
                      {!isCustomer && (
                        <Choice
                          label="Urutkan CRM"
                          value={sort}
                          onChange={(v) => {
                            setSort(v);
                            setPage(1);
                          }}
                          options={{ updated: "Terakhir diperbarui", name: "Nama A–Z" }}
                        />
                      )}
                      <Choice
                        label={isContact ? "Filter kontak" : "Filter status"}
                        value={status}
                        onChange={(v) => {
                          setStatus(v);
                          setPage(1);
                        }}
                        options={{
                          all: isContact
                            ? "Semua kontak"
                            : isCustomer
                              ? "Status · Kategori · Scope"
                              : "Semua status",
                          ...Object.fromEntries(
                            (isContact
                              ? ["ACTIVE", "INACTIVE"]
                              : isCustomer
                                ? ["DRAFT", "ACTIVE", "INACTIVE"]
                                : ["NEW", "IN_PROGRESS", "POTENTIAL", "DEFERRED", "DROPPED"]
                            ).map((s) => [
                              s,
                              isContact && s === "ACTIVE" ? "Kontak aktif" : statusLabels[s]!,
                            ]),
                          ),
                        }}
                      />
                      {(search || status !== (isContact ? "ACTIVE" : "all")) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setQuery("");
                            setStatus(isContact ? "ACTIVE" : "all");
                            setPage(1);
                          }}
                        >
                          <X aria-hidden="true" />
                          Reset
                        </Button>
                      )}
                      {!preview && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Muat ulang CRM"
                          onClick={() => void listQuery.refetch()}
                        >
                          <RefreshCw aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </>
                }
              />
              {!isContact && !isCustomer && (
                <div className="crm-master-callout">
                  <div>
                    <strong>Identitas pelanggan</strong>
                    <span>Cari institusi yang sudah terdaftar sebelum menambah prospek baru.</span>
                  </div>
                  {allowed(principal, "master_data.read") ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={customerHref()}>Buka Master Pelanggan ↗</Link>
                    </Button>
                  ) : (
                    <span className="crm-muted">Memerlukan izin Master Pelanggan</span>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Pipeline({
  principal,
  prospectId,
  preview,
  base,
  canCreate,
}: {
  principal: AuthPrincipal;
  prospectId: string;
  preview: boolean;
  base: string;
  canCreate: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [period, setPeriod] = useState("all");
  const [search, setSearch] = useState("");
  const drafts = useQuery({
    queryKey: ["crm", principal.company_id, principal.user_id, "opportunities", prospectId],
    enabled: !preview,
    queryFn: ({ signal }) =>
      apiRequest<{ data: CrmOpportunity[] }>(`/crm/prospects/${prospectId}/opportunities`, {
        signal,
      }),
  });
  const rows = preview
    ? [
        {
          id: "opp-42",
          code: "OPP/0042",
          period: "2026-09",
          title: "Kebutuhan laboratorium",
          state: "Aktif",
          result: "Terbuka",
          value: "Rp24.200.000",
          action: "Konfirmasi harga · 29 Sep",
          lines: [
            {
              id: "line-1",
              product: "Reagen hematologi · 12 kit",
              stage: "Penawaran · 40%",
              balance: "0 / 12 kit",
              action: "Presentasi produk · Rina · 29 Sep",
            },
            {
              id: "line-2",
              product: "Tabung EDTA · 20 box",
              stage: "Negosiasi · 60%",
              balance: "0 / 20 box",
              action: "Konfirmasi harga · Rina · 29 Sep",
            },
          ],
        },
        {
          id: "opp-48",
          code: "OPP/0048",
          period: "2026-09",
          title: "Peralatan pemeriksaan",
          state: "Ditunda",
          result: "Terbuka",
          value: "Belum diketahui",
          action: "Tinjau anggaran · 30 Sep",
          lines: [],
        },
      ]
    : (drafts.data?.data ?? []).map((d) => ({
        id: d.id,
        code: d.code,
        period: d.period,
        title: d.notes ?? "Peluang draft",
        state: statusLabels[d.state] ?? d.state,
        result: "Belum aktif",
        value: "Belum tersedia",
        action: "Belum dijadwalkan",
        lines: d.lines.map((line) => ({
          id: line.id,
          product: [line.product?.name ?? line.description, line.estimated_qty, line.uom?.name]
            .filter(Boolean)
            .join(" · "),
          stage: "Draft",
          balance: "Belum aktif",
          action: line.notes ?? "Belum dijadwalkan",
        })),
      }));
  const visible = rows.filter(
    (r) =>
      (period === "all" || r.period === period) &&
      `${r.code} ${r.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  const current = visible.find((r) => r.id === selected) ?? visible[0];
  return (
    <div className="crm-pipeline">
      <div className="crm-detail-actions">
        <div className="crm-actions">
          <Choice
            label="Periode peluang"
            value={period}
            onChange={setPeriod}
            options={{
              all: "Semua periode",
              ...Object.fromEntries(rows.map((r) => [r.period, r.period])),
            }}
          />
        </div>
        {canCreate && (
          <Button asChild>
            <Link href={`${base}/opportunities/new`}>Buat Peluang Penjualan</Link>
          </Button>
        )}
      </div>
      {drafts.isLoading && !preview ? (
        <p role="status">Memuat peluang…</p>
      ) : drafts.isError && !preview ? (
        <Notice>
          Peluang gagal dimuat.{" "}
          <Button variant="outline" onClick={() => void drafts.refetch()}>
            Coba lagi
          </Button>
        </Notice>
      ) : (
        <>
          <DataTable
            data={visible}
            total={visible.length}
            label="peluang"
            toolbar={
              <>
                <h2 className="crm-table-title">Peluang prospek</h2>
                <InputGroup>
                  <InputGroupAddon>
                    <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label="Cari peluang"
                    placeholder="Cari…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </InputGroup>
              </>
            }
            columns={[
              {
                id: "code",
                header: "Peluang / periode",
                cell: ({ row }) => (
                  <button
                    className="crm-record-link crm-opportunity-link"
                    aria-pressed={current?.id === row.original.id}
                    onClick={() => setSelected(row.original.id)}
                  >
                    <strong>{row.original.title}</strong>
                    <small>
                      {row.original.code} · {row.original.period}
                    </small>
                  </button>
                ),
              },
              {
                accessorKey: "state",
                header: "Status aktivitas",
                cell: ({ row }) => <StateBadge value={row.original.state} />,
              },
              ...(preview
                ? [
                    { accessorKey: "result", header: "Hasil" },
                    { accessorKey: "value", header: "Nilai net nominal" },
                    { accessorKey: "action", header: "Tindak lanjut" },
                  ]
                : [
                    {
                      id: "lines",
                      header: "Kebutuhan",
                      cell: ({ row }: { row: { original: { lines: unknown[] } } }) =>
                        `${row.original.lines.length} baris kebutuhan`,
                    },
                    {
                      id: "readiness",
                      header: "Tahap berikutnya",
                      cell: () => "Review kebutuhan & kelengkapan",
                    },
                  ]),
            ]}
          />
          {current && (
            <DataTable
              data={current.lines}
              total={current.lines.length}
              label="rincian peluang"
              toolbar={<h2 className="crm-table-title">Rincian {current.code}</h2>}
              columns={[
                { accessorKey: "product", header: "Produk / jumlah" },
                { accessorKey: "stage", header: "Stage · keyakinan" },
                { accessorKey: "balance", header: "Win / sisa" },
                { accessorKey: "action", header: "Tindakan berikutnya" },
                {
                  id: "actions",
                  header: "Aksi",
                  cell: () =>
                    preview ? (
                      <span className="crm-action-links">
                        <Link
                          className="crm-record-link"
                          href={`${base}/opportunities/win?opportunity_id=${encodeURIComponent(current.id)}`}
                        >
                          Catat Win
                        </Link>
                        <Link
                          className="crm-record-link"
                          href={`${base}/opportunities/win?opportunity_id=${encodeURIComponent(current.id)}&outcome=lost`}
                        >
                          Catat Lost
                        </Link>
                      </span>
                    ) : (
                      "Draft"
                    ),
                },
              ]}
            />
          )}
        </>
      )}
      <p className="crm-form-note">
        {preview
          ? "Keyakinan pipeline terpisah dari aktual penjualan. Win memerlukan PO/SP terverifikasi."
          : "Draft belum masuk pipeline aktif dan tidak menambah penjualan aktual."}
      </p>
    </div>
  );
}
