"use client";
import { SalesPeriod, SalesNavigation } from "./sales-experience";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Search, Plus, ArrowLeft, FileText, Package, Truck, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DashboardSidebar } from "../dashboard-sidebar";
import { ExecutiveTopbar } from "../dashboard-executive";
import { DataTable } from "../crm/crm-common";
import { SelectionField } from "@/components/web/selection-field";
import { ErrorBox, type Row } from "./workspace";
import { SalesExceptions } from "./extended-controls";
import { SalesOrderForm, CloseRemainder } from "./sales-order-form";
import { amount, terms, orderStates, type Order, type OrderCommand } from "./sales-order-types";
import { OrderJourney } from "./sales-order-journey";
import "./sales-order.css";
import "./sales-order-modern.css";
type OrderList = {
  rows: Order[];
  total: number;
  summary: {
    draft: number;
    open: number;
    partial: number;
    creditHold: number | null;
    backorder: number;
  };
  asOf: string;
};

export function SalesOrderWorkspace({ path }: { path: string[] }) {
  const session = useSession();
  const principal = session.principal,
    state = session.state;
  const base = "/operations/orders";
  const router = useRouter();
  const client = useQueryClient();
  const id = path[1],
    creating = id === "new",
    editing = path[2] === "edit",
    list = !id;
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [page, setPage] = useState(1);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const keys = useRef(new Map<string, string>());
  const busy = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const allowed =
    can(creating ? "sales_order.create" : "sales_order.read") &&
    (!editing || can("sales_order.update"));
  const endpoint = list
    ? `/operations/lists/orders?page=${page}&search=${encodeURIComponent(debounced)}${filter !== "ALL" ? `&state=${filter}` : ""}`
    : `/operations/orders/${id}`;
  const query = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, endpoint],
    queryFn: ({ signal }) =>
      apiRequest<{
        data: Order | OrderList;
      }>(endpoint, { signal }),
    enabled: allowed && !creating,
    placeholderData: (previous, previousQuery) =>
      list &&
      previousQuery?.queryKey[1] === principal?.company_id &&
      previousQuery?.queryKey[2] === principal?.user_id &&
      String(previousQuery?.queryKey[3]).startsWith("/operations/lists/orders?")
        ? previous
        : undefined,
  });
  const command: OrderCommand = async (url, body = {}) => {
    if (busy.current) throw new Error("Penyimpanan masih berlangsung.");
    busy.current = true;
    setPending(true);
    setError("");
    const signature = `${url}:${JSON.stringify(body)}`;
    const key = keys.current.get(signature) ?? crypto.randomUUID();
    keys.current.set(signature, key);
    try {
      const result = await apiRequest<{ data: Row }>(url, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
      keys.current.delete(signature);
      await client.invalidateQueries({ queryKey: ["operations"] });
      const evaluationError = (result.data as Row & { evaluation_error?: string }).evaluation_error;
      if (evaluationError) {
        setError(`Persetujuan tersimpan; evaluasi SO belum selesai: ${evaluationError}`);
        toast.warning("Persetujuan tersimpan; SO masih perlu dievaluasi.");
      } else toast.success("Perubahan tersimpan.");
      return result;
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Hasil belum terkonfirmasi. Muat ulang sebelum mencoba kembali.";
      setError(message);
      throw e;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  if (!principal)
    return (
      <main>
        <p role="status">
          {state === "loading" ? "Memuat sesi…" : "Silakan masuk untuk mengakses Sales Order."}
        </p>
        <Link href="/login">Masuk</Link>
      </main>
    );
  const row = !list ? (query.data?.data as Order | undefined) : undefined;

  const listing = list ? (query.data?.data as OrderList | undefined) : undefined;
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <DashboardSidebar principal={principal} activeView="sales" activeSection="sales" />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        <main className="executive-content crm-content otc-workspace so-workspace sales-sketch">
          <header className="executive-heading">
            <div>
              <nav className="executive-breadcrumb" aria-label="Breadcrumb">
                Sales & Marketing / Pesanan Pelanggan / <Link href={base}>Sales Order</Link>
              </nav>
              <h1>
                {list
                  ? "Sales Order"
                  : creating
                    ? "Buat Sales Order"
                    : editing
                      ? "Edit Sales Order"
                      : row
                        ? `${row.number} · ${row.customer?.name ?? ""}`
                        : "Detail Sales Order"}
              </h1>
              <p className="so-page-description">
                {list
                  ? "Kelola pesanan pelanggan dan pantau pemenuhannya."
                  : creating
                    ? "Lengkapi pelanggan dan produk untuk menyimpan draft pesanan."
                    : editing
                      ? "Perbarui rincian pesanan dan catat alasan revisi."
                      : row
                        ? `Dibuat ${new Date(row.createdAt).toLocaleDateString("id-ID")} oleh ${row.createdByName ?? "—"} · Total ${amount(row.total, row.currency)}`
                        : "Rincian pesanan pelanggan"}
              </p>
            </div>
            <SalesNavigation active="orders" />
          </header>
          {!allowed ? (
            <ErrorBox message="Anda belum memiliki izin untuk mengakses halaman ini." />
          ) : (
            <>
              {error && <ErrorBox message={error} />}
              {query.error ? (
                <>
                  <ErrorBox message={String(query.error)} />
                  <Button variant="outline" onClick={() => void query.refetch()}>
                    Coba lagi
                  </Button>
                </>
              ) : null}
              {!creating && query.isLoading ? (
                <div className="so-loading" role="status" aria-label="Memuat Sales Order">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : null}
              {creating || (editing && row) ? (
                <SalesOrderForm
                  key={editing && row ? `${row.id}:${row.version}` : "new"}
                  initial={editing ? row : undefined}
                  command={command}
                  pending={pending}
                  onSaved={(value) => router.push(`${base}/${value}`)}
                />
              ) : listing ? (
                <>
                  <div className="sales-list-tabs" aria-label="Antrean Sales Order">
                    <button disabled title="Antrean tugas personal belum tersedia">
                      Perlu tindakan saya
                    </button>
                    {[
                      ["ALL", "Semua"],
                      ["DRAFT", "Draft"],
                      ["OPEN", "Open"],
                      ["CLOSED", "Selesai / Closed"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={filter === value}
                        onClick={() => {
                          setFilter(value!);
                          setPage(1);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="so-context sr-only">
                    {query.isPlaceholderData
                      ? "Memuat hasil pencarian/filter terbaru…"
                      : `Cakupan perusahaan · Diperbarui ${new Date(listing.asOf).toLocaleString("id-ID")}`}
                  </p>
                  <section className="so-kpis" aria-label="Ringkasan Sales Order">
                    {[
                      { label: "Draft", value: listing.summary.draft, icon: FileText },
                      { label: "Open", value: listing.summary.open, icon: FileText },
                      { label: "Perlu tindakan saya", value: null, icon: Truck },
                      { label: "Backorder", value: listing.summary.backorder, icon: Package },
                    ].map(({ label, value, icon: Icon }) => (
                      <Panel key={label} title={label}>
                        <div className="so-metric-value">
                          <strong
                            title={
                              value == null
                                ? "Ringkasan hasil evaluasi kredit belum tersedia."
                                : undefined
                            }
                          >
                            {value ?? "—"}
                          </strong>
                          <Icon aria-hidden="true" />
                        </div>
                      </Panel>
                    ))}
                  </section>
                  <section className="sales-list-panel">
                    <h2>Daftar Sales Order</h2>
                    <DataTable
                      data={listing.rows}
                      columns={listColumns(base)}
                      total={listing.total}
                      pageSize={25}
                      page={page}
                      onPage={setPage}
                      busy={query.isFetching}
                      label="Sales Order"
                      showColumns={false}
                      toolbar={
                        <>
                          <InputGroup className="so-search">
                            <InputGroupAddon>
                              <Search aria-hidden="true" />
                            </InputGroupAddon>
                            <InputGroupInput
                              aria-label="Cari nama atau nomor dokumen"
                              placeholder="Cari nama atau nomor dokumen"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </InputGroup>
                          <div className="so-status-filter">
                            <SelectionField
                              label="Status pesanan"
                              hideLabel
                              value={[filter]}
                              options={Object.entries({
                                ALL: "Semua status",
                                DRAFT: "Draft",
                                OPEN: "Open",
                                CLOSED: "Closed",
                                CANCELLED: "Dibatalkan",
                              }).map(([id, name]) => ({ id, name }))}
                              onChange={(v) => {
                                setFilter(v[0] ?? "ALL");
                                setPage(1);
                              }}
                            />
                          </div>
                          <SalesPeriod />
                          {can("sales_order.create") && (
                            <Button className="sales-toolbar-create" asChild>
                              <Link href={`${base}/new`}>
                                <Plus />
                                Buat Sales Order
                              </Link>
                            </Button>
                          )}
                          {(search || filter !== "ALL") && (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setSearch("");
                                setDebounced("");
                                setFilter("ALL");
                                setPage(1);
                              }}
                            >
                              Reset filter
                            </Button>
                          )}
                        </>
                      }
                    />
                  </section>
                </>
              ) : row && !list && !editing ? (
                <OrderDetail row={row} command={command} pending={pending} can={can} />
              ) : null}
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
function Status({ children }: { children: string }) {
  if (["Belum dievaluasi", "Belum diperiksa", "Lihat evaluasi"].includes(children))
    return <span>{children}</span>;
  return (
    <Badge variant="outline" className="so-status" data-state={children}>
      {children}
    </Badge>
  );
}
const listColumns = (base: string): ColumnDef<Order>[] => [
  {
    id: "number",
    header: "No. SO",
    cell: ({ row }) => (
      <div className="so-order-identity">
        <Link className="so-link" href={`${base}/${row.original.id}`}>
          {row.original.number}
        </Link>
      </div>
    ),
  },
  { id: "customer", header: "Pelanggan", cell: ({ row }) => row.original.customer?.name ?? "—" },
  {
    id: "date",
    header: "Tanggal",
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
  },
  {
    id: "value",
    header: "Nilai SO",
    cell: ({ row }) => (
      <span
        className="so-list-amount"
        title={
          row.original.total == null
            ? "Total belum tersedia; pajak belum ditetapkan."
            : "Total termasuk pajak"
        }
      >
        {amount(row.original.total, row.original.currency)}
        {row.original.total == null && <small>Pajak belum ditetapkan</small>}
      </span>
    ),
  },
  {
    id: "state",
    header: "Status pesanan",
    cell: ({ row }) => <Status>{orderStates[row.original.state] ?? row.original.state}</Status>,
  },
  {
    id: "fulfillment",
    header: "Pemenuhan",
    cell: ({ row }) => <Status>{row.original.fulfillment}</Status>,
  },
  {
    id: "credit",
    header: "Kredit",
    cell: ({ row }) => (
      <span title="Status kredit terbaru tetap diperiksa oleh server saat evaluasi.">
        <Status>{row.original.state === "DRAFT" ? "Belum diperiksa" : "Lihat evaluasi"}</Status>
      </span>
    ),
  },
  {
    id: "remainder",
    header: "Sisa",
    cell: ({ row }) => <Status>{row.original.remainderStatus}</Status>,
  },
  {
    id: "next",
    header: "Langkah berikutnya",
    cell: ({ row: r }) =>
      r.original.state === "DRAFT"
        ? "Ajukan / evaluasi SO"
        : r.original.remainderStatus === "Backorder"
          ? "Tinjau alokasi dan backorder"
          : r.original.fulfillment === "Belum Dikirim"
            ? "Lanjutkan pemenuhan"
            : "Pantau POD dan tagihan",
  },
  {
    id: "action",
    header: "Tindakan",
    cell: ({ row: r }) => (
      <Button asChild variant={r.original.state === "DRAFT" ? "default" : "outline"}>
        <Link href={`${base}/${r.original.id}`}>Buka</Link>
      </Button>
    ),
  },
];
export function Value({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="so-value">
      <span>{label}</span>
      <div>{children || "—"}</div>
    </div>
  );
}
export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function Totals({
  subtotal,
  tax,
  total,
  currency,
  freight,
}: {
  subtotal?: string | undefined;
  tax?: string | null | undefined;
  total?: string | null | undefined;
  currency?: string | undefined;
  freight?: string | null | undefined;
}) {
  return (
    <aside className="so-totals">
      <div className="so-totals-title">
        <h3>Ringkasan nilai</h3>
        <span>{currency}</span>
      </div>
      <dl>
        <div>
          <dt>Subtotal barang</dt>
          <dd>{amount(subtotal, currency)}</dd>
        </div>
        <div>
          <dt>Estimasi ongkir per pengiriman</dt>
          <dd>{freight == null ? "Belum ditetapkan" : amount(freight, currency)}</dd>
        </div>
        <div>
          <dt>Pajak</dt>
          <dd>{tax == null ? "Belum ditetapkan" : amount(tax, currency)}</dd>
        </div>
        <div className="so-grand-total">
          <dt>Nilai barang termasuk pajak</dt>
          <dd>{total == null ? "Menunggu evaluasi" : amount(total, currency)}</dd>
        </div>
      </dl>
      <p className="so-help">
        Ongkir dan PPN ongkir dihitung pada masing-masing pengiriman. Estimasi di atas belum
        ditambahkan ke nilai barang.
      </p>
      {total == null && (
        <p className="so-help">
          Total pesanan tersedia setelah pajak ditetapkan saat evaluasi. Subtotal di atas belum
          termasuk pajak.
        </p>
      )}
    </aside>
  );
}
function OrderDetail({
  row,
  command,
  pending,
  can,
}: {
  row: Order;
  command: OrderCommand;
  pending: boolean;
  can: (p: string) => boolean;
}) {
  const [action, setAction] = useState<"close" | "cancel" | null>(null);
  const editable =
    ["DRAFT", "OPEN"].includes(row.state) &&
    row.fulfillments?.every((b) => b.state === "CANCELLED") &&
    row.lines.every((l) => /^0(?:\.0*)?$/.test(l.closedQuantity));
  return (
    <>
      <Button className="sales-back" variant="outline" asChild>
        <Link href="/operations/orders">
          <ArrowLeft />
          Kembali ke daftar
        </Link>
      </Button>
      <div className="so-print-area web-form">
        <div className="so-detail-overview">
          <div className="so-dimensions">
            <div>
              <span>Pesanan</span>
              <Status>{orderStates[row.state] ?? row.state}</Status>
            </div>
            <div>
              <span>Pemenuhan</span>
              <Status>{row.fulfillment}</Status>
            </div>
            <div>
              <span>Sisa pesanan</span>
              <Status>{row.remainderStatus}</Status>
            </div>
          </div>
        </div>
        <OrderJourney
          row={row}
          can={can}
          command={command}
          pending={pending}
          onCloseRemainder={() => setAction("close")}
          history={
            can("audit_event.read") ? (
              <History id={row.id} />
            ) : (
              <p>Anda tidak memiliki izin membaca riwayat.</p>
            )
          }
        >
          <div className="so-detail-layout">
            <div className="so-detail-main">
              <Panel title="Pelanggan & referensi">
                <div className="so-info-grid">
                  <Value label="Pelanggan">{row.customer?.name}</Value>
                  <Value label="Alamat">{row.deliveryAddress}</Value>
                  <Value label="Tanggal kirim diminta">Belum tersedia</Value>
                  <Value label="Referensi SP Pelanggan">{row.customerReference}</Value>
                  <Value label="Termin">{terms(row.paymentSnapshot)}</Value>
                  <Value label={"Dicatat oleh"}>{row.createdByName}</Value>
                </div>
              </Panel>
              <Panel title="Pengiriman & ongkos kirim">
                <Value label="Ongkos kirim">
                  {row.freightTermsSnapshot?.payer === "COMPANY"
                    ? "Ditanggung perusahaan"
                    : row.freightTermsSnapshot?.payer === "CARRIER"
                      ? "Ditanggung ekspedisi"
                      : "Ditagihkan ke pelanggan"}
                </Value>
                <Value label="Estimasi ongkir">
                  {row.freightEstimate == null
                    ? "Belum ditetapkan"
                    : amount(row.freightEstimate, row.currency)}
                </Value>
                <Value label="Penagihan">Per pengiriman</Value>
                <Value label="Perhitungan PPN">
                  {row.freightTermsSnapshot?.tax_mode === "TAXABLE"
                    ? "Sebelum PPN · Kena PPN"
                    : "Sesudah PPN · Tidak kena PPN"}
                </Value>
                <p className="so-help">Nilai final mengikuti masing-masing tahap pengiriman.</p>
              </Panel>
              <Panel title="Catatan SO">
                <p>{row.notes || "Tidak ada catatan."}</p>
              </Panel>
            </div>
            <aside className="so-detail-aside" aria-label="Nilai dan catatan pesanan">
              <Panel title="Nilai pesanan">
                <Totals
                  subtotal={row.subtotal}
                  tax={row.taxAmount}
                  total={row.total}
                  currency={row.currency}
                  freight={row.freightEstimate}
                />
              </Panel>
              <Panel title="Hasil evaluasi">
                <div className="sales-evaluation">
                  <Value label="Aturan pembayaran">
                    {row.paymentSnapshot ? terms(row.paymentSnapshot) : "Belum dievaluasi"}
                  </Value>
                  <Value label="Kredit">Lihat hasil evaluasi server</Value>
                  <Value label="Stok">
                    <Status>{row.remainderStatus}</Status>
                  </Value>
                  <Value label="Status pesanan">
                    <Status>{orderStates[row.state] ?? row.state}</Status>
                  </Value>
                </div>
              </Panel>
              <Panel title="Progres pemenuhan">
                {[
                  ["orderedQuantity", "Dipesan"],
                  ["allocatedQuantity", "Teralokasi"],
                  ["shippedQuantity", "Terkirim"],
                  ["backorderQuantity", "Backorder"],
                ].map(([key, label]) => (
                  <Value key={key} label={label!}>
                    {key === "shippedQuantity" && row.lines.some((line) => !line.allocations)
                      ? "Belum tersedia"
                      : amount(
                          row.lines
                            .reduce(
                              (sum, line) =>
                                sum.add(
                                  key === "shippedQuantity"
                                    ? (line.allocations ?? []).reduce(
                                        (total, allocation) =>
                                          total
                                            .add(allocation.acceptedQuantity)
                                            .add(allocation.inTransitQuantity)
                                            .add(allocation.returnedQuantity),
                                        new Decimal(0),
                                      )
                                    : String(line[key as "orderedQuantity"] ?? "0"),
                                ),
                              new Decimal(0),
                            )
                            .toString(),
                        )}{" "}
                    unit
                  </Value>
                ))}
              </Panel>
            </aside>
          </div>
        </OrderJourney>
      </div>

      <div className="so-footer so-detail-actions">
        {can("sales_order.close_remainder") && ["OPEN", "DRAFT"].includes(row.state) && (
          <>
            <Button variant="outline" disabled={pending} onClick={() => setAction("cancel")}>
              Batalkan SO / sisa
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setAction("close")}>
              Tutup sisa pesanan
            </Button>
          </>
        )}
        {(can("sales_order.update") || can("sales_order.close_remainder")) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Lainnya</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {can("sales_order.update") && (
                <DropdownMenuItem disabled={!editable || pending} asChild={!!editable}>
                  {editable ? (
                    <Link href={`/operations/orders/${row.id}/edit`}>Edit/Revisi</Link>
                  ) : (
                    <span>Edit/Revisi — pemenuhan masih terikat</span>
                  )}
                </DropdownMenuItem>
              )}
              {can("sales_order.close_remainder") && ["OPEN", "DRAFT"].includes(row.state) && (
                <>
                  <DropdownMenuItem disabled={pending} onSelect={() => setAction("close")}>
                    Tutup Sisa Pesanan
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={pending} onSelect={() => setAction("cancel")}>
                    Batalkan Sisa
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}{" "}
        <Button variant="outline" onClick={() => window.print()}>
          Cetak SO
        </Button>
        <ProformaAction row={row} canIssue={can("proforma.issue")} />
        {can("fulfillment.pick") &&
          row.fulfillments?.some((b) => b.state === "ALLOCATED" && !b.pickList) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={pending}>Buat Pick Slip</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.fulfillments
                  .filter((b) => b.state === "ALLOCATED" && !b.pickList)
                  .map((b) => (
                    <DropdownMenuItem
                      key={b.id}
                      onSelect={() =>
                        void command(`/fulfillment-batches/${b.id}/create-picking`).catch(
                          () => undefined,
                        )
                      }
                    >
                      {b.number}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        {row.state === "DRAFT" && can("sales_order.submit") && (
          <Button
            disabled={pending}
            onClick={() => void command(`/sales-orders/${row.id}/submit`).catch(() => undefined)}
          >
            {pending ? "Memproses…" : "Ajukan SO"}
          </Button>
        )}
      </div>

      {
        <details className="so-exceptions">
          <summary>Persetujuan unlock & harga khusus</summary>
          {<SalesExceptions row={row} command={command} pending={pending} can={can} />}
        </details>
      }
      {action && (
        <CloseRemainder
          row={row}
          cancel={action === "cancel"}
          command={command}
          pending={pending}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}

function ProformaAction({ row, canIssue }: { row: Row; canIssue: boolean }) {
  const documentFor = (batch: Row) =>
    row.documents?.find((d) => d.batchId === batch.id && d.kind.startsWith("PROFORMA"));
  const canReview = (batch: Row) => canIssue && row.state === "OPEN" && batch.state === "ALLOCATED";
  const batches = (row.fulfillments ?? []).filter((b) => canReview(b) || documentFor(b));
  if (!batches.length) return null;
  const hrefFor = (batch: Row) => {
    const document = documentFor(batch);
    if (document?.status === "REVISION_REQUIRED" && canReview(batch))
      return `/operations/proformas/from-order/${row.id}/${batch.id}`;
    return document
      ? `/operations/proformas/${document.id}`
      : `/operations/proformas/from-order/${row.id}/${batch.id}`;
  };
  const labelFor = (batch: Row) => {
    const document = documentFor(batch);
    if (!document) return "Belum diterbitkan · Buka detail";
    if (document.status === "VOID" || batch.state === "CANCELLED")
      return "Dibatalkan · Lihat arsip";
    if (document.status === "REVISION_REQUIRED")
      return canReview(batch) ? "Perlu revisi · Buka revisi" : "Perlu revisi · Lihat dokumen";
    return document.status === "ISSUED" ? "Diterbitkan · Lihat Proforma" : "Lihat Proforma";
  };
  if (batches.length === 1) {
    return (
      <Button variant="outline" className="so-proforma-action" asChild>
        <Link href={hrefFor(batches[0]!)}>
          {documentFor(batches[0]!) ? "Lihat Proforma" : "Tinjau & Terbitkan Proforma"}
        </Link>
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="so-proforma-action">
          Tinjau Proforma <ChevronDown data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {batches.map((batch) => (
          <DropdownMenuItem key={batch.id} asChild>
            <Link href={hrefFor(batch)} className="flex flex-col items-start gap-1">
              <span>{batch.number}</span>
              <span className="text-muted-foreground text-xs">
                {documentFor(batch)?.number ?? "Nomor belum tersedia"}
              </span>
              <span className="text-xs">{labelFor(batch)}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function History({ id }: { id: string }) {
  const { principal } = useSession();
  const [category, setCategory] = useState("ALL");
  const q = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, "audit", id],
    queryFn: ({ signal }) =>
      apiRequest<{ data: { id: string; action: string; occurredAt: string }[] }>(
        `/operations/audit/${id}`,
        { signal },
      ),
  });
  if (q.isLoading) return <p role="status">Memuat riwayat…</p>;
  if (q.error)
    return (
      <>
        <ErrorBox message={String(q.error)} />
        <Button variant="outline" onClick={() => void q.refetch()}>
          Coba Lagi
        </Button>
      </>
    );
  const rows = (q.data?.data ?? []).filter(
    (event) =>
      category === "ALL" ||
      (category === "DOCUMENT"
        ? /document|proforma|invoice/.test(event.action)
        : category === "PAYMENT"
          ? /receipt|payment/.test(event.action)
          : /order|allocation|remainder/.test(event.action)),
  );
  return (
    <>
      <div className="sales-list-tabs">
        {[
          ["ALL", "Semua"],
          ["STATUS", "Status"],
          ["DOCUMENT", "Dokumen"],
          ["PAYMENT", "Pembayaran"],
        ].map(([value, label]) => (
          <button key={value} aria-pressed={category === value} onClick={() => setCategory(value!)}>
            {label}
          </button>
        ))}
      </div>
      <DataTable
        data={rows}
        total={rows.length}
        showColumns={false}
        columns={[
          {
            id: "time",
            header: "Waktu",
            cell: ({ row: r }) => new Date(r.original.occurredAt).toLocaleString("id-ID"),
          },
          { id: "actor", header: "Pengguna", cell: () => "Lihat audit rinci" },
          {
            id: "action",
            header: "Aktivitas",
            cell: ({ row: r }) =>
              (
                ({
                  "sales_order.created": "SO dibuat",
                  "sales_order.submitted": "SO diajukan dan dievaluasi",
                  "sales_order.revised": "SO direvisi",
                  "sales_order.remainder_closed": "Sisa pesanan ditutup",
                  "sales_order.cancelled": "SO dibatalkan",
                }) as Record<string, string>
              )[r.original.action] ?? r.original.action,
          },
          { id: "notes", header: "Keterangan", cell: () => "—" },
        ]}
      />
      <p className="sales-notice">
        Pembatalan atau penutupan sisa memerlukan catatan konfirmasi pelanggan.
      </p>
    </>
  );
}
