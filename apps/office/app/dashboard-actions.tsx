"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { actionQueueResponseSchema, type AuthPrincipal } from "@evflow/contracts";
import { ArrowDownUp, ArrowUpRight, CalendarDays, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, apiRequest } from "../lib/api";
import { useSession } from "./session-provider";
import {
  businessDate,
  formatBusinessTime,
  WorkspaceEmpty,
  WorkspaceFreshness,
} from "./dashboard-workspace-common";
import "./dashboard-executive.css";
import "./dashboard-workspace.css";

type Row = {
  id: string;
  title: string;
  reference: string;
  module: string;
  party: string;
  due: string;
  amount?: string;
  status: string;
  document?: string;
  customer?: string;
  reason?: string;
  version?: number;
};
const samples: Row[] = [
  {
    id: "unlock",
    title: "Unlock kredit SO",
    reference: "ULK/2026/09/0012",
    module: "sales",
    party: "Rina · Sales & Marketing",
    due: "Hari ini, 11.00",
    amount: "Rp32.400.000",
    status: "Menunggu persetujuan",
    document: "SO/2026/09/0192",
    customer: "RS Harapan Medika",
    reason: "Terdapat invoice lewat jatuh tempo. Pengajuan meminta pengecualian untuk SO ini.",
  },
  {
    id: "pr",
    title: "PR barang dagang",
    reference: "PR/2026/09/0045",
    module: "warehouse",
    party: "Budi · Warehouse & Logistik",
    due: "Terlambat 1 hari",
    amount: "Rp48.500.000",
    status: "Menunggu persetujuan",
  },
  {
    id: "payment",
    title: "Pembayaran supplier",
    reference: "PAY/2026/09/0078",
    module: "finance",
    party: "Dewi · Finance",
    due: "Terlambat 2 jam",
    amount: "Rp27.250.000",
    status: "Menunggu persetujuan",
  },
  {
    id: "ops",
    title: "PR barang operasional",
    reference: "PR/2026/09/0048",
    module: "warehouse",
    party: "Sari · Warehouse & Logistik",
    due: "Hari ini, 15.00",
    amount: "Rp3.200.000",
    status: "Menunggu persetujuan",
  },
  {
    id: "vendor",
    title: "Pembayaran vendor",
    reference: "PAY/2026/09/0081",
    module: "finance",
    party: "Dewi · Finance",
    due: "Besok, 10.00",
    amount: "Rp8.750.000",
    status: "Menunggu persetujuan",
  },
];
const followups: Row[] = [
  {
    id: "followup",
    title: "Tindak lanjut kebutuhan produk",
    reference: "PRO/2026/09/0018",
    module: "sales",
    party: "RS Harapan Medika",
    due: "Hari ini, 14.00",
    status: "Perlu ditindaklanjuti",
  },
];
const modules = [
  ["all", "Semua modul"],
  ["sales", "Sales & Marketing"],
  ["warehouse", "Warehouse & Logistik"],
  ["finance", "Finance"],
  ["hris", "HRIS"],
];
const tabs = [
  ["approvals", "Persetujuan saya"],
  ["followups", "Tindak lanjut"],
  ["completed", "Selesai"],
];

