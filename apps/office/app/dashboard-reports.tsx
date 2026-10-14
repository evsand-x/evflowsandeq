"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  reportCatalogResponseSchema,
  reportExportsResponseSchema,
  reportParametersSchema,
  reportPreviewResponseSchema,
  type AuthPrincipal,
  type ReportCatalogItem,
} from "@evflow/contracts";
import { CalendarDays, ChevronDown, ChevronRight, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { useSession } from "./session-provider";
import { businessDate, WorkspaceEmpty, WorkspaceFreshness } from "./dashboard-workspace-common";
import "./dashboard-executive.css";
import "./dashboard-workspace.css";

const demoCatalog: ReportCatalogItem[] = [
  {
    code: "ar-aging",
    name: "Aging Piutang",
    module: "finance",
    description: "Finance · Piutang per tanggal acuan",
    owner_path: "Finance → Piutang (AR)",
  },
  {
    code: "net-sales",
    name: "Penjualan Net",
    module: "sales",
    description: "Sales & Marketing · Invoice diposting",
    owner_path: "Sales & Marketing → Target & Estimasi",
  },
  {
    code: "stock-value",
    name: "Persediaan & Nilai Stok",
    module: "warehouse",
    description: "Warehouse & Logistik · Posisi stok",
    owner_path: "Warehouse & Logistik → Persediaan",
  },
  {
    code: "trial-balance",
    name: "Neraca Saldo",
    module: "finance",
    description: "Finance · Saldo akun periode",
    owner_path: "Finance → Laporan",
  },
  {
    code: "attendance",
    name: "Kehadiran Karyawan",
    module: "hris",
    description: "HRIS · Rekap sesuai cakupan",
    owner_path: "HRIS → Laporan HRIS",
  },
].map((r) => ({
  ...r,
  definition_version: "report-catalog-v1",
  status: "unavailable",
  destination: null,
  can_export: false,
  reason: "Data simulasi. Generator laporan belum tersedia.",
})) as ReportCatalogItem[];
type ExportRow = {
  id: string;
  name: string;
  detail: string;
  status: string;
  action: string;
  tone: string;
};
const demoExports: ExportRow[] = [
  {
    id: "aging",
    name: "Aging Piutang",
    detail: "28 Sep 2026 · Dibuat 09.35 · Tersedia hingga 5 Okt 2026",
    status: "Siap diunduh",
    action: "Unduh",
    tone: "ready",
  },
  {
    id: "stock",
    name: "Persediaan & Nilai Stok",
    detail: "28 Sep 2026 · Dibuat 09.40",
    status: "Sedang diproses",
    action: "Lihat status",
    tone: "processing",
  },
  {
    id: "trial",
    name: "Neraca Saldo",
    detail: "Agustus 2026 · Dibuat 09.12",
    status: "Gagal dibuat",
    action: "Lihat kendala",
    tone: "failed",
  },
];

export function ReportsDashboard({
  principal,
  preview = false,
  scenario,
}: {
  principal: AuthPrincipal;
  preview?: boolean;
  scenario?: string | null;
}) {
  const { reload } = useSession();
  const [selectedCode, setSelectedCode] = useState<string | null>(null),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: [
      "reports",
      "workspace",
      principal.company_id,
      principal.user_id,
      principal.permissions,
    ],
    queryFn: async ({ signal }) => {
      const [catalog, exports] = await Promise.all([
        apiRequest("/reports/catalog", { signal }),
        apiRequest("/report-exports", { signal }),
      ]);
      return {
        catalog: reportCatalogResponseSchema.parse(catalog).data,
        exports: reportExportsResponseSchema.parse(exports).data,
      };
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
  const demo = preview && !scenario;
  const data = failed || denied ? undefined : query.data;
  const catalog =
    loading || failed || denied
      ? []
      : preview
        ? scenario === "empty"
          ? []
          : demoCatalog
        : (data?.catalog.items ?? []);
  const filtered = catalog.filter((r) =>
    `${r.name} ${r.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const selected = filtered.find((r) => r.code === selectedCode) ?? filtered[0];
  const exports = useMemo(
    () => (demo && !denied && !failed && !loading ? demoExports : []),
    [demo, denied, failed, loading],
  );
  const columns = useMemo<ColumnDef<ExportRow>[]>(
    () => [
      {
        id: "report",
        header: "Laporan",
        cell: ({ row }) => (
          <div className="workspace-export-name">
            <FileText aria-hidden="true" />
            <div>
              <strong>{row.original.name}</strong>
              <small>{row.original.detail}</small>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="secondary" className="workspace-status" data-tone={row.original.tone}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "action",
        header: "Tindakan",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info(
                row.original.tone === "ready"
                  ? "Data simulasi. Tidak ada file nyata untuk diunduh."
                  : row.original.tone === "processing"
                    ? "Contoh status antrean ekspor; tidak ada pekerjaan nyata yang sedang berjalan."
                    : "Contoh kegagalan ekspor. Layanan generator laporan belum tersedia.",
              )
            }
          >
            {row.original.action}
          </Button>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: exports,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });
  if (denied)
    return (
      <section id="dashboard-main" tabIndex={-1} className="executive-content">
        <Alert variant="destructive">
          <AlertDescription>Anda tidak memiliki akses laporan pada cakupan ini.</AlertDescription>
        </Alert>
      </section>
    );
  return (
    <section
      id="dashboard-main"
      tabIndex={-1}
      className="executive-content workspace-dashboard"
      aria-label="Laporan & Ekspor"
      aria-busy={loading}
    >
      <div className="executive-heading">
        <div>
          <p className="executive-breadcrumb">Dashboard / Laporan & Ekspor</p>
          <h1>Laporan & Ekspor</h1>
        </div>
      </div>
      <WorkspaceFreshness
        preview={demo}
        loading={loading || (!preview && query.isFetching)}
        failed={failed}
        updatedAt={data?.catalog.updated_at}
        scope="Katalog sesuai hak akses · Ekspor saya"
        refresh={() =>
          preview ? toast.info("Pratinjau memakai data simulasi.") : void query.refetch()
        }
      />
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>Laporan gagal dimuat. Gunakan tombol coba lagi.</AlertDescription>
        </Alert>
      )}
      <div className="executive-performance workspace-grid">
        <Card className="executive-card workspace-catalog">
          <CardHeader>
            <CardTitle>Pilih laporan</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Cari laporan"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search aria-hidden="true" />
            </Button>
          </CardHeader>
          <CardContent>
            {searchOpen && (
              <Field className="workspace-catalog-search">
                <FieldLabel htmlFor="report-search">Cari laporan</FieldLabel>
                <Input
                  id="report-search"
                  value={search}
                  maxLength={100}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedCode(null);
                  }}
                />
              </Field>
            )}
            {loading ? (
              <Skeleton className="m-5 h-64" />
            ) : filtered.length ? (
              <ul aria-label="Katalog laporan">
                {filtered.map((r) => (
                  <li key={r.code}>
                    <button
                      className="workspace-catalog-item"
                      aria-pressed={selected?.code === r.code}
                      onClick={() => setSelectedCode(r.code)}
                    >
                      <FileText aria-hidden="true" />
                      <span>
                        <strong>{r.name}</strong>
                        <small>{r.description}</small>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <WorkspaceEmpty
                title={failed ? "Gagal dimuat" : "Tidak ada laporan"}
                reason={
                  failed
                    ? "Periksa koneksi lalu gunakan tombol coba lagi."
                    : search
                      ? "Tidak ada laporan yang cocok dengan pencarian."
                      : "Belum ada laporan yang tersedia untuk hak akses Anda."
                }
              />
            )}
          </CardContent>
        </Card>
        {selected ? (
          <ReportParameters
            key={`${selected.code}:${principal.company_id}:${principal.user_id}:${JSON.stringify(principal.permissions)}`}
            report={selected}
            principal={principal}
            preview={preview}
          />
        ) : (
          <Card className="executive-card workspace-detail">
            <CardHeader>
              <CardTitle>Parameter laporan</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-60 w-full" />
              ) : (
                <p className="executive-muted">Pilih laporan untuk melihat parameter.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <Card className="executive-card workspace-exports">
        <CardHeader>
          <CardTitle>Ekspor saya</CardTitle>
          <span>File privat · sesuai hak akses</span>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="sr-only">
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
                  <TableCell colSpan={3}>
                    <Skeleton className="h-40 w-full" />
                  </TableCell>
                </TableRow>
              ) : exports.length ? (
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
                  <TableCell colSpan={3}>
                    <WorkspaceEmpty
                      title={
                        failed
                          ? "Gagal dimuat"
                          : scenario === "empty"
                            ? "Belum ada ekspor"
                            : "Belum tersedia"
                      }
                      reason={
                        failed
                          ? "Riwayat gagal dimuat. Gunakan tombol coba lagi."
                          : (data?.exports.reason ??
                            (scenario === "empty"
                              ? "Riwayat kosong (simulasi)."
                              : "Layanan file ekspor belum tersedia."))
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function ReportParameters({
  report,
  principal,
  preview,
}: {
  report: ReportCatalogItem;
  principal: AuthPrincipal;
  preview: boolean;
}) {
  const { reload } = useSession();
  const [asOf, setAsOf] = useState(() => (preview ? "2026-09-28" : businessDate())),
    [format, setFormat] = useState("xlsx");
  const [message, setMessage] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const valid = reportParametersSchema.safeParse({
    as_of: asOf,
    format,
    scope: "authorized",
  }).success;
  const query = useQuery({
    queryKey: [
      "reports",
      "preview",
      principal.company_id,
      principal.user_id,
      principal.permissions,
      report.code,
      asOf,
      format,
    ],
    queryFn: async ({ signal }) =>
      reportPreviewResponseSchema.parse(
        await apiRequest(
          `/reports/${report.code}/preview?${new URLSearchParams({ as_of: asOf, format, scope: "authorized" })}`,
          { signal },
        ),
      ).data,
    enabled: !preview && requested && valid,
    retry: false,
  });
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) void reload();
  }, [query.error, reload]);
  const clear = () => {
    setMessage(null);
    setRequested(false);
  };
  async function requestExport() {
    if (busy || !valid) return;
    if (preview) {
      setMessage("Data simulasi. Tidak ada pekerjaan atau file yang dibuat.");
      toast.info("Generator ekspor belum tersedia.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest(`/reports/${report.code}/exports`, {
        method: "POST",
        body: JSON.stringify({ as_of: asOf, format, scope: "authorized" }),
      });
      setMessage("Status ekspor belum terkonfirmasi. Muat ulang riwayat untuk memeriksa.");
    } catch (e) {
      setMessage(
        e instanceof ApiError
          ? e.message
          : "Layanan tidak dapat dijangkau. Ekspor belum terkonfirmasi.",
      );
      if (e instanceof ApiError && e.status === 401) void reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="executive-card workspace-detail workspace-parameters">
      <CardHeader>
        <CardTitle>{report.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field data-invalid={!valid}>
            <FieldLabel htmlFor="report-date">Tanggal acuan</FieldLabel>
            <Button
              id="report-date"
              variant="outline"
              className="workspace-date"
              disabled={busy}
              aria-expanded={dateOpen}
              aria-controls="report-date-input"
              onClick={() => setDateOpen(!dateOpen)}
            >
              <CalendarDays data-icon="inline-start" />
              {valid
                ? new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "Asia/Makassar",
                  }).format(new Date(`${asOf}T00:00:00+08:00`))
                : "Pilih tanggal"}
              <ChevronDown data-icon="inline-end" />
            </Button>
            {dateOpen && (
              <Input
                id="report-date-input"
                aria-label="Ubah tanggal acuan"
                disabled={busy}
                type="date"
                min="1900-01-01"
                max="2199-12-31"
                value={asOf}
                aria-invalid={!valid}
                aria-describedby={!valid ? "report-date-error" : undefined}
                onChange={(e) => {
                  setAsOf(e.target.value);
                  clear();
                }}
              />
            )}
            {!valid && (
              <p id="report-date-error" role="alert">
                Pilih tanggal yang valid.
              </p>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="report-scope">
              {report.code === "ar-aging" ? "Cakupan pelanggan" : "Cakupan laporan"}
            </FieldLabel>
            <Select value="authorized">
              <SelectTrigger id="report-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="authorized">Seluruh cakupan yang diizinkan</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="report-format">Format ekspor</FieldLabel>
            <Select
              value={format}
              disabled={busy}
              onValueChange={(v) => {
                setFormat(v);
                clear();
              }}
            >
              <SelectTrigger id="report-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          disabled={!valid || query.isFetching || busy}
          onClick={() => {
            setMessage(null);
            if (preview) setMessage(report.reason);
            else if (requested) void query.refetch();
            else setRequested(true);
          }}
        >
          Pratinjau
        </Button>
        <Button disabled={!valid || busy || query.isFetching} onClick={() => void requestExport()}>
          {busy ? "Memeriksa…" : "Buat ekspor"}
        </Button>
      </CardFooter>
      {(message || requested) && (
        <Alert role="status">
          <AlertDescription>
            {message ??
              (query.isFetching
                ? "Memeriksa laporan…"
                : query.error
                  ? "Laporan tidak dapat dimuat atau akses tidak mencukupi."
                  : query.data?.reason)}
            <span>Lokasi laporan: {report.owner_path}</span>
          </AlertDescription>
        </Alert>
      )}
      {!preview && <p className="workspace-coverage">{report.reason}</p>}
    </Card>
  );
}
