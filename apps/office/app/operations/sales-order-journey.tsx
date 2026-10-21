"use client";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight, Files, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { useSession } from "../session-provider";
import { Panel, Value } from "./sales-order";
import { Evidence } from "./workspace";
import { SalesBadge } from "./sales-experience";
import { DataTable } from "../crm/crm-common";
import { amount, type Order, type OrderCommand } from "./sales-order-types";

type Doc = { id: string; kind: string; number: string; batchId: string; issuedAt: string };
type Batch = {
  id: string;
  number: string;
  state: string;
  pickList?: { state: string };
  documents: Omit<Doc, "batchId">[];
  deliveryReceipts: {
    id: string;
    acceptedAt: string;
    invoices: { id: string; number: string }[];
  }[];
};
type Entry = {
  id: string;
  kind: string;
  number: string;
  batch: string;
  date?: string | undefined;
  status: string;
  href: string;
  process?: string;
};
const kinds: Record<string, string> = {
  ALL: "Semua dokumen",
  PROFORMA: "Proforma",
  PICKING: "Picking Slip",
  PACKING: "Packing List",
  SURAT_JALAN: "Surat Jalan",
  POD: "POD",
  INVOICE: "Invoice",
};
export function OrderJourney({
  row,
  can,
  command,
  pending,
  children,
  onCloseRemainder,
  history,
}: {
  row: Order;
  can: (p: string) => boolean;
  command: OrderCommand;
  pending: boolean;
  children: ReactNode;
  onCloseRemainder: () => void;
  history: ReactNode;
}) {
  const { principal } = useSession();
  const [tab, setTab] = useState("summary");
  const [goodsFilter, setGoodsFilter] = useState("ALL");
  const [kind, setKind] = useState("ALL");
  const [search, setSearch] = useState("");
  const tabsRef = useRef<HTMLDivElement>(null);
  const warehouse = can("outbound_checking.read");
  const invoices = can("sales_invoice.read") && can("customer_receipt.read");
  const q = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      "order-journey",
      row.id,
      row.version,
      warehouse,
      invoices,
    ],
    queryFn: async ({ signal }) => {
      const [docs, batches] = await Promise.all([
        Promise.all(
          (row.documents ?? []).map((d) =>
            apiRequest<{ data: Doc }>(`/operations/documents/${d.id}`, { signal }).then(
              (r) => r.data,
            ),
          ),
        ),
        warehouse
          ? Promise.all(
              (row.fulfillments ?? []).map((b) =>
                apiRequest<{ data: Batch }>(`/operations/warehouse/${b.id}`, { signal }).then(
                  (r) => r.data,
                ),
              ),
            )
          : Promise.resolve([] as Batch[]),
      ]);
      const invoiceIds = invoices
        ? [
            ...new Set(
              batches.flatMap((b) =>
                b.deliveryReceipts.flatMap((p) => p.invoices.map((i) => i.id)),
              ),
            ),
          ]
        : [];
      const invoiceViews = await Promise.all(
        invoiceIds.map((id) =>
          apiRequest<{
            data: {
              id: string;
              state: string;
              createdAt: string;
              number: string;
              dueDate?: string;
              total?: string;
              outstandingAmount?: string;
              currency?: string;
            };
          }>(`/operations/invoices/${id}`, { signal }).then((r) => r.data),
        ),
      );
      return { docs, batches, invoiceViews };
    },
  });
  const openDocuments = (value: string) => {
    setKind(value);
    setSearch("");
    setTab("documents");
    requestAnimationFrame(() => {
      tabsRef.current
        ?.querySelector<HTMLButtonElement>('[data-state="active"][role="tab"]')
        ?.focus();
      tabsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  const active = (row.fulfillments ?? []).filter((b) => b.state !== "CANCELLED");
  const pickCandidates = active.filter(
    (b) => b.state === "ALLOCATED" && !b.pickList && can("fulfillment.pick"),
  );
  const proformaCandidates = active.filter((b) => {
    const document = row.documents?.find(
      (d) => d.batchId === b.id && d.kind.startsWith("PROFORMA"),
    );
    return (
      row.state === "OPEN" &&
      b.state === "ALLOCATED" &&
      can("proforma.issue") &&
      (!document || document.status === "REVISION_REQUIRED")
    );
  });
  const createPick = (batchId: string) => {
    void command(`/fulfillment-batches/${batchId}/create-picking`).catch(() => undefined);
  };
  const backorder = row.lines.some((l) => new Decimal(l.backorderQuantity).gt(0));
  const allocated = active.some((b) => b.state === "ALLOCATED");
  const transit = active.some((b) => b.state === "DISPATCHED");
  const received = active.some((b) => b.state === "DELIVERED");
  const terminal = ["CLOSED", "CANCELLED", "COMPLETED"].includes(row.state);
  const hasInvoices = !!q.data?.invoiceViews?.length;
  const heading = terminal
    ? "Pesanan telah ditutup — dokumen tetap dapat ditelusuri"
    : row.state === "DRAFT"
      ? "Pesanan belum diajukan atau belum lolos evaluasi"
      : allocated
        ? "Stok telah dialokasikan — lanjutkan pemenuhan gudang"
        : transit
          ? "Pesanan dalam perjalanan — pantau penerimaan pelanggan"
          : backorder
            ? "Sisa pesanan menunggu stok yang layak"
            : received
              ? hasInvoices
                ? "Invoice tersedia — pantau penagihan dan pembayaran"
                : "Barang telah diterima — tinjau POD dan penagihan"
              : "Tinjau hasil evaluasi dan tahap pemenuhan";
  const entries: Entry[] = (q.data?.docs ?? []).map((d) => ({
    id: d.id,
    kind: d.kind.startsWith("PROFORMA") ? "PROFORMA" : d.kind,
    number: d.number,
    batch: row.fulfillments?.find((b) => b.id === d.batchId)?.number ?? "—",
    date: d.issuedAt,
    status: "Diterbitkan",
    href: d.kind.startsWith("PROFORMA")
      ? `/operations/proformas/${d.id}`
      : `/operations/documents/${d.id}`,
  }));
  for (const b of q.data?.batches ?? []) {
    for (const d of b.documents)
      entries.push({
        id: d.id,
        kind: d.kind,
        number: d.number,
        batch: b.number,
        date: d.issuedAt,
        status: "Diterbitkan",
        href:
          d.kind === "PROFORMA" ? `/operations/proformas/${d.id}` : `/operations/documents/${d.id}`,
        ...(d.kind === "PICKING" &&
        b.state === "ALLOCATED" &&
        b.pickList?.state === "OPEN" &&
        can("fulfillment.pick")
          ? { process: `/operations/warehouse/${b.id}` }
          : {}),
      });
    for (const pod of b.deliveryReceipts) {
      if (can("delivery_receipt.read"))
        entries.push({
          id: pod.id,
          kind: "POD",
          number: "POD tanpa nomor",
          batch: b.number,
          date: pod.acceptedAt,
          status: "Dikonfirmasi",
          href: `/operations/warehouse/${b.id}`,
        });
      if (invoices)
        for (const inv of pod.invoices)
          entries.push({
            id: inv.id,
            kind: "INVOICE",
            number: inv.number,
            batch: b.number,
            date: q.data?.invoiceViews?.find((v) => v.id === inv.id)?.createdAt,
            status:
              (
                {
                  DRAFT: "Draft",
                  ISSUED: "Menunggu POD",
                  POSTED: "Diposting",
                  PARTIALLY_PAID: "Dibayar sebagian",
                  PAID: "Lunas",
                  REVERSED: "Dibalik",
                } as Record<string, string>
              )[q.data?.invoiceViews?.find((v) => v.id === inv.id)?.state ?? ""] ?? "Lihat invoice",
            href: `/operations/invoices/${inv.id}`,
          });
    }
  }
  const filtered = entries.filter(
    (d) =>
      (kind === "ALL" || d.kind === kind) &&
      `${d.number} ${d.batch} ${kinds[d.kind]}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const count = (type: string) =>
    q.isPending || q.isError || (type === "PICKING" && !warehouse)
      ? "—"
      : entries.filter((d) => d.kind === type).length;
  const columns: ColumnDef<Entry>[] = [
    { accessorKey: "number", header: "Nomor dokumen" },
    {
      id: "kind",
      header: "Jenis",
      cell: ({ row: r }) => kinds[r.original.kind] ?? r.original.kind,
    },
    { accessorKey: "batch", header: "Tahap pemenuhan" },
    {
      id: "date",
      header: "Tanggal",
      cell: ({ row: r }) =>
        r.original.date ? new Date(r.original.date).toLocaleDateString("id-ID") : "—",
    },
    { accessorKey: "status", header: "Status dokumen" },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row: r }) => (
        <div className="so-document-actions">
          <Link href={r.original.href}>
            Lihat{r.original.kind !== "POD" && r.original.kind !== "INVOICE" ? " / Cetak" : ""}
            <ArrowUpRight aria-hidden="true" />
          </Link>
          {r.original.process && <Link href={r.original.process}>Proses Picking</Link>}
        </div>
      ),
    },
  ];
  type Line = Order["lines"][number] & {
    allocations?: {
      acceptedQuantity: string;
      inTransitQuantity: string;
      returnedQuantity: string;
    }[];
  };
  const quantities: ColumnDef<Line>[] = [
    { id: "code", header: "Kode produk", cell: ({ row: r }) => r.original.product.code },
    { id: "name", header: "Nama produk", cell: ({ row: r }) => r.original.product.name },
    { id: "unit", header: "Satuan", cell: ({ row: r }) => r.original.product.baseUom?.name ?? "—" },
    { id: "price", header: "Harga", cell: ({ row: r }) => amount(r.original.unitPrice) },
    { id: "subtotal", header: "Subtotal", cell: ({ row: r }) => amount(r.original.subtotal) },
    ...(
      [
        ["orderedQuantity", "Dipesan"],
        ["allocatedQuantity", "Dialokasikan"],
        ["backorderQuantity", "Backorder"],
        ["closedQuantity", "Ditutup"],
      ] as const
    ).map(([key, label]) => ({
      id: key,
      header: label,
      cell: ({ row: r }: { row: { original: Line } }) => amount(r.original[key]),
    })),
    ...(["shipped"] as const).map((key) => ({
      id: key,
      header: key === "shipped" ? "Dikirim" : "Diterima",
      cell: ({ row: r }: { row: { original: Line } }) =>
        r.original.allocations
          ? amount(
              r.original.allocations
                .reduce(
                  (sum, a) =>
                    sum
                      .add(a.acceptedQuantity)
                      .add(
                        key === "shipped"
                          ? new Decimal(a.inTransitQuantity).add(a.returnedQuantity)
                          : 0,
                      ),
                  new Decimal(0),
                )
                .toString(),
            )
          : "—",
    })),
    {
      id: "invoiced",
      header: "Ditagih",
      cell: () => <span title="Kuantitas ditagih per baris belum tersedia">—</span>,
    },
    {
      id: "close",
      header: "Tindakan",
      cell: ({ row: r }) =>
        can("sales_order.close_remainder") &&
        new Decimal(r.original.backorderQuantity ?? 0).gt(0) ? (
          <Button variant="outline" onClick={onCloseRemainder}>
            Tutup sisa
          </Button>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <>
      <section className="so-next-step so-no-print" aria-labelledby="so-next-heading">
        <PackageCheck aria-hidden="true" />
        <div>
          <span className="so-eyebrow">LANGKAH BERIKUTNYA</span>
          <h2 id="so-next-heading">{heading}</h2>
          <p>
            {active.length} tahap pemenuhan terhubung{backorder ? " · Masih ada backorder" : ""}.
            Dokumen mengikuti alokasi dan proses aktual.
          </p>
          {row.paymentSnapshot?.mode === "PREPAY" && (
            <p>
              Pengiriman menunggu dana terverifikasi. Alokasi bukan izin untuk langsung mengirim.
            </p>
          )}
          <div className="so-journey-actions">
            {pickCandidates.length === 1 ? (
              <Button disabled={pending} onClick={() => createPick(pickCandidates[0]!.id)}>
                <Files aria-hidden="true" />
                {pending ? "Memproses…" : "Buat Pick Slip"}
              </Button>
            ) : pickCandidates.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={pending}>
                    <Files aria-hidden="true" /> Buat Pick Slip
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {pickCandidates.map((b) => (
                    <DropdownMenuItem key={b.id} onSelect={() => createPick(b.id)}>
                      {b.number}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : count("PICKING") === 0 ? (
              <Button disabled title="Belum ada tahap alokasi yang dapat dibuatkan Picking Slip">
                <Files aria-hidden="true" /> Buat Pick Slip
              </Button>
            ) : (
              <Button onClick={() => openDocuments("PICKING")} disabled={!warehouse}>
                <Files aria-hidden="true" />
                Lihat Picking Slip
                {count("PICKING") !== "—" && ` · ${count("PICKING")}`}
              </Button>
            )}
            {proformaCandidates.length === 1 ? (
              <Button variant="outline" asChild>
                <Link
                  href={`/operations/proformas/from-order/${row.id}/${proformaCandidates[0]!.id}`}
                >
                  Buat Proforma
                </Link>
              </Button>
            ) : proformaCandidates.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Buat Proforma</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {proformaCandidates.map((b) => (
                    <DropdownMenuItem key={b.id} asChild>
                      <Link href={`/operations/proformas/from-order/${row.id}/${b.id}`}>
                        {b.number}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : count("PROFORMA") === 0 ? (
              <Button
                variant="outline"
                disabled
                title="Belum ada tahap alokasi yang dapat dibuatkan Proforma"
              >
                Buat Proforma
              </Button>
            ) : (
              <Button variant="outline" onClick={() => openDocuments("PROFORMA")}>
                Lihat Proforma{count("PROFORMA") !== "—" && ` · ${count("PROFORMA")}`}
              </Button>
            )}
            {backorder && (
              <Button variant="outline" onClick={() => setTab("fulfillment")}>
                Lihat Backorder
              </Button>
            )}
            {(transit || received) && warehouse && (
              <Button
                variant="outline"
                onClick={() =>
                  transit
                    ? setTab("fulfillment")
                    : openDocuments(
                        hasInvoices ? "INVOICE" : can("delivery_receipt.read") ? "POD" : "ALL",
                      )
                }
              >
                {transit
                  ? "Lacak Pengiriman"
                  : hasInvoices
                    ? "Lihat Invoice"
                    : "Lihat POD & Penagihan"}
              </Button>
            )}
          </div>
          {!warehouse && <p>Akses Picking Slip memerlukan izin membaca pemenuhan.</p>}
        </div>
      </section>
      <Tabs value={tab} onValueChange={setTab} className="so-journey-tabs" ref={tabsRef}>
        <TabsList aria-label="Detail Sales Order" className="so-no-print" variant="line">
          <TabsTrigger value="summary">Ringkasan</TabsTrigger>
          <TabsTrigger value="goods">Barang</TabsTrigger>
          <TabsTrigger value="fulfillment">Pemenuhan</TabsTrigger>
          <TabsTrigger value="documents">Dokumen</TabsTrigger>
          <TabsTrigger value="billing">Tagihan</TabsTrigger>
          <TabsTrigger value="history">Riwayat</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="so-summary-tab">
          {children}
        </TabsContent>
        <TabsContent value="goods">
          <section className="so-journey-panel">
            <h2>Barang pesanan</h2>
            <div className="sales-inline-toolbar">
              <SelectionField
                label="Tampilkan"
                hideLabel
                value={[goodsFilter]}
                options={[
                  { id: "ALL", name: "Semua item" },
                  { id: "BACKORDER", name: "Ada backorder" },
                ]}
                onChange={(v) => setGoodsFilter(v[0] ?? "ALL")}
              />
              <span>Item stok kosong tetap tampil</span>
            </div>
            <DataTable
              data={
                goodsFilter === "BACKORDER"
                  ? row.lines.filter((l) => new Decimal(l.backorderQuantity ?? 0).gt(0))
                  : row.lines
              }
              columns={quantities}
              total={row.lines.length}
              showColumns={false}
            />
            <p className="sales-notice">
              Item stok kosong tetap tercatat. Penutupan sisa memerlukan catatan konfirmasi
              pelanggan.
            </p>
          </section>
        </TabsContent>
        <TabsContent value="fulfillment" className="so-no-print">
          <div className="sales-columns">
            <div className="sales-main">
              <section className="so-journey-panel">
                <h2>Tahap pemenuhan</h2>
                {!warehouse ? (
                  <p className="sales-notice">
                    Akses pemenuhan gudang diperlukan untuk melihat tahap.
                  </p>
                ) : q.isPending ? (
                  <p role="status">Memuat tahap pemenuhan…</p>
                ) : q.isError ? (
                  <p role="alert">
                    Tahap pemenuhan gagal dimuat.{" "}
                    <Button variant="outline" onClick={() => void q.refetch()}>
                      Coba lagi
                    </Button>
                  </p>
                ) : (
                  <DataTable
                    data={q.data?.batches ?? []}
                    total={q.data?.batches.length ?? 0}
                    showColumns={false}
                    columns={[
                      { id: "stage", header: "Tahap", cell: ({ row: r }) => r.original.number },
                      {
                        id: "proforma",
                        header: "Proforma",
                        cell: ({ row: r }) =>
                          row.documents?.find((d) => d.batchId === r.original.id)?.number ??
                          "Belum terbit",
                      },
                      {
                        id: "pick",
                        header: "Pick Slip",
                        cell: ({ row: r }) =>
                          r.original.documents.find((d) => d.kind === "PICKING")?.number ??
                          "Belum dibuat",
                      },
                      {
                        id: "packing",
                        header: "Packing List",
                        cell: ({ row: r }) =>
                          r.original.documents.find((d) => d.kind === "PACKING")?.number ?? "—",
                      },
                      {
                        id: "shipment",
                        header: "Surat Jalan",
                        cell: ({ row: r }) =>
                          r.original.documents.find((d) => d.kind === "SURAT_JALAN")?.number ?? "—",
                      },
                      {
                        id: "pod",
                        header: "POD",
                        cell: ({ row: r }) => r.original.deliveryReceipts.length || "—",
                      },
                      {
                        id: "action",
                        header: "Tindakan",
                        cell: ({ row: r }) =>
                          r.original.state === "ALLOCATED" &&
                          !r.original.pickList &&
                          can("fulfillment.pick") ? (
                            <Button disabled={pending} onClick={() => createPick(r.original.id)}>
                              Buat Pick Slip
                            </Button>
                          ) : (
                            <Link
                              className="so-link"
                              href={`/operations/warehouse/${r.original.id}`}
                            >
                              Buka
                            </Link>
                          ),
                      },
                    ]}
                  />
                )}
                <p className="sales-notice">
                  Tahap hanya memuat alokasi nyata. Backorder tanpa alokasi tetap menunggu stok atau
                  tindakan tutup sisa.
                </p>
              </section>
              <Panel title="Sisa pesanan (Backorder)">
                {can("sales_order.reallocate") && row.state === "OPEN" && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      void command(`/operations/orders/${row.id}/reallocate`, {
                        version: row.version,
                      }).catch(() => undefined)
                    }
                  >
                    Evaluasi & alokasikan stok
                  </Button>
                )}
                <DataTable
                  data={row.lines.filter((l) => new Decimal(l.backorderQuantity ?? 0).gt(0))}
                  total={
                    row.lines.filter((l) => new Decimal(l.backorderQuantity ?? 0).gt(0)).length
                  }
                  showColumns={false}
                  columns={[
                    {
                      id: "code",
                      header: "Kode produk",
                      cell: ({ row: r }) => r.original.product.code,
                    },
                    {
                      id: "name",
                      header: "Nama produk",
                      cell: ({ row: r }) => r.original.product.name,
                    },
                    {
                      id: "qty",
                      header: "Sisa",
                      cell: ({ row: r }) => amount(r.original.backorderQuantity),
                    },
                    {
                      id: "action",
                      header: "Tindakan",
                      cell: () =>
                        can("sales_order.close_remainder") ? (
                          <Button variant="outline" onClick={onCloseRemainder}>
                            Tutup sisa
                          </Button>
                        ) : (
                          "Tunggu stok"
                        ),
                    },
                  ]}
                />
              </Panel>
            </div>
            <aside className="sales-aside">
              {active.map((b, index) => (
                <Panel key={b.id} title={`Dokumen tahap ${index + 1}`}>
                  <Value label="Tahap">{b.number}</Value>
                  {["PROFORMA", "PICKING", "PACKING", "SURAT_JALAN", "POD", "INVOICE"].map((k) => (
                    <Value key={k} label={kinds[k]!}>
                      {entries
                        .filter((e) => e.batch === b.number && e.kind === k)
                        .map((e) => (
                          <Link key={e.id} className="so-link" href={e.href}>
                            {e.number}
                          </Link>
                        )).length ? (
                        entries
                          .filter((e) => e.batch === b.number && e.kind === k)
                          .map((e) => (
                            <Link key={e.id} className="so-link" href={e.href}>
                              {e.number}
                            </Link>
                          ))
                      ) : (
                        <SalesBadge>
                          {q.isPending
                            ? "Memuat"
                            : q.isError
                              ? "Belum terverifikasi"
                              : "Belum tersedia"}
                        </SalesBadge>
                      )}
                    </Value>
                  ))}
                </Panel>
              ))}
              {row.paymentSnapshot?.mode === "PREPAY" && (
                <Panel title="Dana tahap pemenuhan">
                  <p>
                    Dana terverifikasi dan kekurangan dapat ditinjau pada detail Proforma oleh
                    Finance.
                  </p>
                </Panel>
              )}
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="documents" className="so-no-print">
          <section className="so-journey-panel">
            <h2>Dokumen transaksi</h2>
            <p>
              Dokumen terhubung ke tahap pemenuhan. POD yang belum memiliki nomor ditandai apa
              adanya.
            </p>
            <div className="so-document-toolbar">
              <Input
                aria-label="Cari dokumen SO"
                placeholder="Cari nomor atau tahap pemenuhan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <SelectionField
                label="Jenis dokumen"
                hideLabel
                value={[kind]}
                options={Object.entries(kinds)
                  .filter(
                    ([k]) =>
                      (warehouse || ["ALL", "PROFORMA"].includes(k)) &&
                      (invoices || k !== "INVOICE") &&
                      (can("delivery_receipt.read") || k !== "POD"),
                  )
                  .map(([id, name]) => ({ id, name }))}
                onChange={(v) => setKind(v[0] ?? "ALL")}
              />
            </div>
            {q.isPending ? (
              <p role="status">Memuat dokumen terkait…</p>
            ) : q.isError ? (
              <div role="alert">
                <p>Dokumen belum dapat dimuat. Jumlah dokumen belum dapat dipastikan.</p>
                <Button variant="outline" onClick={() => void q.refetch()}>
                  Coba Lagi
                </Button>
              </div>
            ) : (
              <>
                <DataTable
                  columns={columns}
                  data={filtered}
                  total={filtered.length}
                  label="dokumen SO"
                  showColumns={false}
                />
                {!filtered.length && (
                  <p>
                    {search
                      ? "Tidak ada dokumen yang cocok dengan pencarian."
                      : active.length === 0
                        ? "Dokumen belum tersedia karena belum ada alokasi aktif. Periksa evaluasi SO dan ketersediaan stok."
                        : "Dokumen jenis ini belum tersedia. Tahap berikutnya muncul setelah proses terkait selesai."}
                  </p>
                )}
              </>
            )}
            {!warehouse && (
              <p>Dokumen gudang tidak ditampilkan karena izin membaca pemenuhan belum tersedia.</p>
            )}
          </section>
          <Panel title="Lampiran">
            <p>Lampiran SP/PO pelanggan</p>
            <Evidence id={row.evidenceId} />
            <p className="so-help">
              Lampiran tambahan belum didukung. Lampiran sumber tetap terhubung ke Sales Order.
            </p>
          </Panel>
        </TabsContent>
        <TabsContent value="billing" className="so-no-print">
          <div className="sales-columns">
            <div className="sales-main">
              <section className="so-journey-panel">
                <h2>Invoice terkait</h2>
                {!invoices ? (
                  <p>Akses tagihan memerlukan izin Invoice dan penerimaan.</p>
                ) : q.isPending ? (
                  <p>Memuat tagihan…</p>
                ) : q.isError ? (
                  <p role="alert">Tagihan belum dapat dimuat.</p>
                ) : (
                  <>
                    <DataTable
                      data={q.data?.invoiceViews ?? []}
                      total={q.data?.invoiceViews.length ?? 0}
                      showColumns={false}
                      columns={[
                        {
                          id: "number",
                          header: "No. Invoice",
                          cell: ({ row: r }) => (
                            <Link
                              className="so-link"
                              href={`/operations/invoices/${r.original.id}`}
                            >
                              {r.original.number}
                            </Link>
                          ),
                        },
                        {
                          id: "date",
                          header: "Tanggal",
                          cell: ({ row: r }) =>
                            new Date(r.original.createdAt).toLocaleDateString("id-ID"),
                        },
                        {
                          id: "due",
                          header: "Jatuh tempo",
                          cell: ({ row: r }) =>
                            r.original.dueDate
                              ? new Date(r.original.dueDate).toLocaleDateString("id-ID")
                              : "Belum ditetapkan",
                        },
                        {
                          id: "total",
                          header: "Total",
                          cell: ({ row: r }) => amount(r.original.total, r.original.currency),
                        },
                        {
                          id: "remaining",
                          header: "Sisa tagihan",
                          cell: ({ row: r }) =>
                            amount(r.original.outstandingAmount, r.original.currency),
                        },
                      ]}
                    />
                    <p className="sales-notice">
                      Invoice mengikuti POD terkonfirmasi. Draft belum membentuk piutang; pembayaran
                      dicatat dan dialokasikan oleh Finance.
                    </p>
                    {can("sales_invoice.post") && (
                      <Button variant="outline" asChild>
                        <Link href="/operations/invoice-create">Buat Invoice dari POD</Link>
                      </Button>
                    )}
                  </>
                )}
              </section>
              <Panel title="Ongkos kirim">
                <Value label="Penagihan">Per pengiriman</Value>
                <Value label="Estimasi / nilai">{amount(row.freightEstimate, row.currency)}</Value>
                <p className="so-help">Nilai final mengikuti Invoice pada setiap pengiriman.</p>
              </Panel>
            </div>
            <aside className="sales-aside">
              <Panel title="Ringkasan tagihan">
                <Value label="Total SO">{amount(row.total, row.currency)}</Value>
                {[
                  ["total", "Sudah ditagih"],
                  ["outstandingAmount", "Sisa piutang"],
                ].map(([key, label]) => (
                  <Value key={key} label={label!}>
                    {!invoices || !q.isSuccess
                      ? "Belum tersedia"
                      : amount(
                          (q.data.invoiceViews ?? [])
                            .filter((v) => v.state !== "DRAFT")
                            .reduce((sum, v) => sum.add(v[key as "total"] ?? "0"), new Decimal(0))
                            .toString(),
                          row.currency,
                        )}
                  </Value>
                ))}
                <p className="so-help">
                  Draft belum membentuk piutang. Nilai pajak dan ongkir mengikuti masing-masing
                  Invoice.
                </p>
              </Panel>
              {row.paymentSnapshot?.mode === "PREPAY" && (
                <Panel title="Dana tahap pemenuhan">
                  <p>Lihat dana terverifikasi pada detail Proforma.</p>
                </Panel>
              )}
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="history" className="so-no-print">
          <section className="so-journey-panel">
            <h2>Riwayat aktivitas</h2>
            {history}
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
