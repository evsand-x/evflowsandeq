"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { DataTable, OfficePage, PageNotice } from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import {
  lineStatusLabel,
  relatedKindLabel,
  documentStatusLabel,
  orderStatusLabel,
} from "@/lib/sales-order-copy";
import { useSession } from "../session-provider";
import {
  type Order,
  type OrderLine,
  type OrderCommand,
  amount,
  taxLabel,
} from "./sales-order-types";
import { Tone } from "./sales-order-journey";
import { CloseRemainder } from "./sales-order-form";
import { SalesExceptions } from "./extended-controls";
import { SalesOrderAdvancePanel, type OrderAdvance } from "./sales-order-advance-panel";
import { SalesOrderPrint } from "./sales-order-print";

type DetailLine = OrderLine & {
  ordered?: string;
  sent?: string;
  accepted?: string;
  closed?: string;
  remaining?: string;
  lineStatus?: string;
  Uom?: { name: string } | null;
};
export type DetailOrder = Omit<Order, "lines"> & {
  lines: DetailLine[];
  displayStatus?: string;
  orderDate?: string;
  dueDateEstimate?: string | null;
  warehouseName?: string | null;
  salespersonName?: string | null;
  downPayment?: string | null;
  remainingBill?: string | null;
  advances?: OrderAdvance[];
  companyProfile?: { name: string; address?: string | null; taxId?: string | null };
  neighbors?: { previousId: string | null; nextId: string | null };
  lastChanged?: { by: string; at: string } | null;
  lastPrinted?: { by: string; at: string } | null;
};
type RelatedDocument = {
  kind: string;
  id: string;
  number: string;
  date: string;
  status: string;
  amount: string | null;
  href: string;
};
type Action = {
  code: string;
  label: string;
  enabled: boolean;
  reason: string | null;
  target: { batchId?: string; pickListId?: string; advanceId?: string };
};
type Actions = { primary: Action | null; actions: Action[] };
const dateLabel = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "Belum tersedia";

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
  const { principal } = useSession(),
    router = useRouter();
  const [close, setClose] = useState(false),
    [advanceForm, setAdvanceForm] = useState(false),
    [showHistory, setShowHistory] = useState(false);
  const query = <T,>(suffix: string) => ({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      "order-detail",
      row.id,
      suffix,
    ],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiRequest<{ data: T }>(`/operations/orders/${row.id}/${suffix}`, { signal }),
  });
  const related = useQuery(query<RelatedDocument[]>("related"));
  const actions = useQuery(query<Actions>("actions"));
  const list = actions.data?.data.actions ?? [],
    primary = actions.data?.data.primary;
  const printAction = list.find((a) => a.code === "print");
  const run = async (a: Action) => {
    if (!a.enabled || pending) return;
    const batchId = a.target.batchId;
    switch (a.code) {
      case "submit":
        await command(`/sales-orders/${row.id}/submit`);
        break;
      case "reallocate":
        await command(`/operations/orders/${row.id}/reallocate`, { version: row.version });
        break;
      case "create_picking":
        if (batchId) {
          await command(`/fulfillment-batches/${batchId}/create-picking`);
          router.push(`/operations/pick-slips/${batchId}/edit`);
        }
        break;
      case "issue_proforma":
        if (batchId) router.push(`/operations/proformas/from-order/${row.id}/${batchId}`);
        break;
      case "open_picking":
        if (batchId) {
          const state = row.fulfillments?.find((b) => b.id === batchId)?.pickList?.state;
          router.push(
            state === "OPEN"
              ? `/operations/pick-slips/${batchId}/edit`
              : `/operations/warehouse/${state === "CHECKED" ? "shipping" : "checking"}/${batchId}/edit`,
          );
        }
        break;
      case "confirm_pod":
        if (batchId) router.push(`/operations/warehouse/pod/${batchId}/edit`);
        break;
      case "issue_invoice":
        if (batchId) {
          const result = await command(`/fulfillment-batches/${batchId}/issue-invoice`);
          router.push(`/operations/invoices/${result.data.id}`);
        }
        break;
      case "record_advance":
        setAdvanceForm(true);
        document.getElementById("so-advances")?.scrollIntoView({ behavior: "smooth" });
        break;
      case "verify_advance":
        document.getElementById("so-advances")?.scrollIntoView({ behavior: "smooth" });
        break;
      case "close_remainder":
        setClose(true);
        break;
      case "revise":
        router.push(`/operations/orders/${row.id}/edit`);
        break;
      case "duplicate": {
        const result = await command(`/sales-orders/${row.id}/duplicate`);
        router.push(`/operations/orders/${result.data.id}`);
        break;
      }
      case "print":
        await command(`/sales-orders/${row.id}/print-events`);
        window.print();
        break;
    }
  };
  const menuItem = (a: Action, index: number) => (
    <DropdownMenuItem
      key={`${a.code}:${index}`}
      disabled={!a.enabled || pending}
      onSelect={() => void run(a).catch(() => undefined)}
      className="so-action-menu-item"
    >
      <span>{a.label}</span>
      {!a.enabled && a.reason && <small>{a.reason}</small>}
    </DropdownMenuItem>
  );
  const columns: ColumnDef<DetailLine>[] = [
    {
      id: "product",
      header: "Produk",
      cell: ({ row: { original: l } }) => (
        <details
          className="so-line-detail"
          data-remaining={(l.remaining != null && new Decimal(l.remaining).gt(0)) || undefined}
        >
          <summary>
            <strong>{l.product.name}</strong>
            <small>{l.product.code}</small>
          </summary>
          <dl>
            <dt>Dikirim</dt>
            <dd>{amount(l.sent)}</dd>
            <dt>Dalam perjalanan</dt>
            <dd>
              {l.allocations != null
                ? amount(
                    l.allocations
                      .reduce(
                        (total, allocation) => total.add(allocation.inTransitQuantity),
                        new Decimal(0),
                      )
                      .toString(),
                  )
                : "Belum tersedia"}
            </dd>
            <dt>Ditutup</dt>
            <dd>{amount(l.closed)}</dd>
          </dl>
        </details>
      ),
    },
    ...(
      [
        ["ordered", "Dipesan"],
        ["accepted", "Diterima pelanggan"],
        ["remaining", "Sisa"],
      ] as const
    ).map(([key, label]) => ({
      id: key,
      header: label,
      cell: ({ row: r }: { row: { original: DetailLine } }) => (
        <span
          className="so-num"
          data-warn={
            (key === "remaining" && new Decimal(r.original.remaining ?? 0).gt(0)) || undefined
          }
        >
          {amount(r.original[key])}
        </span>
      ),
    })),
    {
      id: "state",
      header: "Status baris",
      cell: ({ row }) => <Tone>{lineStatusLabel(row.original.lineStatus ?? "")}</Tone>,
    },
    {
      id: "uom",
      header: "Satuan",
      cell: ({ row }) =>
        row.original.Uom?.name ?? row.original.product.baseUom?.name ?? "Belum tersedia",
    },
    { id: "price", header: "Harga", cell: ({ row }) => amount(row.original.unitPrice, "IDR") },
    { id: "tax", header: "Pajak", cell: ({ row }) => taxLabel(row.original.taxSnapshot) },
    {
      id: "total",
      header: "Jumlah",
      cell: ({ row }) =>
        row.original.taxAmount != null
          ? amount(new Decimal(row.original.subtotal).add(row.original.taxAmount).toString(), "IDR")
          : "Belum tersedia",
    },
  ];
  const docColumns: ColumnDef<RelatedDocument>[] = [
    { id: "date", header: "Tanggal", cell: ({ row }) => dateLabel(row.original.date) },
    { id: "kind", header: "Jenis", cell: ({ row }) => relatedKindLabel(row.original.kind) },
    {
      id: "number",
      header: "Nomor",
      cell: ({ row }) => (
        <Link className="page-frame-link" href={row.original.href}>
          {row.original.number}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <Tone>{documentStatusLabel(row.original.status)}</Tone>,
    },
    { id: "amount", header: "Jumlah", cell: ({ row }) => amount(row.original.amount, "IDR") },
  ];
  const printAllowed = !!printAction?.enabled && !!row.companyProfile;
  return (
    <>
      <OfficePage
        section="sales"
        crumbs={[
          { label: "Sales & Marketing" },
          { label: "Sales Order", href: "/operations/orders" },
          { label: row.number },
        ]}
        title={`Sales Order ${row.number}`}
        subtitle={<Tone>{orderStatusLabel(row.displayStatus ?? row.state)}</Tone>}
        actions={
          <>
            <Button
              variant="outline"
              aria-label="Pesanan sebelumnya"
              disabled={!row.neighbors?.previousId}
              onClick={() => router.push(`/operations/orders/${row.neighbors?.previousId}`)}
            >
              ‹
            </Button>
            <Button
              variant="outline"
              aria-label="Pesanan berikutnya"
              disabled={!row.neighbors?.nextId}
              onClick={() => router.push(`/operations/orders/${row.neighbors?.nextId}`)}
            >
              ›
            </Button>
            {printAction && (
              <Button
                variant="outline"
                disabled={pending || !printAllowed}
                title={!row.companyProfile ? "Profil perusahaan belum tersedia" : undefined}
                onClick={() => void run(printAction).catch(() => undefined)}
              >
                Cetak
              </Button>
            )}
            {row.state === "OPEN" && can("fulfillment.dispatch") && can("outbound_shipping.read") && (
              <Button variant="outline" asChild>
                <Link href={`/operations/delivery-notes/from-order/${row.id}`}>
                  Buat Surat Jalan
                </Link>
              </Button>
            )}
            {primary && (
              <Button
                disabled={pending || !primary.enabled}
                onClick={() => void run(primary).catch(() => undefined)}
              >
                {pending ? "Memproses…" : primary.label}
              </Button>
            )}
            {list.some(
              (a) =>
                !["revise", "duplicate", "print"].includes(a.code) &&
                !(
                  a.code === primary?.code &&
                  JSON.stringify(a.target) === JSON.stringify(primary.target)
                ),
            ) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Aksi ▾</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="so-actions-menu">
                  {list
                    .filter(
                      (a) =>
                        !["revise", "duplicate", "print"].includes(a.code) &&
                        !(
                          a.code === primary?.code &&
                          JSON.stringify(a.target) === JSON.stringify(primary.target)
                        ),
                    )
                    .map(menuItem)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {(list.some((a) => ["revise", "duplicate"].includes(a.code)) ||
              can("audit_event.read")) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" aria-label="Tindakan lainnya">
                    ⋮
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {list.filter((a) => ["revise", "duplicate"].includes(a.code)).map(menuItem)}
                  {can("audit_event.read") && (
                    <DropdownMenuItem onSelect={() => setShowHistory((v) => !v)}>
                      Riwayat
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      >
        <div className="so-detail-page">
          {error && (
            <PageNotice tone="error" settingsHref={errorHref}>
              {error}
            </PageNotice>
          )}
          {actions.isPending && <p role="status">Memuat tindakan…</p>}
          {actions.isError && (
            <PageNotice tone="error" onRetry={() => void actions.refetch()}>
              {actions.error.message}
            </PageNotice>
          )}
          <dl className="so-detail-head">
            <div>
              <dt>Pelanggan</dt>
              <dd>
                {can("master_customer.read") ? (
                  <Link
                    className="page-frame-link"
                    href={`/master-data/customers/${row.customerId}`}
                  >
                    {row.customer?.name}
                  </Link>
                ) : (
                  row.customer?.name
                )}
                <p>{row.deliveryAddress || "Alamat belum tersedia"}</p>
              </dd>
            </div>
            <div>
              <dt>Nomor</dt>
              <dd>{row.number}</dd>
            </div>
            <div>
              <dt>Tanggal</dt>
              <dd>{dateLabel(row.orderDate ?? row.createdAt)}</dd>
            </div>
            <div>
              <dt>Jatuh tempo (perkiraan)</dt>
              <dd>{dateLabel(row.dueDateEstimate)}</dd>
            </div>
            <div>
              <dt>Gudang</dt>
              <dd>{row.warehouseName ?? "Belum tersedia"}</dd>
            </div>
            <div>
              <dt>Sales</dt>
              <dd>{row.salespersonName ?? "Belum tersedia"}</dd>
            </div>
            <div>
              <dt>No. SP</dt>
              <dd>{row.customerReference || "Belum tersedia"}</dd>
            </div>
          </dl>
          <section className="so-detail-section">
            <h2>Barang</h2>
            <DataTable
              data={row.lines}
              columns={columns}
              total={row.lines.length}
              label="barang pesanan"
              showColumns={false}
            />
            <dl className="so-detail-totals">
              <div>
                <dt>Total kuantitas</dt>
                <dd>
                  {amount(
                    row.lines
                      .reduce((n, l) => n.add(l.ordered ?? l.orderedQuantity), new Decimal(0))
                      .toString(),
                  )}
                </dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{amount(row.subtotal, "IDR")}</dd>
              </div>
              <div>
                <dt>PPN</dt>
                <dd>{amount(row.taxAmount, "IDR")}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{amount(row.total, "IDR")}</dd>
              </div>
              {row.downPayment != null && (
                <div>
                  <dt>DP terverifikasi</dt>
                  <dd>{amount(row.downPayment, "IDR")}</dd>
                </div>
              )}
              {row.remainingBill != null && (
                <div className="so-detail-total">
                  <dt>Sisa tagihan</dt>
                  <dd>{amount(row.remainingBill, "IDR")}</dd>
                </div>
              )}
            </dl>
          </section>
          {row.advances && (
            <SalesOrderAdvancePanel
              orderId={row.id}
              advances={row.advances}
              command={command}
              pending={pending}
              canRecord={list.some((a) => a.code === "record_advance" && a.enabled)}
              verifyIds={list
                .filter((a) => a.code === "verify_advance" && a.enabled)
                .flatMap((a) => (a.target.advanceId ? [a.target.advanceId] : []))}
              showForm={advanceForm}
              onClose={() => setAdvanceForm(false)}
            />
          )}
          <section className="so-detail-section">
            <h2>Transaksi</h2>
            {related.isError ? (
              <PageNotice tone="error" onRetry={() => void related.refetch()}>
                {related.error.message}
              </PageNotice>
            ) : (
              <DataTable
                data={related.data?.data ?? []}
                columns={docColumns}
                total={related.data?.data.length ?? 0}
                busy={related.isFetching}
                label="transaksi terkait"
                showColumns={false}
              />
            )}
          </section>
          <details className="so-exceptions">
            <summary>Persetujuan dan pengecualian</summary>
            <SalesExceptions row={row} command={command} pending={pending} can={can} />
          </details>
          <div className="so-detail-trail">
            {row.lastChanged && (
              <p>
                Terakhir diubah oleh {row.lastChanged.by} pada{" "}
                {new Date(row.lastChanged.at).toLocaleString("id-ID")}
              </p>
            )}
            {row.lastPrinted && (
              <p>
                Terakhir dicetak oleh {row.lastPrinted.by} pada{" "}
                {new Date(row.lastPrinted.at).toLocaleString("id-ID")}
              </p>
            )}
          </div>
          {showHistory && can("audit_event.read") && (
            <section className="so-detail-section">
              <h2>Riwayat</h2>
              {history}
            </section>
          )}
          {close && (
            <CloseRemainder
              row={row}
              cancel={false}
              command={command}
              pending={pending}
              onClose={() => setClose(false)}
            />
          )}
        </div>
      </OfficePage>
      {printAllowed && <SalesOrderPrint row={row} />}
    </>
  );
}
