"use client";
import Link from "next/link";
import Decimal from "decimal.js";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  MetaItem,
  OfficePage,
  PageNotice,
  RecordBadge,
} from "@/components/web/page-frame";
import { IconPlus } from "@/components/web/icons";
import { apiRequest } from "@/lib/api";
import {
  billingLabel,
  orderDocumentStatus,
  shippingLabel,
  type OrderBilling,
  type OrderShipping,
} from "@/lib/sales-order-copy";
import { useSession } from "../session-provider";
import { Evidence } from "./workspace";
import {
  type Order,
  type OrderLine,
  type OrderCommand,
  amount,
  taxLabel,
} from "./sales-order-types";
import { SalesOrderPrint } from "./sales-order-print";

const D = Decimal.clone({ precision: 50 });
type DetailLine = OrderLine & {
  Uom?: { name: string } | null;
  ordered?: string;
  /** Jumlah pada Surat Jalan terbit. */
  delivered?: string;
  /** Bagian terkirim yang sudah diinvoice; hanya untuk pembaca invoice. */
  invoiced?: string;
  remaining?: string;
};
export type DetailOrder = Omit<Order, "lines"> & {
  lines: DetailLine[];
  customer?: {
    id?: string;
    name: string;
    primaryAddress?: string | null;
    channel?: { name: string } | null;
  } | null;
  warehouseName?: string | null;
  companyProfile?: { name: string; address?: string | null; taxId?: string | null };
  paymentTerm?: { code: string; label: string } | null;
  shipping?: OrderShipping;
  billing?: OrderBilling;
  deliveryNotes?: {
    id: string;
    number: string;
    state: "DRAFT" | "ISSUED";
    issuedAt: string | null;
  }[];
  invoiceSummaries?: {
    id: string;
    number: string;
    total: string;
    outstanding: string;
    paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  }[];
};
type Action = { code: string; label: string; enabled: boolean; reason: string | null };

const dateLabel = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "Belum tersedia";
const paymentLabels = { UNPAID: "Belum dibayar", PARTIAL: "Dibayar sebagian", PAID: "Lunas" };
const paymentTones = { UNPAID: "neutral", PARTIAL: "warning", PAID: "success" };
function percent(part: Decimal, whole: Decimal) {
  if (whole.lte(0)) return 0;
  return Math.min(100, Math.round(part.div(whole).mul(100).toNumber()));
}
function Kv({
  label,
  children,
  plain,
}: {
  label: string;
  children?: React.ReactNode;
  plain?: boolean;
}) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div>
      <dt>{label}</dt>
      <dd data-empty={empty || undefined} data-plain={plain || undefined}>
        {empty ? "Belum tersedia" : children}
      </dd>
    </div>
  );
}
function Progress({ label, value, tone }: { label: string; value: number; tone?: "light" }) {
  return (
    <>
      <div className="sor-progress-label">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div
        className="sor-progress-bar"
        data-tone={tone}
        role="img"
        aria-label={`${label} ${value}%`}
      >
        <span style={{ width: `${value}%` }} />
      </div>
    </>
  );
}

/**
 * Detail SO mengikuti canvas "SO-detail": kartu dengan urutan yang sama seperti form, lalu
 * Ringkasan, Progres nilai dan Daftar Dokumen di kanan. Jumlah terkirim, tagihan dan dokumen
 * berasal dari GET /operations/orders/:id; aksi dari GET /operations/orders/:id/actions.
 */
