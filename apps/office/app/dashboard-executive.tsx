"use client";

import type { AuthPrincipal } from "@evflow/contracts";
import Link from "next/link";
import { hasCompanyPermission } from "../lib/navigation";
import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpRight,
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  PackageSearch,
  Search,
  RefreshCw,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import "./dashboard-executive.css";

const fixtureRows = [
  [
    "INV/2026/09/0148",
    "Invoice Penjualan",
    "RS Sehat Sentosa",
    "Rp24.750.000",
    "Diposting",
    "09.38",
  ],
  [
    "RCV/2026/09/0086",
    "Penerimaan Tagihan",
    "Klinik Mitra Utama",
    "Rp18.500.000",
    "Diposting",
    "09.24",
  ],
  [
    "SO/2026/09/0192",
    "Sales Order",
    "RS Harapan Medika",
    "Rp32.400.000",
    "Open · Sebagian",
    "09.12",
  ],
  ["GR/2026/09/0064", "Penerimaan Barang", "PT Medika Nusantara", "—", "Diposting", "08.56"],
];
const kpis = [
  {
    title: "Nilai Sales Order",
    value: "Rp586.000.000",
    note: "32 pesanan diajukan",
    icon: ClipboardList,
  },
  {
    title: "Penjualan net",
    value: "Rp428.500.000",
    note: "Invoice diposting · setelah retur",
    icon: TrendingUp,
  },
  {
    title: "Penerimaan tagihan",
    value: "Rp312.800.000",
    note: "Pembayaran diposting & dialokasikan",
    icon: Banknote,
  },
  {
    title: "Piutang terbuka",
    value: "Rp215.400.000",
    note: "Posisi per 28 September 2026",
    icon: Wallet,
  },
];
const barHeights = [
  [71.3, 92],
  [81.42, 92],
  [87.86, 103.5],
  [92.23, 103.5],
  [102.58, 115],
  [98.555, 115],
];
const months = ["Apr", "Mei", "Jun", "Jul", "Agu", "Sep"];

export function ExecutiveTopbar({
  companyName,
  preview = false,
}: {
  companyName: string;
  preview?: boolean;
}) {
  return (
    <header className="executive-topbar">
      <div className="executive-company">
        <SidebarTrigger className="md:hidden" aria-label="Buka menu" />
        <Building2 aria-hidden="true" />
        <strong>{companyName}</strong>
      </div>
      <div className="executive-utilities">
        <div className="executive-search" title="Pencarian global belum tersedia">
          <Search aria-hidden="true" />
          <span>Cari menu atau dokumen</span>
        </div>
        <Button variant="ghost" size="icon" disabled aria-label="Notifikasi belum tersedia">
          <Bell aria-hidden="true" />
        </Button>
        {preview && <Badge className="executive-demo">Data simulasi</Badge>}
      </div>
    </header>
  );
}

