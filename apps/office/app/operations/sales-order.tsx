"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { SalesOrderDetail } from "./sales-order-detail";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  DataTable,
  ActiveFilters,
  FilterChips,
  FilterPopover,
  OfficePage,
  PageNotice,
  SubNav,
} from "@/components/web/page-frame";
import { IconPlus, IconSearch } from "@/components/web/icons";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest, settingsHrefOf } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { useListParams } from "../master-data/master-shared";
import { type Row } from "./workspace";
import { SalesOrderForm } from "./sales-order-form";
import { amount, orderStates, type Order, type OrderCommand } from "./sales-order-types";
import { Tone } from "./sales-order-journey";
import "./sales-order.css";
import "./sales-order-modern.css";
import "./sales-order-frame.css";
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
  filters?: { customers: { id: string; name: string }[] };
  asOf: string;
};
const orderStateFilters: Record<string, string> = {
  ALL: "Semua status",
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  CANCELLED: "Dibatalkan",
};
const fulfillmentFilters: Record<string, string> = {
  ALL: "Semua pemenuhan",
  NOT_SHIPPED: "Belum Dikirim",
  PARTIAL: "Sebagian",
  SHIPPED: "Terkirim Semua",
};
const remainderFilters: Record<string, string> = {
  ALL: "Semua sisa",
  BACKORDER: "Backorder",
  IN_PROGRESS: "Proses Pemenuhan",
  NOT_EVALUATED: "Belum dievaluasi",
  CLOSED: "Ditutup",
};
const filterKeys = ["customer_id", "from", "to", "fulfillment", "remainder"] as const;
const base = "/operations/orders";
const crumbs = [
  { label: "Sales & Marketing" },
  { label: "Pesanan Pelanggan" },
  { label: "Sales Order", href: base },
];

function useCan() {
  const { principal } = useSession();
  return (p: string) => !!principal && hasCompanyPermission(principal, p);
}

// Sub-menu Pesanan Pelanggan; tiap item memakai izin read submenu masing-masing.
function OrderSubNav() {
  const can = useCan();
  return (
    <SubNav
      items={[
        ["Sales Order", base, "sales_order.read"],
        ["Proforma", "/operations/proformas", "proforma.read"],
        ["Backorder & Sisa Pesanan", "/operations/backorders", "sales_backorder.read"],
      ]
        .filter(([, , permission]) => can(permission!))
        .map(([label, href]) => ({ label: label!, href: href!, active: href === base }))}
    />
  );
}

