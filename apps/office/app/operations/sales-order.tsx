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
  MetaItem,
  OfficePage,
  PageNotice,
  RecordBadge,
} from "@/components/web/page-frame";
import { IconPlus, IconSearch } from "@/components/web/icons";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest, settingsHrefOf } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { useListParams } from "../master-data/master-shared";
import { type Row } from "./workspace";
import { SalesOrderForm } from "./sales-order-form";
import { amount, type Order, type OrderCommand } from "./sales-order-types";
import {
  billingLabel,
  orderDocumentStatus,
  shippingLabel,
  type OrderBilling,
  type OrderShipping,
} from "@/lib/sales-order-copy";
import "./sales-order.css";
import "./sales-order-modern.css";
import "./sales-order-frame.css";
import "./sales-order-r1.css";
type OrderList = {
  rows: (Order & {
    displayStatus: string;
    orderDate: string;
    paymentTerm: { code: string; label: string } | null;
    shipping: OrderShipping;
    billing?: OrderBilling;
  })[];
  total: number;
  summary: Record<string, number>;
  filters?: { customers: { id: string; name: string }[] };
  asOf: string;
};
const base = "/operations/orders";
const crumbs = [{ label: "Sales & Marketing" }, { label: "Pesanan Pelanggan", href: base }];
// Tab di pita (canvas SO-list): status dokumen atau daftar kerja dari ringkasan server.
type Tab = {
  id: string;
  label: string;
  param: Record<string, string>;
  count: string;
  billing?: boolean;
};
const listTabs: Tab[] = [
  { id: "ALL", label: "Semua", param: {}, count: "all" },
  { id: "DRAFT", label: "Draft", param: { status: "DRAFT" }, count: "DRAFT" },
  { id: "TO_SHIP", label: "Perlu dikirim", param: { queue: "TO_SHIP" }, count: "toShip" },
  {
    id: "UNINVOICED",
    label: "Belum diinvoice",
    param: { queue: "UNINVOICED" },
    count: "uninvoiced",
    billing: true,
  },
  { id: "COMPLETED", label: "Terkirim penuh", param: { status: "COMPLETED" }, count: "COMPLETED" },
];