export function ActionsDashboard({
  principal,
  preview = false,
  scenario,
}: {
  principal: AuthPrincipal;
  preview?: boolean;
  scenario?: string | null;
}) {
  const { reload } = useSession();
  const [tab, setTab] = useState("approvals"),
    [module, setModule] = useState("all");
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState("");
  const [month, setMonth] = useState(() => (preview ? "2026-09" : businessDate().slice(0, 7)));
  const [periodOpen, setPeriodOpen] = useState(false),
    [sort, setSort] = useState("asc");
  const [sortApplied, setSortApplied] = useState(false);
  const [cursors, setCursors] = useState<string[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setCursors([]);
      setSelectedId(null);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const reset = () => {
    setCursors([]);
    setSelectedId(null);
  };
  const query = useQuery({
    queryKey: [
      "dashboard",
      "actions",
      principal.company_id,
      principal.user_id,
      principal.permissions,
      tab,
      module,
      month,
      term,
      sort,
      cursors.at(-1),
    ],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ month, tab, module, search: term, sort, limit: "5" });
      if (cursors.length) params.set("cursor", cursors.at(-1)!);
      return actionQueueResponseSchema.parse(
        await apiRequest(`/dashboard/actions?${params}`, { signal }),
      ).data;
    },
    enabled: !preview,
    retry: (n, e) => !(e instanceof ApiError && [400, 401, 403].includes(e.status)) && n < 1,
  });
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) void reload();
  }, [query.error, reload]);
  const denied =
    scenario === "denied" || (query.error instanceof ApiError && query.error.status === 403);
  const loading = preview ? scenario === "loading" : query.isPending;
  const failed = preview ? scenario === "error" : query.isError;
  const demo = preview && !scenario && month === "2026-09";
  const data = failed || denied ? undefined : query.data;
  const rows = useMemo<Row[]>(() => {
    if (denied || loading || failed) return [];
    if (demo) {
      const filtered = (
        tab === "approvals" ? samples : tab === "followups" ? followups : []
      ).filter(
        (r) =>
          (module === "all" || r.module === module) &&
          `${r.title} ${r.reference} ${r.party}`
            .toLocaleLowerCase()
            .includes(term.toLocaleLowerCase()),
      );
      if (!sortApplied) return filtered;
      const order = ["pr", "payment", "unlock", "ops", "vendor", "followup"];
      return filtered.sort(
        (a, b) => (order.indexOf(a.id) - order.indexOf(b.id)) * (sort === "asc" ? 1 : -1),
      );
    }
    return (
      data?.items.map((r) => ({
        id: r.id,
        title: r.title,
        reference: r.reference,
        module: r.module,
        party: r.party,
        due: `${formatBusinessTime(r.due_at)} WITA`,
        status: r.status === "overdue" ? "Melewati tenggat" : "Perlu ditindaklanjuti",
        version: r.source_version,
      })) ?? []
    );
  }, [denied, loading, failed, demo, tab, module, term, data, sort, sortApplied]);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: "application",
        header: "Pengajuan",
        cell: ({ row }) => (
          <button
            className="workspace-row-button"
            aria-pressed={selected?.id === row.original.id}
            onClick={() => setSelectedId(row.original.id)}
          >
            <strong>{row.original.title}</strong>
            <span>{row.original.reference}</span>
            <small>{row.original.party}</small>
          </button>
        ),
      },
      {
        id: "due",
        header: () => (
          <button
            className="workspace-sort"
            onClick={() => {
              setSort((s) => (s === "asc" ? "desc" : "asc"));
              setSortApplied(true);
              reset();
            }}
            aria-label={`Urutkan tenggat ${sort === "asc" ? "terbaru" : "terlama"}`}
          >
            Tenggat <ArrowDownUp aria-hidden="true" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="workspace-due">
            {row.original.amount && <strong>{row.original.amount}</strong>}
            <span
              data-overdue={
                row.original.due.startsWith("Terlambat") ||
                row.original.status === "Melewati tenggat"
              }
            >
              {row.original.due}
            </span>
          </div>
        ),
      },
    ],
    [selected?.id, sort],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
  });
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  }).format(new Date(`${month}-01T00:00:00+08:00`));
  const metricDefs = [
    {
      code: "approvals",
      title: "Menunggu persetujuan",
      demo: "5",
      note: "Sesuai penunjukan & kewenangan",
    },
    {
      code: "followups",
      title: "Perlu ditindaklanjuti",
      demo: "13",
      note: "Dokumen dan proses lintas modul",
    },
    {
      code: "overdue",
      title: "Melewati tenggat",
      demo: "2",
      note: "Prioritaskan pemeriksaan hari ini",
    },
  ] as const;
  if (denied)
    return (
      <section id="dashboard-main" tabIndex={-1} className="executive-content">
        <Alert variant="destructive">
          <AlertDescription>Anda tidak memiliki akses antrean tugas ini.</AlertDescription>
        </Alert>
      </section>
    );
  return (
    <section
      id="dashboard-main"
      tabIndex={-1}
      className="executive-content workspace-dashboard"
      aria-label="Tugas & Persetujuan"
      aria-busy={loading}
    >
      <div className="executive-heading">
        <div>
          <p className="executive-breadcrumb">Dashboard / Tugas & Persetujuan</p>
          <h1>Tugas & Persetujuan</h1>
        </div>
        <div className="executive-controls">
          <Button
            variant="outline"
            aria-expanded={periodOpen}
            aria-controls="actions-period"
            onClick={() => setPeriodOpen(!periodOpen)}
          >
            <CalendarDays data-icon="inline-start" />
            {monthLabel}
            <ChevronDown data-icon="inline-end" />
          </Button>
        </div>
      </div>
      {periodOpen && (
        <Field id="actions-period" className="workspace-period">
          <FieldLabel htmlFor="actions-month">Periode bulan</FieldLabel>
          <Input
            id="actions-month"
            type="month"
            min="1900-01"
            max="2199-12"
            value={month}
            onChange={(e) => {
              if (/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) {
                setMonth(e.target.value);
                reset();
              }
            }}
          />
        </Field>
      )}
      <WorkspaceFreshness
        preview={demo}
        loading={loading || (!preview && query.isFetching)}
        failed={failed}
        updatedAt={data?.updated_at}
        scope={`${monthLabel} · Tugas saya`}
        refresh={() =>
          preview ? toast.info("Pratinjau memakai data simulasi.") : void query.refetch()
        }
      />
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>Antrean gagal dimuat. Gunakan tombol coba lagi.</AlertDescription>
        </Alert>
      )}
      <div className="executive-kpis workspace-task-kpis">
        {metricDefs.map((m) => (
          <Card key={m.code} className="executive-card executive-kpi">
            <CardHeader className="executive-card-header">
              <CardTitle>{m.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="executive-kpi-skeleton" />
              ) : (
                <p
                  className={
                    demo || data?.metrics[m.code].value != null
                      ? "executive-value"
                      : "executive-unavailable-value"
                  }
                  data-metric={m.code}
                >
                  {failed
                    ? "Gagal dimuat"
                    : demo
                      ? m.demo
                      : (data?.metrics[m.code].value ?? "Belum tersedia")}
                </p>
              )}
              <p className="executive-muted">
                {demo ? m.note : (data?.metrics[m.code].reason ?? "Sumber tugas belum tersedia.")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          reset();
        }}
        className="workspace-tabs"
      >
        <TabsList variant="line" aria-label="Jenis pekerjaan">
          {tabs.map(([id, label]) => (
            <TabsTrigger key={id} value={id!}>
              {label}
              {demo && id !== "completed" ? `  ${id === "approvals" ? "5" : "13"}` : ""}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <div className="executive-performance workspace-grid">
            <Card className="executive-card workspace-queue">
              <CardHeader className="workspace-filters">
                <CardTitle className="sr-only">
                  Antrean {tabs.find(([id]) => id === tab)?.[1]}
                </CardTitle>
                <InputGroup>
                  <InputGroupAddon>
                    <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label="Cari nomor atau pemohon"
                    placeholder={
                      tab === "followups"
                        ? "Cari nomor, pelanggan, atau tugas"
                        : "Cari nomor atau pemohon"
                    }
                    value={search}
                    maxLength={100}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </InputGroup>
                <Select
                  value={module}
                  onValueChange={(v) => {
                    setModule(v);
                    reset();
                  }}
                >
                  <SelectTrigger aria-label="Filter modul">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {modules.map(([id, label]) => (
                        <SelectItem key={id} value={id!}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((g) => (
                      <TableRow key={g.id}>
                        {g.headers.map((h) => (
                          <TableHead key={h.id}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Skeleton className="h-60 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : rows.length ? (
                      table.getRowModel().rows.map((r) => (
                        <TableRow
                          key={r.id}
                          data-state={selected?.id === r.id ? "selected" : undefined}
                        >
                          {r.getVisibleCells().map((c) => (
                            <TableCell key={c.id}>
                              {flexRender(c.column.columnDef.cell, c.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2}>
                          <WorkspaceEmpty
                            title={
                              failed
                                ? "Gagal dimuat"
                                : data?.status === "unavailable" || scenario === "unavailable"
                                  ? "Belum tersedia"
                                  : "Tidak ada tugas"
                            }
                            reason={
                              failed
                                ? "Periksa koneksi lalu gunakan tombol coba lagi."
                                : (data?.reason ??
                                  (preview && scenario !== "unavailable"
                                    ? "Tidak ada pekerjaan untuk periode dan filter ini (simulasi)."
                                    : "Sumber antrean belum tersedia."))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="executive-table-footer">
                <span>
                  {demo
                    ? `${rows.length} pengajuan ditampilkan · simulasi`
                    : data?.total != null
                      ? `${data.total} tindak lanjut prospek sesuai filter`
                      : "Jumlah belum tersedia"}
                </span>
                <div className="workspace-pagination">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!cursors.length || loading}
                    onClick={() => {
                      setCursors((c) => c.slice(0, -1));
                      setSelectedId(null);
                    }}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data?.next_cursor || loading}
                    onClick={() => {
                      if (data?.next_cursor) setCursors((c) => [...c, data.next_cursor!]);
                      setSelectedId(null);
                    }}
                  >
                    Berikutnya
                  </Button>
                </div>
              </CardFooter>
            </Card>
            <Card className="executive-card workspace-detail">
              <CardHeader>
                {selected ? (
                  <>
                    <Badge variant="secondary">{selected.status}</Badge>
                    <CardTitle>{selected.title}</CardTitle>
                    <p className="workspace-reference">{selected.reference}</p>
                  </>
                ) : (
                  <CardTitle>Rincian tugas</CardTitle>
                )}
              </CardHeader>
              <CardContent>
                {selected ? (
                  <>
                    <dl>
                      {[
                        ["Dokumen sumber", selected.document ?? selected.reference],
                        [
                          selected.customer ? "Pelanggan" : "Pihak terkait",
                          selected.customer ?? selected.party,
                        ],
                        ["Pemohon", demo ? selected.party : principal.display_name],
                        ...(selected.amount ? [["Nilai pengajuan", selected.amount]] : []),
                        [
                          "Tahap aktif",
                          selected.id === "unlock" ? "Review pengecualian kredit" : selected.status,
                        ],
                        ...(selected.version ? [["Versi sumber", String(selected.version)]] : []),
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {selected.reason && (
                      <Alert className="workspace-warning">
                        <AlertDescription>
                          <strong>Alasan terkunci</strong>
                          {selected.reason}
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                ) : loading ? (
                  <Skeleton className="h-60 w-full" />
                ) : (
                  <p className="executive-muted">Pilih tugas untuk melihat rincian.</p>
                )}
              </CardContent>
              {selected && (
                <CardFooter>
                  <Button
                    onClick={() => {
                      if (!demo) window.location.assign(`/crm/prospects/${selected.id}`);
                      else
                        toast.info(
                          "Data simulasi. Pengajuan asli belum tersedia; tidak ada persetujuan yang diproses.",
                        );
                    }}
                  >
                    Buka {tab === "approvals" ? "pengajuan" : "dokumen sumber"}
                    <ArrowUpRight data-icon="inline-end" />
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      {!preview && data && <p className="workspace-coverage">{data.coverage}</p>}
    </section>
  );
}