// Perintah SO memakai Idempotency-Key per isi permintaan; backend tetap otoritas status dan izin.
function useOrderCommand() {
  const client = useQueryClient();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [errorHref, setErrorHref] = useState<string | undefined>();
  const keys = useRef(new Map<string, string>());
  const busy = useRef(false);
  const command: OrderCommand = async (url, body = {}) => {
    if (busy.current) throw new Error("Penyimpanan masih berlangsung.");
    busy.current = true;
    setPending(true);
    setError("");
    setErrorHref(undefined);
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
      setErrorHref(settingsHrefOf(e));
      setError(message);
      throw e;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return { command, pending, error, errorHref };
}

export function SalesOrderWorkspace({ path }: { path: string[] }) {
  const id = path[1],
    creating = id === "new",
    editing = path[2] === "edit";
  if (!id) return <OrderListPage />;
  if (creating) return <OrderFormPage />;
  return <OrderRecordPage id={id} editing={editing} />;
}

function OrderListPage() {
  const { principal } = useSession(),
    can = useCan(),
    list = useListParams();
  const state = list.get("state");
  const value = (key: string) => (list.get(key) === "ALL" ? "" : list.get(key));
  const params = new URLSearchParams({ page: String(list.page), search: list.q });
  if (state !== "ALL") params.set("state", state);
  for (const key of filterKeys) if (value(key)) params.set(key, value(key));
  const endpoint = `/operations/lists/orders?${params}`;
  const allowed = can("sales_order.read");
  const query = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, endpoint],
    queryFn: ({ signal }) => apiRequest<{ data: OrderList }>(endpoint, { signal }),
    enabled: allowed,
    placeholderData: (previous) => previous,
  });
  const listing = query.data?.data;
  const stateCount = (id: string) =>
    id === "DRAFT" ? listing?.summary.draft : id === "OPEN" ? listing?.summary.open : undefined;
  const clear = (key: string) => () => list.set({ [key]: "ALL", page: 1 });
  const customerName = listing?.filters?.customers.find(
    (c) => c.id === list.get("customer_id"),
  )?.name;
  const period = [value("from"), value("to")].map((d) =>
    d ? new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "",
  );
  const active = [
    state !== "ALL" && {
      key: "state",
      label: `Status: ${orderStateFilters[state]}`,
      onRemove: clear("state"),
    },
    value("customer_id") && {
      key: "customer_id",
      label: `Pelanggan: ${customerName ?? "terpilih"}`,
      onRemove: clear("customer_id"),
    },
    (value("from") || value("to")) && {
      key: "period",
      label: `Periode: ${period[0] || "awal"} – ${period[1] || "sekarang"}`,
      onRemove: () => list.set({ from: "ALL", to: "ALL", page: 1 }),
    },
    value("fulfillment") && {
      key: "fulfillment",
      label: `Pemenuhan: ${fulfillmentFilters[value("fulfillment")]}`,
      onRemove: clear("fulfillment"),
    },
    value("remainder") && {
      key: "remainder",
      label: `Sisa: ${remainderFilters[value("remainder")]}`,
      onRemove: clear("remainder"),
    },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];
  // Angka di tombol Filter hanya menghitung filter di popup; status/pemenuhan tampil di toolbar.
  const popupCount = active.filter((item) =>
    ["customer_id", "period", "remainder"].includes(item.key),
  ).length;
  return (
    <OfficePage
      section="sales"
      crumbs={[...crumbs.slice(0, 2), { label: "Sales Order" }]}
      title="Sales Order"
      subtitle="Pesanan pelanggan dan pemenuhannya. Approval hanya untuk pengecualian."
      tabs={<OrderSubNav />}
      actions={
        can("sales_order.create") && (
          <Button asChild>
            <Link href={`${base}/new`}>
              <IconPlus aria-hidden="true" />
              Buat Sales Order
            </Link>
          </Button>
        )
      }
    >
      {!allowed ? (
        <PageNotice tone="error">Anda tidak memiliki izin melihat Sales Order.</PageNotice>
      ) : (
        <>
          {query.isError && (
            <PageNotice tone="error" onRetry={() => void query.refetch()}>
              {query.error.message}
            </PageNotice>
          )}
          <DataTable
            data={listing?.rows ?? []}
            columns={listColumns}
            total={listing?.total ?? 0}
            pageSize={25}
            page={list.page}
            onPage={(page) => list.set({ page })}
            busy={query.isFetching}
            label="Sales Order"
            toolbar={
              <>
                <div className="page-frame-search">
                  <IconSearch />
                  <Input
                    aria-label="Cari nomor SO atau pelanggan"
                    placeholder="Cari nomor SO atau nama pelanggan"
                    value={list.search}
                    onChange={(event) => list.setSearch(event.target.value)}
                  />
                </div>
                <FilterPopover
                  count={popupCount}
                  onReset={() =>
                    list.set({
                      customer_id: "ALL",
                      from: "ALL",
                      to: "ALL",
                      remainder: "ALL",
                      page: 1,
                    })
                  }
                  resultLabel={`Tampilkan ${listing?.total ?? 0} SO`}
                >
                  <fieldset className="page-frame-chip-group">
                    <legend>Pelanggan</legend>
                    <SelectionField
                      label="Pelanggan"
                      hideLabel
                      value={[list.get("customer_id")]}
                      options={[
                        { id: "ALL", name: "Semua pelanggan" },
                        ...(listing?.filters?.customers ?? []),
                      ]}
                      onChange={(v) => list.set({ customer_id: v[0] ?? "ALL", page: 1 })}
                    />
                  </fieldset>
                  <fieldset className="page-frame-chip-group">
                    <legend>Periode tanggal SO</legend>
                    <div className="so-period">
                      <Input
                        type="date"
                        aria-label="Dari tanggal"
                        value={value("from")}
                        max={value("to") || undefined}
                        onChange={(e) => list.set({ from: e.target.value, page: 1 })}
                      />
                      <Input
                        type="date"
                        aria-label="Sampai tanggal"
                        value={value("to")}
                        min={value("from") || undefined}
                        onChange={(e) => list.set({ to: e.target.value, page: 1 })}
                      />
                    </div>
                  </fieldset>
                  <FilterChips
                    legend="Sisa pesanan"
                    value={list.get("remainder")}
                    options={Object.entries(remainderFilters)
                      .filter(([id]) => id !== "ALL")
                      .map(([id, label]) => ({
                        id,
                        label,
                        count: id === "BACKORDER" ? listing?.summary.backorder : undefined,
                      }))}
                    onChange={(v) => list.set({ remainder: v, page: 1 })}
                  />
                </FilterPopover>
                <SelectionField
                  label="Status pesanan"
                  hideLabel
                  value={[state]}
                  options={Object.entries(orderStateFilters).map(([id, name]) => ({
                    id,
                    name: stateCount(id) != null ? `${name} (${stateCount(id)})` : name,
                  }))}
                  onChange={(v) => list.set({ state: v[0] ?? "ALL", page: 1 })}
                />
                <SelectionField
                  label="Pemenuhan"
                  hideLabel
                  value={[list.get("fulfillment")]}
                  options={Object.entries(fulfillmentFilters).map(([id, name]) => ({ id, name }))}
                  onChange={(v) => list.set({ fulfillment: v[0] ?? "ALL", page: 1 })}
                />
                <ActiveFilters items={active} />
              </>
            }
          />
          {listing && (
            <p className="page-frame-subtitle">
              Cakupan perusahaan · Diperbarui {new Date(listing.asOf).toLocaleString("id-ID")}
            </p>
          )}
        </>
      )}
    </OfficePage>
  );
}
// Kolom daftar SO sesuai urutan pengguna: No. SO, Tanggal SO, Pelanggan, Nilai SO, Status, Pemenuhan, Sisa.
const listColumns: ColumnDef<Order>[] = [
  {
    id: "number",
    header: "No. SO",
    cell: ({ row }) => (
      <Link className="page-frame-link" href={`${base}/${row.original.id}`}>
        {row.original.number}
      </Link>
    ),
  },
  {
    id: "date",
    header: "Tanggal SO",
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
  },
  {
    id: "customer",
    header: "Pelanggan",
    cell: ({ row }) => <span className="so-cell">{row.original.customer?.name ?? "—"}</span>,
  },
  {
    id: "value",
    header: "Nilai SO",
    cell: ({ row }) => (
      <span
        className="so-num"
        title={
          row.original.total == null
            ? "Total belum tersedia; pajak belum ditetapkan."
            : "Total termasuk pajak"
        }
      >
        {row.original.total == null
          ? "Menunggu evaluasi"
          : amount(row.original.total, row.original.currency)}
      </span>
    ),
  },
  {
    id: "state",
    header: "Status",
    cell: ({ row }) => <Tone>{orderStates[row.original.state] ?? row.original.state}</Tone>,
  },
  {
    id: "fulfillment",
    header: "Pemenuhan",
    cell: ({ row }) => <Tone>{row.original.fulfillment}</Tone>,
  },
  {
    id: "remainder",
    header: "Sisa",
    cell: ({ row }) => <Tone>{row.original.remainderStatus}</Tone>,
  },
];