export function SalesOrderDetail({
  row,
  command,
  pending,
  error,
  errorHref,
  can,
  history,
}: {
  row: DetailOrder;
  command: OrderCommand;
  pending: boolean;
  error: string;
  errorHref?: string | undefined;
  can: (permission: string) => boolean;
  history: React.ReactNode;
}) {
  const { principal } = useSession();
  const actions = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      "order-detail",
      row.id,
      "actions",
      principal?.permissions,
    ],
    queryFn: ({ signal }) =>
      apiRequest<{ data: { actions: Action[] } }>(`/operations/orders/${row.id}/actions`, {
        signal,
      }),
  });
  const list = actions.data?.data.actions ?? [];
  const action = (code: string) => list.find((a) => a.code === code);
  const submit = action("submit"),
    revise = action("revise"),
    print = action("print");

  const draft = row.state === "DRAFT";
  const termLabel = row.paymentTerm?.label ?? null;
  const unitOf = (l: DetailLine) => l.Uom?.name ?? l.product.baseUom?.name ?? "";
  const units = new Set(row.lines.map(unitOf).filter(Boolean));
  const unit = units.size === 1 ? [...units][0] : "unit";
  const ordered = row.lines.reduce((s, l) => s.add(l.ordered ?? l.orderedQuantity), new D(0));
  const open = row.lines.filter((l) => new D(l.remaining ?? 0).gt(0));
  const remainingText =
    open.length === 1
      ? `${amount(open[0]!.remaining)} ${unitOf(open[0]!)} ${open[0]!.product.name}`
      : `${open.length} barang`;
  const hasInvoiced = row.lines.some((l) => l.invoiced != null);
  const deliveredValue = row.lines.reduce(
    (s, l) => s.add(new D(l.delivered ?? 0).mul(l.unitPrice)),
    new D(0),
  );
  const invoicedValue = (row.invoiceSummaries ?? []).reduce((s, i) => s.add(i.total), new D(0));
  const shipping = shippingLabel(row.shipping);
  const billing = billingLabel(row.billing);
  const status = orderDocumentStatus(row.displayStatus ?? row.state);
  const canCreateNote =
    row.state === "OPEN" &&
    can("fulfillment.dispatch") &&
    can("outbound_shipping.read") &&
    row.shipping?.status !== "SHIPPED";

  const columns: ColumnDef<DetailLine>[] = [
    {
      id: "product",
      header: "Produk",
      cell: ({ row: { original: l } }) => (
        <span className="sor-product">
          <strong>{l.product.name}</strong>
          <small>
            {l.product.code}
            {unitOf(l) ? ` · ${unitOf(l)}` : ""}
          </small>
        </span>
      ),
    },
    {
      id: "ordered",
      header: () => <span className="sor-num">Dipesan</span>,
      cell: ({ row: { original: l } }) => (
        <span className="sor-num">{amount(l.ordered ?? l.orderedQuantity)}</span>
      ),
    },
    ...(!draft
      ? ([
          {
            id: "delivered",
            header: () => <span className="sor-num">Terkirim</span>,
            cell: ({ row: { original: l } }) => (
              <span className="sor-num">{amount(l.delivered ?? "0")}</span>
            ),
          },
          {
            id: "remaining",
            header: () => <span className="sor-num">Sisa</span>,
            cell: ({ row: { original: l } }) => (
              <span
                className="sor-num sor-strong"
                style={{ color: new D(l.remaining ?? 0).gt(0) ? "#8A5300" : "#17663F" }}
              >
                {amount(l.remaining ?? "0")}
              </span>
            ),
          },
          ...(hasInvoiced
            ? ([
                {
                  id: "invoiced",
                  header: () => <span className="sor-num">Diinvoice</span>,
                  cell: ({ row: { original: l } }) => (
                    <span className="sor-num">{amount(l.invoiced ?? "0")}</span>
                  ),
                },
              ] satisfies ColumnDef<DetailLine>[])
            : []),
        ] satisfies ColumnDef<DetailLine>[])
      : []),
    {
      id: "price",
      header: () => <span className="sor-num">Harga</span>,
      cell: ({ row: { original: l } }) => (
        <span className="sor-num">{amount(l.unitPrice, row.currency)}</span>
      ),
    },
    {
      id: "tax",
      header: () => <span className="sor-num">PPN</span>,
      cell: ({ row: { original: l } }) => (
        <span className="sor-num">{taxLabel(l.taxSnapshot)}</span>
      ),
    },
    {
      id: "subtotal",
      header: () => <span className="sor-num">Subtotal</span>,
      cell: ({ row: { original: l } }) => (
        <span className="sor-num sor-strong">{amount(l.subtotal, row.currency)}</span>
      ),
    },
  ];

  const createNoteButton = (variant: "default" | "outline") => (
    <Button variant={variant} asChild>
      <Link href={`/operations/delivery-notes/from-order/${row.id}`}>
        {variant === "default" && <IconPlus aria-hidden="true" />}
        Buat Surat Jalan
      </Link>
    </Button>
  );
  const next = draft
    ? "SO masih draft. Ajukan SO agar Surat Jalan dapat dibuat."
    : row.displayStatus === "WAITING_APPROVAL"
      ? "SO menunggu persetujuan sesuai aturan aktif di Setting."
      : row.state === "OPEN" && row.shipping
        ? open.length
          ? `${remainingText} belum dikirim. Buat Surat Jalan saat barang siap diantar; sisa tetap terbuka sampai dikirim.`
          : row.billing?.status === "UNINVOICED"
            ? "Seluruh barang sudah dikirim. Buat Invoice dari Surat Jalan terbit."
            : "Seluruh barang sudah dikirim."
        : null;

  return (
    <>
      <OfficePage
        section="sales"
        crumbs={[
          { label: "Sales & Marketing" },
          { label: "Pesanan Pelanggan", href: "/operations/orders" },
          { label: row.number },
        ]}
        title={row.number}
        meta={
          <>
            <MetaItem label="Status pesanan">
              <RecordBadge state={status.tone} label={status.label} />
            </MetaItem>
            {row.shipping && (
              <MetaItem label="Pengiriman">
                <RecordBadge state={shipping.tone} label={shipping.label} />
              </MetaItem>
            )}
            {row.billing && (
              <MetaItem label="Tagihan">
                <RecordBadge state={billing.tone} label={billing.label} />
              </MetaItem>
            )}
            {termLabel && (
              <MetaItem label="Termin">
                <RecordBadge state="info" label={termLabel} />
              </MetaItem>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/operations/orders">Kembali</Link>
            </Button>
            {print && (
              <Button
                variant="outline"
                disabled={pending || !print.enabled || !row.companyProfile}
                onClick={() =>
                  void command(`/sales-orders/${row.id}/print-events`)
                    .then(() => window.print())
                    .catch(() => undefined)
                }
              >
                Cetak
              </Button>
            )}
            {can("sales_order.create") && (
              <Button variant="outline" asChild>
                <Link href="/operations/orders/new">SO baru</Link>
              </Button>
            )}
            {revise?.enabled && (
              <Button variant="outline" asChild>
                <Link href={`/operations/orders/${row.id}/edit`}>Ubah</Link>
              </Button>
            )}
            {submit?.enabled ? (
              <Button
                disabled={pending}
                onClick={() =>
                  void command(`/sales-orders/${row.id}/submit`).catch(() => undefined)
                }
              >
                {pending ? "Memproses…" : "Ajukan SO"}
              </Button>
            ) : (
              canCreateNote && createNoteButton("default")
            )}
          </>
        }
      >
        {error && (
          <PageNotice tone="error" settingsHref={errorHref}>
            {error}
          </PageNotice>
        )}
        {actions.isError && (
          <PageNotice tone="error" onRetry={() => void actions.refetch()}>
            {actions.error.message}
          </PageNotice>
        )}
        {next && (
          <section className="sor-next" aria-label="Langkah berikutnya">
            <svg width="22" height="24" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
              <path
                d="M8 1C4 1.4 1 4.4 1 7.9 1 11 3.3 13.2 6.5 13 4.3 12.3 2.8 10.3 2.8 7.8 2.8 4.9 4.9 2.3 8 1z"
                fill="#1F7FE0"
              />
            </svg>
            <div>
              <strong>Langkah berikutnya</strong>
              <span>{next}</span>
            </div>
            {canCreateNote && open.length > 0 && createNoteButton("outline")}
          </section>
        )}
        <div className="sor-layout">
          <div className="sor-main">
            <section className="sor-panel" aria-labelledby="sod-1">
              <h2 id="sod-1">Informasi Utama</h2>
              <dl className="sor-kv sor-grid">
                <Kv label="Nomor SO">{row.number}</Kv>
                <Kv label="Tanggal SO">{dateLabel(row.orderDate ?? row.createdAt)}</Kv>
                <div>
                  <dt>Pelanggan</dt>
                  <dd>
                    {can("master_customer.read") && row.customer ? (
                      <Link
                        className="page-frame-link"
                        href={`/master-data/customers/${row.customerId}`}
                      >
                        {row.customer.name}
                      </Link>
                    ) : (
                      (row.customer?.name ?? "Belum tersedia")
                    )}
                  </dd>
                  {row.customer?.channel?.name && <dd>{row.customer.channel.name}</dd>}
                </div>
                <Kv label="Termin / TOP">{termLabel}</Kv>
                <div className="sor-span">
                  <Kv label="Alamat utama" plain>
                    {row.customer?.primaryAddress}
                  </Kv>
                </div>
              </dl>
            </section>

            <section className="sor-panel" aria-labelledby="sod-2">
              <h2 id="sod-2">Referensi pesanan</h2>
              <dl className="sor-kv sor-grid">
                <Kv label="Nomor SP pelanggan">{row.customerReference}</Kv>
                <div className="sor-span">
                  <dt>Bukti SP</dt>
                  <dd>{row.evidenceId ? <Evidence id={row.evidenceId} /> : "Belum ada bukti."}</dd>
                </div>
              </dl>
            </section>

            <section className="sor-panel" aria-labelledby="sod-3">
              <h2 id="sod-3">Barang</h2>
              <p className="sor-desc" style={{ marginBottom: 16 }}>
                Harga dan PPN terkunci saat SO diajukan.
              </p>
              <DataTable
                data={row.lines}
                columns={columns}
                total={row.lines.length}
                label="barang pesanan"
                showColumns={false}
              />
              {!draft && (
                <p className="sor-hint" style={{ marginTop: 14 }}>
                  Terkirim dihitung dari Surat Jalan terbit, kumulatif. Baris yang sudah terkirim
                  tidak bisa diubah di SO.
                </p>
              )}
            </section>

            <section className="sor-panel" aria-labelledby="sod-4">
              <h2 id="sod-4">Pengiriman</h2>
              <dl className="sor-kv sor-grid">
                <div className="sor-span">
                  <dt>Alamat pengantaran</dt>
                  <dd data-plain>{row.deliveryAddress || "Belum tersedia"}</dd>
                </div>
                <Kv label="Ongkir">
                  {row.freightEstimate != null ? amount(row.freightEstimate, row.currency) : null}
                </Kv>
              </dl>
            </section>

            <section className="sor-panel" aria-labelledby="sod-5">
              <h2 id="sod-5">Catatan</h2>
              <dl className="sor-kv">
                <Kv label="Catatan untuk gudang dan finance" plain>
                  {row.notes || "Tidak ada"}
                </Kv>
              </dl>
            </section>

            {can("audit_event.read") && (
              <section className="sor-panel" aria-labelledby="sod-6">
                <h2 id="sod-6">Riwayat</h2>
                {history}
              </section>
            )}
          </div>

          <aside className="sor-aside" aria-label="Ringkasan SO">
            <section className="sor-side" aria-labelledby="sod-sum">
              <h2 id="sod-sum">Ringkasan</h2>
              <dl style={{ margin: 0 }}>
                <div className="sor-sum">
                  <dt>
                    {row.lines.length} baris · {amount(ordered.toString())} {unit}
                  </dt>
                  <dd />
                </div>
                <div className="sor-sum">
                  <dt>Nilai barang</dt>
                  <dd>{amount(row.subtotal, row.currency)}</dd>
                </div>
                <div className="sor-sum">
                  <dt>PPN {row.lines[0]?.taxSnapshot ? taxLabel(row.lines[0].taxSnapshot) : ""}</dt>
                  <dd>
                    {row.taxAmount == null
                      ? "Menunggu evaluasi"
                      : amount(row.taxAmount, row.currency)}
                  </dd>
                </div>
                <div className="sor-sum">
                  <dt>Ongkos kirim</dt>
                  <dd>{amount(row.freightEstimate ?? "0", row.currency)}</dd>
                </div>
                <div className="sor-sum sor-sum-total">
                  <dt>Total SO</dt>
                  <dd>
                    {row.total == null ? "Menunggu evaluasi" : amount(row.total, row.currency)}
                  </dd>
                </div>
                <div className="sor-sum">
                  <dt>Termin</dt>
                  <dd>{termLabel ?? "—"}</dd>
                </div>
              </dl>
            </section>

            {!draft && (
              <section className="sor-side" aria-labelledby="sod-progress">
                <h2 id="sod-progress">Progres nilai</h2>
                <div className="sor-progress">
                  <Progress
                    label="Terkirim (SJ terbit)"
                    value={percent(deliveredValue, new D(row.subtotal ?? 0))}
                  />
                  {row.invoiceSummaries && row.total != null && (
                    <Progress
                      label="Diinvoice"
                      value={percent(invoicedValue, new D(row.total))}
                      tone="light"
                    />
                  )}
                </div>
              </section>
            )}

            {!draft && (row.deliveryNotes || row.invoiceSummaries) && (
              <section className="sor-side" aria-labelledby="sod-docs">
                <h2 id="sod-docs">Daftar Dokumen</h2>
                <dl className="sor-kv sor-docs">
                  {row.deliveryNotes && (
                    <div>
                      <dt>Surat Jalan</dt>
                      {row.deliveryNotes.length ? (
                        row.deliveryNotes.map((n) => (
                          <dd key={n.id} className="sor-doc-row">
                            <Link
                              className="page-frame-link"
                              href={`/operations/delivery-notes/${n.id}`}
                            >
                              {n.number}
                            </Link>
                            <RecordBadge
                              state={n.state === "ISSUED" ? "success" : "warning"}
                              label={n.state === "ISSUED" ? "Terbit" : "Draft"}
                            />
                          </dd>
                        ))
                      ) : (
                        <dd data-empty>Belum ada</dd>
                      )}
                    </div>
                  )}
                  {row.invoiceSummaries && (
                    <div>
                      <dt>Invoice</dt>
                      {row.invoiceSummaries.length ? (
                        row.invoiceSummaries.map((i) => (
                          <dd key={i.id} className="sor-doc-row">
                            <Link className="page-frame-link" href={`/operations/invoices/${i.id}`}>
                              {i.number}
                            </Link>
                            <RecordBadge
                              state={paymentTones[i.paymentStatus]}
                              label={paymentLabels[i.paymentStatus]}
                            />
                          </dd>
                        ))
                      ) : (
                        <dd data-empty>Belum ada</dd>
                      )}
                    </div>
                  )}
                  <Kv label="Sisa belum dikirim">{open.length ? remainingText : "Tidak ada"}</Kv>
                </dl>
              </section>
            )}
          </aside>
        </div>
      </OfficePage>
      {print?.enabled && row.companyProfile && <SalesOrderPrint row={row} />}
    </>
  );
}
