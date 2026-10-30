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
import { amount } from "./sales-order-types";
import { dateOnly, dueNote, invoiceStatus, todayLocal } from "./invoice-utils";
import "./sales-order-r1.css";

type Row = {
  id: string;
  number: string;
  state: string;
  status: string;
  overdue: boolean;
  invoiceDate: string | null;
  createdAt: string;
  dueDate: string | null;
  /** Tanpa izin sales_invoice.view_price server tidak mengirim nilai. */
  total?: string | null;
  outstandingAmount?: string | null;
  customer: { id: string; name: string };
  deliveryNote: { id: string; number: string; issuedAt: string | null } | null;
};
type Listing = {
  rows: Row[];
  total: number;
  pageSize: number;
  summary: Record<TabId, number>;
};
type Candidates = { rows: { id: string; number: string }[]; total: number };
type TabId = "ALL" | "DRAFT" | "UNPAID" | "PARTIAL" | "OVERDUE" | "PAID";
// Tab di pita (canvas Invoice-list) ditambah Draft dari backend.
const tabs: { id: TabId; label: string }[] = [
  { id: "ALL", label: "Semua" },
  { id: "DRAFT", label: "Draft" },
  { id: "UNPAID", label: "Belum dibayar" },
  { id: "PARTIAL", label: "Sebagian dibayar" },
  { id: "OVERDUE", label: "Lewat jatuh tempo" },
  { id: "PAID", label: "Lunas" },
];
const base = "/operations/invoices";