function OrderFormPage({ row }: { row?: Order }) {
  const can = useCan(),
    router = useRouter();
  const { command, pending, error, errorHref } = useOrderCommand();
  const allowed = row ? can("sales_order.update") : can("sales_order.create");
  return (
    <OfficePage
      section="sales"
      crumbs={[
        ...crumbs,
        ...(row ? [{ label: row.number, href: `${base}/${row.id}` }] : []),
        { label: row ? "Revisi" : "Baru" },
      ]}
      title={row ? `Revisi ${row.number}` : "Sales Order baru"}
      subtitle={
        row
          ? "Perbarui rincian pesanan dan catat alasan revisi. Revisi memerlukan pengajuan ulang."
          : "Catat barang dan jumlah sesuai SP. Setelah diajukan, server memeriksa harga, satuan, kredit dan stok tanpa approval rutin."
      }
    >
      {!allowed ? (
        <PageNotice tone="error">Anda tidak memiliki izin untuk halaman ini.</PageNotice>
      ) : (
        <>
          {error && (
            <PageNotice tone="error" settingsHref={errorHref}>
              {error}
            </PageNotice>
          )}
          <SalesOrderForm
            key={row ? `${row.id}:${row.version}` : "new"}
            initial={row}
            command={command}
            pending={pending}
            onSaved={(value) => router.push(`${base}/${value}`)}
          />
        </>
      )}
    </OfficePage>
  );
}