function useCan() {
  const { principal } = useSession();
  return (p: string) => !!principal && hasCompanyPermission(principal, p);
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
  const billing = can("sales_invoice.read");
  const tabs = listTabs.filter((tab) => !tab.billing || billing);
  const active =
    tabs.find(
      (tab) => Object.entries(tab.param).every(([k, v]) => list.get(k) === v) && tab.id !== "ALL",
    ) ?? tabs[0]!;
  const customerId = list.get("customer_id");
  const params = new URLSearchParams({ page: String(list.page), search: list.q, ...active.param });
  if (customerId !== "ALL") params.set("customer_id", customerId);
  const endpoint = `/operations/lists/orders?${params}`;
  const allowed = can("sales_order.read");
  const query = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, endpoint],
    queryFn: ({ signal }) => apiRequest<{ data: OrderList }>(endpoint, { signal }),
    enabled: allowed,
    placeholderData: (previous) => previous,
  });
  const listing = query.data?.data;
  const summary = listing?.summary;
  const tabHref = (tab: Tab) => {
    const next = new URLSearchParams(tab.param);
    if (customerId !== "ALL") next.set("customer_id", customerId);
    if (list.q) next.set("q", list.q);
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  const columns: ColumnDef<OrderList["rows"][number]>[] = [
    {
      id: "number",
      header: "Nomor",
      cell: ({ row }) => (
        <Link className="page-frame-link" href={`${base}/${row.original.id}`}>
          {row.original.number}
        </Link>
      ),
    },
    {
      id: "date",
      header: "Tanggal",
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
    {
      id: "term",
      header: "Termin",
      cell: ({ row }) => row.original.paymentTerm?.label ?? "—",
    },
    {
      id: "value",
      header: () => <span className="sor-num">Nilai</span>,
      cell: ({ row }) => (
        <span className="sor-num sor-strong" style={{ display: "block" }}>
          {row.original.total == null
            ? "Menunggu evaluasi"
            : amount(row.original.total, row.original.currency)}
        </span>
      ),
    },
    {
      id: "shipping",
      header: "Pengiriman",
      cell: ({ row }) => {
        const value = shippingLabel(row.original.shipping);
        return row.original.shipping ? (
          <RecordBadge state={value.tone} label={value.label} />
        ) : (
          <span className="sor-hint">—</span>
        );
      },
    },
    ...(billing
      ? [
          {
            id: "billing",
            header: "Tagihan",
            cell: ({ row }) => {
              const value = billingLabel(row.original.billing);
              return row.original.billing && row.original.billing.status !== "NONE" ? (
                <RecordBadge state={value.tone} label={value.label} />
              ) : (
                <span className="sor-hint">—</span>
              );
            },
          } satisfies ColumnDef<OrderList["rows"][number]>,
        ]
      : []),
    {
      id: "documentStatus",
      // Header sebagai fungsi: badge status dibuat kolom ini sendiri, bukan pembungkus tabel.
      header: () => "Status",
      cell: ({ row }) => {
        const value = orderDocumentStatus(row.original.displayStatus);
        return <RecordBadge state={value.tone} label={value.label} />;
      },
    },
  ];
  return (
    <OfficePage
      section="sales"
      crumbs={[crumbs[0]!, { label: "Pesanan Pelanggan" }]}
      title="Pesanan Pelanggan"
      subtitle="Semua SO beserta kemajuan pengiriman (Surat Jalan) dan tagihannya."
      tabs={
        allowed && (
          <nav className="page-frame-subnav" aria-label="Daftar Sales Order">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tabHref(tab)}
                aria-current={active.id === tab.id ? "page" : undefined}
              >
                {tab.label}
                {summary && <span className="sor-count">{summary[tab.count] ?? 0}</span>}
              </Link>
            ))}
          </nav>
        )
      }
      actions={
        can("sales_order.create") && (
          <Button asChild>
            <Link href={`${base}/new`}>
              <IconPlus aria-hidden="true" />
              SO baru
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
          {!!summary?.toShip && (
            <section className="sor-next sor-next-compact" aria-label="Perlu tindakan">
              <svg width="20" height="22" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
                <path
                  d="M8 1C4 1.4 1 4.4 1 7.9 1 11 3.3 13.2 6.5 13 4.3 12.3 2.8 10.3 2.8 7.8 2.8 4.9 4.9 2.3 8 1z"
                  fill="#1F7FE0"
                />
              </svg>
              <div>
                <span>{summary.toShip} SO masih punya sisa yang belum dikirim.</span>
              </div>
              {can("outbound_shipping.read") && (
                <Link className="page-frame-link sor-next-link" href="/operations/delivery-notes">
                  Lihat Surat Jalan
                </Link>
              )}
            </section>
          )}
          <DataTable
            data={listing?.rows ?? []}
            columns={columns}
            total={listing?.total ?? 0}
            pageSize={25}
            page={list.page}
            onPage={(page) => list.set({ page })}
            busy={query.isFetching}
            label="Sales Order"
            showColumns={false}
            toolbar={
              <>
                <div className="page-frame-search">
                  <IconSearch />
                  <Input
                    type="search"
                    aria-label="Cari nomor SO, SP atau pelanggan"
                    placeholder="Cari nomor SO, SP atau pelanggan"
                    value={list.search}
                    onChange={(event) => list.setSearch(event.target.value)}
                  />
                </div>
                <div className="sor-list-filter">
                  <SelectionField
                    label="Filter pelanggan"
                    hideLabel
                    value={[customerId]}
                    options={[
                      { id: "ALL", name: "Semua pelanggan" },
                      ...(listing?.filters?.customers ?? []),
                    ]}
                    onChange={(v) => list.set({ customer_id: v[0] ?? "ALL", page: 1 })}
                  />
                </div>
                {listing && (
                  <span className="sor-range">
                    {listing.rows.length} dari {listing.total} dokumen
                  </span>
                )}
              </>
            }
          />
        </>
      )}
    </OfficePage>
  );
}

function OrderFormPage({ row }: { row?: Order }) {
  const can = useCan(),
    router = useRouter();
  const { command, pending, error, errorHref } = useOrderCommand();
  const allowed = row ? can("sales_order.update") : can("sales_order.create");
  const status = row ? (row.displayStatus ?? row.state) : null;
  return (
    <OfficePage
      section="sales"
      crumbs={[
        ...crumbs,
        ...(row ? [{ label: row.number, href: `${base}/${row.id}` }] : []),
        { label: row ? "Ubah" : "Baru" },
      ]}
      title={row ? row.number : "Sales Order baru"}
      meta={
        <MetaItem label="Status">
          <RecordBadge
            state={status ? orderDocumentStatus(status).tone : "neutral"}
            label={status ? orderDocumentStatus(status).label : "Belum disimpan"}
          />
        </MetaItem>
      }
      actions={
        <Button variant="outline" asChild>
          <Link href={base}>Kembali</Link>
        </Button>
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
