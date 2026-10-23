"use client";
import Link from "next/link";
import Decimal from "decimal.js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageNotice, RecordBadge } from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import { useSession } from "../session-provider";
import { Evidence } from "./workspace";
import { amount, type Order, type OrderCommand } from "./sales-order-types";

type Doc = { id: string; kind: string; number: string; batchId: string; issuedAt: string };
type Batch = {
  id: string;
  number: string;
  state: string;
  createdAt?: string;
  dispatchedAt?: string | null;
  podAt?: string | null;
  allocations?: {
    quantity: string;
    stockLot?: { product?: { baseUom?: { name: string } } };
  }[];
  pickList?: { state: string };
  documents: Omit<Doc, "batchId">[];
  deliveryReceipts: {
    id: string;
    acceptedAt: string;
    invoices: { id: string; number: string }[];
  }[];
};
type InvoiceView = {
  id: string;
  state: string;
  createdAt: string;
  number: string;
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
const modules: Record<string, string> = {
  PROFORMA: "Sales › Proforma",
  PICKING: "Warehouse › Barang Keluar",
  PACKING: "Warehouse › Barang Keluar",
  SURAT_JALAN: "Warehouse › Barang Keluar",
  POD: "Warehouse › Barang Keluar",
  INVOICE: "Finance › Piutang (AR)",
};
const invoiceStates: Record<string, string> = {
  DRAFT: "Draft",
  ISSUED: "Diterbitkan",
  POSTED: "Diposting",
  PARTIALLY_PAID: "Dibayar sebagian",
  PAID: "Lunas",
  REVERSED: "Dibalik",
};
export function tone(label: string) {
  if (/batal|ditahan|perlu revisi|dibalik/i.test(label)) return "danger";
  if (/backorder|sebagian|menunggu|belum|draft|perjalanan/i.test(label)) return "warning";
  if (/selesai|lunas|terkirim|diterima|lengkap|closed|dikonfirmasi|diposting/i.test(label))
    return "success";
  if (/open|diterbitkan|teralokasi/i.test(label)) return "info";
  return "neutral";
}
export function Tone({ children }: { children: string }) {
  return <RecordBadge state={tone(children)} label={children} />;
}

/** Pindah tab detail lewat URL (?tab=, ?kind=) agar tombol Langkah berikutnya dapat dibagikan. */
export function useTabLink() {
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  return (tab: string, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", tab);
    next.delete("kind");
    for (const [key, value] of Object.entries(extra)) next.set(key, value);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
}

// Dokumen dan tahap pemenuhan SO; gudang dan invoice hanya dimuat bila izinnya ada.
export function useOrderJourney(row: Order, can: (p: string) => boolean) {
  const { principal } = useSession();
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
          apiRequest<{ data: InvoiceView }>(`/operations/invoices/${id}`, { signal }).then(
            (r) => r.data,
          ),
        ),
      );
      return { docs, batches, invoiceViews };
    },
  });
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
        for (const inv of pod.invoices) {
          const view = q.data?.invoiceViews?.find((v) => v.id === inv.id);
          entries.push({
            id: inv.id,
            kind: "INVOICE",
            number: inv.number,
            batch: b.number,
            date: view?.createdAt,
            status: invoiceStates[view?.state ?? ""] ?? "Lihat invoice",
            href: `/operations/invoices/${inv.id}`,
          });
        }
    }
  }
  const backorder = row.lines.some((l) => new Decimal(l.backorderQuantity).gt(0));
  const allocated = active.some((b) => b.state === "ALLOCATED");
  const transit = active.some((b) => b.state === "DISPATCHED");
  const received = active.some((b) => b.state === "DELIVERED");
  const terminal = ["CLOSED", "CANCELLED", "COMPLETED"].includes(row.state);
  const hasInvoices = !!q.data?.invoiceViews?.length;
  const count = (type: string) =>
    q.isPending || q.isError || (type === "PICKING" && !warehouse)
      ? null
      : entries.filter((d) => d.kind === type).length;
  const heading = terminal
    ? "Pesanan telah ditutup. Dokumen tetap dapat ditelusuri."
    : row.state === "DRAFT"
      ? "Pesanan belum diajukan atau belum lolos evaluasi."
      : allocated
        ? "Stok telah dialokasikan. Lanjutkan pemenuhan gudang."
        : transit
          ? "Pesanan dalam perjalanan. Pantau penerimaan pelanggan."
          : backorder
            ? "Sisa pesanan menunggu stok yang layak."
            : received
              ? hasInvoices
                ? "Invoice tersedia. Pantau penagihan dan pembayaran."
                : "Barang telah diterima. Tinjau POD; invoice diterbitkan Finance."
              : "Tinjau hasil evaluasi dan tahap pemenuhan.";
  return {
    q,
    warehouse,
    invoices,
    active,
    entries,
    pickCandidates,
    proformaCandidates,
    backorder,
    transit,
    received,
    hasInvoices,
    heading,
    count,
  };
}
type Journey = ReturnType<typeof useOrderJourney>;

