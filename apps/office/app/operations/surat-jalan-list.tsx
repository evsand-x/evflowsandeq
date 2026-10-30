"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, OfficePage, PageNotice, RecordBadge } from "@/components/web/page-frame";
import { IconPlus, IconSearch } from "@/components/web/icons";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { useListParams } from "../master-data/master-shared";
import {
  deliveryNoteStatus,
  handoverText,
  quantityText,
  type DeliveryNoteState,
} from "./surat-jalan-utils";
import { shippingLabel, type OrderShipping } from "@/lib/sales-order-copy";
import { amount } from "./sales-order-types";
import "./sales-order-r1.css";

/** SO diajukan yang masih punya sisa belum dikirim (daftar SO, antrean TO_SHIP). */
type ReadyRow = {
  id: string;
  number: string;
  orderDate?: string;
  createdAt: string;
  customer?: { name: string } | null;
  paymentTerm: { code: string; label: string } | null;
  shipping: OrderShipping;
};
type ReadyListing = { rows: ReadyRow[]; total: number; summary: Record<string, number> };

type ListRow = {
  id: string;
  number: string;
  state: DeliveryNoteState;
  handoverAt: string | null;
  salesOrder: { id: string; number: string; customer?: { name: string } | null };
  warehouses: { id: string; name: string }[];
  quantity: string;
  unit: string | null;
  /** Hanya dikirim server untuk pemegang sales_invoice.read. */
  invoice?: { id: string; number: string } | null;
  /** Baris SO siap dikirim yang digabung di tab Semua (belum ada Surat Jalan). */
  order?: ReadyRow;
};
type Listing = {
  rows: ListRow[];
  total: number;
  pageSize: number;
  summary: { all: number; draft: number; uninvoiced?: number; invoiced?: number };
  warehouses: { id: string; code: string; name: string }[];
  timezone: string | null;
};
type Tab = {
  id: "ALL" | "READY" | "DRAFT" | "UNINVOICED" | "INVOICED";
  label: string;
  count: keyof Listing["summary"] | "ready";
  billing?: boolean;
  ready?: boolean;
};
// Tab di pita (canvas SJ-list); tab invoice hanya untuk pemegang izin baca Invoice.
const tabs: Tab[] = [
  { id: "ALL", label: "Semua", count: "all" },
  // SO siap dibuatkan Surat Jalan: perlu sales_order.read dan fulfillment.dispatch.
  { id: "READY", label: "Siap dibuatkan SJ", count: "ready", ready: true },
  { id: "DRAFT", label: "Draft", count: "draft" },
  { id: "UNINVOICED", label: "Terbit, belum diinvoice", count: "uninvoiced", billing: true },
  { id: "INVOICED", label: "Sudah diinvoice", count: "invoiced", billing: true },
];
const base = "/operations/delivery-notes";