export function ExecutiveDashboard({
  name,
  principal,
  preview = false,
  asOf,
  loading = false,
  failed = false,
  onRefresh,
}: {
  name: string;
  principal?: AuthPrincipal;
  preview?: boolean;
  asOf?: string | undefined;
  loading?: boolean;
  failed?: boolean;
  onRefresh?: (() => void) | undefined;
}) {
  const shortcuts = [
    {
      title: "Sales Order",
      note: "Kelola pesanan pelanggan",
      href: "/operations/orders",
      permission: "sales_order.read",
      icon: ClipboardList,
    },
    {
      title: "Pelanggan",
      note: "Temukan data pelanggan",
      href: "/master-data/customers",
      permission: "master_data.read",
      icon: Building2,
    },
    {
      title: "Pemenuhan & POD",
      note: "Pantau pengiriman pesanan",
      href: "/operations/warehouse",
      permission: "fulfillment.read",
      icon: Truck,
    },
    {
      title: "Invoice & Pembayaran",
      note: "Buka tagihan pelanggan",
      href: "/operations/invoices",
      permission: "sales_invoice.read",
      icon: Wallet,
    },
  ].filter((item) => principal && hasCompanyPermission(principal, item.permission));
  const [notice, setNotice] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const historyRows = useMemo(
    () =>
      preview
        ? fixtureRows.filter((row) => {
            if (moduleFilter === "sales") return row[1] === "Sales Order";
            if (moduleFilter === "warehouse") return row[1] === "Penerimaan Barang";
            if (moduleFilter === "finance")
              return row[1] === "Invoice Penjualan" || row[1] === "Penerimaan Tagihan";
            return true;
          })
        : [],
    [preview, moduleFilter],
  );
  const unavailable = () =>
    setNotice(
      preview
        ? "Ini pratinjau desain dengan data simulasi. Tindakan operasional tersedia setelah sumber modul terhubung."
        : "Sumber data untuk tindakan ini belum tersedia.",
    );
  const columns = useMemo<ColumnDef<string[]>[]>(
    () =>
      ["Dokumen", "Jenis", "Pelanggan / pihak", "Nilai", "Status", "Waktu"].map(
        (header, index) => ({
          id: header,
          header,
          accessorFn: (row) => row[index],
          cell: (context) =>
            index === 4 ? (
              <Badge
                className={
                  context.getValue() === "Diposting" ? "executive-posted" : "executive-open"
                }
              >
                {String(context.getValue())}
              </Badge>
            ) : index === 0 ? (
              <button className="executive-text-link" onClick={unavailable}>
                {String(context.getValue())}
              </button>
            ) : (
              String(context.getValue())
            ),
        }),
      ),
    [preview],
  );
  const table = useReactTable({
    data: historyRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const dateLabel = preview
    ? "1–28 September 2026"
    : asOf
      ? `Posisi per ${new Date(asOf).toLocaleDateString("id-ID")}`
      : "Tanggal acuan belum tersedia";
  const current = preview
    ? "28 Sep 2026, 09.41 WITA"
    : asOf
      ? new Date(asOf).toLocaleString("id-ID")
      : "Belum tersedia";
  return (
    <section
      id="dashboard-main"
      tabIndex={-1}
      className="executive-content"
      aria-label="Ringkasan Eksekutif"
      aria-busy={loading}
    >
      <div className="executive-heading">
        <div>
          <p className="executive-breadcrumb">Dashboard / Ringkasan Eksekutif</p>
          <h1>{preview ? "Selamat pagi, Andi" : `Selamat datang, ${name.split(" ")[0]}`}</h1>
          <p className="modern-intro">Ringkasan bisnis dan pekerjaan Anda, dalam satu tempat.</p>
        </div>
        <div className="executive-controls">
          <Button
            variant="outline"
            onClick={unavailable}
            disabled={!preview}
            title={!preview ? "Filter periode belum tersedia" : undefined}
          >
            <CalendarDays data-icon="inline-start" />
            {preview ? "September 2026" : "Periode"}
            <ChevronDown data-icon="inline-end" />
          </Button>
          <Button
            variant="outline"
            onClick={unavailable}
            disabled={!preview}
            title={!preview ? "Ekspor ringkasan belum tersedia" : undefined}
          >
            <Download data-icon="inline-start" />
            Ekspor
          </Button>
        </div>
      </div>
      <div className="executive-freshness">
        <span>{dateLabel} · Seluruh cakupan yang diizinkan</span>
        <button
          disabled={loading}
          onClick={() =>
            onRefresh
              ? onRefresh()
              : setNotice("Data simulasi mengikuti snapshot mockup 28 September 2026.")
          }
          className="executive-refresh"
        >
          <RefreshCw
            aria-hidden="true"
            className={failed ? "executive-refresh-icon failed" : "executive-refresh-icon"}
          />
          {failed
            ? "Gagal diperbarui · Coba lagi"
            : loading
              ? "Memperbarui…"
              : `Diperbarui ${current}`}
        </button>
      </div>
      {notice && (
        <Alert role="status" className="executive-notice">
          <AlertDescription>
            {notice}
            <Button variant="ghost" size="sm" onClick={() => setNotice("")}>
              Tutup
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {failed && (
        <Alert variant="destructive" role="alert" className="executive-notice">
          <AlertDescription>
            Ringkasan gagal diperbarui. Periksa koneksi lalu gunakan tombol Coba lagi. Angka sumber
            belum tersedia.
          </AlertDescription>
        </Alert>
      )}
      {!preview && (
        <div className="modern-workspace-banner">
          <div className="modern-banner-copy">
            <span className="modern-eyebrow">RUANG KERJA ANDA</span>
            <h2>Mulai dari yang perlu ditindaklanjuti.</h2>
            <p>Buka tugas Anda atau lanjutkan pekerjaan di modul operasional.</p>
          </div>
          <Button asChild className="modern-task-button">
            <Link href="/?view=actions">
              Buka tugas saya <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      )}
      <section className="executive-kpis" aria-label="Ringkasan kinerja">
        {kpis.map((item) => (
          <Card className="executive-card executive-kpi" key={item.title}>
            <CardHeader className="executive-card-header">
              <CardTitle>{item.title}</CardTitle>
              <item.icon aria-hidden="true" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="executive-kpi-skeleton" aria-label={`Memuat ${item.title}`} />
              ) : (
                <p className={preview ? "executive-value" : "executive-unavailable-value"}>
                  {preview ? item.value : "Belum tersedia"}
                </p>
              )}
              <p className="executive-muted">
                {preview ? item.note : "Sumber transaksi belum terhubung"}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Card className="executive-card executive-actions">
        <CardHeader className="executive-card-header">
          <CardTitle>Perlu ditindaklanjuti</CardTitle>
          {preview ? (
            <button className="executive-text-link" onClick={unavailable}>
              Lihat semua tugas ↗
            </button>
          ) : (
            <Link className="executive-text-link" href="/?view=actions">
              Lihat semua tugas ↗
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {preview ? (
            <div className="executive-action-grid">
              {[
                {
                  label: "6 pesanan backorder",
                  owner: "Warehouse & Logistik",
                  icon: PackageSearch,
                },
                { label: "4 pengiriman menunggu pod", owner: "Warehouse & Logistik", icon: Truck },
                { label: "3 tagihan perlu dicocokkan", owner: "Finance", icon: FileText },
              ].map((item) => (
                <button key={item.label} onClick={unavailable} className="executive-action">
                  <span className="executive-action-icon">
                    <item.icon aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.owner}</small>
                  </span>
                  <ArrowUpRight aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="modern-task-empty">
              <span className="modern-empty-icon">
                <ClipboardCheck aria-hidden="true" />
              </span>
              <div>
                <strong>Antrean lintas modul belum tersedia</strong>
                <p className="executive-muted">
                  Tindak lanjut yang sudah terhubung dapat dilihat di halaman tugas Anda.
                </p>
              </div>
              <Link href="/?view=actions" className="executive-text-link">
                Buka tugas <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="executive-performance">
        <Card className="executive-card executive-chart">
          <CardHeader className="executive-card-header">
            <div>
              <CardTitle>Penjualan net &amp; target</CardTitle>
              <p className="executive-muted">
                {preview
                  ? "Dalam juta rupiah · September s.d. 28 Sep"
                  : "Dalam juta rupiah · Sesuai periode sumber"}
              </p>
            </div>
            <button className="executive-text-link" onClick={unavailable}>
              Lihat A/T Penjualan ↗
            </button>
          </CardHeader>
          <CardContent>
            {preview ? (
              <>
                <div className="executive-chart-totals">
                  {[
                    ["Aktual September", "Rp428,5 jt"],
                    ["Target September", "Rp500 jt"],
                    ["A/T September", "85,7%"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="executive-muted">{label}</p>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div
                  className="executive-bars"
                  role="img"
                  aria-label="Grafik simulasi April sampai September: aktual dibanding target. September aktual Rp428,5 juta, target Rp500 juta, pencapaian 85,7 persen."
                >
                  {barHeights.map(([actual, target], index) => (
                    <div className="executive-month" key={months[index]}>
                      <div className="executive-bar-pair">
                        <span style={{ height: actual }} />
                        <span style={{ height: target }} />
                      </div>
                      <span>{months[index]}</span>
                    </div>
                  ))}
                </div>
                <div className="executive-legend">
                  <span>
                    <i />
                    Aktual
                  </span>
                  <span>
                    <i />
                    Target
                  </span>
                </div>
                <details className="executive-chart-data">
                  <summary>Rincian grafik</summary>
                  <Table>
                    <caption>
                      Data simulasi September · juta rupiah. Bulan lain berupa bentuk visual dari
                      mockup; nilai sumber belum tersedia.
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Periode</TableHead>
                        <TableHead>Aktual</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>A/T</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>September</TableCell>
                        <TableCell>428,5</TableCell>
                        <TableCell>500</TableCell>
                        <TableCell>85,7%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </details>
              </>
            ) : (
              <div className="executive-empty modern-chart-empty">
                <span className="modern-empty-icon">
                  <TrendingUp aria-hidden="true" />
                </span>
                <strong>{loading ? "Memuat ringkasan…" : "Tren penjualan belum tersedia"}</strong>
                <p>Perbandingan aktual dan target akan tampil setelah sumber data terhubung.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="executive-attention">
          <Card className="executive-card">
            <CardHeader className="executive-card-header">
              <CardTitle>Piutang lewat jatuh tempo</CardTitle>
              <Clock3 className="executive-overdue-icon" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className={cn("executive-overdue", !preview && "executive-unavailable-value")}>
                {preview ? "Rp68.200.000" : "Belum tersedia"}
              </p>
              <div className="executive-detail-row">
                {preview ? (
                  <Badge className="executive-warning">8 invoice</Badge>
                ) : (
                  <span className="executive-muted">Sumber Finance</span>
                )}
                <button className="executive-text-link" onClick={unavailable}>
                  Lihat aging ↗
                </button>
              </div>
            </CardContent>
          </Card>
          <Card className="executive-card">
            <CardHeader className="executive-card-header">
              <CardTitle>Persetujuan saya</CardTitle>
              <ClipboardCheck aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className={cn("executive-approval", !preview && "executive-unavailable-value")}>
                {preview ? "5 menunggu keputusan" : "Belum tersedia"}
              </p>
              <div className="executive-detail-row">
                <span className="executive-muted">PR, pembayaran &amp; unlock</span>
                {preview ? (
                  <button className="executive-text-link" onClick={unavailable}>
                    Buka tugas ↗
                  </button>
                ) : (
                  <Link className="executive-text-link" href="/?view=actions">
                    Buka tugas ↗
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {!preview && shortcuts.length > 0 && (
        <section className="modern-shortcuts" aria-label="Akses cepat">
          <div className="modern-section-title">
            <h2>Akses cepat</h2>
            <span>Modul operasional sesuai akses Anda</span>
          </div>
          <div className="modern-shortcut-grid">
            {shortcuts.map((item) => (
              <Link href={item.href} key={item.href} className="modern-shortcut">
                <span className="modern-shortcut-icon">
                  <item.icon aria-hidden="true" />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.note}</small>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
      <Card className="executive-card executive-history">
        <CardHeader className="executive-card-header">
          <CardTitle>Riwayat transaksi terbaru</CardTitle>
          <Select value={moduleFilter} onValueChange={setModuleFilter} disabled={!preview}>
            <SelectTrigger aria-label="Filter modul riwayat" className="executive-history-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Semua modul</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {!preview && (
                <TableRow>
                  <TableCell colSpan={6}>Riwayat transaksi belum tersedia.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="executive-table-footer">
            <span>
              {preview
                ? `${historyRows.length} transaksi ditampilkan · 28 September 2026`
                : "Sumber transaksi belum terhubung"}
            </span>
            <button className="executive-text-link" onClick={unavailable}>
              Buka riwayat sesuai modul ↗
            </button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
