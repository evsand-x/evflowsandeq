"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Decimal from "decimal.js";
import { ArrowLeft, Printer, Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DashboardSidebar } from "../dashboard-sidebar";
import { ExecutiveTopbar } from "../dashboard-executive";
import { DataTable } from "../crm/crm-common";
import { ErrorBox, Upload, Evidence } from "./workspace";
import "../crm/crm.css";
import "./outbound.css";

type Stage = "picking" | "checking" | "shipping" | "pod" | "returns";
type Snapshot = {
  packing?: Snapshot;
  source?: Snapshot;
  package_count?: string;
  total_weight_kg?: string;
  package_type?: string;
  notes?: string;
};
type Doc = { id: string; kind: string; number: string; issuedAt: string; snapshot?: Snapshot };
type Allocation = {
  id: string;
  quantity: string;
  inTransitQuantity: string;
  acceptedQuantity: string;
  returnedQuantity: string;
  stockLot: {
    batchNo: string;
    expiryDate: string | null;
    locator?: { code: string };
    product: { code: string; name: string; baseUom?: { name: string } };
  };
};
type Pick = {
  id: string;
  version: number;
  state: string;
  createdAt: string;
  pickedAt: string | null;
  checkedAt: string | null;
  lines: {
    id: string;
    fulfillmentAllocationId: string;
    assignedQuantity: string;
    pickedQuantity: string;
    checkedQuantity: string;
  }[];
};
type Receipt = {
  id: string;
  receiverName: string;
  acceptedAt: string;
  evidenceId: string;
  lines: { id: string; fulfillmentAllocationId: string; acceptedQuantity: string }[];
  invoices: { id: string; number: string }[];
};
type Batch = {
  id: string;
  number: string;
  state: string;
  status?: string;
  createdAt: string;
  dispatchedAt: string | null;
  shipmentSnapshot?: { driver?: string; vehicle?: string; planned_at?: string };
  freightAmount?: string;
  freightTaxSnapshot?: unknown;
  salesOrder: {
    id: string;
    number: string;
    customerId: string;
    deliveryAddress: string;
    customer: { name: string };
  };
  allocations: Allocation[];
  pickList: Pick | null;
  documents: Doc[];
  deliveryReceipts?: Receipt[];
};
type ReturnRow = {
  id: string;
  state: string;
  createdAt: string;
  reason: string;
  customer: { name: string };
  salesInvoice?: { number: string };
  lines?: {
    id: string;
    batchNo: string;
    quantity: string;
    quarantineLocator: { code: string };
    deliveryReceiptLine: { allocation: { stockLot: { product: { code: string; name: string } } } };
  }[];
};
type Source = {
  id: string;
  acceptedAt: string;
  salesOrder: Batch["salesOrder"];
  lines: {
    id: string;
    acceptedQuantity: string;
    returns: { quantity: string }[];
    allocation: { stockLot: { warehouseId: string; batchNo: string; product: { name: string } } };
  }[];
};
type Sources = {
  receipts: Source[];
  locators: { id: string; code: string; name: string; warehouseId: string }[];
};
type Command = (url: string, body?: unknown) => Promise<{ data: { id: string } }>;
const stages: { key: Stage; label: string; description: string }[] = [
  {
    key: "picking",
    label: "Pick Slip",
    description: "Antrean tindakan: apa yang harus dikerjakan gudang sekarang",
  },
  {
    key: "checking",
    label: "Checking / Packing",
    description: "Periksa ulang hasil picking, lalu kemas dan terbitkan Packing List",
  },
  {
    key: "shipping",
    label: "Pengiriman",
    description: "Siapkan sopir dan kendaraan, lalu dispatch",
  },
  { key: "pod", label: "POD", description: "Konfirmasi barang diterima pelanggan" },
  {
    key: "returns",
    label: "Retur",
    description: "Penerimaan barang retur dan tindak lanjut pemeriksaan mutu",
  },
];
const href = (stage: Stage, id = "", form = false) =>
  `${stage === "picking" ? "/operations/pick-slips" : stage === "returns" ? "/operations/returns" : "/operations/warehouse"}${id ? `/${id}` : ""}?stage=${stage}${form ? "&view=form" : ""}`;
