"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  salesDashboardResponseSchema,
  type AuthPrincipal,
  type SalesDashboardAction,
} from "@evflow/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
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
import { CalendarDays, ChevronDown, Download, Info, ListFilter, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiRequest, ApiError } from "../lib/api";
import { useSession } from "./session-provider";
import "./dashboard-executive.css";
import "./dashboard-sales.css";

const demoRows = [
  {
    action: "Follow-up penawaran",
    reference: "QTN/0098",
    customer_name: "RS Sehat Sentosa",
    due_at: "2026-09-28T02:00:00.000Z",
    label: "Terjadwal",
  },
  {
    action: "Kunjungan",
    reference: "VIS/0145",
    customer_name: "Klinik Mitra Utama",
    due_at: "2026-09-28T05:00:00.000Z",
    label: "Disetujui",
  },
  {
    action: "Sisa SO",
    reference: "SO/0192",
    customer_name: "RS Harapan Medika",
    due_at: "2026-09-28T00:00:00.000Z",
    label: "Backorder",
  },
  {
    action: "Trial sampel",
    reference: "SMP/0028",
    customer_name: "RS Citra Medika",
    due_at: "2026-09-29T00:00:00.000Z",
    label: "Perlu hasil",
  },
].map((r, i) => ({
  ...r,
  id: `demo-${i}`,
  status: (i === 2 ? "overdue" : "upcoming") as "overdue" | "upcoming",
}));
type Row = SalesDashboardAction & { label?: string };
const kpis = [
  {
    code: "net_sales",
    title: "Penjualan net",
    demo: "Rp428,5 jt",
    description: "Invoice diposting setelah retur",
  },
  {
    code: "sales_achievement",
    title: "A/T penjualan",
    demo: "85,7%",
    description: "Target September Rp500 jt",
  },
  {
    code: "successful_visits",
    title: "Kunjungan berhasil",
    demo: "42 sesi",
    description: "Dihitung per sesi, bukan kontak",
  },
  {
    code: "new_customers",
    title: "Pelanggan baru",
    demo: "7",
    description: "Invoice pertama diposting",
  },
];
const targets = [
  { code: "target", label: "Target penjualan", demo: "Rp500 jt" },
  { code: "estimate", label: "Estimasi akhir periode", demo: "Rp475 jt" },
  { code: "net_sales", label: "Aktual", demo: "Rp428,5 jt" },
  { code: "estimate_achievement", label: "E/T", demo: "95,0%" },
  { code: "sales_achievement", label: "A/T", demo: "85,7%" },
];
function currentMonth() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${p.find((v) => v.type === "year")!.value}-${p.find((v) => v.type === "month")!.value}`;
}
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const unavailable = () =>
  toast.info("Layar atau layanan ini belum tersedia. Tidak ada transaksi yang diproses.");

export function SalesDashboard({
  principal,
  preview = false,
  scenario,
}: {
  principal: AuthPrincipal;
  preview?: boolean;
  scenario?: string | null;
}) {
  const { reload } = useSession();
  const [month, setMonth] = useState(() => (preview ? "2026-09" : currentMonth()));
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [cursors, setCursors] = useState<string[]>([]);
  const [periodOpen, setPeriodOpen] = useState(false);
  const cursor = cursors.at(-1);
  const canRead = principal.permissions.some(
    (p) =>
      p.code === "crm.read" &&
      ["company", "privileged"].includes(p.scope_type) &&
      (!p.scope_id || p.scope_id === principal.company_id),
  );
  const query = useQuery({
    queryKey: [
      "dashboard",
      "sales",
      principal.company_id,
      principal.user_id,
      principal.permissions,
      month,
      status,
      sort,
      cursor,
    ],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ month, status, sort });
      if (cursor) params.set("cursor", cursor);
      return salesDashboardResponseSchema.parse(
        await apiRequest(`/dashboard/sales?${params}`, { signal }),
      ).data;
    },
    enabled: !preview && canRead,
    retry: (count, error) =>
      !(error instanceof ApiError && [400, 401, 403].includes(error.status)) && count < 1,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) void reload();
  }, [query.error, reload]);
  const denied =
    !canRead ||
    (query.error instanceof ApiError && query.error.status === 403) ||
    scenario === "denied";
  const loading = preview ? scenario === "loading" : query.isPending && canRead;
  const failed = preview ? scenario === "error" : query.isError;
  const demo = preview && !scenario && month === "2026-09";
  const data = failed ? undefined : query.data;
  const rows = useMemo<Row[]>(() => {
    if (denied || failed || loading) return [];
    if (!preview) return data?.actions ?? [];
    if (!demo) return [];
    const filtered = demoRows.filter((r) => status === "all" || r.status === status);
    return sort === "asc" ? filtered : [...filtered].reverse();
  }, [data, demo, preview, status, sort, denied, failed, loading]);
  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "action",
        header: "Kegiatan / referensi",
        cell: ({ row }) => (
          <details className="sales-action-detail">
            <summary>
              {row.original.action} · {row.original.reference}
            </summary>
            <p>
              {row.original.customer_name}
              <br />
              {dateTime(row.original.due_at)} WITA
              <br />
              {preview
                ? "Data simulasi; dokumen sumber belum tersedia."
                : "Sumber: jadwal tindak lanjut prospek saya. Penyelesaian dilakukan pada modul CRM."}
            </p>
          </details>
        ),
      },
      { accessorKey: "customer_name", header: "Pelanggan" },
      {
        accessorKey: "due_at",
        header: () => (
          <button
            onClick={() => {
              setSort(sort === "asc" ? "desc" : "asc");
              setCursors([]);
            }}
            aria-label={`Urutkan jadwal ${sort === "asc" ? "terbaru" : "terlama"}`}
          >
            Jadwal {sort === "asc" ? "↑" : "↓"}
          </button>
        ),
        cell: ({ row }) =>
          demo
            ? ["Hari ini, 10.00", "Hari ini, 13.00", "Hari ini", "29 Sep 2026"][
                Number(row.original.id.split("-")[1])
              ]
            : dateTime(row.original.due_at),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className="sales-action-status web-table-status" data-tone={row.original.status === "overdue" ? "danger" : "info"}>
            {row.original.label ?? (row.original.status === "overdue" ? "Terlambat" : "Terjadwal")}
          </span>
        ),
      },
    ],
    [sort, preview, demo],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
  });
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  }).format(new Date(`${month}-01T00:00:00+08:00`));
  if (denied)
    return (
      <section id="dashboard-main" tabIndex={-1} className="sales-dashboard executive-content">
        <Alert variant="destructive">
          <AlertDescription>
            Anda tidak memiliki akses Dashboard Sales pada cakupan ini.
          </AlertDescription>
        </Alert>
      </section>
    );
  return (
    <section
      id="dashboard-main"
      tabIndex={-1}
      className="sales-dashboard executive-content"
      aria-label="Dashboard Sales"
      aria-busy={loading}
    >
      <div className="executive-heading">
        <div>
          <p className="executive-breadcrumb">Dashboard / Sales</p>
          <h1>Kinerja sales</h1>
        </div>
        <div className="executive-controls">
          <Button
            variant="outline"
            aria-expanded={periodOpen}
            aria-controls="sales-period"
            onClick={() => setPeriodOpen(!periodOpen)}
          >
            <CalendarDays data-icon="inline-start" />
            {monthLabel}
            <ChevronDown data-icon="inline-end" />
          </Button>
          <Button variant="outline" onClick={unavailable}>
            <Download data-icon="inline-start" />
            Ekspor
          </Button>
        </div>
      </div>
      {periodOpen && (
        <div id="sales-period" className="sales-period">
          <label htmlFor="sales-month">Periode bulan</label>
          <Input
            id="sales-month"
            type="month"
            min="1900-01"
            max="2199-12"
            value={month}
            onChange={(e) => {
              if (/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) {
                setMonth(e.target.value);
                setCursors([]);
              }
            }}
          />
        </div>
      )}
      <div className="executive-freshness">
        <span>
          {demo
            ? "1–28 September 2026 · Seluruh cakupan yang diizinkan"
            : `${monthLabel} · Tindak lanjut saya · WITA`}
        </span>
        <button
          className="executive-refresh"
          disabled={loading || (!preview && query.isFetching)}
          onClick={() =>
            preview ? toast.info("Pratinjau memakai data simulasi.") : void query.refetch()
          }
        >
          <RefreshCw aria-hidden="true" className="executive-refresh-icon" />
          {failed
            ? "Gagal diperbarui — coba lagi"
            : loading
              ? "Memuat…"
              : demo
                ? "Diperbarui 28 Sep 2026, 09.41 WITA"
                : data
                  ? `Diperbarui ${dateTime(data.updated_at)} WITA`
                  : "Belum tersedia"}
        </button>
      </div>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>
            Dashboard Sales gagal dimuat. Periksa koneksi lalu gunakan tombol coba lagi.
          </AlertDescription>
        </Alert>
      )}
      <div className="executive-kpis">
        {kpis.map((k) => (
          <Card className="executive-card executive-kpi sales-kpi" key={k.code}>
            <CardHeader className="executive-card-header">
              <CardTitle>{k.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="executive-kpi-skeleton" />
              ) : (
                <p className={demo ? "executive-value" : "executive-unavailable-value"}>
                  {failed ? "Gagal dimuat" : demo ? k.demo : "Belum tersedia"}
                </p>
              )}
              <p className="executive-muted">
                {demo
                  ? k.description
                  : (data?.metrics.find((m) => m.code === k.code)?.reason ??
                    "Sumber data belum tersedia.")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="executive-performance sales-work">
        <Card className="sales-actions">
          <CardHeader>
            <CardTitle>Tindak lanjut sales</CardTitle>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setCursors([]);
              }}
            >
              <SelectTrigger
                aria-label="Filter tindak lanjut"
                title={
                  status === "all"
                    ? "Semua jadwal"
                    : status === "overdue"
                      ? "Terlambat"
                      : "Terjadwal"
                }
                className="sales-filter"
              >
                <ListFilter aria-hidden="true" />
                <span className="sr-only">
                  {status === "all"
                    ? "Semua jadwal"
                    : status === "overdue"
                      ? "Terlambat"
                      : "Terjadwal"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Semua jadwal</SelectItem>
                  <SelectItem value="overdue">Terlambat</SelectItem>
                  <SelectItem value="upcoming">Terjadwal</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((h) => (
                      <TableHead
                        key={h.id}
                        aria-sort={
                          h.id === "due_at"
                            ? sort === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-40 w-full" />
                    </TableCell>
                  </TableRow>
                ) : rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="sales-empty">
                      {failed
                        ? "Tindak lanjut gagal dimuat."
                        : preview && scenario === "unavailable"
                          ? "Sumber tindak lanjut belum tersedia."
                          : "Tidak ada tindak lanjut untuk periode dan filter ini."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter>
            <button className="executive-text-link" onClick={unavailable}>
              Buka Sales ↗
            </button>
            {!demo && !loading && !failed && (
              <span>
                {data?.total_actions ?? rows.length} tindak lanjut
                {preview ? " simulasi" : " prospek saya"}
              </span>
            )}
            {!preview && (cursor || data?.next_cursor) && (
              <div className="sales-pagination">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!cursor}
                  onClick={() => setCursors((c) => c.slice(0, -1))}
                >
                  Sebelumnya
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data?.next_cursor}
                  onClick={() => {
                    if (data?.next_cursor) setCursors((c) => [...c, data.next_cursor!]);
                  }}
                >
                  Berikutnya
                </Button>
              </div>
            )}
          </CardFooter>
        </Card>
        <Card className="sales-target">
          <CardHeader>
            <CardTitle>Target &amp; estimasi</CardTitle>
          </CardHeader>
          <CardContent>
            {targets.map((t) => (
              <div key={t.code}>
                <p>{demo && t.code === "net_sales" ? "Aktual sampai 28 Sep" : t.label}</p>
                {loading ? (
                  <Skeleton className="h-5 w-28" />
                ) : (
                  <strong title={data?.metrics.find((m) => m.code === t.code)?.reason}>
                    {failed ? "Gagal dimuat" : demo ? t.demo : "Belum tersedia"}
                  </strong>
                )}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={unavailable}>
              Lihat A/T Penjualan
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Alert className="sales-estimate-info">
        <Info aria-hidden="true" />
        <AlertDescription>
          Estimasi akhir periode = aktual + estimasi tambahan yang belum terealisasi.
        </AlertDescription>
      </Alert>
      {!preview && (
        <p className="sales-source-note">
          Tindak lanjut bersumber dari jadwal prospek aktif milik Anda. Penawaran, kunjungan, SO,
          dan sampel belum terhubung. Pembaruan melalui muat ulang atau saat kembali ke halaman.
        </p>
      )}
    </section>
  );
}
