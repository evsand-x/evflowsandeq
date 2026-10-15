"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { financeDashboardResponseSchema, type AuthPrincipal } from "@evflow/contracts";
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
import { hasCompanyPermission } from "../lib/navigation";
import { useSession } from "./session-provider";
import "./dashboard-executive.css";
import "./dashboard-finance.css";

const kpis = [
  {
    code: "open_receivables",
    title: "Piutang terbuka",
    demo: "Rp215,4 jt",
    note: "Posisi per 28 September",
  },
  {
    code: "open_payables",
    title: "Utang terbuka",
    demo: "Rp172,6 jt",
    note: "Supplier dan vendor",
  },
  {
    code: "allocated_receipts",
    title: "Penerimaan tagihan",
    demo: "Rp312,8 jt",
    note: "Diposting dan dialokasikan",
  },
  {
    code: "posted_payments",
    title: "Pembayaran",
    demo: "Rp186,2 jt",
    note: "Pembayaran diposting",
  },
];
const attention = [
  { code: "period", label: "Periode", demo: "September 2026" },
  { code: "period_status", label: "Status periode", demo: "Terbuka" },
  { code: "completed_steps", label: "Langkah selesai", demo: "4 dari 7" },
  { code: "bank_reconciliation", label: "Rekonsiliasi bank", demo: "Perlu ditinjau" },
  { code: "inventory_reconciliation", label: "Rekonsiliasi persediaan", demo: "Belum selesai" },
] as const;
const stages = [
  { code: "all", label: "Semua proses" },
  { code: "receivables", label: "Piutang" },
  { code: "matching", label: "Pencocokan tagihan" },
  { code: "allocation", label: "Alokasi dana" },
  { code: "closing", label: "Closing" },
];
const demoRows = [
  {
    document: "INV/0132 · Piutang jatuh tempo",
    party: "RS Bina Sehat",
    stage: "receivables",
    amount: "Rp18.500.000",
    status: "Lewat jatuh tempo",
  },
  {
    document: "BILL/0046 · Pencocokan tagihan",
    party: "PT Medika Nusantara",
    stage: "matching",
    amount: "Rp27.250.000",
    status: "Ada selisih",
  },
  {
    document: "RCV/0084 · Alokasi dana",
    party: "Klinik Mitra Utama",
    stage: "allocation",
    amount: "Rp5.000.000",
    status: "Belum dialokasikan",
  },
  {
    document: "Closing bulanan",
    party: "September 2026",
    stage: "closing",
    amount: "—",
    status: "3 penghalang",
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

export function FinanceDashboard({
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
  const [stage, setStage] = useState("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const canRead = hasCompanyPermission(principal, "finance.read");
  const query = useQuery({
    queryKey: [
      "dashboard",
      "finance",
      principal.company_id,
      principal.user_id,
      principal.permissions,
      month,
      stage,
    ],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ month, process: stage });
      return financeDashboardResponseSchema.parse(
        await apiRequest(`/dashboard/finance?${params}`, { signal }),
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
        header: "Dokumen / proses",
        cell: ({ row }) => (
          <details className="finance-detail">
            <summary>{row.original.document}</summary>
            <p>{row.original.party}. Data simulasi; dokumen sumber belum tersedia.</p>
          </details>
        ),
      },
      { accessorKey: "party", header: "Pihak / periode" },
      { accessorKey: "amount", header: "Nilai" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <span className="finance-status web-table-status" data-tone="warning">{row.original.status}</span>,
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
            Anda tidak memiliki akses Dashboard Finance pada cakupan ini.
          </AlertDescription>
        </Alert>
      </section>
    );
  return (
    <section
      id="dashboard-main"
      tabIndex={-1}
      className="executive-content finance-dashboard"
      aria-label="Dashboard Finance"
      aria-busy={loading}
    >
      <div className="executive-heading">
        <div>
          <p className="executive-breadcrumb">Dashboard / Finance</p>
          <h1>Ringkasan finance</h1>
        </div>
        <div className="executive-controls">
          <Button
            variant="outline"
            aria-expanded={periodOpen}
            aria-controls="finance-period"
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
        <div id="finance-period" className="finance-period">
          <label htmlFor="finance-month">Periode bulan</label>
          <Input
            id="finance-month"
            type="month"
            min="1900-01"
            max="2199-12"
            value={month}
            onChange={(e) => {
              if (/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value))
                setMonth(e.target.value);
            }}
          />
        </div>
      )}
      <div className="executive-freshness">
        <span>{demo ? "1–28 September 2026" : monthLabel} · Seluruh cakupan yang diizinkan</span>
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
            Dashboard Finance gagal dimuat. Periksa koneksi lalu gunakan tombol coba lagi.
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
      <div className="executive-performance finance-work">
        <Card className="executive-card executive-history finance-queue">
          <CardHeader className="executive-card-header">
            <CardTitle>Antrean finance</CardTitle>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="finance-filter" aria-label="Filter proses finance">
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
                    <TableCell colSpan={4} className="finance-empty">
                      {failed
                        ? "Antrean gagal dimuat."
                        : preview && (scenario === "empty" || month !== "2026-09")
                          ? "Tidak ada pekerjaan untuk periode dan filter ini (simulasi)."
                          : (data?.actions_reason ?? "Antrean finance belum tersedia.")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="executive-table-footer">
            <button className="executive-text-link" onClick={unavailable}>
              Buka Finance ↗
            </button>
          </CardFooter>
        </Card>
        <Card className="executive-card finance-attention">
          <CardHeader>
            <CardTitle>Kesiapan closing</CardTitle>
          </CardHeader>
          <CardContent>
            {attention.map((a) => (
              <div key={a.code}>
                <p>{a.label}</p>
                {loading ? (
                  <Skeleton className="h-5 w-28" />
                ) : (
                  <strong
                    title={demo || a.code === "period" ? undefined : data?.closing[a.code]?.reason}
                  >
                    {a.code === "period"
                      ? monthLabel
                      : failed
                        ? "Gagal dimuat"
                        : demo
                          ? a.demo
                          : "Belum tersedia"}
                  </strong>
                )}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={unavailable}>
              Buka Checklist Closing
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