export function NextStep({
  row,
  journey,
  can,
  command,
  pending,
}: {
  row: Order;
  journey: Journey;
  can: (p: string) => boolean;
  command: OrderCommand;
  pending: boolean;
}) {
  const go = useTabLink();
  const { active, pickCandidates, proformaCandidates, count, warehouse } = journey;
  const createPick = (batchId: string) => {
    void command(`/fulfillment-batches/${batchId}/create-picking`).catch(() => undefined);
  };
  const picking = count("PICKING"),
    proforma = count("PROFORMA");
  return (
    <section className="so-next" aria-labelledby="so-next-heading">
      <svg className="so-next-mark" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
        <path d="M8 1C4 1.4 1 4.4 1 7.9 1 11 3.3 13.2 6.5 13 4.3 12.3 2.8 10.3 2.8 7.8 2.8 4.9 4.9 2.3 8 1z" />
      </svg>
      <div className="so-next-copy">
        <h2 id="so-next-heading">Langkah berikutnya</h2>
        <p>
          {journey.heading} {active.length} tahap pemenuhan terhubung
          {journey.backorder ? ", masih ada backorder" : ""}.
        </p>
        {row.paymentSnapshot?.mode === "PREPAY" && (
          <p>Pengiriman menunggu dana terverifikasi. Alokasi bukan izin untuk langsung mengirim.</p>
        )}
        {!warehouse && <p>Akses Picking Slip memerlukan izin membaca pemenuhan.</p>}
      </div>
      <div className="so-next-actions">
        {pickCandidates.length === 1 ? (
          <Button disabled={pending} onClick={() => createPick(pickCandidates[0]!.id)}>
            {pending ? "Memproses…" : "Buat Pick Slip"}
          </Button>
        ) : pickCandidates.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={pending}>Buat Pick Slip</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {pickCandidates.map((b) => (
                <DropdownMenuItem key={b.id} onSelect={() => createPick(b.id)}>
                  {b.number}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : picking ? (
          <Button variant="outline" onClick={() => go("documents", { kind: "PICKING" })}>
            Lihat Picking Slip · {picking}
          </Button>
        ) : null}
        {proformaCandidates.length === 1 ? (
          <Button variant="outline" asChild>
            <Link href={`/operations/proformas/from-order/${row.id}/${proformaCandidates[0]!.id}`}>
              Buat Proforma
            </Link>
          </Button>
        ) : proformaCandidates.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Buat Proforma</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {proformaCandidates.map((b) => (
                <DropdownMenuItem key={b.id} asChild>
                  <Link href={`/operations/proformas/from-order/${row.id}/${b.id}`}>
                    {b.number}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : proforma ? (
          <Button variant="outline" onClick={() => go("documents", { kind: "PROFORMA" })}>
            Lihat Proforma · {proforma}
          </Button>
        ) : null}
        {(journey.backorder || journey.transit) && (
          <Button variant="outline" onClick={() => go("fulfillment")}>
            Lihat pemenuhan
          </Button>
        )}
        {journey.received && (
          <Button
            variant="outline"
            onClick={() =>
              go("documents", {
                kind: journey.hasInvoices ? "INVOICE" : can("delivery_receipt.read") ? "POD" : "ALL",
              })
            }
          >
            {journey.hasInvoices ? "Lihat Invoice" : "Lihat POD"}
          </Button>
        )}
      </div>
    </section>
  );
}

const stageStates: Record<string, string> = {
  ALLOCATED: "Teralokasi",
  PICKING: "Proses picking",
  PACKED: "Dikemas",
  DISPATCHED: "Dalam perjalanan",
  PARTIALLY_DELIVERED: "Diterima sebagian",
  DELIVERED: "Diterima",
  CANCELLED: "Dibatalkan",
};
const shortDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "";

// Tab Pemenuhan (canvas SO-detail): kartu per tahap, lalu kartu bergaris putus untuk sisa pesanan.
export function FulfillmentTab({
  row,
  journey,
  can,
  command,
  pending,
  onCloseRemainder,
}: {
  row: Order;
  journey: Journey;
  can: (p: string) => boolean;
  command: OrderCommand;
  pending: boolean;
  onCloseRemainder: () => void;
}) {
  const { q, warehouse } = journey;
  const remainder = row.lines.reduce(
    (sum, l) => sum.add(l.backorderQuantity ?? 0),
    new Decimal(0),
  );
  const closed = row.lines.reduce((sum, l) => sum.add(l.closedQuantity ?? 0), new Decimal(0));
  const units = new Set(row.lines.map((l) => l.product.baseUom?.name).filter(Boolean));
  const unit = units.size === 1 ? [...units][0] : "unit";
  const createPick = (batchId: string) => {
    void command(`/fulfillment-batches/${batchId}/create-picking`).catch(() => undefined);
  };
  return (
    <div className="so-tab-stack">
      {!warehouse ? (
        <PageNotice>Akses pemenuhan gudang diperlukan untuk melihat tahap.</PageNotice>
      ) : q.isPending ? (
        <p role="status">Memuat tahap pemenuhan…</p>
      ) : q.isError ? (
        <PageNotice tone="error" onRetry={() => void q.refetch()}>
          Tahap pemenuhan gagal dimuat.
        </PageNotice>
      ) : (
        <ol className="so-stages">
          {q.data.batches.map((b, index) => {
            const qty = (b.allocations ?? []).reduce(
              (sum, a) => sum.add(a.quantity),
              new Decimal(0),
            );
            const batchUnit = b.allocations?.[0]?.stockLot?.product?.baseUom?.name ?? unit;
            const pod =
              b.deliveryReceipts.length > 0
                ? "POD dikonfirmasi"
                : ["DISPATCHED", "PARTIALLY_DELIVERED"].includes(b.state)
                  ? "Menunggu POD"
                  : null;
            return (
              <li key={b.id}>
                <span>
                  <strong>
                    Tahap {index + 1} · {amount(qty.toString())} {batchUnit}
                  </strong>
                  <small>
                    {b.number} · dialokasikan {shortDate(b.createdAt)}
                    {b.dispatchedAt ? ` · dikirim ${shortDate(b.dispatchedAt)}` : ""}
                    {b.podAt ? ` · diterima ${shortDate(b.podAt)}` : ""}
                  </small>
                </span>
                <span className="so-stage-actions">
                  <Tone>{stageStates[b.state] ?? b.state}</Tone>
                  {pod && <Tone>{pod}</Tone>}
                  {b.state === "ALLOCATED" && !b.pickList && can("fulfillment.pick") ? (
                    <Button size="sm" disabled={pending} onClick={() => createPick(b.id)}>
                      Buat Pick Slip
                    </Button>
                  ) : (
                    <Link className="page-frame-link" href={`/operations/warehouse/${b.id}`}>
                      Buka
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
          <li className="so-stage-rest">
            <span>
              <strong>
                {remainder.gt(0)
                  ? `Sisa · ${amount(remainder.toString())} ${unit}`
                  : closed.gt(0)
                    ? `Sisa ditutup · ${amount(closed.toString())} ${unit}`
                    : "Tidak ada sisa pesanan"}
              </strong>
              <small>
                {remainder.gt(0)
                  ? "Belum tersedia. Dialokasikan otomatis saat stok layak masuk."
                  : closed.gt(0)
                    ? "Ditutup atas konfirmasi pelanggan."
                    : q.data.batches.length
                      ? "Seluruh jumlah pesanan sudah teralokasi."
                      : "Tahap terbentuk dari alokasi stok setelah SO diajukan."}
              </small>
            </span>
            <span className="so-stage-actions">
              {remainder.gt(0) && (
                <Tone>{`Backorder ${amount(remainder.toString())} ${unit}`}</Tone>
              )}
              {remainder.gt(0) && can("sales_order.reallocate") && row.state === "OPEN" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    void command(`/operations/orders/${row.id}/reallocate`, {
                      version: row.version,
                    }).catch(() => undefined)
                  }
                >
                  Evaluasi & alokasikan
                </Button>
              )}
              {remainder.gt(0) && can("sales_order.close_remainder") && (
                <Button variant="outline" size="sm" onClick={onCloseRemainder}>
                  Tutup sisa
                </Button>
              )}
            </span>
          </li>
        </ol>
      )}
      <p className="page-frame-subtitle so-footnote">
        Tahap hanya memuat alokasi nyata. Backorder tanpa alokasi menunggu stok atau tindakan tutup
        sisa.
      </p>
    </div>
  );
}

const notes: Record<string, string> = {
  SP: "Bukti SP/PO pelanggan yang dilampirkan saat SO dibuat.",
  PROFORMA: "Tidak mem-posting buku besar. Berisi jumlah yang teralokasi pada tahap ini.",
  PICKING: "Pengambilan FEFO/FIFO per lot oleh picker.",
  PACKING: "Hasil checking; menjadi sumber invoice di Finance.",
  SURAT_JALAN: "Dokumen pengiriman barang ke pelanggan.",
  POD: "Bukti penerimaan barang oleh pelanggan.",
  INVOICE: "Diterbitkan Finance dari packing list; status tagihan terpisah dari status pesanan.",
};

// Tab Dokumen (canvas SO-detail): tabel dokumen per tahap dan panel pratinjau di kanan.
export function DocumentsTab({
  row,
  journey,
}: {
  row: Order;
  journey: Journey;
  can: (p: string) => boolean;
}) {
  const params = useSearchParams(),
    go = useTabLink();
  const { q, warehouse, invoices, entries, active } = journey;
  const stageNo = (batch: string) => {
    const index = (q.data?.batches ?? []).findIndex((b) => b.number === batch);
    return index >= 0 ? String(index + 1) : "—";
  };
  const rows: (Entry & { stage: string })[] = [
    {
      id: "sp",
      kind: "SP",
      number: row.customerReference ?? "—",
      batch: "—",
      date: row.createdAt,
      status: row.evidenceId ? "Tersimpan" : "Belum ada",
      href: "",
      stage: "—",
    },
    // Urutan dalam tahap mengikuti alur: Proforma, Picking, Packing, Surat Jalan, POD, Invoice.
    ...entries
      .map((e) => ({ ...e, stage: stageNo(e.batch) }))
      .sort(
        (a, b) =>
          a.stage.localeCompare(b.stage, "id", { numeric: true }) ||
          Object.keys(kinds).indexOf(a.kind) - Object.keys(kinds).indexOf(b.kind),
      ),
  ];
  const kind = params.get("kind");
  const picked =
    rows.find((d) => d.id === params.get("doc")) ??
    (kind ? rows.find((d) => d.kind === kind) : undefined);
  const label = (k: string) => (k === "SP" ? "Bukti SP/PO" : (kinds[k] ?? k));
  return (
    <div className="so-tab-stack">
      {q.isError && (
        <PageNotice tone="error" onRetry={() => void q.refetch()}>
          Dokumen belum dapat dimuat. Jumlah dokumen belum dapat dipastikan.
        </PageNotice>
      )}
      <div className="so-docs">
        <div className="so-docs-table">
          <table>
            <thead>
              <tr>
                <th>Dokumen</th>
                <th>Tahap</th>
                <th>Nomor</th>
                <th>Modul</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={`${d.kind}-${d.id}`} data-active={picked?.id === d.id || undefined}>
                  <td>
                    <button
                      type="button"
                      className="so-doc-pick"
                      aria-pressed={picked?.id === d.id}
                      onClick={() => go("documents", { doc: d.id })}
                    >
                      {label(d.kind)}
                    </button>
                  </td>
                  <td>{d.stage}</td>
                  <td className="so-muted">{d.number}</td>
                  <td>{d.kind === "SP" ? "Sales › Sales Order" : (modules[d.kind] ?? "—")}</td>
                  <td>
                    <Tone>{d.status}</Tone>
                  </td>
                </tr>
              ))}
              {q.isPending && (
                <tr>
                  <td colSpan={5} role="status">
                    Memuat dokumen terkait…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <aside className="so-doc-preview" aria-label="Pratinjau dokumen">
          {picked ? (
            <>
              <small>{picked.kind === "SP" ? "Sales › Sales Order" : modules[picked.kind]}</small>
              <strong>
                {label(picked.kind)}
                {picked.stage !== "—" ? ` · tahap ${picked.stage}` : ""}
              </strong>
              <dl className="so-kv so-kv-single">
                <div>
                  <dt>Nomor</dt>
                  <dd>{picked.number}</dd>
                </div>
                <div>
                  <dt>Tanggal</dt>
                  <dd>{shortDate(picked.date) || "—"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{picked.status}</dd>
                </div>
              </dl>
              <p>{notes[picked.kind]}</p>
              {picked.kind === "SP" ? (
                <Evidence id={row.evidenceId} />
              ) : (
                <div className="so-doc-links">
                  <Link className="page-frame-link" href={picked.href}>
                    Buka dokumen
                  </Link>
                  {picked.process && (
                    <Link className="page-frame-link" href={picked.process}>
                      Proses picking
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <strong>Pilih dokumen</strong>
              <p>Klik nama dokumen untuk melihat ringkasannya dan modul yang mengelolanya.</p>
            </>
          )}
        </aside>
      </div>
      <p className="page-frame-subtitle so-footnote">
        Dokumen tahap berasal dari alokasi, bukan dibuat manual. Proforma tidak mem-posting buku
        besar; invoice diterbitkan Finance dari packing list dan status tagihan dicatat terpisah dari
        status pesanan.
        {active.length === 0 && " Belum ada alokasi aktif, jadi dokumen tahap belum tersedia."}
        {!warehouse && " Dokumen gudang tidak tampil karena izin membaca pemenuhan belum ada."}
        {!invoices && " Invoice tidak tampil karena izin invoice dan penerimaan belum ada."}
      </p>
    </div>
  );
}
