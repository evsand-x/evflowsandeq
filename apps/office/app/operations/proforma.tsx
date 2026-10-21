"use client";
import {
  SalesPeriod,
  SalesNavigation,
  SalesBadge,
  DocumentHandoff,
  HandoffStatus,
} from "./sales-experience";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Printer } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DashboardSidebar } from "../dashboard-sidebar";
import { ExecutiveTopbar } from "../dashboard-executive";
import { DataTable } from "../crm/crm-common";
import { ErrorBox } from "./workspace";
import { Panel, Value } from "./sales-order";
import { amount, terms } from "./sales-order-types";
import { Badge } from "@/components/ui/badge";
import Decimal from "decimal.js";

import { ProformaDraftDetail } from "./issue-proforma";

type Proforma = {
  status?: "ISSUED" | "SUPERSEDED" | "VOID" | "REVISION_REQUIRED" | "PENDING";
  id: string;
  number: string;
  issuedAt: string;
  pending?: boolean;
  snapshot?: unknown;
  value?: string | null;
  verifiedFunds?: string | null;
  currency?: string;
  batch?: {
    id: string;
    number: string;
    state: string;
    salesOrder: { id: string; number: string; customer: { name: string } };
  } | null;
};
export function ProformaWorkspace({
  id,
  orderId,
  batchId,
}: {
  id?: string | undefined;
  orderId?: string;
  batchId?: string;
}) {
  if (orderId && batchId) return <ProformaDraftDetail orderId={orderId} batchId={batchId} />;
  return <ProformaDocuments id={id} />;
}
function ProformaDocuments({ id }: { id?: string | undefined }) {
  const { principal, state } = useSession();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("ALL");
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const allowed = !!principal && hasCompanyPermission(principal, "proforma.read");
  const canIssue = !!principal && hasCompanyPermission(principal, "proforma.issue");
  const canReadOrder = !!principal && hasCompanyPermission(principal, "sales_order.read");
  const endpoint = id
    ? `/operations/proformas/${id}`
    : `/operations/lists/proformas?page=${page}&search=${encodeURIComponent(term)}&view=${filter}`;
  const query = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      endpoint,
      principal?.permissions,
    ],
    queryFn: ({ signal }) =>
      apiRequest<{
        data: Proforma & { rows: Proforma[]; total: number; summary: Record<string, number> };
      }>(endpoint, { signal }),
    enabled: allowed,
  });
  const row = query.data?.data;
  const columns: ColumnDef<Proforma>[] = [
    {
      id: "number",
      header: "Nomor Proforma",
      cell: ({ row: r }) =>
        r.original.pending ? (
          <span>{r.original.number}</span>
        ) : (
          <Link className="so-link" href={`/operations/proformas/${r.original.id}`}>
            {r.original.number}
          </Link>
        ),
    },
    {
      id: "order",
      header: "Sales Order",
      cell: ({ row: r }) =>
        r.original.batch && !r.original.pending && canReadOrder ? (
          <Link className="so-link" href={`/operations/orders/${r.original.batch.salesOrder.id}`}>
            {r.original.batch.salesOrder.number}
          </Link>
        ) : (
          (r.original.batch?.salesOrder.number ?? "—")
        ),
    },
    {
      id: "customer",
      header: "Pelanggan",
      cell: ({ row: r }) => r.original.batch?.salesOrder.customer.name ?? "—",
    },
    {
      id: "batch",
      header: "Tahap pemenuhan",
      cell: ({ row: r }) => r.original.batch?.number ?? "—",
    },
    {
      id: "date",
      header: "Tanggal terbit",
      cell: ({ row: r }) =>
        r.original.pending
          ? "Menunggu penerbitan"
          : new Date(r.original.issuedAt).toLocaleDateString("id-ID"),
    },
    {
      id: "value",
      header: "Nilai proforma",
      cell: ({ row: r }) => amount(r.original.value, r.original.currency),
    },
    {
      id: "status",
      header: "Status dokumen",
      cell: ({ row: r }) => <SalesBadge>{statusLabel(r.original.status)}</SalesBadge>,
    },
    {
      id: "funds",
      header: "Dana terverifikasi",
      cell: () => (
        <span title="Dana per tahap dapat diperiksa pada detail Proforma sesuai izin penerimaan">
          —
        </span>
      ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row: r }) =>
        r.original.pending && r.original.batch ? (
          canIssue ? (
            <Link
              className="so-link"
              href={`/operations/proformas/from-order/${r.original.batch.salesOrder.id}/${r.original.batch.id}`}
            >
              Buat Proforma
            </Link>
          ) : (
            <Badge variant="outline">Menunggu penerbitan</Badge>
          )
        ) : (
          <Link className="so-link" href={`/operations/proformas/${r.original.id}`}>
            {r.original.status === "ISSUED" ? "Lihat / Cetak" : "Lihat detail"}
          </Link>
        ),
    },
  ];
  if (state !== "authenticated" || !principal)
    return (
      <main>
        <p role="status">
          {state === "loading" ? "Memuat sesi…" : "Silakan masuk untuk membuka Proforma."}
        </p>
        <Link href="/login">Masuk</Link>
      </main>
    );
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
              <nav aria-label="Breadcrumb" className="executive-breadcrumb">
                Sales & Marketing / Pesanan Pelanggan /{" "}
                <Link href="/operations/proformas">Proforma</Link>
                {id ? " / Detail" : ""}
              </nav>
              <h1>
                {id && row ? `${row.number} · ${row.batch?.salesOrder.number ?? ""}` : "Proforma"}
              </h1>
              <p>
                {id && row
                  ? `Terbit ${new Date(row.issuedAt).toLocaleDateString("id-ID")} · ${row.batch?.number ?? ""}`
                  : "Dokumen per tahap pemenuhan; Proforma tidak membentuk piutang."}
              </p>
            </div>
            <SalesNavigation active="proformas" />
          </header>
          {!allowed ? (
            <ErrorBox message="Anda tidak memiliki izin membaca Proforma." />
          ) : query.isError ? (
            <>
              <ErrorBox message="Proforma belum dapat dimuat atau tidak tersedia dalam akses Anda." />
              <Button variant="outline" onClick={() => void query.refetch()}>
                Coba Lagi
              </Button>
              <Link href="/operations/proformas">Kembali ke daftar Proforma</Link>
            </>
          ) : id ? (
            query.isPending ? (
              <p role="status">Memuat Proforma…</p>
            ) : (
              row && (
                <>
                  <Button className="sales-back" variant="outline" asChild>
                    <Link href="/operations/proformas">← Kembali ke daftar</Link>
                  </Button>
                  <div className="so-print-area web-form">
                    <div className="sales-status-strip">
                      <SalesBadge>{statusLabel(row.status)}</SalesBadge>
                    </div>
                    {row.status !== "ISSUED" && (
                      <p role="status">
                        {row.status === "SUPERSEDED"
                          ? "Dokumen telah digantikan oleh revisi baru."
                          : row.status === "VOID"
                            ? "Tahap pemenuhan dibatalkan. Dokumen ini tidak berlaku."
                            : row.status === "REVISION_REQUIRED"
                              ? "Alokasi telah berubah. Tinjau dan terbitkan revisi melalui detail SO."
                              : "Status dokumen belum tersedia. Muat ulang data sebelum mencetak."}
                      </p>
                    )}
                    {row.status !== "ISSUED" && (
                      <p>ARSIP — tidak untuk digunakan sebagai Proforma aktif.</p>
                    )}
                    <ProformaContents
                      documentNumber={row.number}
                      asideContent={
                        <>
                          <Panel title="Pembayaran">
                            <Value label="Nilai Proforma">
                              {amount(
                                (row.snapshot as { total?: string })?.total ?? row.value,
                                (row.snapshot as { currency?: string })?.currency,
                              )}
                            </Value>
                            <Value label="Dana terverifikasi">
                              {row.verifiedFunds == null
                                ? "Memerlukan akses penerimaan"
                                : amount(
                                    row.verifiedFunds,
                                    (row.snapshot as { currency?: string })?.currency,
                                  )}
                            </Value>
                            <Value label="Kekurangan">
                              {row.verifiedFunds != null &&
                              (row.snapshot as { total?: string })?.total != null
                                ? amount(
                                    Decimal.max(
                                      0,
                                      new Decimal((row.snapshot as { total: string }).total).sub(
                                        row.verifiedFunds,
                                      ),
                                    ).toString(),
                                    (row.snapshot as { currency?: string }).currency,
                                  )
                                : "Belum tersedia"}
                            </Value>
                            <p className="sales-notice sales-warning">
                              Bukti unggahan tidak otomatis berarti dana terverifikasi. Pengiriman
                              mengikuti pemeriksaan Finance dan gudang.
                            </p>
                          </Panel>
                          <Panel title="Penyerahan dokumen">
                            <HandoffStatus kind="proforma" id={row.id} />
                          </Panel>
                          <Panel title="Versi & riwayat">
                            <Value label="Dokumen">{row.number}</Value>
                            <Value label="Terbit">
                              {new Date(row.issuedAt).toLocaleDateString("id-ID")}
                            </Value>
                            <SalesBadge>{statusLabel(row.status)}</SalesBadge>
                            <p className="sales-notice">
                              Proforma tidak membentuk piutang. Perubahan sumber memerlukan
                              pemeriksaan revisi.
                            </p>
                          </Panel>
                        </>
                      }
                      mainContent={
                        <DocumentHandoff
                          kind="proforma"
                          id={row.id}
                          editable={canIssue && row.status === "ISSUED"}
                        />
                      }
                      snapshot={row.snapshot}
                      issuedAt={row.issuedAt}
                      batchNumber={row.batch?.number}
                    />
                  </div>
                  <div className="so-footer so-detail-actions so-no-print">
                    <Button variant="outline" asChild>
                      <Link href="/operations/proformas">
                        <ArrowLeft />
                        Daftar Proforma
                      </Link>
                    </Button>
                    {row.batch && canReadOrder && (
                      <Button variant="outline" asChild>
                        <Link href={`/operations/orders/${row.batch.salesOrder.id}`}>
                          Buka Sales Order
                        </Link>
                      </Button>
                    )}
                    <Button disabled={row.status !== "ISSUED"} onClick={() => window.print()}>
                      <Printer />
                      Cetak Proforma
                    </Button>
                  </div>
                </>
              )
            )
          ) : (
            <>
              <div className="sales-list-tabs" aria-label="Status Proforma">
                {[
                  ["ALL", "Semua"],
                  ["PENDING", "Belum terbit"],
                  ["ISSUED", "Terbit"],
                  ["REVISION_REQUIRED", "Perlu revisi"],
                  ["SUPERSEDED", "Diganti"],
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
              <div className="so-kpis">
                {[
                  ["ISSUED", "Terbit"],
                  ["REVISION_REQUIRED", "Perlu revisi"],
                  ["SUPERSEDED", "Diganti"],
                  ["FUNDS_PENDING", "Menunggu dana"],
                ].map(([key, label]) => (
                  <Panel key={key} title={label!}>
                    <strong className="sales-kpi-number">{row?.summary?.[key!] ?? "—"}</strong>
                  </Panel>
                ))}
              </div>
              <p className="sales-notice">
                Proforma diterbitkan per tahap setelah alokasi tersedia. Proforma tidak membentuk
                piutang.
              </p>
              <section className="sales-list-panel">
                <h2>Daftar Proforma</h2>
                <DataTable
                  data={row?.rows ?? []}
                  columns={columns}
                  total={row?.total ?? 0}
                  page={page}
                  onPage={setPage}
                  busy={query.isFetching}
                  label="Proforma"
                  showColumns={false}
                  toolbar={
                    <div className="sales-inline-toolbar">
                      <Input
                        aria-label="Cari Proforma, SO, atau pelanggan"
                        placeholder="Cari nomor Proforma, SO, atau pelanggan…"
                        value={search}
                        maxLength={100}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <SelectionField
                        label="Status Proforma"
                        value={[filter]}
                        options={[
                          { id: "ALL", name: "Semua status" },
                          { id: "PENDING", name: "Belum terbit" },
                          { id: "ISSUED", name: "Terbit" },
                          { id: "REVISION_REQUIRED", name: "Perlu revisi" },
                          { id: "SUPERSEDED", name: "Diganti" },
                        ]}
                        onChange={(values) => {
                          setFilter(values[0] ?? "ALL");
                          setPage(1);
                        }}
                      />
                      <SalesPeriod />
                    </div>
                  }
                />
              </section>
              <p className="so-help">
                Proforma hanya memuat jumlah yang telah dialokasikan. Tahap yang menunggu penerbitan
                belum memiliki nomor dokumen sampai pengguna mengonfirmasi penerbitannya. Proforma
                tidak membentuk piutang.
              </p>
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function statusLabel(status?: Proforma["status"]) {
  return (
    (
      {
        ISSUED: "Diterbitkan",
        SUPERSEDED: "Digantikan revisi",
        VOID: "Tidak berlaku",
        REVISION_REQUIRED: "Perlu revisi",
        PENDING: "Menunggu diterbitkan",
      } as Record<string, string>
    )[status ?? ""] ?? "Status belum tersedia"
  );
}
type SnapshotLine = {
  product_code?: string;
  unit?: string;
  product: string;
  quantity: string;
  unit_price: string;
  tax_snapshot?: { rate?: string } | null;
  amounts?: { net: string; tax: string; total: string };
};
export function ProformaContents({
  snapshot,
  issuedAt,
  batchNumber,
  totalsPending = false,
  freightControls,
  documentType = "Proforma",
  notes,
  mainContent,
  asideContent,
  beforeContent,
  afterContent,
  review = false,
  documentNumber,
}: {
  snapshot: unknown;
  issuedAt?: string | undefined;
  batchNumber?: string | undefined;
  totalsPending?: boolean;
  freightControls?: ReactNode;
  documentType?: "Proforma" | "Invoice";
  notes?: ReactNode;
  mainContent?: ReactNode;
  asideContent?: ReactNode;
  beforeContent?: ReactNode;
  afterContent?: ReactNode;
  review?: boolean;
  documentNumber?: string;
}) {
  const data = snapshot as
    | {
        customer?: string;
        address?: string;
        reference?: string;
        currency?: string;
        company?: string;
        payment?: { mode: string; top_days?: number };
        subtotal?: string;
        tax?: string;
        total?: string;
        freight?: { amount?: string; tax?: string; tax_snapshot?: { rate?: string } | null };
        allocations?: SnapshotLine[];
      }
    | undefined;
  if (!data || !Array.isArray(data.allocations))
    return <p>Rincian cetak dokumen tidak tersedia.</p>;
  const subtotal = data.subtotal ?? sumAmounts(data.allocations, "net");
  const tax = data.tax ?? sumAmounts(data.allocations, "tax");
  const total = data.total ?? sumAmounts(data.allocations, "total");
  const columns: ColumnDef<SnapshotLine>[] = [
    { id: "code", header: "Kode Produk", cell: ({ row }) => row.original.product_code ?? "—" },
    { accessorKey: "product", header: "Nama Produk" },
    { id: "unit", header: "Satuan", cell: ({ row }) => row.original.unit ?? "—" },
    { id: "quantity", header: "Jumlah", cell: ({ row }) => amount(String(row.original.quantity)) },
    {
      id: "price",
      header: "Harga Satuan",
      cell: ({ row }) => amount(String(row.original.unit_price)),
    },
    {
      id: "discount",
      header: "Diskon (%)",
      cell: () => <span title="Diskon terpisah belum didukung oleh data Proforma">—</span>,
    },
    {
      id: "tax",
      header: "Pajak",
      cell: ({ row }) =>
        row.original.tax_snapshot?.rate != null ? (
          `${amount(new Decimal(row.original.tax_snapshot.rate).mul(100).toFixed())}%`
        ) : (
          <span title="Tarif pajak tidak tersimpan pada snapshot dokumen ini">—</span>
        ),
    },
    { id: "net", header: "Sub Total", cell: ({ row }) => amount(row.original.amounts?.net) },
  ];
  const totals = (
    <aside className="so-totals" aria-label={`Ringkasan nilai ${documentType}`}>
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{amount(subtotal, data.currency)}</dd>
        </div>
        <div>
          <dt>Diskon</dt>
          <dd>Belum tersedia</dd>
        </div>
        {data.freight?.tax_snapshot || new Decimal(data.freight?.tax ?? "0").gt(0) ? (
          <>
            <div>
              <dt>Ongkos kirim (sebelum PPN)</dt>
              <dd>{totalsPending ? "—" : amount(data.freight?.amount, data.currency)}</dd>
            </div>
            <div>
              <dt>PPN barang + ongkos kirim</dt>
              <dd>{totalsPending ? "—" : amount(tax, data.currency)}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>PPN barang</dt>
              <dd>{totalsPending ? "—" : amount(tax, data.currency)}</dd>
            </div>
            <div>
              <dt>Ongkos kirim (sesudah PPN)</dt>
              <dd>{totalsPending ? "—" : amount(data.freight?.amount, data.currency)}</dd>
            </div>
          </>
        )}
        <div className="so-grand-total">
          <dt>Total Tagihan</dt>
          <dd>{totalsPending ? "—" : amount(total, data.currency)}</dd>
        </div>
      </dl>
      {data.total == null && data.allocations.length > 0 && (
        <p>
          Ringkasan dihitung dari nilai baris pada snapshot dokumen lama. Nilai yang tidak tersimpan
          ditampilkan sebagai tanda pisah.
        </p>
      )}
    </aside>
  );
  const reviewing = review || !!freightControls;
  return (
    <div className="sales-columns">
      <div className="sales-main">
        {beforeContent}
        <Panel
          title={
            reviewing
              ? documentType === "Invoice"
                ? "2 · Tinjau baris tagihan"
                : "Isi Proforma (hanya yang teralokasi)"
              : `${documentType === "Invoice" ? "Invoice" : "Proforma Invoice"}${documentNumber ? ` · ${documentNumber}` : ""}`
          }
          className="sales-document"
        >
          {!reviewing && (
            <div className="sales-document-parties">
              <strong>{data.company ?? "Perusahaan tidak tercatat pada dokumen lama"}</strong>
              <p>
                {data.customer} · {data.address}
              </p>
              <p className="so-help">
                {data.reference} · {terms(data.payment)}
                {issuedAt ? ` · ${new Date(issuedAt).toLocaleDateString("id-ID")}` : ""}
                {batchNumber ? ` · ${batchNumber}` : ""}
              </p>
            </div>
          )}
          <DataTable
            data={data.allocations}
            columns={columns}
            total={data.allocations.length}
            label={`produk ${documentType}`}
            showColumns={false}
          />
          {reviewing ? (
            <p className="sales-notice">
              {documentType === "Invoice"
                ? "Jumlah mengikuti yang benar-benar diterima pada POD."
                : "Jika alokasi berubah setelah pratinjau, muat ulang sebelum menerbitkan."}
            </p>
          ) : (
            <div className="sales-document-total">{totals}</div>
          )}
        </Panel>
        {freightControls}
        {afterContent}
        {mainContent}
        {notes && reviewing && <Panel title="3 · Jatuh tempo & referensi">{notes}</Panel>}
      </div>
      <aside className="sales-aside" aria-label={`Ringkasan dan tindak lanjut ${documentType}`}>
        {reviewing && (
          <Panel title="Ringkasan">
            {totals}
            <p className="sales-notice">
              Ongkir mengikuti pengiriman terkait. Nilainya tidak ditambahkan dua kali.
            </p>
          </Panel>
        )}
        {asideContent}
      </aside>
    </div>
  );
}

function sumAmounts(lines: SnapshotLine[], field: "net" | "tax" | "total") {
  if (!lines.length || lines.some((line) => line.amounts?.[field] == null)) return undefined;
  return lines.reduce((sum, line) => sum.add(line.amounts![field]), new Decimal(0)).toFixed();
}