/** Daftar Invoice (canvas Invoice-list): Invoice dari Surat Jalan, outstanding dari pembayaran. */
export function InvoiceListPage() {
  const { principal } = useSession();
  const list = useListParams();
  const can = (permission: string) => !!principal && hasCompanyPermission(principal, permission);
  const prices = can("sales_invoice.view_price");
  const active = tabs.find((tab) => tab.id === list.get("tab")) ?? tabs[0]!;
  const customerId = list.get("customer_id");
  const params = new URLSearchParams({ page: String(list.page), search: list.q, tab: active.id });
  if (customerId !== "ALL") params.set("customer_id", customerId);
  const endpoint = `/sales-invoices?${params}`;
  const query = useQuery({
    queryKey: ["invoices", principal?.company_id, principal?.user_id, endpoint],
    queryFn: ({ signal }) => apiRequest<{ data: Listing }>(endpoint, { signal }),
    placeholderData: (previous) => previous,
  });
  const listing = query.data?.data;
  // Surat Jalan terbit yang belum punya invoice: banner "siap diinvoice".
  const candidates = useQuery({
    queryKey: ["invoices", principal?.company_id, "candidates"],
    queryFn: ({ signal }) =>
      apiRequest<{ data: Candidates }>("/sales-invoices/candidates", { signal }),
  });
  const ready = candidates.data?.data;
  // Filter pelanggan memakai master pelanggan; hanya untuk pemegang izin baca pelanggan.
  const customersAllowed = can("master_customer.read");
  const customers = useQuery({
    queryKey: ["invoices", principal?.company_id, "customers"],
    queryFn: ({ signal }) =>
      apiRequest<{ data: { id: string; code: string; name: string }[] }>("/master-data/customers", {
        signal,
      }),
    enabled: customersAllowed,
  });
  const today = todayLocal();
  const tabHref = (tab: TabId) => {
    const next = new URLSearchParams();
    if (tab !== "ALL") next.set("tab", tab);
    if (customerId !== "ALL") next.set("customer_id", customerId);
    if (list.q) next.set("q", list.q);
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  const columns: ColumnDef<Row>[] = [
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
        // Invoice lama tanpa tanggal invoice: tanggal dibuat.
        dateOnly(row.original.invoiceDate ?? row.original.createdAt),
    },
    {
      id: "customer",
      header: "Pelanggan",
      cell: ({ row }) => <span className="sor-strong">{row.original.customer.name}</span>,
    },
    {
      id: "deliveryNote",
      header: "Surat Jalan",
      cell: ({ row }) =>
        row.original.deliveryNote ? (
          can("outbound_shipping.read") ? (
            <Link
              className="page-frame-link"
              href={`/operations/delivery-notes/${row.original.deliveryNote.id}`}
            >
              {row.original.deliveryNote.number}
            </Link>
          ) : (
            row.original.deliveryNote.number
          )
        ) : (
          <span className="sor-hint">—</span>
        ),
    },
    {
      id: "due",
      header: "Jatuh tempo",
      cell: ({ row }) => {
        const r = row.original;
        const note =
          r.state === "POSTED" && r.status !== "PAID" ? dueNote(r.dueDate, today, true) : "";
        return (
          <span className="sor-product">
            <span>{dateOnly(r.dueDate)}</span>
            {note && (
              <small style={r.overdue ? { color: "var(--ev-color-danger)" } : undefined}>
                {note}
              </small>
            )}
          </span>
        );
      },
    },
    ...(prices
      ? ([
          {
            id: "total",
            header: () => <span className="sor-num sor-head-num">Total</span>,
            cell: ({ row }) => (
              <span className="sor-num" style={{ display: "block" }}>
                {amount(row.original.total ?? null, "IDR")}
              </span>
            ),
          },
          {
            id: "outstanding",
            header: () => <span className="sor-num sor-head-num">Outstanding</span>,
            cell: ({ row }) => (
              <span className="sor-num sor-strong" style={{ display: "block" }}>
                {row.original.state === "DRAFT"
                  ? "—"
                  : amount(row.original.outstandingAmount ?? null, "IDR")}
              </span>
            ),
          },
        ] satisfies ColumnDef<Row>[])
      : []),
    {
      id: "invoiceStatus",
      header: () => "Status",
      cell: ({ row }) => {
        const value = invoiceStatus(row.original.status);
        return <RecordBadge state={value.tone} label={value.label} />;
      },
    },
  ];
  const filtered = !!list.q || customerId !== "ALL";
  return (
    <OfficePage
      section="finance"
      crumbs={[{ label: "Finance" }, { label: "Invoice & Pembayaran" }]}
      title="Invoice & Pembayaran"
      subtitle="Invoice dibuat dari Surat Jalan terbit. Outstanding dihitung dari pembayaran terposting."
      tabs={
        <nav className="page-frame-subnav" aria-label="Daftar Invoice">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tabHref(tab.id)}
              aria-current={active.id === tab.id ? "page" : undefined}
            >
              {tab.label}
              {listing && <span className="sor-count">{listing.summary[tab.id] ?? 0}</span>}
            </Link>
          ))}
        </nav>
      }
      actions={
        can("sales_invoice.post") &&
        prices && (
          <Button asChild>
            <Link href="/operations/delivery-notes?tab=UNINVOICED">
              <IconPlus aria-hidden="true" />
              Invoice dari Surat Jalan
            </Link>
          </Button>
        )
      }
    >
      {query.isError && (
        <PageNotice tone="error" onRetry={() => void query.refetch()}>
          {query.error.message}
        </PageNotice>
      )}
      {!!ready?.total && (
        <section className="sor-next sor-next-compact" aria-label="Perlu tindakan">
          <svg width="20" height="22" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
            <path
              d="M8 1C4 1.4 1 4.4 1 7.9 1 11 3.3 13.2 6.5 13 4.3 12.3 2.8 10.3 2.8 7.8 2.8 4.9 4.9 2.3 8 1z"
              fill="#1F7FE0"
            />
          </svg>
          <div>
            <span>
              {ready.total} Surat Jalan terbit siap diinvoice
              {ready.total <= 3 ? `: ${ready.rows.map((r) => r.number).join(", ")}.` : "."}
            </span>
          </div>
          {can("sales_invoice.post") && prices && ready.total === 1 ? (
            <Link
              className="page-frame-link sor-next-link"
              href={`${base}/new?surat_jalan_id=${ready.rows[0]!.id}`}
            >
              Buat Invoice
            </Link>
          ) : (
            <Link
              className="page-frame-link sor-next-link"
              href="/operations/delivery-notes?tab=UNINVOICED"
            >
              Lihat Surat Jalan
            </Link>
          )}
        </section>
      )}
      <DataTable
        data={listing?.rows ?? []}
        columns={columns}
        total={listing?.total ?? 0}
        pageSize={listing?.pageSize ?? 25}
        page={list.page}
        onPage={(page) => list.set({ page })}
        busy={query.isFetching}
        label="Invoice"
        showColumns={false}
        toolbar={
          <>
            <div className="page-frame-search">
              <IconSearch />
              <Input
                type="search"
                aria-label="Cari nomor invoice, SJ atau pelanggan"
                placeholder="Cari nomor invoice, SJ atau pelanggan"
                value={list.search}
                onChange={(event) => list.setSearch(event.target.value)}
              />
            </div>
            {customersAllowed && (
              <div className="sor-list-filter">
                <SelectionField
                  label="Filter pelanggan"
                  hideLabel
                  value={[customerId]}
                  options={[
                    { id: "ALL", name: "Semua pelanggan" },
                    ...(customers.data?.data ?? []).map((c) => ({
                      id: c.id,
                      name: c.name,
                      code: c.code,
                    })),
                  ]}
                  onChange={(v) => list.set({ customer_id: v[0] ?? "ALL", page: 1 })}
                />
              </div>
            )}
            {listing && (
              <span className="sor-range">
                {listing.rows.length} dari {listing.total} invoice
              </span>
            )}
          </>
        }
      />
      {listing && !listing.rows.length && filtered && (
        <p className="sor-hint">
          Pencarian atau filter terlalu sempit.{" "}
          <Link className="page-frame-link" href={tabHref(active.id).split("?")[0]!}>
            Tampilkan semua
          </Link>
        </p>
      )}
    </OfficePage>
  );
}