export function SuratJalanListPage() {
  const { principal } = useSession();
  const list = useListParams();
  const can = (permission: string) => !!principal && hasCompanyPermission(principal, permission);
  const billing = can("sales_invoice.read");
  const canCreateInvoice = can("sales_invoice.post") && can("sales_invoice.view_price");
  const readyAllowed = can("sales_order.read") && can("fulfillment.dispatch");
  const visibleTabs = tabs.filter(
    (tab) => (!tab.billing || billing) && (!tab.ready || readyAllowed),
  );
  const active = visibleTabs.find((tab) => tab.id === list.get("tab")) ?? visibleTabs[0]!;
  const isReady = active.id === "READY";
  const warehouseId = list.get("warehouse_id");
  const params = new URLSearchParams({
    page: String(isReady ? 1 : list.page),
    search: isReady ? "" : list.q,
    tab: isReady ? "ALL" : active.id,
  });
  if (warehouseId !== "ALL") params.set("warehouse_id", warehouseId);
  const endpoint = `/delivery-notes?${params}`;
  const query = useQuery({
    queryKey: ["surat-jalan", principal?.company_id, principal?.user_id, endpoint],
    queryFn: ({ signal }) => apiRequest<{ data: Listing }>(endpoint, { signal }),
    placeholderData: (previous) => previous,
  });
  const listing = query.data?.data;
  const summary = listing?.summary;
  // Antrean SO siap kirim memakai daftar SO yang sudah ada (queue=TO_SHIP); jumlahnya untuk tab.
  const readyParams = new URLSearchParams({
    page: String(isReady ? list.page : 1),
    search: isReady || active.id === "ALL" ? list.q : "",
    queue: "TO_SHIP",
  });
  const readyEndpoint = `/operations/lists/orders?${readyParams}`;
  const ready = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, readyEndpoint],
    queryFn: ({ signal }) => apiRequest<{ data: ReadyListing }>(readyEndpoint, { signal }),
    enabled: readyAllowed,
    placeholderData: (previous) => previous,
  });
  const readyListing = ready.data?.data;
  // Keputusan pengguna: tab Semua menggabungkan SO siap dikirim (baris "Belum dibuat") di atas
  // dokumen Surat Jalan. Tanpa filter gudang (SO belum punya gudang kirim) dan hanya di halaman 1.
  const mergeReady = readyAllowed && active.id === "ALL" && warehouseId === "ALL";
  const readyAsRows: ListRow[] =
    mergeReady && list.page === 1
      ? (readyListing?.rows ?? []).map((order) => ({
          id: `order-${order.id}`,
          number: "",
          state: "DRAFT",
          handoverAt: null,
          salesOrder: { id: order.id, number: order.number, customer: order.customer ?? null },
          warehouses: [],
          quantity: order.shipping?.remainingQuantity ?? "0",
          unit: order.shipping?.remainingUnit ?? null,
          invoice: null,
          order,
        }))
      : [];
  const rows = [...readyAsRows, ...(listing?.rows ?? [])];
  const readyCount = readyListing?.summary.toShip;
  const countOf = (tab: Tab) =>
    tab.count === "ready"
      ? readyCount
      : tab.id === "ALL" && mergeReady && summary
        ? summary.all + (readyCount ?? 0)
        : summary?.[tab.count];
  const tabHref = (tab: Tab) => {
    const next = new URLSearchParams();
    if (tab.id !== "ALL") next.set("tab", tab.id);
    if (warehouseId !== "ALL") next.set("warehouse_id", warehouseId);
    if (list.q) next.set("q", list.q);
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  const filtered = !!list.q || warehouseId !== "ALL";
  const columns: ColumnDef<ListRow>[] = [
    {
      id: "number",
      header: "Nomor",
      cell: ({ row }) =>
        row.original.order ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/from-order/${row.original.order.id}`}>Buat Surat Jalan</Link>
          </Button>
        ) : (
          <Link className="page-frame-link" href={`${base}/${row.original.id}`}>
            {row.original.number}
          </Link>
        ),
    },
    {
      id: "order",
      header: "Sales Order",
      cell: ({ row }) =>
        can("sales_order.read") ? (
          <Link
            className="page-frame-link"
            href={`/operations/orders/${row.original.salesOrder.id}`}
          >
            {row.original.salesOrder.number}
          </Link>
        ) : (
          row.original.salesOrder.number
        ),
    },
    {
      id: "customer",
      header: "Pelanggan",
      cell: ({ row }) => (
        <span className="sor-strong">{row.original.salesOrder.customer?.name ?? "—"}</span>
      ),
    },
    {
      id: "warehouse",
      header: "Gudang",
      cell: ({ row }) =>
        row.original.warehouses.map((w) => w.name).join(", ") || (
          <span className="sor-hint">—</span>
        ),
    },
    {
      id: "handover",
      header: "Serah terima",
      cell: ({ row }) =>
        row.original.order ? (
          <span className="sor-hint">—</span>
        ) : row.original.handoverAt ? (
          handoverText(row.original.handoverAt, listing?.timezone ?? undefined)
        ) : (
          <span className="sor-hint">Belum diserahkan</span>
        ),
    },
    {
      id: "quantity",
      header: () => <span className="sor-num sor-head-num">Barang</span>,
      cell: ({ row }) => (
        <span className="sor-num sor-strong" style={{ display: "block" }}>
          {quantityText(row.original.quantity, row.original.unit)}
        </span>
      ),
    },
    {
      id: "documentStatus",
      // Header sebagai fungsi: badge dibuat kolom ini, bukan pembungkus status tabel.
      header: () => "Status",
      cell: ({ row }) => {
        if (row.original.order) return <RecordBadge state="info" label="Belum dibuat" />;
        const value = deliveryNoteStatus(row.original.state);
        return <RecordBadge state={value.tone} label={value.label} />;
      },
    },
    ...(billing
      ? [
          {
            id: "invoice",
            header: "Invoice",
            cell: ({ row }) =>
              row.original.invoice ? (
                <Link
                  className="page-frame-link"
                  href={`/operations/invoices/${row.original.invoice.id}`}
                >
                  {row.original.invoice.number}
                </Link>
              ) : row.original.state === "ISSUED" && !row.original.order ? (
                canCreateInvoice ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/operations/invoices/new?surat_jalan_id=${row.original.id}`}>
                      Buat Invoice
                    </Link>
                  </Button>
                ) : (
                  <RecordBadge state="warning" label="Belum diinvoice" />
                )
              ) : (
                <span className="sor-hint">—</span>
              ),
          } satisfies ColumnDef<ListRow>,
        ]
      : []),
  ];
  const readyColumns: ColumnDef<ReadyRow>[] = [
    {
      id: "number",
      header: "Nomor SO",
      cell: ({ row }) => (
        <Link className="page-frame-link" href={`/operations/orders/${row.original.id}`}>
          {row.original.number}
        </Link>
      ),
    },
    {
      id: "date",
      header: "Tanggal SO",
      cell: ({ row }) =>
        new Date(row.original.orderDate ?? row.original.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
    },
    {
      id: "customer",
      header: "Pelanggan",
      cell: ({ row }) => <span className="sor-strong">{row.original.customer?.name ?? "—"}</span>,
    },
    { id: "term", header: "Termin", cell: ({ row }) => row.original.paymentTerm?.label ?? "—" },
    {
      id: "rest",
      header: () => <span className="sor-num sor-head-num">Sisa dikirim</span>,
      cell: ({ row }) => (
        <span className="sor-num sor-strong" style={{ display: "block" }}>
          {row.original.shipping
            ? `${amount(row.original.shipping.remainingQuantity)} ${row.original.shipping.remainingUnit ?? "unit"}`
            : "—"}
        </span>
      ),
    },
    {
      id: "shipping",
      header: "Pengiriman",
      cell: ({ row }) => {
        const value = shippingLabel(row.original.shipping);
        return <RecordBadge state={value.tone} label={value.label} />;
      },
    },
    {
      id: "action",
      header: () => <span className="sr-only">Aksi</span>,
      cell: ({ row }) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`${base}/from-order/${row.original.id}`}>Buat Surat Jalan</Link>
        </Button>
      ),
    },
  ];
  const search = (
    <div className="page-frame-search">
      <IconSearch />
      <Input
        type="search"
        aria-label={isReady ? "Cari nomor SO atau pelanggan" : "Cari nomor SJ, SO atau pelanggan"}
        placeholder={isReady ? "Cari nomor SO atau pelanggan" : "Cari nomor SJ, SO atau pelanggan"}
        value={list.search}
        onChange={(event) => list.setSearch(event.target.value)}
      />
    </div>
  );
  return (
    <OfficePage
      section="warehouse"
      crumbs={[{ label: "Warehouse & Logistik" }, { label: "Surat Jalan" }]}
      title="Surat Jalan"
      subtitle="Stok dan pendapatan tercatat saat SJ terbit. Penerimaan barang dicatat terpisah."
      tabs={
        <nav className="page-frame-subnav" aria-label="Daftar Surat Jalan">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tabHref(tab)}
              aria-current={active.id === tab.id ? "page" : undefined}
            >
              {tab.label}
              {countOf(tab) !== undefined && <span className="sor-count">{countOf(tab)}</span>}
            </Link>
          ))}
        </nav>
      }
      actions={
        // Keputusan pengguna: membuka Daftar SO tab Perlu dikirim; SJ dibuat dari detail SO.
        can("fulfillment.dispatch") &&
        can("sales_order.read") && (
          <Button asChild>
            <Link href="/operations/orders?queue=TO_SHIP">
              <IconPlus aria-hidden="true" />
              Surat Jalan dari SO
            </Link>
          </Button>
        )
      }
    >
      {(isReady ? ready.isError : query.isError) && (
        <PageNotice tone="error" onRetry={() => void (isReady ? ready.refetch() : query.refetch())}>
          {(isReady ? ready.error : query.error)?.message}
        </PageNotice>
      )}
      {!!summary?.uninvoiced && (
        <section className="sor-next sor-next-compact" aria-label="Perlu tindakan">
          <svg width="20" height="22" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
            <path
              d="M8 1C4 1.4 1 4.4 1 7.9 1 11 3.3 13.2 6.5 13 4.3 12.3 2.8 10.3 2.8 7.8 2.8 4.9 4.9 2.3 8 1z"
              fill="#1F7FE0"
            />
          </svg>
          <div>
            <span>{summary.uninvoiced} Surat Jalan terbit belum diinvoice.</span>
          </div>
          <Link className="page-frame-link sor-next-link" href="/operations/invoices">
            Buka daftar Invoice
          </Link>
        </section>
      )}
      {isReady ? (
        <DataTable
          data={readyListing?.rows ?? []}
          columns={readyColumns}
          total={readyListing?.total ?? 0}
          pageSize={25}
          page={list.page}
          onPage={(page) => list.set({ page })}
          busy={ready.isFetching}
          label="SO siap dibuatkan Surat Jalan"
          showColumns={false}
          toolbar={
            <>
              {search}
              {readyListing && (
                <span className="sor-range">
                  {readyListing.rows.length} dari {readyListing.total} SO
                </span>
              )}
            </>
          }
        />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          total={(listing?.total ?? 0) + readyAsRows.length}
          pageSize={listing?.pageSize ?? 25}
          page={list.page}
          onPage={(page) => list.set({ page })}
          busy={query.isFetching}
          label="Surat Jalan"
          showColumns={false}
          toolbar={
            <>
              {search}
              <div className="sor-list-filter">
                <SelectionField
                  label="Filter gudang"
                  hideLabel
                  value={[warehouseId]}
                  options={[
                    { id: "ALL", name: "Semua gudang" },
                    ...(listing?.warehouses ?? []).map((w) => ({
                      id: w.id,
                      name: w.name,
                      code: w.code,
                    })),
                  ]}
                  onChange={(v) => list.set({ warehouse_id: v[0] ?? "ALL", page: 1 })}
                />
              </div>
              {listing && (
                <span className="sor-range">
                  {rows.length} dari {listing.total + (mergeReady ? (readyCount ?? 0) : 0)} baris
                </span>
              )}
            </>
          }
        />
      )}
      {!isReady && listing && !rows.length && filtered && (
        <p className="sor-hint">
          Pencarian atau filter terlalu sempit.{" "}
          <Link className="page-frame-link" href={tabHref(active).split("?")[0]!}>
            Tampilkan semua
          </Link>
        </p>
      )}
    </OfficePage>
  );
}
