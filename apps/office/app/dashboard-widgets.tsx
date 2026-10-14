"use client";

import type { DashboardSummary } from "@evflow/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Info,
  LayoutGrid,
  Lightbulb,
  LogOut,
  Bell,
  MoreHorizontal,
  SlidersHorizontal,
  History,
  ArrowUpRight,
  ClipboardList,
  Building2,
  Search,
  PackageSearch,
  Truck,
  FileText,
} from "lucide-react";
import type { ReactNode } from "react";

type SalesSummary = NonNullable<DashboardSummary["sales"]>;
type Metric = SalesSummary["metrics"][number];

function metric(sales: SalesSummary | null | undefined, code: string) {
  return sales?.metrics.find((item) => item.code === code);
}

function MetricValue({ item }: { item?: Metric | undefined }) {
  return (
    <span className="text-foreground text-xl font-semibold tabular-nums">
      {item ? item.value.toLocaleString("id-ID") : "—"}
    </span>
  );
}

export function Topbar({
  companyName,
  displayName,
  role,
  onLogout,
}: {
  companyName: string;
  displayName: string;
  role: string;
  onLogout?: () => void;
}) {
  return (
    <header className="border-border bg-card flex min-h-14 items-center justify-between gap-3 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Building2 aria-hidden="true" className="text-primary size-4 shrink-0" />
        <p className="text-foreground truncate text-sm font-semibold">{companyName}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="border-border bg-card text-muted-foreground hidden h-9 w-60 items-center gap-2 rounded-sm border px-3 text-xs lg:flex">
          <Search aria-hidden="true" className="size-4" />
          <span>Cari dokumen, pelanggan…</span>
          <kbd className="border-border ml-auto rounded border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-sm"
          aria-label="Notifikasi belum tersedia"
          title="Notifikasi belum tersedia"
          disabled
        >
          <Bell aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 rounded-sm px-2">
              <Avatar size="sm" className="bg-primary text-primary-foreground">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {displayName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left sm:block">
                <span className="block max-w-32 truncate text-xs font-semibold">{displayName}</span>
                <span className="text-muted-foreground block max-w-32 truncate text-[11px]">
                  {role}
                </span>
              </span>
              <MoreHorizontal aria-hidden="true" className="text-muted-foreground size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Profil saya</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Profil · belum tersedia</DropdownMenuItem>
            <DropdownMenuItem disabled={!onLogout} {...(onLogout ? { onSelect: onLogout } : {})}>
              <LogOut aria-hidden="true" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function DashboardFilters() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="h-9 rounded-sm">
        1–28 September 2026
      </Button>
      <Button variant="outline" size="sm" className="h-9 rounded-sm">
        Seluruh cakupan
      </Button>
      <Button size="sm" className="h-9 rounded-sm">
        Refresh
      </Button>
    </div>
  );
}

export function ExecutiveKpiGrid({ sales }: { sales: SalesSummary | null | undefined }) {
  const total = metric(sales, "prospects_total");
  const cards = [
    ["Nilai Sales Order", null, "Belum tersedia", "Finance/Sales"],
    ["Penjualan net", null, "Belum tersedia", "Finance"],
    ["Penerimaan tagihan", null, "Belum tersedia", "Finance"],
    ["Prospek aktif", total?.value ?? null, total?.unit ?? "Belum tersedia", "Sales & Marketing"],
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value, unit, source]) => (
        <Card key={label} className="border-border rounded-md shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">{label}</p>
              <Info aria-hidden="true" className="text-muted-foreground size-3.5" />
            </div>
            <p className="text-foreground mt-4 text-2xl font-semibold tabular-nums">
              {value === null ? "Belum tersedia" : value.toLocaleString("id-ID")}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{unit}</p>
            <p className="text-muted-foreground mt-3 text-[11px]">Sumber: {source}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PerformancePanel() {
  return (
    <Card className="border-border min-h-[320px] rounded-md shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 p-5 pb-3">
        <div>
          <CardTitle className="text-sm">Pencapaian penjualan net</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">Target dan aktual per bulan</p>
        </div>
        <Badge variant="outline" className="border-border bg-muted rounded-full text-[11px]">
          Belum tersedia
        </Badge>
      </CardHeader>
      <CardContent className="text-muted-foreground flex min-h-[230px] items-center justify-center p-5 text-center text-sm">
        Data target dan penjualan net belum terhubung pada sumber dashboard ini.
      </CardContent>
    </Card>
  );
}

export function ActionList({ actions }: { actions: SalesSummary["actions"] | null | undefined }) {
  const items = actions?.slice(0, 3) ?? [];
  const icons = [PackageSearch, Truck, FileText];
  return (
    <Card className="border-border rounded-md shadow-none">
      <CardHeader className="flex-row items-center justify-between p-5 pb-3">
        <CardTitle className="text-sm">Perlu ditindaklanjuti</CardTitle>
        <Button variant="link" size="sm" className="h-auto px-0 text-xs" disabled={!items.length}>
          Lihat semua <ArrowUpRight data-icon="inline-end" />
        </Button>
      </CardHeader>
      <CardContent className="p-5 pt-1">
        {items.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {items.map((item, index) => {
              const Icon = icons[index] ?? ClipboardList;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-primary bg-accent flex size-10 shrink-0 items-center justify-center rounded-sm">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{item.action}</span>
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {item.customer_name} · {item.prospect_code}
                    </span>
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-primary ml-auto size-4 shrink-0"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Belum ada tindakan yang dapat ditampilkan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function WelcomeBanner({ name, onCustomize }: { name: string; onCustomize: () => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Hai, {name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Berikut ringkasan aktivitas hari ini</p>
      </div>
      <Button variant="outline" size="sm" className="h-9 rounded-sm" onClick={onCustomize}>
        <LayoutGrid data-icon="inline-start" />
        Kustomisasi
      </Button>
    </div>
  );
}

export function InfoBanner({
  asOf,
  message = "Ringkasan baca-saja · Data mengikuti izin Anda",
}: {
  asOf?: string;
  message?: string;
}) {
  return (
    <Alert className="border-border bg-muted rounded-sm py-2.5">
      <Info aria-hidden="true" />
      <AlertTitle className="text-foreground text-xs font-medium">{message}</AlertTitle>
      <AlertDescription className="text-xs">
        {asOf
          ? `Diperbarui ${new Date(asOf).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" })} WITA`
          : "Menunggu data terbaru"}
      </AlertDescription>
    </Alert>
  );
}

export function SummaryCard({
  sales,
  preview = false,
}: {
  sales: SalesSummary | null | undefined;
  preview?: boolean;
}) {
  const total = metric(sales, "prospects_total");
  const items = [
    ["Baru", metric(sales, "prospects_new"), "Prospek baru"],
    ["Dalam Pendekatan", metric(sales, "prospects_in_progress"), "Sedang ditindaklanjuti"],
    ["Potensial", metric(sales, "prospects_potential"), "Status potensial"],
    ["Ditunda", metric(sales, "prospects_deferred"), "Tindak lanjut ditunda"],
  ] as const;
  return (
    <Card className="border-border rounded-md shadow-none">
      <CardHeader className="gap-3 p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Ringkasan Prospek</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">Institusi dalam pendekatan CRM</p>
          </div>
          <Badge variant="outline" className="border-border bg-muted rounded-full text-[11px]">
            CRM
          </Badge>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-primary text-3xl font-semibold tabular-nums">
              {total ? total.value.toLocaleString("id-ID") : "—"}
            </div>
            <p className="text-muted-foreground text-xs">{total?.unit ?? "Belum tersedia"}</p>
            {preview ? (
              <p className="mt-1 text-xs font-medium text-green-700">↑ 12% · simulasi</p>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">
                Perbandingan periode belum tersedia
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-9 rounded-sm px-2.5">
              <LayoutGrid data-icon="inline-start" />
              Overview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-sm px-2.5"
              disabled
              title="Riwayat belum tersedia"
            >
              <History data-icon="inline-start" />
              Riwayat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-sm px-2.5"
              disabled
              title="Filter belum tersedia"
            >
              <SlidersHorizontal data-icon="inline-start" />
              Filter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-2">
          {items.map(([label, item, hint]) => (
            <div key={label} className="bg-card border-border rounded-sm border p-3">
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                {label}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="focus-visible:outline-ring inline-flex rounded-sm focus-visible:outline-2"
                      aria-label={`Info ${label}`}
                    >
                      <Info aria-hidden="true" className="size-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{hint}</TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-2">
                <MetricValue item={item} />
              </div>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {item ? item.unit : "Belum tersedia"}
              </p>
            </div>
          ))}
        </div>
        <Button
          variant="link"
          className="mt-2 h-auto px-0 text-xs"
          disabled
          title="Detail prospek belum tersedia"
        >
          Lihat detail <ArrowUpRight data-icon="inline-end" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function SideInsightCard({
  title,
  children,
  icon = <Lightbulb aria-hidden="true" />,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="border-border rounded-md shadow-none">
      <CardContent className="flex gap-3 p-4">
        <div className="text-primary bg-accent flex size-8 shrink-0 items-center justify-center rounded-sm">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-5">{children}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TodoCard({ count }: { count: number | null }) {
  return (
    <Card className="border-border rounded-md shadow-none">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">Hal yang Perlu Dilakukan</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3 p-4 pt-0">
        <div>
          <div className="text-primary text-3xl font-semibold tabular-nums">
            {count === null ? "—" : count}
          </div>
          <p className="text-muted-foreground text-xs">
            {count === 0
              ? "Belum ada tugas CRM yang perlu ditinjau"
              : count === null
                ? "Antrean belum tersedia"
                : "Tugas CRM perlu ditinjau"}
          </p>
        </div>
        <ClipboardList aria-hidden="true" className="text-muted-foreground size-7" />
      </CardContent>
    </Card>
  );
}

const simulationRows = [
  ["20 Sep 2026", "Tagihan contoh RS Bahagia", "Piutang", "Rp 1.250.000", "Menunggu"],
  ["19 Sep 2026", "Pembayaran contoh pelanggan", "Kas Masuk", "Rp 850.000", "Selesai"],
  ["18 Sep 2026", "Pesanan contoh pelanggan", "Penjualan", "Rp 2.100.000", "Aktif"],
] as const;

export function TransactionTable({ preview = false }: { preview?: boolean }) {
  return (
    <Card className="border-border rounded-md shadow-none">
      <CardHeader className="flex-row items-center justify-between p-4 pb-3">
        <div>
          <CardTitle className="text-sm">Riwayat Transaksi</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            {preview
              ? "Data simulasi untuk pratinjau tampilan"
              : "Sumber transaksi belum terhubung"}
          </p>
        </div>
        <Button
          variant="link"
          className="h-auto px-0 text-xs"
          disabled
          title="Riwayat transaksi belum tersedia"
        >
          Lihat semua
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[620px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Tanggal</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview ? (
              simulationRows.map(([date, description, category, amount, status]) => (
                <TableRow key={date + description}>
                  <TableCell className="text-muted-foreground pl-4 text-xs">{date}</TableCell>
                  <TableCell className="text-sm font-medium">{description}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{category}</TableCell>
                  <TableCell className="text-sm tabular-nums">{amount}</TableCell>
                  <TableCell className="pr-4">
                    <Badge
                      variant="outline"
                      className={
                        status === "Selesai"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : status === "Menunggu"
                            ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                            : "border-blue-200 bg-blue-50 text-blue-700"
                      }
                    >
                      {status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground px-4 py-8 text-center text-sm"
                >
                  Belum ada transaksi yang dapat ditampilkan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