function OrderRecordPage({ id, editing }: { id: string; editing: boolean }) {
  const { principal } = useSession(),
    can = useCan();
  const allowed = can("sales_order.read");
  const endpoint = `/operations/orders/${id}`;
  const query = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, endpoint],
    queryFn: ({ signal }) => apiRequest<{ data: Order }>(endpoint, { signal }),
    enabled: allowed,
  });
  const row = query.data?.data;
  if (!allowed || !row)
    return (
      <OfficePage section="sales" crumbs={[...crumbs, { label: "Detail" }]} title="Sales Order">
        {!allowed ? (
          <PageNotice tone="error">Anda tidak memiliki izin melihat Sales Order.</PageNotice>
        ) : query.isError ? (
          <PageNotice tone="error" onRetry={() => void query.refetch()}>
            {query.error.message}
          </PageNotice>
        ) : (
          <p role="status">Memuat Sales Order…</p>
        )}
      </OfficePage>
    );
  if (editing) return <OrderFormPage row={row} />;
  return <OrderDetail row={row} />;
}

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

function OrderDetail({ row }: { row: Order }) {
  const can = useCan();
  const { command, pending, error, errorHref } = useOrderCommand();
  return (
    <SalesOrderDetail
      row={row}
      command={command}
      pending={pending}
      error={error}
      errorHref={errorHref}
      can={can}
      history={<History id={row.id} />}
    />
  );
}
const auditLabels: Record<string, string> = {
  "sales_order.created": "SO dibuat",
  "sales_order.submitted": "SO diajukan dan dievaluasi",
  "sales_order.revised": "SO direvisi",
  "sales_order.remainder_closed": "Sisa pesanan ditutup",
  "sales_order.cancelled": "SO dibatalkan",
  "sales_order.duplicated": "SO disalin menjadi draft",
  "sales_order.printed": "SO dicetak",
};
const auditTones: Record<string, string> = {
  "sales_order.created": "#5A6680",
  "sales_order.submitted": "#1F7FE0",
  "sales_order.revised": "#8A5300",
  "sales_order.remainder_closed": "#5A6680",
  "sales_order.cancelled": "#B42318",
};
// Riwayat (canvas SO-detail): garis waktu bertanda sabit, judul aktivitas dan waktu di kanan.
function History({ id }: { id: string }) {
  const { principal } = useSession();
  const q = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, "audit", id],
    queryFn: ({ signal }) =>
      apiRequest<{ data: { id: string; action: string; occurredAt: string }[] }>(
        `/operations/audit/${id}`,
        { signal },
      ),
  });
  if (q.isPending) return <p role="status">Memuat riwayat…</p>;
  if (q.isError)
    return (
      <PageNotice tone="error" onRetry={() => void q.refetch()}>
        {q.error.message}
      </PageNotice>
    );
  const rows = [...q.data.data].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  return (
    <div className="so-tab-stack">
      {rows.length ? (
        <ol className="so-timeline">
          {rows.map((event) => (
            <li key={event.id}>
              <svg viewBox="0 0 12 14" aria-hidden="true" focusable="false">
                <path
                  fill={auditTones[event.action] ?? "#0B4DA2"}
                  d="M8 1C4 1.4 1 4.4 1 7.9 1 11 3.3 13.2 6.5 13 4.3 12.3 2.8 10.3 2.8 7.8 2.8 4.9 4.9 2.3 8 1z"
                />
              </svg>
              <strong>{auditLabels[event.action] ?? event.action}</strong>
              <time dateTime={event.occurredAt}>
                {new Date(event.occurredAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="page-frame-subtitle">Belum ada aktivitas.</p>
      )}
      <p className="page-frame-subtitle so-footnote">
        Pembatalan atau penutupan sisa memerlukan catatan konfirmasi pelanggan.
      </p>
    </div>
  );
}