const date = (s?: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";
const qty = (s?: string) => new Decimal(s || "0").toString();
const total = (values: string[]) => values.reduce((a, b) => a.add(b), new Decimal(0)).toString();
const returnStatus = (s: string) =>
  ({
    REQUESTED: "Diajukan",
    APPROVED: "Disetujui",
    RECEIVED: "Di karantina",
    COMPLETED: "Selesai",
  })[s] ?? s;
function status(stage: Stage, b: Batch) {
  if (b.status) return b.status;
  if (["CANCELLED", "RELEASED"].includes(b.state)) return "Dibatalkan";
  const p = b.pickList;
  const shortage =
    p?.state === "PICKED" &&
    p.lines.some((l) => new Decimal(l.pickedQuantity).lt(l.assignedQuantity));
  if (stage === "picking")
    return !p
      ? "Belum dibuat"
      : p.state === "OPEN"
        ? "Siap diambil"
        : shortage
          ? "Sebagian diambil"
          : "Selesai";
  if (stage === "checking")
    return p?.state === "CHECKED" ? "Packing List terbit" : shortage ? "Ditahan" : "Perlu dicek";
  if (stage === "shipping")
    return b.state === "DELIVERED"
      ? "Selesai"
      : b.state !== "ALLOCATED"
        ? "Dalam perjalanan"
        : b.shipmentSnapshot
          ? "Siap kirim"
          : "Menunggu sopir";
  return b.state === "DELIVERED"
    ? "Selesai"
    : b.state === "PARTIALLY_DELIVERED"
      ? "Sebagian diterima"
      : "Menunggu POD";
}
function Badge({ children }: { children: string }) {
  const tone = /selisih|kurang|ditahan|dibatalkan|belum terverifikasi/i.test(children)
    ? "danger"
    : /selesai|sesuai|terbit|lengkap|^ya$/i.test(children)
      ? "success"
      : /siap|sebagian|menunggu|perlu|perjalanan|diajukan/i.test(children)
        ? "warning"
        : "neutral";
  return <span className={`ob-badge ob-${tone}`}>{children}</span>;
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ob-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ob-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Actions({ children }: { children: ReactNode }) {
  return <footer className="ob-actions">{children}</footer>;
}
function Progress({ stage, batch }: { stage: Stage; batch?: Batch }) {
  const index =
    stage === "returns"
      ? 1
      : !batch
        ? 0
        : batch.state === "DELIVERED"
          ? 5
          : ["DISPATCHED", "PARTIALLY_DELIVERED"].includes(batch.state)
            ? 4
            : batch.pickList?.state === "CHECKED"
              ? 3
              : batch.pickList?.state === "PICKED"
                ? 2
                : 1;
  const labels =
    stage === "returns"
      ? ["Referensi sumber", "Diterima di karantina", "Pemeriksaan mutu", "Putusan"]
      : ["Alokasi", "Picking", "Checking", "Packing", "Kirim", "POD"];
  return (
    <ol className="ob-progress" aria-label="Tahap dokumen">
      {labels.map((l, i) => (
        <li key={l} aria-current={i === index ? "step" : undefined}>
          {l}
        </li>
      ))}
    </ol>
  );
}

export function OutboundWorkspace({
  path,
  stage: requested,
  form = false,
}: {
  path: string[];
  stage?: string | undefined;
  form?: boolean;
}) {
  const stage: Stage =
    path[0] === "pick-slips"
      ? "picking"
      : path[0] === "returns"
        ? "returns"
        : ["checking", "shipping", "pod"].includes(requested ?? "")
          ? (requested as Stage)
          : "checking";
  const id = path[1];
  const creating = id === "new";
  const { principal, state } = useSession();
  const router = useRouter();
  const client = useQueryClient();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const enabled = can(
    stage === "returns"
      ? "customer_return.receive"
      : stage === "pod"
        ? "delivery_receipt.read"
        : `outbound_${stage}.read`,
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const keys = useRef(new Map<string, string>());
  const endpoint = id
    ? stage === "returns"
      ? `/operations/returns/${id}`
      : `/operations/outbound/${stage}/${id}`
    : stage === "returns"
      ? `/operations/returns?page=${page}&search=${encodeURIComponent(search)}`
      : `/operations/outbound/${stage}?page=${page}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(filter)}`;
  const query = useQuery({
    queryKey: [
      "outbound",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      endpoint,
    ],
    queryFn: () =>
      apiRequest<{
        data: Batch &
          ReturnRow & {
            rows: Batch[] & ReturnRow[];
            total: number;
            summary: Record<string, number>;
          };
      }>(endpoint),
    enabled: enabled && !creating,
  });
  const command: Command = async (url, body = {}) => {
    const fingerprint = `${url}:${JSON.stringify(body)}`;
    const key = keys.current.get(fingerprint) ?? crypto.randomUUID();
    keys.current.set(fingerprint, key);
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<{ data: { id: string } }>(url, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
      keys.current.delete(fingerprint);
      await client.invalidateQueries({ queryKey: ["outbound"] });
      await client.invalidateQueries({ queryKey: ["operations"] });
      toast.success("Transaksi tersimpan.");
      return result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Transaksi belum terkonfirmasi. Coba kembali dengan isian yang sama.",
      );
      throw e;
    } finally {
      setPending(false);
    }
  };
  const run = (fn: () => Promise<unknown>) => {
    void fn().catch(() => undefined);
  };
  if (!principal)
    return (
      <main className="ob-auth">
        <p>{state === "loading" ? "Memuat sesi…" : "Silakan masuk untuk membuka Barang Keluar."}</p>
        <Link href="/login">Masuk</Link>
      </main>
    );
  const data = query.data?.data;
  const info = stages.find((s) => s.key === stage)!;
  const doc = data?.documents?.find(
    (d) =>
      d.kind ===
      (stage === "picking" ? "PICKING" : stage === "checking" ? "PACKING" : "SURAT_JALAN"),
  );
  const title = creating
    ? "Terima Retur Pelanggan"
    : id
      ? form
        ? `${stage === "picking" ? "Konfirmasi Picking" : stage === "checking" ? "Checking & Packing" : stage === "shipping" ? "Atur Pengiriman" : "Konfirmasi POD"} · ${data?.number ?? "…"}`
        : stage === "returns"
          ? "Detail Retur"
          : `${stage === "checking" ? "Packing List" : stage === "shipping" ? "Surat Jalan" : info.label} · ${doc?.number ?? data?.number ?? "…"}`
      : stage === "returns"
        ? "Retur Pelanggan"
        : info.label;
  const actionPermission = {
    picking: "fulfillment.pick",
    checking: "fulfillment.check",
    shipping: "fulfillment.dispatch",
    pod: "delivery_receipt.confirm",
    returns: "customer_return.receive",
  }[stage];
  const action = (b: Batch) =>
    stage === "picking"
      ? !b.pickList
        ? "Buat Pick Slip"
        : b.pickList.state === "OPEN"
          ? "Mulai picking"
          : "Lihat detail"
      : stage === "checking"
        ? b.pickList?.state === "CHECKED"
          ? "Lihat"
          : "Mulai checking"
        : stage === "shipping"
          ? b.state === "ALLOCATED"
            ? "Atur & dispatch"
            : "Lihat Surat Jalan"
          : b.state === "DELIVERED"
            ? "Lihat"
            : "Konfirmasi POD";
  const canEdit = (b: Batch) =>
    stage === "picking"
      ? b.state === "ALLOCATED" && b.pickList?.state === "OPEN"
      : stage === "checking"
        ? b.state === "ALLOCATED" && b.pickList?.state === "PICKED"
        : stage === "shipping"
          ? b.state === "ALLOCATED" && b.pickList?.state === "CHECKED"
          : ["DISPATCHED", "PARTIALLY_DELIVERED"].includes(b.state);
  const columns: ColumnDef<Batch>[] = [
    {
      id: "number",
      header: stage === "pod" ? "Surat Jalan" : "Tahap pemenuhan",
      cell: ({ row: r }) => (
        <Link className="ob-link" href={href(stage, r.original.id)}>
          {stage === "pod"
            ? (r.original.documents.find((d) => d.kind === "SURAT_JALAN")?.number ??
              r.original.number)
            : r.original.number}
        </Link>
      ),
    },
    { id: "order", header: "Sales Order", cell: ({ row: r }) => r.original.salesOrder.number },
    {
      id: "customer",
      header: "Pelanggan",
      cell: ({ row: r }) => r.original.salesOrder.customer.name,
    },
    ...(stage === "picking"
      ? [
          {
            id: "items",
            header: "Item",
            cell: ({ row: r }: { row: { original: Batch } }) => r.original.allocations.length,
          },
          {
            id: "priority",
            header: "Prioritas",
            cell: () => <span title="Prioritas belum tersedia pada dokumen sumber">—</span>,
          },
        ]
      : []),
    ...(stage === "checking"
      ? [
          {
            id: "picked",
            header: "Diambil",
            cell: ({ row: r }: { row: { original: Batch } }) =>
              `${total(r.original.pickList?.lines.map((l) => l.pickedQuantity) ?? [])} dari ${total(r.original.pickList?.lines.map((l) => l.assignedQuantity) ?? [])}`,
          },
        ]
      : []),
    ...(stage === "shipping"
      ? [
          {
            id: "packing",
            header: "Koli",
            cell: ({ row: r }: { row: { original: Batch } }) =>
              r.original.documents.find((d) => d.kind === "PACKING")?.snapshot?.packing
                ?.package_count ?? "—",
          },
        ]
      : []),
    ...(stage === "pod"
      ? [
          {
            id: "sent",
            header: "Dikirim",
            cell: ({ row: r }: { row: { original: Batch } }) => date(r.original.dispatchedAt),
          },
          {
            id: "age",
            header: "Umur",
            cell: ({ row: r }: { row: { original: Batch } }) =>
              r.original.dispatchedAt
                ? `${Math.max(0, Math.floor((Date.now() - new Date(r.original.dispatchedAt).getTime()) / 86400000))} hari`
                : "—",
          },
        ]
      : []),
    {
      id: "status",
      header:
        stage === "picking"
          ? "Status picking"
          : stage === "checking"
            ? "Status checking"
            : stage === "shipping"
              ? "Status pengiriman"
              : "Status POD",
      cell: ({ row: r }) => <Badge>{status(stage, r.original)}</Badge>,
    },
    {
      id: "actions",
      header: "Tindakan",
      cell: ({ row: r }) =>
        stage === "picking" && !r.original.pickList && can(actionPermission) ? (
          <Button
            disabled={pending}
            onClick={() =>
              run(async () => {
                await command(`/fulfillment-batches/${r.original.id}/create-picking`);
                router.push(href(stage, r.original.id, true));
              })
            }
          >
            Buat Pick Slip
          </Button>
        ) : (
          <Button
            variant={canEdit(r.original) && can(actionPermission) ? "default" : "outline"}
            asChild
          >
            <Link href={href(stage, r.original.id, canEdit(r.original) && can(actionPermission))}>
              {can(actionPermission) ? action(r.original) : "Lihat detail"}
            </Link>
          </Button>
        ),
    },
  ];
  const labels =
    stage === "picking"
      ? ["Belum dibuat", "Siap diambil", "Sebagian diambil", "Selesai"]
      : stage === "checking"
        ? ["Perlu dicek", "Packing List terbit", "Ditahan", "Total"]
        : stage === "shipping"
          ? ["Siap kirim", "Menunggu sopir", "Dalam perjalanan", "Total"]
          : stage === "pod"
            ? ["Menunggu POD", "Sebagian diterima", "Selesai", "Total"]
            : ["Diajukan", "Disetujui", "Di karantina", "Selesai"];
  const summary =
    stage === "returns"
      ? Object.fromEntries(
          Object.entries(data?.summary ?? {}).map(([k, v]) => [returnStatus(k), v]),
        )
      : (data?.summary ?? {});
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <DashboardSidebar
        principal={principal}
        activeView="warehouse"
        activeSection="warehouse"
        outboundStage={stage}
      />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        <main className="executive-content crm-content ob-workspace">
          <header className="ob-header">
            <div>
              <nav className="executive-breadcrumb">
                Warehouse & Logistik / Barang Keluar / {info.label}
              </nav>
              <h1>{title}</h1>
              <p>
                {id
                  ? data?.salesOrder
                    ? `${data.salesOrder.number} · ${data.salesOrder.customer.name}`
                    : info.description
                  : info.description}
              </p>
            </div>
            <nav className="ob-tabs" aria-label="Barang Keluar">
              {stages.map((s) => (
                <Link
                  key={s.key}
                  href={href(s.key)}
                  aria-current={stage === s.key ? "page" : undefined}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          </header>
          {id && (
            <Button variant="outline" asChild className="ob-back">
              <Link href={href(stage)}>
                <ArrowLeft />
                Kembali ke daftar
              </Link>
            </Button>
          )}
          {!enabled ? (
            <ErrorBox message="Izin Anda belum mencukupi untuk layar ini." />
          ) : (
            <>
              {(error || query.error) && <ErrorBox message={error || String(query.error)} />}
              {query.isLoading && !creating && <p role="status">Memuat dokumen…</p>}
              {!id && (
                <>
                  <div className="ob-kpis">
                    {labels.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => {
                          if (stage !== "returns") {
                            setFilter(l === "Total" ? "" : l);
                            setPage(1);
                          }
                        }}
                      >
                        <strong>
                          {data
                            ? l === "Total"
                              ? Object.values(summary).reduce((a, b) => a + b, 0)
                              : (summary[l] ?? 0)
                            : "—"}
                        </strong>
                        <span>{l}</span>
                      </button>
                    ))}
                  </div>
                  <Panel title={`Daftar ${info.label}`}>
                    <div className="ob-toolbar">
                      <span>{filter || "Semua dokumen"}</span>
                      <div className="ob-search">
                        <Search />
                        <Input
                          aria-label="Cari dokumen"
                          placeholder={
                            stage === "returns"
                              ? "Cari pelanggan atau alasan retur"
                              : "Cari nomor tahap, SO, atau pelanggan"
                          }
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                          }}
                        />
                      </div>
                      {stage !== "returns" && (
                        <SelectionField
                          hideLabel
                          label="Status"
                          placeholder="Semua status"
                          options={[
                            ...new Set([
                              ...labels,
                              ...Object.keys(summary),
                              "Dibatalkan",
                              ...(stage === "shipping" ? ["Selesai"] : []),
                            ]),
                          ]
                            .filter((l) => l !== "Total")
                            .map((l) => ({ id: l, name: l }))}
                          value={filter ? [filter] : []}
                          onChange={(v) => {
                            setFilter(v[0] ?? "");
                            setPage(1);
                          }}
                        />
                      )}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearch("");
                          setFilter("");
                          setPage(1);
                        }}
                      >
                        Reset filter
                      </Button>
                      {stage === "returns" && (
                        <Button asChild>
                          <Link href={href(stage, "new")}>
                            <Plus />
                            Terima retur
                          </Link>
                        </Button>
                      )}
                    </div>
                    {query.isLoading || query.isError ? null : stage === "returns" ? (
                      <DataTable<ReturnRow>
                        data={data?.rows ?? []}
                        total={data?.total ?? 0}
                        page={page}
                        pageSize={25}
                        onPage={setPage}
                        showColumns={false}
                        columns={[
                          {
                            id: "number",
                            header: "Referensi retur",
                            cell: ({ row: r }) => (
                              <Link href={href(stage, r.original.id)} className="ob-link">
                                {r.original.id.slice(0, 8).toUpperCase()}
                              </Link>
                            ),
                          },
                          {
                            id: "invoice",
                            header: "Invoice",
                            cell: ({ row: r }) => r.original.salesInvoice?.number ?? "—",
                          },
                          {
                            id: "customer",
                            header: "Pelanggan",
                            cell: ({ row: r }) => r.original.customer.name,
                          },
                          { accessorKey: "reason", header: "Alasan" },
                          {
                            id: "status",
                            header: "Status",
                            cell: ({ row: r }) => <Badge>{returnStatus(r.original.state)}</Badge>,
                          },
                          {
                            id: "action",
                            header: "Tindakan",
                            cell: ({ row: r }) => (
                              <Button variant="outline" asChild>
                                <Link href={href(stage, r.original.id)}>Lihat</Link>
                              </Button>
                            ),
                          },
                        ]}
                      />
                    ) : (
                      <DataTable<Batch>
                        data={data?.rows ?? []}
                        columns={columns}
                        total={data?.total ?? 0}
                        page={page}
                        pageSize={25}
                        onPage={setPage}
                        showColumns={false}
                        busy={query.isFetching}
                      />
                    )}
                  </Panel>
                </>
              )}
              {creating && stage === "returns" && (
                <ReturnForm
                  command={command}
                  pending={pending}
                  onDone={(id) => router.push(href(stage, id))}
                />
              )}
              {id &&
                !creating &&
                data &&
                (stage === "returns" ? (
                  <ReturnDetail row={data} />
                ) : form ? (
                  <BatchForm
                    key={`${data.id}:${stage}`}
                    row={data}
                    stage={stage}
                    can={can}
                    command={command}
                    pending={pending}
                    onDone={() => router.push(href(stage, data.id))}
                  />
                ) : (
                  <BatchDetail
                    row={data}
                    stage={stage}
                    company={principal.company_name}
                    can={can}
                    command={command}
                    pending={pending}
                  />
                ))}
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function productColumns(): ColumnDef<Allocation>[] {
  return [
    { id: "code", header: "Kode", cell: ({ row: r }) => r.original.stockLot.product.code },
    { id: "name", header: "Nama produk", cell: ({ row: r }) => r.original.stockLot.product.name },
    { id: "batch", header: "Batch", cell: ({ row: r }) => r.original.stockLot.batchNo },
    {
      id: "ed",
      header: "ED",
      cell: ({ row: r }) => r.original.stockLot.expiryDate?.slice(0, 10) ?? "—",
    },
  ];
}
function BatchDetail({
  row,
  stage,
  company,
  can,
  command,
  pending,
}: {
  row: Batch;
  stage: Stage;
  company: string;
  can: (p: string) => boolean;
  command: Command;
  pending: boolean;
}) {
  const doc = row.documents.find(
    (d) =>
      d.kind ===
      (stage === "picking" ? "PICKING" : stage === "checking" ? "PACKING" : "SURAT_JALAN"),
  );
  const packing = row.documents.find((d) => d.kind === "PACKING")?.snapshot?.packing;
  const shortage =
    row.pickList?.state === "PICKED" &&
    row.pickList.lines.some((l) => new Decimal(l.pickedQuantity).lt(l.assignedQuantity));
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState("");
  const receipts = row.deliveryReceipts ?? [];
  return (
    <>
      <Progress stage={stage} batch={row} />
      <div className="ob-detail-grid">
        <div className="ob-stack">
          <Panel
            title={
              stage === "pod"
                ? "Penerimaan"
                : stage === "picking"
                  ? "Ringkasan"
                  : `${stage === "checking" ? "Packing List" : "Surat Jalan"} · ${doc?.number ?? "Belum diterbitkan"}`
            }
          >
            <p className="ob-document-heading">{company}</p>
            <dl className="ob-facts">
              <dt>Sales Order</dt>
              <dd>{row.salesOrder.number}</dd>
              <dt>Pelanggan</dt>
              <dd>{row.salesOrder.customer.name}</dd>
              <dt>Alamat kirim</dt>
              <dd>{row.salesOrder.deliveryAddress}</dd>
              <dt>Status</dt>
              <dd>
                <Badge>{status(stage, row)}</Badge>
              </dd>
              {stage === "pod" &&
                receipts.map((p) => (
                  <div key={p.id} className="ob-receipt">
                    <strong>{p.receiverName}</strong>
                    <p>{date(p.acceptedAt)}</p>
                    {can("delivery_receipt.read") && <Evidence id={p.evidenceId} />}
                  </div>
                ))}
            </dl>
          </Panel>
          <Panel title={stage === "pod" ? "Barang diterima" : "Barang"}>
            <DataTable
              data={row.allocations}
              total={row.allocations.length}
              formTable
              showColumns={false}
              columns={[
                ...productColumns(),
                ...(stage === "picking"
                  ? [
                      {
                        id: "locator",
                        header: "Locator",
                        cell: ({ row: r }: { row: { original: Allocation } }) =>
                          r.original.stockLot.locator?.code ?? "—",
                      },
                    ]
                  : []),
                {
                  id: "qty",
                  header: stage === "picking" ? "Alokasi" : "Jumlah",
                  cell: ({ row: r }) => qty(r.original.quantity),
                },
                {
                  id: "unit",
                  header: "Satuan",
                  cell: ({ row: r }) => r.original.stockLot.product.baseUom?.name ?? "—",
                },
                ...(stage === "picking"
                  ? [
                      {
                        id: "picked",
                        header: "Diambil",
                        cell: ({ row: r }: { row: { original: Allocation } }) =>
                          qty(
                            row.pickList?.lines.find(
                              (l) => l.fulfillmentAllocationId === r.original.id,
                            )?.pickedQuantity,
                          ),
                      },
                    ]
                  : []),
                ...(stage === "pod"
                  ? [
                      {
                        id: "accepted",
                        header: "Diterima",
                        cell: ({ row: r }: { row: { original: Allocation } }) =>
                          qty(r.original.acceptedQuantity),
                      },
                      {
                        id: "remaining",
                        header: "Belum diterima",
                        cell: ({ row: r }: { row: { original: Allocation } }) =>
                          qty(r.original.inTransitQuantity),
                      },
                    ]
                  : []),
              ]}
            />
            {stage === "checking" && (
              <p>
                Total koli: {packing?.package_count ?? "—"} · Berat:{" "}
                {packing?.total_weight_kg ?? "—"} kg
              </p>
            )}
            {stage === "shipping" && (
              <p>
                Pengemudi: {row.shipmentSnapshot?.driver ?? "—"} · Kendaraan:{" "}
                {row.shipmentSnapshot?.vehicle ?? "—"}
              </p>
            )}
            {["checking", "shipping"].includes(stage) && (
              <div className="ob-signatures">
                {(stage === "checking"
                  ? ["Petugas picking", "Petugas checking", "Packing"]
                  : ["Gudang", "Pengemudi", "Penerima"]
                ).map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <aside className="ob-stack">
          {shortage && (
            <Panel title="Selisih — perlu keputusan">
              <p className="ob-notice">
                Jumlah diambil kurang dari alokasi. Selesaikan selisih sebelum checking.
              </p>
              <Field label="Alasan selisih">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              {can("fulfillment.check") && (
                <>
                  <Upload purpose="WAREHOUSE_CONTROL" onChange={setProof} />
                  <Button
                    disabled={pending || !proof || !reason.trim()}
                    onClick={() =>
                      void command(`/pick-lists/${row.pickList!.id}/resolve-shortage`, {
                        version: row.pickList!.version,
                        reason,
                        evidence_id: proof,
                      }).catch(() => undefined)
                    }
                  >
                    Jadikan backorder
                  </Button>
                </>
              )}
              {can("sales_order.read") && (
                <Button variant="outline" asChild>
                  <Link href={`/operations/orders/${row.salesOrder.id}`}>
                    Tinjau penutupan sisa pesanan
                  </Link>
                </Button>
              )}
            </Panel>
          )}
          <Panel title="Status">
            <dl className="ob-facts">
              <dt>
                {stage === "checking"
                  ? "Checking"
                  : stage === "shipping"
                    ? "Pengiriman"
                    : "Dokumen"}
              </dt>
              <dd>
                <Badge>{status(stage, row)}</Badge>
              </dd>
              <dt>Dibuat</dt>
              <dd>{date(row.createdAt)}</dd>
              {stage === "shipping" && (
                <>
                  <dt>Berangkat</dt>
                  <dd>{date(row.dispatchedAt)}</dd>
                  <dt>POD</dt>
                  <dd>
                    <Badge>{receipts.length ? "Sudah diterima" : "Menunggu"}</Badge>
                  </dd>
                </>
              )}
            </dl>
          </Panel>
          {stage === "pod" && (
            <Panel title="Tagihan">
              {!receipts.length ? (
                <p>POD belum dikonfirmasi.</p>
              ) : (
                receipts.map((p) => (
                  <div key={p.id}>
                    {p.invoices.length ? (
                      p.invoices.map((i) => (
                        <p key={i.id}>
                          {can("sales_invoice.read") ? (
                            <Link className="ob-link" href={`/operations/invoices/${i.id}`}>
                              {i.number}
                            </Link>
                          ) : (
                            "Invoice tersedia"
                          )}
                        </p>
                      ))
                    ) : (
                      <>
                        <p>
                          Invoice belum dibuat. Jatuh tempo mengikuti ketentuan pembayaran
                          pelanggan.
                        </p>
                        {can("sales_invoice.post") && (
                          <Button
                            disabled={pending}
                            onClick={() =>
                              void command("/sales-invoice-drafts", {
                                delivery_receipt_id: p.id,
                              }).catch(() => undefined)
                            }
                          >
                            Buat draft Invoice dari POD
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </Panel>
          )}
          <Panel title="Riwayat">
            <ol className="ob-history">
              <li>
                <time>{date(row.createdAt)}</time>Tahap pemenuhan dibuat
              </li>
              {row.documents.map((d) => (
                <li key={d.id}>
                  <time>{date(d.issuedAt)}</time>
                  {d.number} diterbitkan
                </li>
              ))}
              {row.pickList?.pickedAt && (
                <li>
                  <time>{date(row.pickList.pickedAt)}</time>Picking dikonfirmasi
                </li>
              )}
              {receipts.map((p) => (
                <li key={p.id}>
                  <time>{date(p.acceptedAt)}</time>POD diterima oleh {p.receiverName}
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
      <Actions>
        {(doc || stage === "pod") && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Cetak{" "}
            {stage === "picking"
              ? "Pick Slip"
              : stage === "checking"
                ? "Packing List"
                : stage === "shipping"
                  ? "Surat Jalan"
                  : "POD"}
          </Button>
        )}
        {stage === "picking" &&
          row.state === "ALLOCATED" &&
          !row.pickList &&
          can("fulfillment.pick") && (
            <Button
              disabled={pending}
              onClick={() =>
                void command(`/fulfillment-batches/${row.id}/create-picking`).catch(() => undefined)
              }
            >
              Buat Pick Slip
            </Button>
          )}
        {stage === "picking" &&
          row.state === "ALLOCATED" &&
          row.pickList?.state === "OPEN" &&
          can("fulfillment.pick") && (
            <Button asChild>
              <Link href={href(stage, row.id, true)}>Mulai picking</Link>
            </Button>
          )}
        {stage === "picking" &&
          row.state === "ALLOCATED" &&
          row.pickList?.state === "PICKED" &&
          !shortage &&
          can("fulfillment.check") && (
            <Button asChild>
              <Link href={href("checking", row.id, true)}>Lanjut ke Checking</Link>
            </Button>
          )}
        {stage === "checking" &&
          row.state === "ALLOCATED" &&
          row.pickList?.state === "PICKED" &&
          can("fulfillment.check") && (
            <Button asChild>
              <Link href={href(stage, row.id, true)}>Mulai checking</Link>
            </Button>
          )}
        {stage === "checking" &&
          row.pickList?.state === "CHECKED" &&
          can("fulfillment.dispatch") && (
            <Button asChild>
              <Link href={href("shipping", row.id, true)}>Atur pengiriman</Link>
            </Button>
          )}
        {stage === "shipping" && row.state === "ALLOCATED" && can("fulfillment.dispatch") && (
          <Button asChild>
            <Link href={href(stage, row.id, true)}>Atur pengiriman</Link>
          </Button>
        )}
        {["shipping", "pod"].includes(stage) &&
          ["DISPATCHED", "PARTIALLY_DELIVERED"].includes(row.state) &&
          can("delivery_receipt.confirm") && (
            <Button asChild>
              <Link href={href("pod", row.id, true)}>Konfirmasi POD</Link>
            </Button>
          )}
      </Actions>
    </>
  );
}

function BatchForm({
  row,
  stage,
  can,
  command,
  pending: commandPending,
  onDone,
}: {
  row: Batch;
  stage: Stage;
  can: (p: string) => boolean;
  command: Command;
  pending: boolean;
  onDone: () => void;
}) {
  const p = row.pickList;
  const busy = useRef(false);
  const [working, setWorking] = useState(false);
  const pending = commandPending || working;
  const savedShipment = useRef("");
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (p?.lines ?? []).map((l) => [l.id, p!.version > 1 ? l.pickedQuantity : l.assignedQuantity]),
    ),
  );
  const [checked, setChecked] = useState<Record<string, string>>(() =>
    Object.fromEntries((p?.lines ?? []).map((l) => [l.id, l.pickedQuantity])),
  );
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");
  const [packageCount, setPackageCount] = useState("");
  const [weight, setWeight] = useState("");
  const [packageType, setPackageType] = useState("Dus");
  const [notes, setNotes] = useState("");
  const [label, setLabel] = useState(false);
  const [driver, setDriver] = useState(row.shipmentSnapshot?.driver ?? "");
  const [vehicle, setVehicle] = useState(row.shipmentSnapshot?.vehicle ?? "");
  const [when, setWhen] = useState(() => {
    const d = new Date(row.shipmentSnapshot?.planned_at ?? Date.now());
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [freight, setFreight] = useState(row.freightAmount ?? "0");
  const [freightOn, setFreightOn] = useState(() => new Decimal(row.freightAmount ?? "0").gt(0));
  const [taxable, setTaxable] = useState(!!row.freightTaxSnapshot);
  const [receiver, setReceiver] = useState("");
  const [proof, setProof] = useState("");
  const [accepted, setAccepted] = useState<Record<string, string>>(() =>
    Object.fromEntries(row.allocations.map((l) => [l.id, l.inTransitQuantity])),
  );
  const permission =
    stage === "picking"
      ? "fulfillment.pick"
      : stage === "checking"
        ? "fulfillment.check"
        : stage === "shipping"
          ? "fulfillment.dispatch"
          : "delivery_receipt.confirm";
  const eligible =
    stage === "picking"
      ? row.state === "ALLOCATED" && p?.state === "OPEN"
      : stage === "checking"
        ? row.state === "ALLOCATED" && p?.state === "PICKED"
        : stage === "shipping"
          ? row.state === "ALLOCATED" && p?.state === "CHECKED"
          : ["DISPATCHED", "PARTIALLY_DELIVERED"].includes(row.state);
  const run = (fn: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    setWorking(true);
    setLocalError("");
    void fn()
      .catch((e) => setLocalError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        busy.current = false;
        setWorking(false);
      });
  };
  const savePick = async (draft: boolean) => {
    if (!p) return;
    const lines = p.lines.map((l) => ({
      pick_list_line_id: l.id,
      picked_quantity: picked[l.id] ?? "0",
    }));
    const shortage = lines.some((l, i) =>
      new Decimal(l.picked_quantity).lt(p.lines[i]!.assignedQuantity),
    );
    if (!draft && shortage && !reason.trim())
      throw new Error("Isi alasan selisih sebelum konfirmasi picking.");
    await command(`/pick-lists/${p.id}/${draft ? "save-draft" : "confirm-pick"}`, {
      version: p.version,
      reason,
      lines,
    });
    onDone();
  };
  const confirmCheck = async () => {
    if (!p) return;
    await command(`/pick-lists/${p.id}/confirm-check`, {
      checks: p.lines.map((l) => ({
        pick_list_line_id: l.id,
        checked_quantity: checked[l.id] ?? "0",
        condition: conditions[l.id] ?? "BAIK",
      })),
      packing: {
        ...(packageCount ? { package_count: packageCount } : {}),
        ...(weight ? { total_weight_kg: weight } : {}),
        package_type: packageType,
        notes,
        label_attached: label,
      },
    });
    onDone();
  };
  const dispatch = async () => {
    const shipment = {
      driver,
      vehicle,
      planned_at: new Date(when).toISOString(),
      freight: {
        amount: freightOn ? freight : "0",
        tax_mode: freightOn && taxable ? "TAXABLE" : "NON_TAXABLE",
      },
    };
    const fingerprint = JSON.stringify(shipment);
    if (savedShipment.current !== fingerprint) {
      await command(`/operations/warehouse/${row.id}/shipment`, shipment);
      savedShipment.current = fingerprint;
    }
    // Keep a successful shipment save across dispatch retries.
    await command(`/fulfillment-batches/${row.id}/dispatch`);
    onDone();
  };
  const pod = async (invoice = false) => {
    const result = await command(`/fulfillment-batches/${row.id}/pod`, {
      receiver_name: receiver,
      accepted_at: new Date(when).toISOString(),
      evidence_id: proof,
      lines: row.allocations
        .filter((l) => new Decimal(l.inTransitQuantity).gt(0))
        .map((l) => ({
          fulfillment_allocation_id: l.id,
          accepted_quantity: accepted[l.id] ?? "0",
        })),
    });
    if (invoice) {
      try {
        await command("/sales-invoice-drafts", { delivery_receipt_id: result.data.id });
      } catch {
        onDone();
        throw new Error(
          "POD sudah tersimpan. Draft Invoice belum berhasil dibuat; lanjutkan dari detail POD.",
        );
      }
    }
    onDone();
  };
  const difference = (a: string, b: string) => {
    try {
      const d = new Decimal(a).sub(b);
      return d.isZero() ? "Sesuai" : d.gt(0) ? `Kurang ${d}` : `Lebih ${d.abs()}`;
    } catch {
      return "Periksa jumlah";
    }
  };
  if (!can(permission) || !eligible)
    return (
      <Panel title="Tindakan belum tersedia">
        <p>Status dokumen atau izin Anda belum memungkinkan tindakan ini.</p>
        <Button asChild variant="outline">
          <Link href={href(stage, row.id)}>Kembali ke detail</Link>
        </Button>
      </Panel>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          stage === "picking"
            ? savePick(false)
            : stage === "checking"
              ? confirmCheck()
              : stage === "shipping"
                ? dispatch()
                : pod(),
        );
      }}
      className="ob-form"
    >
      {localError && <ErrorBox message={localError} />}
      {stage === "picking" && (
        <>
          <Panel title="Informasi tahap">
            <dl className="ob-facts">
              <dt>Sales Order</dt>
              <dd>
                {row.salesOrder.number} · {row.salesOrder.customer.name}
              </dd>
              <dt>Alamat kirim</dt>
              <dd>{row.salesOrder.deliveryAddress}</dd>
              <dt>Picking Slip</dt>
              <dd>{row.documents.find((d) => d.kind === "PICKING")?.number ?? "—"}</dd>
            </dl>
          </Panel>
          <Panel title="Barang yang diambil">
            <p className="ob-notice">
              Jumlah diambil terisi sesuai alokasi. Ubah hanya bila barang fisik berbeda.
            </p>
            <DataTable
              formTable
              showColumns={false}
              data={row.allocations.filter((a) =>
                p?.lines.some((l) => l.fulfillmentAllocationId === a.id),
              )}
              total={p?.lines.length ?? 0}
              columns={[
                ...productColumns(),
                {
                  id: "locator",
                  header: "Locator",
                  cell: ({ row: r }) => r.original.stockLot.locator?.code ?? "—",
                },
                {
                  id: "allocation",
                  header: "Alokasi",
                  cell: ({ row: r }) => qty(r.original.quantity),
                },
                {
                  id: "picked",
                  header: "Diambil",
                  cell: ({ row: r }) => {
                    const l = p!.lines.find((l) => l.fulfillmentAllocationId === r.original.id)!;
                    return (
                      <Input
                        required
                        inputMode="decimal"
                        aria-label={`Jumlah diambil ${r.original.stockLot.product.name}`}
                        value={picked[l.id] ?? "0"}
                        onChange={(e) => setPicked((v) => ({ ...v, [l.id]: e.target.value }))}
                      />
                    );
                  },
                },
                {
                  id: "difference",
                  header: "Selisih",
                  cell: ({ row: r }) => {
                    const l = p!.lines.find((l) => l.fulfillmentAllocationId === r.original.id)!;
                    return <Badge>{difference(l.assignedQuantity, picked[l.id] ?? "0")}</Badge>;
                  },
                },
              ]}
            />
            <div className="ob-form-grid">
              <Field label="Alasan selisih (wajib bila ada selisih)">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1000}
                />
              </Field>
              <div className="ob-field">
                <span>Ganti batch / locator</span>
                <p className="ob-muted">
                  Perubahan batch memerlukan alokasi ulang. Selesaikan selisih melalui detail Pick
                  Slip.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setPicked(Object.fromEntries(p!.lines.map((l) => [l.id, l.assignedQuantity])))
              }
            >
              Isi semua sesuai alokasi
            </Button>
          </Panel>
        </>
      )}
      {stage === "checking" && (
        <>
          <Panel title="Checking">
            <DataTable
              formTable
              showColumns={false}
              data={row.allocations.filter((a) =>
                p?.lines.some((l) => l.fulfillmentAllocationId === a.id),
              )}
              total={p?.lines.length ?? 0}
              columns={[
                {
                  id: "name",
                  header: "Produk",
                  cell: ({ row: r }) => r.original.stockLot.product.name,
                },
                {
                  id: "picked",
                  header: "Diambil",
                  cell: ({ row: r }) =>
                    qty(
                      p!.lines.find((l) => l.fulfillmentAllocationId === r.original.id)
                        ?.pickedQuantity,
                    ),
                },
                {
                  id: "checked",
                  header: "Dicek",
                  cell: ({ row: r }) => {
                    const l = p!.lines.find((l) => l.fulfillmentAllocationId === r.original.id)!;
                    return (
                      <Input
                        required
                        inputMode="decimal"
                        aria-label={`Jumlah dicek ${r.original.stockLot.product.name}`}
                        value={checked[l.id] ?? "0"}
                        onChange={(e) => setChecked((v) => ({ ...v, [l.id]: e.target.value }))}
                      />
                    );
                  },
                },
                {
                  id: "condition",
                  header: "Kondisi",
                  cell: ({ row: r }) => {
                    const l = p!.lines.find((l) => l.fulfillmentAllocationId === r.original.id)!;
                    return (
                      <SelectionField
                        hideLabel
                        label={`Kondisi ${r.original.stockLot.product.name}`}
                        value={[conditions[l.id] ?? "BAIK"]}
                        onChange={(v) =>
                          setConditions((old) => ({ ...old, [l.id]: v[0] ?? "BAIK" }))
                        }
                        options={[
                          { id: "BAIK", name: "Baik" },
                          { id: "RUSAK", name: "Rusak" },
                          { id: "KURANG", name: "Kurang" },
                        ]}
                      />
                    );
                  },
                },
              ]}
            />
            <p className="ob-notice">
              Jika jumlah dicek berbeda atau kondisi bermasalah, selesaikan selisih sebelum
              menerbitkan Packing List.
            </p>
          </Panel>
          <Panel title="Packing">
            <div className="ob-form-grid">
              <Field label="Jumlah koli">
                <Input
                  required
                  inputMode="numeric"
                  pattern="[0-9]+"
                  value={packageCount}
                  onChange={(e) => setPackageCount(e.target.value)}
                />
              </Field>
              <Field label="Berat total (kg)">
                <Input
                  required
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </Field>
              <SelectionField
                label="Jenis kemasan"
                options={["Dus", "Box", "Pallet", "Lainnya"].map((s) => ({ id: s, name: s }))}
                value={[packageType]}
                onChange={(v) => setPackageType(v[0] ?? "")}
              />
              <Field label="Catatan packing">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                />
              </Field>
            </div>
            <label className="ob-checkbox">
              <input type="checkbox" checked={label} onChange={(e) => setLabel(e.target.checked)} />
              Label koli sudah ditempel
            </label>
          </Panel>
        </>
      )}
      {stage === "shipping" && (
        <div className="ob-detail-grid">
          <Panel title="Data pengiriman">
            <div className="ob-form-grid">
              <Field label="Pengemudi">
                <Input
                  required
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field label="Kendaraan">
                <Input
                  required
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  maxLength={100}
                />
              </Field>
              <Field label="Berangkat (tanggal & jam)">
                <Input
                  required
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </Field>
            </div>
            <div className="ob-switch">
              <span>Tambahkan ongkos kirim</span>
              <Switch
                checked={freightOn}
                onCheckedChange={setFreightOn}
                aria-label="Tambahkan ongkos kirim"
              />
            </div>
            <div className="ob-form-grid ob-freight">
              <Field label="Nominal ongkos kirim">
                <Input
                  disabled={!freightOn}
                  required={freightOn}
                  value={freight}
                  inputMode="decimal"
                  onChange={(e) => setFreight(e.target.value)}
                />
              </Field>
              <div className="ob-switch">
                <span>Kena PPN</span>
                <Switch
                  disabled={!freightOn}
                  checked={taxable}
                  onCheckedChange={setTaxable}
                  aria-label="Ongkir kena PPN"
                />
              </div>
            </div>
          </Panel>
          <Panel title="Kesiapan dispatch">
            <dl className="ob-facts">
              <dt>Checking selesai</dt>
              <dd>
                <Badge>{p?.state === "CHECKED" ? "Ya" : "Belum"}</Badge>
              </dd>
              <dt>Packing List terbit</dt>
              <dd>
                <Badge>{row.documents.some((d) => d.kind === "PACKING") ? "Ya" : "Belum"}</Badge>
              </dd>
              <dt>Sopir & kendaraan terisi</dt>
              <dd>
                <Badge>{driver.trim() && vehicle.trim() ? "Ya" : "Belum"}</Badge>
              </dd>
              <dt>Dana dan kelayakan stok</dt>
              <dd>Diperiksa server saat dispatch</dd>
            </dl>
            <p className="ob-muted">
              Jika dispatch ditolak, rencana pengiriman tetap tersimpan dan alasan penolakan
              ditampilkan.
            </p>
          </Panel>
        </div>
      )}
      {stage === "pod" && (
        <>
          <Panel title="Penerima">
            <div className="ob-form-grid">
              <Field label="Nama penerima *">
                <Input
                  required
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field label="Diterima (tanggal & jam) *">
                <Input
                  required
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </Field>
            </div>
          </Panel>
          <Panel title="Barang diterima">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setAccepted(
                  Object.fromEntries(row.allocations.map((l) => [l.id, l.inTransitQuantity])),
                )
              }
            >
              Terima semua sesuai Surat Jalan
            </Button>
            <DataTable
              formTable
              showColumns={false}
              data={row.allocations.filter((l) => new Decimal(l.inTransitQuantity).gt(0))}
              total={row.allocations.length}
              columns={[
                {
                  id: "product",
                  header: "Produk",
                  cell: ({ row: r }) => r.original.stockLot.product.name,
                },
                { id: "batch", header: "Batch", cell: ({ row: r }) => r.original.stockLot.batchNo },
                {
                  id: "sent",
                  header: "Belum diterima",
                  cell: ({ row: r }) => qty(r.original.inTransitQuantity),
                },
                {
                  id: "accepted",
                  header: "Diterima",
                  cell: ({ row: r }) => (
                    <Input
                      required
                      aria-label={`Diterima ${r.original.stockLot.product.name}`}
                      inputMode="decimal"
                      value={accepted[r.original.id] ?? "0"}
                      onChange={(e) =>
                        setAccepted((v) => ({ ...v, [r.original.id]: e.target.value }))
                      }
                    />
                  ),
                },
                {
                  id: "difference",
                  header: "Selisih",
                  cell: ({ row: r }) => (
                    <Badge>
                      {difference(r.original.inTransitQuantity, accepted[r.original.id] ?? "0")}
                    </Badge>
                  ),
                },
              ]}
            />
            <p className="ob-muted">
              Jumlah yang belum diterima tetap dalam perjalanan. Retur fisik dicatat melalui proses
              retur.
            </p>
          </Panel>
          <Panel title="Bukti">
            <Upload purpose="POD" onChange={setProof} />
          </Panel>
        </>
      )}
      <Actions>
        <Button variant="outline" type="button" onClick={onDone}>
          Batal
        </Button>
        {stage === "picking" && (
          <Button
            disabled={pending}
            variant="outline"
            type="button"
            onClick={() => run(() => savePick(true))}
          >
            Simpan Draft
          </Button>
        )}
        {stage === "pod" && can("sales_invoice.post") && (
          <Button
            disabled={pending || !proof || !receiver.trim()}
            variant="outline"
            type="button"
            onClick={() => run(() => pod(true))}
          >
            Konfirmasi POD & buat draft Invoice
          </Button>
        )}
        <Button type="submit" disabled={pending || (stage === "pod" && !proof)}>
          {pending
            ? "Menyimpan…"
            : stage === "picking"
              ? "Konfirmasi picking"
              : stage === "checking"
                ? "Konfirmasi checking & terbitkan Packing List"
                : stage === "shipping"
                  ? "Simpan & dispatch"
                  : "Konfirmasi POD"}
        </Button>
      </Actions>
    </form>
  );
}

function ReturnForm({
  command,
  pending,
  onDone,
}: {
  command: Command;
  pending: boolean;
  onDone: (id: string) => void;
}) {
  const { principal } = useSession();
  const query = useQuery({
    queryKey: [
      "outbound",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      "return-sources",
    ],
    queryFn: () => apiRequest<{ data: Sources }>("/operations/return-sources"),
  });
  const [sourceId, setSourceId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [locators, setLocators] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const source = query.data?.data.receipts.find((s) => s.id === sourceId);
  return (
    <form
      className="ob-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!source) return;
        setError("");
        void (async () => {
          const lines = source.lines
            .filter((l) => new Decimal(quantities[l.id] || "0").gt(0))
            .map((l) => ({
              delivery_receipt_line_id: l.id,
              quantity: quantities[l.id],
              quarantine_locator_id: locators[l.id],
              batch_no: l.allocation.stockLot.batchNo,
            }));
          if (!lines.length) throw new Error("Isi jumlah retur pada minimal satu produk.");
          const r = await command(`/customers/${source.salesOrder.customerId}/returns`, {
            reason,
            lines,
          });
          onDone(r.data.id);
        })().catch((e) => setError(e instanceof Error ? e.message : String(e)));
      }}
    >
      {(error || query.error) && <ErrorBox message={error || String(query.error)} />}
      <Panel title="Dokumen asal">
        <SelectionField
          label="POD / Sales Order asal *"
          placeholder={query.isLoading ? "Memuat sumber…" : "Pilih dokumen penerimaan"}
          value={sourceId ? [sourceId] : []}
          onChange={(v) => {
            setSourceId(v[0] ?? "");
            setQuantities({});
            setLocators({});
          }}
          options={(query.data?.data.receipts ?? []).map((s) => ({
            id: s.id,
            name: `${s.salesOrder.number} · ${s.salesOrder.customer.name} · ${date(s.acceptedAt)}`,
          }))}
        />
        <p className="ob-muted">
          Menampilkan 250 penerimaan terbaru. Proses ini mencatat barang yang sudah diterima kembali
          secara fisik.
        </p>
      </Panel>
      <Panel title="Barang diretur">
        <DataTable
          data={source?.lines ?? []}
          total={source?.lines.length ?? 0}
          formTable
          showColumns={false}
          columns={[
            {
              id: "product",
              header: "Produk",
              cell: ({ row: r }) => r.original.allocation.stockLot.product.name,
            },
            {
              id: "batch",
              header: "Batch",
              cell: ({ row: r }) => r.original.allocation.stockLot.batchNo,
            },
            { accessorKey: "acceptedQuantity", header: "Diterima pelanggan" },
            {
              id: "returned",
              header: "Sudah diretur",
              cell: ({ row: r }) => total(r.original.returns.map((x) => x.quantity)),
            },
            {
              id: "quantity",
              header: "Qty retur",
              cell: ({ row: r }) => (
                <Input
                  aria-label={`Qty retur ${r.original.allocation.stockLot.product.name}`}
                  inputMode="decimal"
                  value={quantities[r.original.id] ?? "0"}
                  onChange={(e) =>
                    setQuantities((v) => ({ ...v, [r.original.id]: e.target.value }))
                  }
                />
              ),
            },
            {
              id: "locator",
              header: "Locator karantina",
              cell: ({ row: r }) => (
                <SelectionField
                  hideLabel
                  label={`Locator karantina ${r.original.allocation.stockLot.product.name}`}
                  value={locators[r.original.id] ? [locators[r.original.id]!] : []}
                  options={(query.data?.data.locators ?? [])
                    .filter((l) => l.warehouseId === r.original.allocation.stockLot.warehouseId)
                    .map((l) => ({ id: l.id, name: `${l.code} · ${l.name}` }))}
                  onChange={(v) => setLocators((old) => ({ ...old, [r.original.id]: v[0] ?? "" }))}
                />
              ),
            },
          ]}
        />
      </Panel>
      <Panel title="Catatan">
        <Field label="Alasan retur *">
          <Textarea
            required
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p className="ob-notice ob-good">
          Barang retur masuk karantina dan tidak langsung menambah stok layak jual.
        </p>
      </Panel>
      <Actions>
        <Button variant="outline" asChild>
          <Link href={href("returns")}>Batal</Link>
        </Button>
        <Button disabled={pending || !source}>Terima barang retur</Button>
      </Actions>
    </form>
  );
}
function ReturnDetail({ row }: { row: ReturnRow }) {
  return (
    <>
      <Progress stage="returns" />
      <div className="ob-detail-grid">
        <div className="ob-stack">
          <Panel title="Ringkasan">
            <dl className="ob-facts">
              <dt>Referensi</dt>
              <dd>{row.id.slice(0, 8).toUpperCase()}</dd>
              <dt>Pelanggan</dt>
              <dd>{row.customer.name}</dd>
              <dt>Alasan</dt>
              <dd>{row.reason}</dd>
              <dt>Status</dt>
              <dd>
                <Badge>{returnStatus(row.state)}</Badge>
              </dd>
              <dt>Dibuat</dt>
              <dd>{date(row.createdAt)}</dd>
            </dl>
          </Panel>
          <Panel title="Barang">
            <DataTable
              data={row.lines ?? []}
              total={row.lines?.length ?? 0}
              showColumns={false}
              columns={[
                {
                  id: "code",
                  header: "Kode",
                  cell: ({ row: r }) =>
                    r.original.deliveryReceiptLine.allocation.stockLot.product.code,
                },
                {
                  id: "name",
                  header: "Produk",
                  cell: ({ row: r }) =>
                    r.original.deliveryReceiptLine.allocation.stockLot.product.name,
                },
                { accessorKey: "batchNo", header: "Batch" },
                { accessorKey: "quantity", header: "Qty retur" },
                {
                  id: "locator",
                  header: "Karantina",
                  cell: ({ row: r }) => r.original.quarantineLocator.code,
                },
              ]}
            />
          </Panel>
        </div>
        <aside className="ob-stack">
          <Panel title="Putusan mutu">
            <p className="ob-notice">
              Barang tetap mengikuti status karantina. Alur keputusan mutu dan pemusnahan belum
              tersedia pada layar ini.
            </p>
            <Button variant="outline" disabled>
              Kembalikan ke stok layak
            </Button>
            <Button variant="outline" disabled>
              Musnahkan
            </Button>
          </Panel>
          <Panel title="Finance">
            <dl className="ob-facts">
              <dt>Invoice</dt>
              <dd>{row.salesInvoice?.number ?? "Belum ditautkan"}</dd>
              <dt>Credit note</dt>
              <dd>Diproses oleh Finance sesuai dokumen sumber</dd>
            </dl>
          </Panel>
        </aside>
      </div>
      <Actions>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer />
          Cetak Retur
        </Button>
      </Actions>
    </>
  );
}
