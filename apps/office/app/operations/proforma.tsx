"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Printer } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const allowed =
    !!principal &&
    (hasCompanyPermission(principal, "sales_order.read") ||
      hasCompanyPermission(principal, "proforma.issue"));
  const canIssue = !!principal && hasCompanyPermission(principal, "proforma.issue");
  const canReadOrder = !!principal && hasCompanyPermission(principal, "sales_order.read");
  const endpoint = id
    ? `/operations/proformas/${id}`
    : `/operations/lists/proformas?page=${page}&search=${encodeURIComponent(term)}`;
  const query = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, endpoint],
    queryFn: ({ signal }) =>
      apiRequest<{ data: Proforma & { rows: Proforma[]; total: number } }>(endpoint, { signal }),
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
      id: "status",
      header: "Status dokumen",
      cell: ({ row: r }) => <Badge variant="outline">{statusLabel(r.original.status)}</Badge>,
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
        <main className="executive-content crm-content otc-workspace so-workspace">
          <header className="executive-heading">
            <div>
              <nav aria-label="Breadcrumb" className="executive-breadcrumb">
                Sales & Marketing / Pesanan Pelanggan /{" "}
                <Link href="/operations/proformas">Proforma</Link>
                {id ? " / Detail" : ""}
              </nav>
              <h1>{id ? "Detail Proforma" : "Proforma"}</h1>
              <p>Proforma dan riwayat revisi berdasarkan alokasi Sales Order.</p>
            </div>
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
                  <div className="so-print-area web-form">
                    <div className="so-detail-overview">
                      <div>
                        <span className="so-eyebrow">PROFORMA</span>
                        <h2>{row.number}</h2>
                        <p>{row.batch?.salesOrder.customer.name}</p>
                      </div>
                      <div className="so-dimensions">
                        <div>
                          <span>Dokumen</span>
                          <Badge variant="outline">{statusLabel(row.status)}</Badge>
                        </div>
                        <div>
                          <span>Sales Order</span>
                          <strong>{row.batch?.salesOrder.number ?? "—"}</strong>
                        </div>
                      </div>
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
                      snapshot={row.snapshot}
                      issuedAt={row.issuedAt}
                      batchNumber={row.batch?.number}
                    />
                  </div>
                </>
              )
            )
          ) : (
            <>
              <DataTable
                data={row?.rows ?? []}
                columns={columns}
                total={row?.total ?? 0}
                page={page}
                onPage={setPage}
                busy={query.isFetching}
                label="Proforma"
                densityControl
                toolbar={
                  <Input
                    aria-label="Cari Proforma, SO, atau pelanggan"
                    placeholder="Cari nomor Proforma, SO, atau pelanggan…"
                    value={search}
                    maxLength={100}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                }
              />
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
}: {
  snapshot: unknown;
  issuedAt?: string;
  batchNumber?: string | undefined;
  totalsPending?: boolean;
  freightControls?: ReactNode;
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
  return (
    <div className={freightControls ? "so-detail-layout so-proforma-layout" : "so-detail-layout"}>
      <div className="so-detail-main">
        <Panel title="Pelanggan & pengiriman">
          <div className="so-info-grid">
            <Value label="Perusahaan saat penerbitan">
              {data.company ?? "Tidak tercatat pada dokumen lama"}
            </Value>
            <Value label="Pelanggan saat penerbitan">{data.customer}</Value>
            <Value label="Alamat pengiriman">{data.address}</Value>
            <Value label="Referensi pelanggan">{data.reference}</Value>
            <Value label="Mata uang">{data.currency}</Value>
            <Value label="Ketentuan pembayaran">{terms(data.payment)}</Value>
            <Value label="Tanggal terbit">
              {issuedAt
                ? new Date(issuedAt).toLocaleDateString("id-ID", { dateStyle: "long" })
                : "Belum diterbitkan"}
            </Value>
            <Value label="Tahap pemenuhan">{batchNumber}</Value>
          </div>
        </Panel>
        <Panel title="Detail produk Proforma">
          <div className="so-proforma-lines">
            <DataTable
              data={data.allocations}
              columns={columns}
              total={data.allocations.length}
              label="produk Proforma"
              showColumns={false}
            />
          </div>
          <p className="so-help">
            Harga dan nilai dalam {data.currency ?? "mata uang dokumen"}. Subtotal sebelum pajak.
          </p>
        </Panel>
      </div>
      <aside className="so-detail-aside" aria-label="Nilai dan catatan Proforma">
        <Panel title="Nilai Pesanan">
          <aside className="so-totals" aria-label="Ringkasan nilai Proforma">
            <h3>Ringkasan nilai</h3>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{amount(subtotal, data.currency)}</dd>
              </div>
              <div>
                <dt>Diskon</dt>
                <dd>Belum tersedia</dd>
              </div>
              <div>
                <dt>Ongkos Kirim</dt>
                <dd>{totalsPending ? "—" : amount(data.freight?.amount, data.currency)}</dd>
              </div>
              <div>
                <dt>Pajak</dt>
                <dd>{totalsPending ? "—" : amount(tax, data.currency)}</dd>
              </div>
              <div className="so-grand-total">
                <dt>Total Tagihan</dt>
                <dd>{totalsPending ? "—" : amount(total, data.currency)}</dd>
              </div>
            </dl>
            {data.total == null && (
              <p>
                Ringkasan dihitung dari nilai baris pada snapshot dokumen lama. Nilai yang tidak
                tersimpan ditampilkan sebagai tanda pisah.
              </p>
            )}
          </aside>
        </Panel>
        {freightControls}
        <Panel title="Catatan" className="so-proforma-note">
          <p className="so-help">
            Proforma Invoice merupakan dokumen sementara sebelum Invoice diterbitkan dan belum
            membentuk piutang. Nilai mengikuti alokasi pada dokumen.
          </p>
        </Panel>
      </aside>
    </div>
  );
}

function sumAmounts(lines: SnapshotLine[], field: "net" | "tax" | "total") {
  if (!lines.length || lines.some((line) => line.amounts?.[field] == null)) return undefined;
  return lines.reduce((sum, line) => sum.add(line.amounts![field]), new Decimal(0)).toFixed();
}
