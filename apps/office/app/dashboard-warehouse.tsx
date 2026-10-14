"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { warehouseDashboardResponseSchema, type AuthPrincipal } from "@evflow/contracts";
import { CalendarDays, ChevronDown, Download, ListFilter, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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
import { ApiError, apiRequest } from "../lib/api";
import { hasWarehouseDashboardPermission } from "../lib/navigation";
import { useSession } from "./session-provider";
import "./dashboard-executive.css";
import "./dashboard-warehouse.css";

const kpis = [
  {
    code: "pending_receipts",
    title: "Penerimaan menunggu",
    demo: "4 kiriman",
    note: "Tiba, belum selesai diperiksa",
  },
  {
    code: "picking_tasks",
    title: "Tugas picking",
    demo: "9",
    note: "Berdasarkan alokasi yang sah",
  },
  {
    code: "active_shipments",
    title: "Pengiriman aktif",
    demo: "12",
    note: "Masih dalam perjalanan",
  },
  {
    code: "quarantine_batches",
    title: "Batch karantina",
    demo: "3",
    note: "Tidak tersedia untuk alokasi",
  },
];
const attention = [
  { code: "below_minimum", label: "Produk di bawah minimum", demo: "18 produk" },
  { code: "backorders", label: "Pesanan backorder", demo: "6 pesanan" },
  { code: "near_expiry", label: "Batch mendekati expiry", demo: "5 batch" },
  { code: "quarantine_batches", label: "Batch karantina", demo: "3 batch" },
];
const stages = [
  { code: "all", label: "Semua tahap" },
  { code: "inbound", label: "Barang masuk" },
  { code: "picking", label: "Picking" },
  { code: "shipping", label: "Dalam perjalanan" },
  { code: "quality", label: "Pemeriksaan mutu" },
];
const demoRows = [
  {
    document: "GR/0065 · Pemeriksaan barang",
    party: "PT Medika Nusantara",
    stage: "inbound",
    action: "Periksa fisik",
  },
  {
    document: "PICK/0104 · Ambil barang",
    party: "Gudang Utama · A-02",
    stage: "picking",
    action: "Konfirmasi aktual",
  },
  {
    document: "SJ/0088 · Pengiriman",
    party: "RS Sehat Sentosa",
    stage: "shipping",
    action: "Catat POD",
  },
  {
    document: "RET/0019 · Retur pelanggan",
    party: "Locator Karantina",
    stage: "quality",
    action: "Buka inspeksi",
  },
];
const unavailable = () =>
  toast.info("Layar atau layanan ini belum tersedia. Tidak ada transaksi yang diproses.");
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

export function WarehouseDashboard({
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
  const [warehouse, setWarehouse] = useState("all");
  const [stage, setStage] = useState("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const canRead = hasWarehouseDashboardPermission(principal);
  const query = useQuery({
    queryKey: [
      "dashboard",
      "warehouse",
      principal.company_id,
      principal.user_id,
      principal.permissions,
      month,
      warehouse,
      stage,
    ],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ month, stage });
      if (warehouse !== "all") params.set("warehouse_id", warehouse);
      return warehouseDashboardResponseSchema.parse(
        await apiRequest(`/dashboard/warehouse?${params}`, { signal }),
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
    scenario === "denied" ||
    (query.error instanceof ApiError && query.error.status === 403);
  const loading = preview ? scenario === "loading" : query.isPending && canRead;
  const failed = preview ? scenario === "error" : query.isError;
  const demo = preview && !scenario && month === "2026-09";
  const data = failed ? undefined : query.data;
  const rows = useMemo(
    () => (demo && !denied ? demoRows.filter((r) => stage === "all" || r.stage === stage) : []),
    [demo, denied, stage],
  );
  const columns = useMemo<ColumnDef<(typeof demoRows)[number]>[]>(
    () => [
      {
        accessorKey: "document",
        header: "Dokumen / pekerjaan",
        cell: ({ row }) => (
          <details className="warehouse-detail">
            <summary>{row.original.document}</summary>
            <p>{row.original.party}. Data simulasi; dokumen sumber belum tersedia.</p>
          </details>
        ),
      },
      { accessorKey: "party", header: "Pihak / lokasi" },
      {
        accessorKey: "stage",
        header: "Tahap",
        cell: ({ row }) => stages.find((s) => s.code === row.original.stage)?.label,
      },
      {
        accessorKey: "action",
        header: "Tindak lanjut",
        cell: ({ row }) => (
          <button className="executive-text-link" onClick={unavailable}>
            {row.original.action}
          </button>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
  });
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T00:00:00+08:00`));
  const reason = (code: string) =>
    data?.metrics.find((m) => m.code === code)?.reason ?? "Sumber data belum tersedia.";
  if (denied)
    return (
      <section id="dashboard-main" tabIndex={-1} className="executive-content">
        <Alert variant="destructive">
          <AlertDescription>
            Anda tidak memiliki akses Dashboard Warehouse &amp; Logistik pada cakupan ini.
          </AlertDescription>
        </Alert>
      </section>
    );
  return (
    <section
      id="dashboard-main"
      tabIndex={-1}
      className="executive-content warehouse-dashboard"
      aria-label="Dashboard Warehouse & Logistik"
      aria-busy={loading}
    >
      <div className="executive-heading">
        <div>
          <p className="executive-breadcrumb">Dashboard / Warehouse &amp; Logistik</p>
          <h1>Operasional gudang</h1>
        </div>
        <div className="executive-controls">
          <Button
            variant="outline"
            aria-expanded={periodOpen}
            aria-controls="warehouse-period"
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
        <div id="warehouse-period" className="warehouse-period">
          <label htmlFor="warehouse-month">Periode bulan</label>
          <Input
            id="warehouse-month"
            type="month"
            min="1900-01"
            max="2199-12"
            value={month}
            onChange={(e) => {
              if (/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value))
                setMonth(e.target.value);
            }}
          />
          <label htmlFor="warehouse-selector">Gudang</label>
          <Select value={warehouse} onValueChange={setWarehouse}>
            <SelectTrigger id="warehouse-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Semua gudang yang diizinkan</SelectItem>
                {(preview
                  ? [{ id: "demo-warehouse", code: "GDG", name: "Gudang Utama" }]
                  : (data?.warehouses ?? [])
                ).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="executive-freshness">
        <span>
          {demo ? "1–28 September 2026" : monthLabel} ·{" "}
          {warehouse === "all"
            ? "Seluruh cakupan yang diizinkan"
            : preview
              ? "Gudang Utama"
              : (data?.warehouses.find((w) => w.id === warehouse)?.name ?? "Gudang dipilih")}
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
                  ? `Diperiksa ${formatTime(data.updated_at)} WITA`
                  : "Belum tersedia"}
        </button>
      </div>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>
            Dashboard Warehouse gagal dimuat. Periksa koneksi lalu gunakan tombol coba lagi.
          </AlertDescription>
        </Alert>
      )}
      <div className="executive-kpis">
        {kpis.map((k) => (
          <Card key={k.code} className="executive-card executive-kpi">
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
              <p className="executive-muted">{demo ? k.note : reason(k.code)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="executive-performance warehouse-work">
        <Card className="executive-card executive-history warehouse-queue">
          <CardHeader className="executive-card-header">
            <CardTitle>Antrean operasional</CardTitle>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="warehouse-filter" aria-label="Filter tahap operasional">
                <ListFilter aria-hidden="true" />
                <span className="sr-only">{stages.find((s) => s.code === stage)?.label}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stages.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.label}
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
                    <TableCell colSpan={4}>
                      <Skeleton className="h-40 w-full" />
                    </TableCell>
                  </TableRow>
                ) : rows.length ? (
                  table.getRowModel().rows.map((r) => (
                    <TableRow key={r.id}>
                      {r.getVisibleCells().map((c) => (
                        <TableCell key={c.id}>
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="warehouse-empty">
                      {failed
                        ? "Antrean gagal dimuat."
                        : preview && (scenario === "empty" || month !== "2026-09")
                          ? "Tidak ada pekerjaan untuk periode dan filter ini (simulasi)."
                          : (data?.actions_reason ?? "Antrean operasional belum tersedia.")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="executive-table-footer">
            <button className="executive-text-link" onClick={unavailable}>
              Buka Warehouse &amp; Logistik ↗
            </button>
          </CardFooter>
        </Card>
        <Card className="executive-card warehouse-attention">
          <CardHeader>
            <CardTitle>Perhatian persediaan</CardTitle>
          </CardHeader>
          <CardContent>
            {attention.map((a) => (
              <div key={a.code}>
                <p>{a.label}</p>
                {loading ? (
                  <Skeleton className="h-5 w-28" />
                ) : (
                  <strong title={demo ? undefined : reason(a.code)}>
                    {failed ? "Gagal dimuat" : demo ? a.demo : "Belum tersedia"}
                  </strong>
                )}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={unavailable}>
              Buka Stok &amp; Locator
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
