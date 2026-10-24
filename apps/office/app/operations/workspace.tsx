"use client";
import {
  SalesPeriod,
  SalesNavigation,
  SalesBadge,
  DocumentHandoff,
  HandoffStatus,
  InvoiceProgress,
} from "./sales-experience";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Printer, ArrowLeft } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProformaContents } from "./proforma";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import Decimal from "decimal.js";
import { formatMoney } from "@/lib/format";
import { SelectionField } from "@/components/web/selection-field";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { invoicePaymentStatus, invoiceDocumentNote } from "@/lib/invoice-status";
import { useSession } from "../session-provider";
import { DashboardSidebar } from "../dashboard-sidebar";
import { ExecutiveTopbar } from "../dashboard-executive";
import { DataTable } from "../crm/crm-common";
import "../crm/crm.css";
import "./workflow.css";
import "./sales-order.css";
import "./sales-order-modern.css";
import { Controls } from "./controls";
import { SalesExceptions, TaxComponents, FinanceWorkspace, Backorders } from "./extended-controls";

type Option = { id: string; name: string };
type Line = {
  id: string;
  product: { name: string };
  orderedQuantity: string;
  allocatedQuantity: string;
  backorderQuantity: string;
  unitPrice: string;
};
type Allocation = {
  id: string;
  quantity: string;
  inTransitQuantity: string;
  stockLot: {
    product: { name: string };
    batchNo: string;
    expiryDate?: string | null;
    locator?: { name: string; code: string };
  };
};
export type Row = {
  snapshot?: unknown;
  issuedSnapshot?: { version?: number; notes?: string; reference?: string };
  deliveryReceiptId?: string;
  handoff?: string;
  invoices?: { id: string; number: string; state: string }[];
  version: number;
  id: string;
  number: string;
  state: string;
  currency?: string;
  customer?: { name: string };
  salesOrder?: { number: string; customer?: { name: string }; deliveryAddress?: string };
  pickList?: {
    id: string;
    state: string;
    lines: { id: string; fulfillmentAllocationId: string; assignedQuantity: string }[];
  };
  createdAt?: string;
  customerId: string;
  lines?: Line[];
  fulfillments?: Row[];
  allocations?: Allocation[];
  deliveryReceipts?: {
    id: string;
    receiverName: string;
    evidenceId: string;
    invoices: { id: string; number: string }[];
  }[];
  deliveryReceipt?: {
    acceptedAt: string;
    receiverName?: string | null;
    lines: {
      acceptedQuantity: string;
      allocation: {
        salesOrderLine: {
          unitPrice: string;
          taxSnapshot?: unknown;
          product: { code: string; name: string; baseUom?: { name: string } | null };
          Uom?: { name: string } | null;
        };
      };
    }[];
  } | null;
  documents?: { id: string; kind: string; number: string; batchId?: string; status?: string }[];
  receipts?: {
    id: string;
    amount: string;
    unallocatedAmount: string;
    bankReference: string;
    evidenceId: string;
  }[];
  outstandingAmount?: string;
  subtotal?: string;
  taxAmount?: string | null;
  total?: string | null;
  description?: string;
  freightAmount?: string;
  freightTaxAmount?: string;
  postedAt?: string | null;
  dueDate?: string;
  document?: { id: string; snapshot: unknown };
  evidenceId?: string;
  customerReference?: string;
  deliveryAddress?: string;
  acceptedAt?: string;
  acceptedQuantity?: string;
  receiverName?: string;
  fulfillmentBatch?: { id: string; number: string };
  receiptLines?: {
    acceptedQuantity: string;
    allocation: {
      salesOrderLine: {
        unitPrice: string;
        taxSnapshot?: unknown;
        product: { code: string; name: string; baseUom?: { name: string } | null };
        Uom?: { name: string } | null;
      };
    };
  }[];
};
type Command = (path: string, body?: unknown) => Promise<{ data: Row }>;
const titles: Record<string, string> = {
  orders: "Sales Order",
  backorders: "Backorder & Sisa Pesanan",
  "warehouse-backorders": "Backorder & Alokasi Stok",
  "pick-slips": "Pick Slip",
  warehouse: "Pemenuhan & POD",
  returns: "Retur Pelanggan",
  invoices: "Invoice",
  "invoice-create": "Buat Invoice",
  documents: "Dokumen Transaksi",
};
function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("id-ID") : "—";
}
// Currency stays Rupiah (CFG-09); the argument is kept for existing call sites.
function money(value?: string | null, _currency = "IDR") {
  return value == null ? "—" : formatMoney(value);
}
export function ErrorBox({ message }: { message: string }) {
  const messages: Record<string, string> = {
    RECEIPT_ALLOCATION_EXCEEDED: "Jumlah alokasi melebihi sisa penerimaan atau sisa piutang.",
    CREDIT_HOLD:
      "Exposure pelanggan melebihi limit kredit. Hubungi Finance untuk meninjau kebijakannya.",
    CUSTOMER_PAST_DUE:
      "Pelanggan memiliki piutang lewat jatuh tempo. Selesaikan piutang sebelum melanjutkan pesanan.",
    CUSTOMER_CREDIT_FROZEN:
      "Kredit pelanggan sedang dibekukan. Finance perlu meninjau status kredit.",
    CUSTOMER_NOT_ACTIVE: "Pelanggan tidak aktif dan belum dapat diproses.",
    PRICE_EXCEPTION_APPROVAL_REQUIRED:
      "Harga berbeda dari acuan aktif. Ajukan harga khusus pada baris terkait sebelum memproses SO.",
    PRICE_POLICY_REQUIRED:
      "Harga acuan belum dikonfigurasi untuk produk, satuan, dan mata uang ini.",
    TAX_POLICY_REQUIRED:
      "Aturan pajak yang berlaku belum tersedia. Lengkapi konfigurasi sebelum submit.",
    PAYMENT_POLICY_REQUIRED: "Kebijakan pembayaran pelanggan belum tersedia.",
    STOCK_NOT_ELIGIBLE:
      "Stok sudah tidak layak dikirim. Periksa mutu, kedaluwarsa, gudang dan locator.",
    SHIPMENT_DETAILS_REQUIRED: "Simpan pengemudi dan kendaraan sebelum dispatch.",
    PREPAYMENT_REQUIRED: "Uang muka terkait pemenuhan belum mencukupi untuk dispatch.",
    TAX_POLICY_OVERLAP:
      "Aturan pajak pada cakupan dan masa berlaku ini sudah tersedia. Periksa riwayat aturan sebelum menambah versi baru.",
    REALLOCATION_COMMAND_REQUIRED: "Gunakan tindakan alokasi ulang dengan versi SO terbaru.",
    ORDER_VERSION_CHANGED:
      "SO sudah berubah. Muat ulang dan periksa perubahan sebelum mencoba lagi.",
    ORDER_STATE_OR_VERSION_CHANGED:
      "Status atau versi SO sudah berubah. Muat ulang dokumen sebelum melanjutkan.",
    REMAINDER_EXCEEDED_RELEASE_BATCH_FIRST:
      "Jumlah melebihi sisa bebas. Selesaikan pelepasan alokasi melalui gudang sebelum menutup sisa.",
    CUSTOMER_CANCELLATION_CONFIRMATION_REQUIRED:
      "Lengkapi pihak pelanggan, waktu, media, dan referensi konfirmasi pembatalan.",
    BANK_STATEMENT_DUPLICATE: "Mutasi ini sudah pernah diimpor. Buka rekonsiliasi yang tersimpan.",
    BANK_MATCH_AMOUNT_OR_ACCOUNT_MISMATCH:
      "Nominal pencocokan melebihi sisa mutasi/penerimaan, atau rekening tidak sama. Periksa nominal dan kandidat ERP.",
    BANK_RECONCILIATION_BLOCKED:
      "Rekonsiliasi belum dapat ditutup. Selesaikan baris yang belum cocok dan selisih saldo, lalu validasi kembali.",
    BANK_RECONCILIATION_PERIOD_CLOSED:
      "Tanggal penerimaan berada pada rekonsiliasi yang sudah ditutup.",
    FINANCE_PERIOD_NOT_OPEN: "Periode akuntansi untuk tanggal transaksi belum terbuka.",
    TAX_DOCUMENT_SOURCE_ALREADY_LINKED: "Dokumen sumber sudah memiliki faktur pajak aktif.",
    IDEMPOTENCY_PAYLOAD_MISMATCH:
      "Isi percobaan ulang berbeda dari transaksi sebelumnya. Muat ulang data dan periksa status transaksi.",
  };
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{messages[message] ?? message}</AlertDescription>
    </Alert>
  );
}
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = `field-${label.replaceAll(" ", "-")}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        type={type}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
export function Upload({ purpose, onChange }: { purpose: string; onChange: (id: string) => void }) {
  const uploadId = useId();
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Field>
      <FieldLabel htmlFor={uploadId}>Bukti dokumen (JPEG/PNG, maksimal 2 MB)</FieldLabel>
      <Input
        id={uploadId}
        type="file"
        accept="image/jpeg,image/png"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          onChange("");
          if (!file) return;
          if (file.size > 2097152) {
            setState("Ukuran melebihi 2 MB.");
            return;
          }
          setBusy(true);
          setState("Mengunggah bukti…");
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(",")[1]!);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const r = await apiRequest<{ data: { id: string } }>("/operations/evidence", {
              method: "POST",
              body: JSON.stringify({ purpose, name: file.name, base64 }),
            });
            onChange(r.data.id);
            setState(`Bukti tersimpan: ${file.name}`);
          } catch (error) {
            setState(error instanceof Error ? error.message : "Unggah gagal.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <p role="status">{state}</p>
    </Field>
  );
}
export function Evidence({ id }: { id?: string | undefined }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  if (!id) return <p>Bukti belum tersedia.</p>;
  return (
    <div>
      <Button
        variant="outline"
        type="button"
        onClick={async () => {
          try {
            const r = await apiRequest<{ data: { image: string } }>(`/operations/evidence/${id}`);
            setImage(r.data.image);
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        Lihat bukti
      </Button>
      {error && <ErrorBox message={error} />}
      {image && <img src={image} alt="Bukti transaksi tersimpan" className="otc-evidence" />}
    </div>
  );
}
const warehouseStageTitles: Record<string, string> = {
  picking: "Pick Slip",
  checking: "Checking / Packing",
  shipping: "Pengiriman",
  pod: "POD",
};

const outboundStages = [
  { key: "picking", label: "Picking", href: "/operations/pick-slips" },
  { key: "checking", label: "Checking / Packing", href: "/operations/warehouse?stage=checking" },
  { key: "shipping", label: "Pengiriman", href: "/operations/warehouse?stage=shipping" },
  { key: "pod", label: "POD", href: "/operations/warehouse?stage=pod" },
  { key: "returns", label: "Retur", href: "/operations/returns" },
] as const;

function outboundSubtitle(kind: string, stage?: string) {
  if (kind === "pick-slips") return "Antrean tindakan: siapkan dan konfirmasi pengambilan barang.";
  if (kind === "returns") return "Penerimaan dan penyelesaian barang retur pelanggan.";
  if (stage === "checking") return "Periksa hasil picking, lalu kemas dan terbitkan Packing List.";
  if (stage === "shipping") return "Siapkan pengemudi dan kendaraan, lalu dispatch Surat Jalan.";
  if (stage === "pod") return "Konfirmasi barang diterima pelanggan dan simpan bukti penerimaan.";
  return "Pantau pemenuhan barang keluar berdasarkan dokumen operasional.";
}

function OutboundSummary({
  kind,
  stage,
  rows,
  total,
}: {
  kind: string;
  stage?: string;
  rows: Row[];
  total: number;
}) {
  const cards =
    kind === "pick-slips"
      ? [
          [rows.filter((row) => !row.pickList).length, "Belum dibuat"],
          [rows.filter((row) => row.pickList?.state === "OPEN").length, "Siap diambil"],
          [
            rows.filter((row) => row.pickList?.state === "PICKED").length,
            "Sebagian / selesai diambil",
          ],
          [total, "Total antrean"],
        ]
      : stage === "checking"
        ? [
            [total, "Perlu dicek"],
            [rows.filter((row) => row.pickList?.state === "CHECKED").length, "Packing List terbit"],
            [rows.filter((row) => row.state === "CANCELLED").length, "Ditahan / dibatalkan"],
            [total, "Total antrean"],
          ]
        : stage === "shipping"
          ? [
              [total, "Siap disiapkan"],
              [rows.filter((row) => row.pickList?.state === "CHECKED").length, "Checking selesai"],
              [rows.filter((row) => row.state === "ALLOCATED").length, "Menunggu dispatch"],
              [total, "Total antrean"],
            ]
          : [
              [total, "Menunggu POD"],
              [
                rows.filter((row) => row.state === "PARTIALLY_DELIVERED").length,
                "Sebagian diterima",
              ],
              [rows.filter((row) => row.state === "DELIVERED").length, "Selesai"],
              [total, "Total antrean"],
            ];
  return (
    <div className="outbound-summary" aria-label="Ringkasan tugas outbound">
      {cards.map(([value, label]) => (
        <div className="outbound-summary-card" key={String(label)}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function OperationsWorkspace({ path, stage }: { path: string[]; stage?: string }) {
  const { principal, state } = useSession();
  const router = useRouter();
  const client = useQueryClient();
  const kind = path[0] ?? "orders",
    id = path[1],
    creating = id === "new",
    configuring = kind === "controls",
    invoiceCreation = kind === "invoice-create",
    financeControl = [
      "reconciliation",
      "accounting",
      "bank-statements",
      "tax-rules",
      "tax-documents",
    ].includes(kind);
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const keys = useRef(new Map<string, string>());
  const can = (permission: string) => !!principal && hasCompanyPermission(principal, permission);
  const permission =
    {
      orders: "sales_order.read",
      backorders: "sales_backorder.read",
      "warehouse-backorders": "warehouse_allocation.read",
      "pick-slips": "outbound_picking.read",
      warehouse: "outbound_checking.read",
      returns: "customer_return.receive",
      invoices: "sales_invoice.read",
      "invoice-create": "sales_invoice.issue",
      documents: "outbound_checking.read",
    }[kind] ?? "";
  const enabled =
    !!principal &&
    (configuring
      ? ["transaction_approval.manage", "inventory.quality.decide"].some(can)
      : financeControl
        ? can(
            (
              {
                accounting: "posting_profile.read",
                "bank-statements": "bank_statement.import",
                "tax-rules": "tax_rule.read",
                "tax-documents": "tax_component.read",
              } as Record<string, string>
            )[kind] ?? "bank_reconciliation.read",
          )
        : creating
          ? can("sales_order.create")
          : kind === "documents"
            ? ["sales_order.read", "outbound_checking.read", "sales_invoice.read"].some(can)
            : can(permission));
  const endpoint =
    kind === "documents"
      ? `/operations/documents/${id}`
      : invoiceCreation
        ? "/receivables/invoice-candidates"
        : id && !creating
          ? `/operations/${kind === "pick-slips" ? "warehouse" : kind}/${id}`
          : `/operations/${["backorders", "warehouse-backorders"].includes(kind) ? kind : `lists/${kind}`}?page=${page}&search=${encodeURIComponent(search)}${kind === "warehouse" && stage && warehouseStageTitles[stage] ? `&stage=${stage}` : ""}`;
  const [invoiceFilter, setInvoiceFilter] = useState("ALL");
  const query = useQuery({
    queryKey: ["operations", principal?.user_id, principal?.company_id, endpoint, invoiceFilter],
    queryFn: () =>
      apiRequest<{
        data: Row & {
          rows: Row[];
          total: number;
          snapshot: unknown;
          summary?: Record<string, number>;
        };
      }>(kind === "invoices" && !id ? `${endpoint}&view=${invoiceFilter}` : endpoint),
    enabled:
      enabled &&
      !creating &&
      !configuring &&
      !financeControl &&
      !invoiceCreation &&
      !["backorders", "warehouse-backorders", "returns"].includes(kind),
  });
  const candidateQuery = useQuery({
    queryKey: ["operations", principal?.user_id, principal?.company_id, "invoice-candidates"],
    queryFn: () => apiRequest<{ data: Row[] }>("/receivables/invoice-candidates"),
    enabled:
      enabled && (invoiceCreation || (kind === "invoices" && !id && can("sales_invoice.issue"))),
  });
  const command: Command = async (url, body = {}) => {
    const fingerprint = `${url}:${JSON.stringify(body)}`;
    let key = keys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(fingerprint, key);
    }
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<{ data: Row }>(url, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
      keys.current.delete(fingerprint);
      await client.invalidateQueries({ queryKey: ["operations"] });
      const evaluationError = (result as { data?: { evaluation_error?: string } }).data
        ?.evaluation_error;
      if (evaluationError) {
        setError(`Persetujuan tersimpan, tetapi SO belum diproses: ${evaluationError}`);
        toast.warning("Persetujuan tersimpan; evaluasi SO belum selesai.");
      } else toast.success("Transaksi tersimpan.");
      return result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Transaksi belum terkonfirmasi. Coba lagi dengan isian yang sama.",
      );
      throw e;
    } finally {
      setPending(false);
    }
  };
  const invoke = (url: string, body?: unknown) => {
    void command(url, body).catch(() => undefined);
  };
  if (!principal)
    return (
      <main>
        <p role="status">
          {state === "loading" ? "Memuat sesi…" : "Silakan masuk untuk mengakses transaksi."}
        </p>
        <Link href="/login">Masuk</Link>
      </main>
    );
  const row = query.data?.data;
  const proformaDocument =
    kind === "documents" && (row as { kind?: string } | undefined)?.kind === "PROFORMA";
  const outboundView = ["warehouse", "pick-slips", "returns"].includes(kind);
  const outboundStage =
    kind === "pick-slips"
      ? "picking"
      : kind === "returns"
        ? "returns"
        : kind === "warehouse"
          ? stage && warehouseStageTitles[stage]
            ? stage
            : "checking"
          : undefined;
  const stageQuery =
    kind === "warehouse" && stage && warehouseStageTitles[stage] ? `?stage=${stage}` : "";
  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "number",
      header:
        kind === "invoices"
          ? "No. Invoice"
          : kind === "pick-slips"
            ? "Tahap pemenuhan"
            : "Nomor dokumen",
      cell: ({ row: r }) => (
        <Link
          className="text-primary underline"
          href={`/operations/${kind === "pick-slips" ? "warehouse" : kind}/${r.original.id}${stageQuery}`}
        >
          {r.original.number}
        </Link>
      ),
    },
    {
      id: "customer",
      header: "Pelanggan",
      cell: ({ row: r }) =>
        r.original.customer?.name ?? r.original.salesOrder?.customer?.name ?? "—",
    },
    ...(outboundView
      ? [
          {
            id: "salesOrder",
            header: "Sales Order",
            cell: ({ row: r }: { row: { original: Row } }) => r.original.salesOrder?.number ?? "—",
          },
        ]
      : []),
    ...(kind === "invoices"
      ? [
          {
            id: "handoff",
            header: "Tukar faktur",
            cell: ({ row: r }: { row: { original: Row } }) => (
              <SalesBadge>{r.original.handoff ?? "Belum terverifikasi"}</SalesBadge>
            ),
          },
        ]
      : []),
    ...(kind !== "invoices" && kind !== "warehouse"
      ? [
          {
            accessorKey: "state",
            header: "Status",
            cell: ({ row: r }: { row: { original: Row } }) => (
              <Badge variant="outline">{r.original.state}</Badge>
            ),
          },
        ]
      : []),
    ...(kind === "invoices"
      ? [
          {
            id: "createdAt",
            header: "Tanggal dibuat",
            cell: ({ row: r }: { row: { original: Row } }) => formatDate(r.original.createdAt),
          },
          {
            id: "dueDate",
            header: "Tanggal Jatuh tempo",
            cell: ({ row: r }: { row: { original: Row } }) => formatDate(r.original.dueDate),
          },
          {
            id: "invoiceState",
            header: "Status",
            cell: ({ row: r }: { row: { original: Row } }) => {
              const status = invoicePaymentStatus(r.original);
              return (
                <Badge
                  variant="outline"
                  className="so-status"
                  data-state={status ?? undefined}
                  title={
                    invoiceDocumentNote(r.original.state) ??
                    "Status pembayaran berdasarkan sisa tagihan"
                  }
                >
                  {status ?? "—"}
                </Badge>
              );
            },
          },
          {
            id: "outstandingAmount",
            header: "Sisa Tagihan",
            cell: ({ row: r }: { row: { original: Row } }) =>
              money(r.original.outstandingAmount, r.original.currency),
          },
          {
            id: "total",
            header: "Total Tagihan",
            cell: ({ row: r }: { row: { original: Row } }) =>
              money(r.original.total, r.original.currency),
          },
          {
            id: "description",
            header: "Keterangan",
            cell: ({ row: r }: { row: { original: Row } }) =>
              invoiceDocumentNote(r.original.state) ??
              r.original.description ??
              "Belum terverifikasi",
          },
        ]
      : []),
    ...(kind === "warehouse"
      ? [
          ...(stage === "checking"
            ? [
                {
                  id: "pickedQuantity",
                  header: "Diambil",
                  cell: ({ row: r }: { row: { original: Row } }) =>
                    r.original.pickList?.lines?.length ?? "—",
                },
              ]
            : []),
          ...(stage === "shipping"
            ? [
                {
                  id: "shipmentRequirement",
                  header: "Syarat kirim",
                  cell: ({ row: r }: { row: { original: Row } }) =>
                    r.original.pickList?.state === "CHECKED" ? "Lengkap" : "Belum lengkap",
                },
              ]
            : []),
          ...(stage === "pod"
            ? [
                {
                  id: "podStatus",
                  header: "Status POD",
                  cell: ({ row: r }: { row: { original: Row } }) =>
                    r.original.state === "PARTIALLY_DELIVERED"
                      ? "Sebagian diterima"
                      : "Menunggu POD",
                },
              ]
            : []),
          {
            id: "stageState",
            header:
              stage === "checking"
                ? "Status checking"
                : stage === "shipping"
                  ? "Status pengiriman"
                  : "Status POD",
            cell: ({ row: r }: { row: { original: Row } }) => (
              <Badge variant="outline">
                {stage === "checking"
                  ? r.original.pickList?.state === "CHECKED"
                    ? "Packing List terbit"
                    : "Perlu dicek"
                  : stage === "shipping"
                    ? r.original.state === "DISPATCHED"
                      ? "Dalam perjalanan"
                      : "Siap dikirim"
                    : r.original.state === "PARTIALLY_DELIVERED"
                      ? "Sebagian diterima"
                      : "Menunggu POD"}
              </Badge>
            ),
          },
          {
            id: "action",
            header: "Tindakan",
            cell: ({ row: r }: { row: { original: Row } }) => (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/operations/warehouse/${r.original.id}${stageQuery}`}>
                  {stage === "checking"
                    ? "Periksa barang"
                    : stage === "shipping"
                      ? "Siapkan pengiriman"
                      : stage === "pod"
                        ? "Buka penerimaan"
                        : "Buka detail"}
                </Link>
              </Button>
            ),
          },
        ]
      : []),
    ...(kind === "pick-slips"
      ? [
          {
            id: "pickState",
            header: "Status picking",
            cell: ({ row: r }: { row: { original: Row } }) => (
              <Badge variant="outline">{r.original.pickList?.state ?? "Belum dibuat"}</Badge>
            ),
          },
          {
            id: "action",
            header: "Tindakan",
            cell: ({ row: r }: { row: { original: Row } }) => {
              if (!r.original.pickList && r.original.state === "ALLOCATED") {
                return can("fulfillment.pick") ? (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => invoke(`/fulfillment-batches/${r.original.id}/create-picking`)}
                  >
                    Buat Pick Slip
                  </Button>
                ) : (
                  <Badge variant="outline">Menunggu tindakan</Badge>
                );
              }
              const actionLabel =
                r.original.pickList?.state === "OPEN"
                  ? "Mulai picking"
                  : r.original.pickList?.state === "PICKED"
                    ? "Lanjutkan"
                    : r.original.pickList?.state === "CHECKED"
                      ? "Lihat Pick Slip"
                      : "Buka Pick Slip";
              return (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/operations/warehouse/${r.original.id}?stage=picking`}>
                    {actionLabel}
                  </Link>
                </Button>
              );
            },
          },
        ]
      : []),
  ];
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <DashboardSidebar
        principal={principal}
        {...(outboundStage ? { outboundStage } : {})}
        activeView={
          ["warehouse", "pick-slips", "warehouse-backorders", "returns"].includes(kind)
            ? "warehouse"
            : kind === "invoices"
              ? "finance"
              : "sales"
        }
        activeSection={
          ["orders", "backorders"].includes(kind) || proformaDocument
            ? "sales"
            : ["warehouse", "pick-slips", "warehouse-backorders", "returns"].includes(kind)
              ? "warehouse"
              : configuring
                ? "setting"
                : "finance"
        }
      />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        <main
          className={`executive-content crm-content otc-workspace ${["invoices", "invoice-create"].includes(kind) ? "so-workspace sales-sketch" : ""}`}
        >
          <header className="executive-heading">
            <div>
              <nav className="executive-breadcrumb" aria-label="Breadcrumb">
                {["orders", "backorders"].includes(kind) || proformaDocument
                  ? "Sales & Marketing / Pesanan Pelanggan"
                  : ["warehouse", "pick-slips", "warehouse-backorders", "returns"].includes(kind)
                    ? "Warehouse & Logistik / Barang Keluar"
                    : kind.startsWith("tax-")
                      ? "Finance / Pajak"
                      : kind === "accounting"
                        ? "Finance / Akuntansi"
                        : ["reconciliation", "bank-statements"].includes(kind)
                          ? "Finance / Kas & Bank"
                          : configuring
                            ? "Setting / Kontrol transaksi"
                            : "Finance / Piutang (AR)"}
              </nav>
              <h1>
                {configuring
                  ? "Kontrol transaksi"
                  : financeControl
                    ? {
                        reconciliation: "Rekonsiliasi",
                        accounting: "Pengaturan Jurnal Otomatis",
                        "bank-statements": "Impor Mutasi Bank",
                        "tax-rules": "Profil & Aturan Pajak",
                        "tax-documents": "Faktur Keluaran",
                      }[kind]
                    : creating
                      ? "Buat Sales Order"
                      : (row?.number ??
                        (kind === "warehouse" && stage ? warehouseStageTitles[stage] : undefined) ??
                        titles[kind] ??
                        "Halaman tidak ditemukan")}
              </h1>
              {kind === "invoices" && (
                <p>
                  {id
                    ? `Jatuh tempo ${formatDate(row?.dueDate)} · sesuai POD dan termin`
                    : "Invoice dan piutang pelanggan."}
                </p>
              )}
              {outboundView && (
                <p className="outbound-page-subtitle">{outboundSubtitle(kind, stage)}</p>
              )}
            </div>
            <div className="crm-actions">
              {id && kind !== "invoices" && (
                <Button variant="outline" asChild>
                  <Link
                    href={`/operations/${proformaDocument ? "proformas" : kind === "documents" ? "warehouse" : kind}${stageQuery}`}
                  >
                    <ArrowLeft />
                    Kembali
                  </Link>
                </Button>
              )}
              {!id && kind === "orders" && can("sales_order.create") && (
                <Button asChild>
                  <Link href="/operations/orders/new">
                    <Plus />
                    Buat Sales Order
                  </Link>
                </Button>
              )}
            </div>
            {["invoices", "invoice-create"].includes(kind) && <SalesNavigation active="invoices" />}
          </header>
          {outboundView && (
            <nav className="outbound-stage-nav" aria-label="Tahap Barang Keluar">
              {outboundStages.map((item, index) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="outbound-stage-link"
                  aria-current={outboundStage === item.key ? "page" : undefined}
                >
                  <span className="outbound-stage-index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          )}
          {kind === "invoices" && id && (
            <Button className="sales-back" variant="outline" asChild>
              <Link href="/operations/invoices">← Kembali ke daftar</Link>
            </Button>
          )}
          {outboundView && !id && kind !== "returns" && (
            <OutboundSummary
              kind={kind}
              {...(stage ? { stage } : {})}
              rows={row?.rows ?? []}
              total={row?.total ?? 0}
            />
          )}
          {!id &&
            kind === "invoices" &&
            can("sales_invoice.read") &&
            !can("sales_invoice.post") && (
              <Alert className="mb-4">
                <AlertDescription>
                  Anda dapat melihat Invoice, tetapi belum memiliki izin membuat Invoice. Hubungi
                  Administrator atau Finance Supervisor untuk mengaktifkan tindakan ini.
                </AlertDescription>
              </Alert>
            )}
          {kind === "invoices" && !id && enabled && (
            <>
              <div className="sales-list-tabs" aria-label="Antrean Invoice">
                {[
                  ["ALL", "Semua"],
                  ["HANDOFF", "Perlu tukar faktur"],
                  ["OVERDUE", "Jatuh tempo"],
                  ["PARTIAL", "Dibayar sebagian"],
                  ["PAID", "Lunas"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={invoiceFilter === value}
                    onClick={() => {
                      setInvoiceFilter(value!);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="so-kpis">
                {[
                  ["HANDOFF", "Perlu tukar faktur"],
                  ["OVERDUE", "Jatuh tempo"],
                  ["PAID", "Lunas"],
                ].map(([key, label]) => (
                  <Panel key={key} title={label!}>
                    <strong className="sales-kpi-number">
                      {key === "READY"
                        ? candidateQuery.data?.data
                          ? `${candidateQuery.data.data.length}${candidateQuery.data.data.length === 100 ? "+" : ""}`
                          : "—"
                        : (query.data?.data.summary?.[key!] ?? "—")}
                    </strong>
                  </Panel>
                ))}
              </div>
            </>
          )}
          {!enabled ? (
            <ErrorBox message="Izin Anda belum mencukupi untuk layar ini." />
          ) : (
            <>
              {(error || query.error || candidateQuery.error) && (
                <ErrorBox message={error || String(query.error || candidateQuery.error)} />
              )}
              {query.isFetching && <p role="status">Memuat data terbaru…</p>}
              {invoiceCreation ? (
                <InvoiceCreation
                  rows={candidateQuery.data?.data ?? []}
                  pending={pending}
                  command={command}
                  onCreated={() => router.push("/operations/invoices")}
                />
              ) : ["backorders", "warehouse-backorders"].includes(kind) ? (
                <Backorders
                  can={can}
                  command={command}
                  pending={pending}
                  warehouse={kind === "warehouse-backorders"}
                />
              ) : financeControl ? (
                <FinanceWorkspace
                  kind={kind}
                  id={id}
                  can={can}
                  command={command}
                  pending={pending}
                />
              ) : configuring ? (
                <Controls can={can} command={command} pending={pending} />
              ) : creating ? (
                <OrderForm
                  command={command}
                  pending={pending}
                  onCreated={(id) => router.push(`/operations/orders/${id}`)}
                />
              ) : kind === "returns" ? (
                <CustomerReturnForm command={command} pending={pending} />
              ) : !id ? (
                <section className={kind === "invoices" ? "sales-list-panel" : undefined}>
                  {kind === "invoices" && <h2>Daftar Invoice</h2>}
                  <DataTable
                    data={row?.rows ?? []}
                    columns={
                      kind === "invoices"
                        ? [
                            ...[
                              "number",
                              "customer",
                              "dueDate",
                              "total",
                              "outstandingAmount",
                              "invoiceState",
                              "handoff",
                            ]
                              .map(
                                (key) =>
                                  columns.find(
                                    (c) =>
                                      c.id === key || ("accessorKey" in c && c.accessorKey === key),
                                  )!,
                              )
                              .filter(Boolean),
                            {
                              id: "open",
                              header: "Tindakan",
                              cell: ({ row: r }) => (
                                <Button variant="outline" asChild>
                                  <Link href={`/operations/invoices/${r.original.id}`}>Buka</Link>
                                </Button>
                              ),
                            },
                          ]
                        : columns
                    }
                    showColumns={kind !== "invoices"}
                    total={row?.total ?? 0}
                    page={page}
                    onPage={setPage}
                    busy={query.isFetching}
                    label={
                      (kind === "warehouse" && stage ? warehouseStageTitles[stage] : undefined) ??
                      titles[kind] ??
                      "Transaksi"
                    }
                    toolbar={
                      <div className="outbound-toolbar">
                        {kind !== "invoices" && (
                          <span className="outbound-queue-label">
                            Antrean tindakan ({row?.total ?? 0})
                          </span>
                        )}
                        <Input
                          aria-label={
                            kind === "invoices"
                              ? "Cari nomor Invoice atau pelanggan"
                              : "Cari nomor tahap, sales order, atau pelanggan"
                          }
                          placeholder={
                            kind === "invoices"
                              ? "Cari nomor Invoice atau pelanggan"
                              : "Cari No. tahap, SO, atau pelanggan"
                          }
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                          }}
                        />
                        {kind === "invoices" && (
                          <SelectionField
                            label="Status Invoice"
                            hideLabel
                            value={[invoiceFilter]}
                            options={[
                              { id: "ALL", name: "Semua status" },
                              { id: "UNPAID", name: "Belum dibayar" },
                              { id: "PARTIAL", name: "Dibayar sebagian" },
                              { id: "PAID", name: "Lunas" },
                            ]}
                            onChange={(v) => {
                              setInvoiceFilter(v[0] ?? "ALL");
                              setPage(1);
                            }}
                          />
                        )}
                        {kind === "invoices" && <SalesPeriod />}
                        {!id && kind === "invoices" && can("sales_invoice.issue") && (
                          <Button asChild>
                            <Link href="/operations/invoice-create">
                              <Plus />
                              Buat Invoice
                            </Link>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSearch("");
                            setPage(1);
                          }}
                          disabled={!search}
                        >
                          Reset filter
                        </Button>
                      </div>
                    }
                  />
                </section>
              ) : (
                row && (
                  <>
                    {kind === "orders" && (
                      <>
                        <Panel title="Informasi pesanan">
                          <p>
                            {row.customer?.name} · {row.state}
                          </p>
                          <p>Referensi: {row.customerReference}</p>
                          <p>{row.deliveryAddress}</p>
                          <Evidence id={row.evidenceId} />
                          {row.documents?.map((doc) => (
                            <Link
                              key={doc.id}
                              className="text-primary underline"
                              href={`/operations/documents/${doc.id}`}
                            >
                              {doc.number}
                            </Link>
                          ))}
                        </Panel>
                        <DataTable
                          data={row.lines ?? []}
                          total={row.lines?.length ?? 0}
                          columns={[
                            {
                              id: "product",
                              header: "Produk",
                              cell: ({ row: r }) => r.original.product.name,
                            },
                            { accessorKey: "orderedQuantity", header: "Dipesan" },
                            { accessorKey: "allocatedQuantity", header: "Dialokasikan" },
                            { accessorKey: "backorderQuantity", header: "Backorder" },
                            { accessorKey: "unitPrice", header: "Harga satuan" },
                          ]}
                        />
                        {row.state === "DRAFT" && can("sales_order.submit") && (
                          <Button
                            disabled={pending}
                            onClick={() => invoke(`/sales-orders/${id}/submit`)}
                          >
                            Submit & periksa kelayakan
                          </Button>
                        )}
                        {row.state === "OPEN" && can("sales_order.reallocate") && (
                          <Button
                            disabled={pending}
                            onClick={() =>
                              invoke(`/operations/orders/${row.id}/reallocate`, {
                                version: row.version,
                              })
                            }
                          >
                            Evaluasi & alokasikan backorder
                          </Button>
                        )}
                        <SalesExceptions row={row} command={command} pending={pending} can={can} />
                        <Panel title="Pemenuhan">
                          {row.fulfillments?.length ? (
                            row.fulfillments.map((b) => (
                              <p key={b.id}>
                                <Link
                                  href={`/operations/warehouse/${b.id}`}
                                  className="text-primary underline"
                                >
                                  {b.number}
                                </Link>{" "}
                                · {b.state}
                              </p>
                            ))
                          ) : (
                            <p>Belum ada pemenuhan. Backorder memerlukan tindak lanjut logistik.</p>
                          )}
                        </Panel>
                      </>
                    )}
                    {(["warehouse", "pick-slips"] as string[]).includes(kind) && (
                      <Warehouse
                        key={row.id}
                        row={row}
                        command={command}
                        pending={pending}
                        can={can}
                        stage={kind === "pick-slips" ? "picking" : (stage ?? "checking")}
                      />
                    )}
                    {kind === "invoices" && (
                      <Invoice
                        key={row.id}
                        row={row}
                        command={command}
                        pending={pending}
                        can={can}
                      />
                    )}
                    {kind === "documents" && (
                      <Panel title={row.number}>
                        <Button variant="outline" onClick={() => window.print()}>
                          <Printer />
                          Cetak
                        </Button>
                        <div className="otc-printable">
                          <h2>{row.number}</h2>
                          <DocumentValue value={row.snapshot} />
                        </div>
                      </Panel>
                    )}
                    {can("audit_event.read") && <Audit id={id} />}
                  </>
                )
              )}
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
function OrderForm({
  command,
  pending,
  onCreated,
}: {
  command: Command;
  pending: boolean;
  onCreated: (id: string) => void;
}) {
  const { principal } = useSession();
  const lookup = useQuery({
    queryKey: ["operations", principal?.user_id, principal?.company_id, "lookups"],
    queryFn: () =>
      apiRequest<{ data: { customers: Option[]; products: Option[] } }>("/operations/lookups"),
  });
  const [customer, setCustomer] = useState(""),
    [reference, setReference] = useState(""),
    [address, setAddress] = useState(""),
    [proof, setProof] = useState("");
  const [lines, setLines] = useState([{ product_id: "", quantity: "", unit_price: "" }]);
  const change = (index: number, field: string, value: string) =>
    setLines((old) => old.map((line, n) => (n === index ? { ...line, [field]: value } : line)));
  return (
    <form
      className="web-form"
      onSubmit={(e) => {
        e.preventDefault();
        void command("/sales-orders", {
          customer_id: customer,
          customer_reference: reference,
          delivery_address: address,
          evidence_id: proof,
          currency: "IDR",
          lines,
        })
          .then((r) => onCreated(r.data.id))
          .catch(() => undefined);
      }}
    >
      {lookup.error && <ErrorBox message={String(lookup.error)} />}
      <Panel title="Informasi utama">
        <FieldGroup>
          <SelectionField
            label="Pelanggan"
            options={lookup.data?.data.customers ?? []}
            value={customer ? [customer] : []}
            onChange={(v) => setCustomer(v[0] ?? "")}
          />
          <TextField label="Referensi SP pelanggan" value={reference} onChange={setReference} />
          <TextField label="Alamat pengiriman" value={address} onChange={setAddress} />
          <Upload purpose="SALES_ORDER" onChange={setProof} />
        </FieldGroup>
      </Panel>
      <Panel title="Detail pesanan">
        <DataTable
          formTable
          showColumns={false}
          data={lines.map((l, index) => ({ ...l, index }))}
          total={lines.length}
          columns={[
            {
              id: "product",
              header: "Produk",
              cell: ({ row }) => (
                <SelectionField
                  label="Produk"
                  options={lookup.data?.data.products ?? []}
                  value={row.original.product_id ? [row.original.product_id] : []}
                  onChange={(v) => change(row.index, "product_id", v[0] ?? "")}
                />
              ),
            },
            {
              id: "qty",
              header: "Kuantitas",
              cell: ({ row }) => (
                <Input
                  required
                  inputMode="decimal"
                  aria-label={`Kuantitas baris ${row.index + 1}`}
                  value={row.original.quantity}
                  onChange={(e) => change(row.index, "quantity", e.target.value)}
                />
              ),
            },
            {
              id: "price",
              header: "Harga satuan",
              cell: ({ row }) => (
                <Input
                  required
                  inputMode="decimal"
                  aria-label={`Harga baris ${row.index + 1}`}
                  value={row.original.unit_price}
                  onChange={(e) => change(row.index, "unit_price", e.target.value)}
                />
              ),
            },
            {
              id: "remove",
              header: "Aksi",
              cell: ({ row }) => (
                <Button
                  type="button"
                  variant="outline"
                  disabled={lines.length === 1}
                  onClick={() => setLines((old) => old.filter((_, n) => n !== row.index))}
                >
                  Hapus
                </Button>
              ),
            },
          ]}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setLines([...lines, { product_id: "", quantity: "", unit_price: "" }])}
        >
          <Plus />
          Tambah produk
        </Button>
        <p>Harga, pajak, kredit, dan ketersediaan diverifikasi server saat submit.</p>
      </Panel>
      <Button disabled={pending || !proof || !customer} type="submit">
        {pending ? "Menyimpan…" : "Simpan draft"}
      </Button>
    </form>
  );
}
function Warehouse({
  row,
  command,
  pending,
  can,
  stage,
}: {
  row: Row;
  command: Command;
  pending: boolean;
  can: (p: string) => boolean;
  stage?: string;
}) {
  const isChecking = stage === "checking";
  const isPicking = stage === "picking";
  const isShipping = stage === "shipping";
  const isPod = stage === "pod";
  const canManualInvoice = row.state === "ALLOCATED" && can("sales_invoice.issue");
  const [driver, setDriver] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [receiver, setReceiver] = useState(""),
    [proof, setProof] = useState("");
  const [accepted, setAccepted] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [checkCondition, setCheckCondition] = useState<Record<string, string>>({});
  const [packageCount, setPackageCount] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [packageType, setPackageType] = useState("Dus");
  const [packingNotes, setPackingNotes] = useState("");
  const [labelAttached, setLabelAttached] = useState(false);
  const [freightEnabled, setFreightEnabled] = useState(false),
    [freightAmount, setFreightAmount] = useState(""),
    [freightTaxable, setFreightTaxable] = useState(false);
  const run = (url: string, data?: unknown) => {
    void command(url, data).catch(() => undefined);
  };
  useEffect(() => {
    if (!row.pickList) return;
    setPicked(
      Object.fromEntries(row.pickList.lines.map((line) => [line.id, line.assignedQuantity])),
    );
  }, [row.pickList]);
  return (
    <>
      <Panel
        title={
          isChecking
            ? "Dokumen Checking / Packing"
            : isShipping
              ? "Dokumen Pengiriman"
              : isPod
                ? "Dokumen POD"
                : "Dokumen Pemenuhan"
        }
      >
        <p>
          {row.salesOrder?.number} · {row.salesOrder?.customer?.name} · {row.state}
        </p>
        <p>{row.salesOrder?.deliveryAddress}</p>
      </Panel>
      {isPicking ? (
        <form
          className="web-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!row.pickList) return;
            run(`/pick-lists/${row.pickList.id}/confirm-pick`, {
              lines: row.pickList.lines.map((line) => ({
                pick_list_line_id: line.id,
                picked_quantity: picked[line.id] ?? "0",
              })),
            });
          }}
        >
          <Panel title="Barang yang diambil">
            <DataTable
              formTable
              showColumns={false}
              data={(row.allocations ?? []).map((allocation) => ({
                ...allocation,
                pickLine: row.pickList?.lines.find(
                  (line) => line.fulfillmentAllocationId === allocation.id,
                ),
              }))}
              total={row.allocations?.length ?? 0}
              columns={[
                {
                  id: "product",
                  header: "Produk",
                  cell: ({ row: r }) => r.original.stockLot.product.name,
                },
                {
                  id: "batch",
                  header: "Batch · ED",
                  cell: ({ row: r }) =>
                    `${r.original.stockLot.batchNo} · ${r.original.stockLot.expiryDate?.slice(0, 7) ?? "—"}`,
                },
                {
                  id: "locator",
                  header: "Locator",
                  cell: ({ row: r }) => r.original.stockLot.locator?.code ?? "—",
                },
                { accessorKey: "quantity", header: "Alokasi" },
                {
                  id: "picked",
                  header: "Diambil",
                  cell: ({ row: r }) => (
                    <Input
                      inputMode="decimal"
                      aria-label={`Jumlah diambil ${r.original.stockLot.product.name}`}
                      value={picked[r.original.pickLine?.id ?? ""] ?? ""}
                      onChange={(event) =>
                        setPicked((old) => ({
                          ...old,
                          [r.original.pickLine?.id ?? ""]: event.target.value,
                        }))
                      }
                      disabled={!r.original.pickLine || row.pickList?.state !== "OPEN"}
                    />
                  ),
                },
                {
                  id: "difference",
                  header: "Selisih",
                  cell: ({ row: r }) => (
                    <Badge variant="outline">
                      {r.original.pickLine &&
                      picked[r.original.pickLine.id] === r.original.pickLine.assignedQuantity
                        ? "Sesuai"
                        : "Perlu ditinjau"}
                    </Badge>
                  ),
                },
              ]}
            />
            <p className="so-help">
              Jumlah diambil tidak boleh melebihi alokasi. Selisih membutuhkan tindak lanjut sesuai
              aturan backorder.
            </p>
          </Panel>
          <div className="so-footer so-detail-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setPicked(
                  Object.fromEntries(
                    (row.pickList?.lines ?? []).map((line) => [line.id, line.assignedQuantity]),
                  ),
                )
              }
            >
              Isi semua sesuai alokasi
            </Button>
            <Button
              type="submit"
              disabled={pending || !row.pickList || row.pickList.state !== "OPEN"}
            >
              Konfirmasi picking
            </Button>
          </div>
        </form>
      ) : (
        <DataTable
          data={row.allocations ?? []}
          total={row.allocations?.length ?? 0}
          columns={[
            {
              id: "product",
              header: "Produk",
              cell: ({ row: r }) => r.original.stockLot.product.name,
            },
            { id: "batch", header: "Batch", cell: ({ row: r }) => r.original.stockLot.batchNo },
            { accessorKey: "quantity", header: "Dialokasikan" },
            { accessorKey: "inTransitQuantity", header: "Dalam perjalanan" },
          ]}
        />
      )}
      {isChecking && (
        <form
          className="web-form"
          onSubmit={(event) => {
            event.preventDefault();
            run(`/pick-lists/${row.pickList!.id}/confirm-check`, {
              checks: (row.pickList?.lines ?? []).map((line) => ({
                pick_list_line_id: line.id,
                condition: checkCondition[line.id] ?? "BAIK",
              })),
              packing: {
                package_count: packageCount || undefined,
                total_weight_kg: totalWeight || undefined,
                package_type: packageType || undefined,
                notes: packingNotes || undefined,
                label_attached: labelAttached,
              },
            });
          }}
        >
          <Panel title="Checking & Packing">
            <p className="so-help">
              Checking memverifikasi hasil picking. Packing List diterbitkan server setelah jumlah
              picking lengkap.
            </p>
            <DataTable
              formTable
              showColumns={false}
              data={(row.allocations ?? []).map((allocation) => ({
                ...allocation,
                pickLine: row.pickList?.lines.find(
                  (line) => line.fulfillmentAllocationId === allocation.id,
                ),
              }))}
              total={row.allocations?.length ?? 0}
              columns={[
                {
                  id: "product",
                  header: "Produk",
                  cell: ({ row: r }) => r.original.stockLot.product.name,
                },
                {
                  id: "picked",
                  header: "Diambil",
                  cell: ({ row: r }) => r.original.pickLine?.assignedQuantity ?? "—",
                },
                {
                  id: "checked",
                  header: "Dicek",
                  cell: ({ row: r }) => r.original.pickLine?.assignedQuantity ?? "—",
                },
                {
                  id: "condition",
                  header: "Kondisi",
                  cell: ({ row: r }) => (
                    <select
                      aria-label={`Kondisi ${r.original.stockLot.product.name}`}
                      value={checkCondition[r.original.pickLine?.id ?? ""] ?? "BAIK"}
                      onChange={(event) =>
                        setCheckCondition((old) => ({
                          ...old,
                          [r.original.pickLine?.id ?? ""]: event.target.value,
                        }))
                      }
                    >
                      <option value="BAIK">Baik</option>
                      <option value="RUSAK">Rusak</option>
                      <option value="KURANG">Kurang</option>
                    </select>
                  ),
                },
              ]}
            />
            <div className="otc-form-grid">
              <TextField label="Jumlah koli" value={packageCount} onChange={setPackageCount} />
              <TextField label="Berat total (kg)" value={totalWeight} onChange={setTotalWeight} />
              <TextField label="Jenis kemasan" value={packageType} onChange={setPackageType} />
              <TextField label="Catatan packing" value={packingNotes} onChange={setPackingNotes} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={labelAttached}
                onChange={(event) => setLabelAttached(event.target.checked)}
              />{" "}
              Label koli sudah ditempel
            </label>
            <Button
              type="submit"
              disabled={pending || !row.pickList || row.pickList.state !== "PICKED"}
            >
              Konfirmasi checking & terbitkan Packing List
            </Button>
          </Panel>
          <div className="crm-actions">
            {row.state === "ALLOCATED" && !row.pickList && can("fulfillment.pick") && (
              <Button
                disabled={pending}
                onClick={() => run(`/fulfillment-batches/${row.id}/create-picking`)}
              >
                Buat Picking Slip
              </Button>
            )}
            {row.pickList?.state === "OPEN" && can("fulfillment.pick") && (
              <Button
                disabled={pending}
                onClick={() =>
                  run(`/pick-lists/${row.pickList!.id}/confirm-pick`, {
                    lines: row.pickList!.lines.map((l) => ({
                      pick_list_line_id: l.id,
                      picked_quantity: l.assignedQuantity,
                    })),
                  })
                }
              >
                Konfirmasi seluruh picking
              </Button>
            )}
          </div>
        </form>
      )}
      {isShipping && row.state === "ALLOCATED" && can("fulfillment.dispatch") && (
        <form
          className="web-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(`/operations/warehouse/${row.id}/shipment`, {
              driver,
              vehicle,
              planned_at: new Date().toISOString(),
              ...(freightEnabled
                ? {
                    freight: {
                      amount: freightAmount || "0",
                      tax_mode: freightTaxable ? "TAXABLE" : "NON_TAXABLE",
                    },
                  }
                : {}),
            });
          }}
        >
          <Panel title="Pengiriman">
            <FieldGroup>
              <TextField label="Pengemudi" value={driver} onChange={setDriver} />
              <TextField label="Kendaraan" value={vehicle} onChange={setVehicle} />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Tambahkan ongkos kirim</p>
                  <p className="text-muted-foreground text-xs">Berlaku untuk Surat Jalan ini.</p>
                </div>
                <Switch
                  checked={freightEnabled}
                  onCheckedChange={setFreightEnabled}
                  aria-label="Aktifkan ongkos kirim Surat Jalan"
                />
              </div>
              {freightEnabled && (
                <>
                  <TextField
                    label="Nominal ongkos kirim"
                    value={freightAmount}
                    onChange={setFreightAmount}
                  />
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">Kena PPN</span>
                    <Switch
                      checked={freightTaxable}
                      onCheckedChange={setFreightTaxable}
                      aria-label="Ongkos kirim kena PPN"
                    />
                  </div>
                </>
              )}
              <Button type="submit" disabled={pending}>
                Simpan rencana pengiriman
              </Button>
              <Button
                type="button"
                disabled={pending || row.pickList?.state !== "CHECKED"}
                onClick={() => run(`/fulfillment-batches/${row.id}/dispatch`)}
              >
                Dispatch & terbitkan surat jalan
              </Button>
            </FieldGroup>
          </Panel>
        </form>
      )}
      {canManualInvoice && (
        <Panel title="Invoice">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(`/fulfillment-batches/${row.id}/issue-invoice`)}
          >
            Buat Invoice manual
          </Button>
        </Panel>
      )}
      {isPod &&
        ["DISPATCHED", "PARTIALLY_DELIVERED"].includes(row.state) &&
        can("delivery_receipt.confirm") && (
          <form
            className="web-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(`/fulfillment-batches/${row.id}/pod`, {
                receiver_name: receiver,
                evidence_id: proof,
                lines: (row.allocations ?? [])
                  .filter((l) => accepted[l.id] && !/^0+(\.0*)?$/.test(accepted[l.id]!))
                  .map((l) => ({
                    fulfillment_allocation_id: l.id,
                    accepted_quantity: accepted[l.id],
                  })),
              });
            }}
          >
            <Panel title="Bukti penerimaan pelanggan (POD)">
              <FieldGroup>
                <TextField label="Nama penerima" value={receiver} onChange={setReceiver} />
                {row.allocations?.map((l) => (
                  <TextField
                    key={l.id}
                    label={`Diterima ${l.stockLot.product.name} (${l.stockLot.batchNo})`}
                    value={accepted[l.id] ?? ""}
                    onChange={(v) => setAccepted({ ...accepted, [l.id]: v })}
                    required={false}
                  />
                ))}
                <Upload purpose="POD" onChange={setProof} />
                <Button disabled={pending || !proof}>Konfirmasi POD</Button>
              </FieldGroup>
            </Panel>
          </form>
        )}
      {isShipping && (
        <Panel title="Surat Jalan">
          {row.documents?.map((doc) => (
            <p key={doc.id}>
              <Link href={`/operations/documents/${doc.id}`} className="text-primary underline">
                {doc.number}
              </Link>
            </p>
          ))}
        </Panel>
      )}
      {isPod && (
        <Panel title="POD & penagihan">
          {row.deliveryReceipts?.map((pod) => (
            <div key={pod.id}>
              <p>Penerima: {pod.receiverName}</p>
              {can("delivery_receipt.read") && <Evidence id={pod.evidenceId} />}
              {pod.invoices.length ? (
                pod.invoices.map((i) => (
                  <p key={i.id}>
                    <Link href={`/operations/invoices/${i.id}`} className="text-primary underline">
                      {i.number}
                    </Link>
                  </p>
                ))
              ) : (
                <p className="sales-notice">Belum ada invoice.</p>
              )}
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
function InvoiceCreation({
  rows,
  pending,
  command,
}: {
  rows: Row[];
  pending: boolean;
  command: Command;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const selected = rows.find((row) => row.id === selectedId);
  const create = async () => {
    if (!selected) return;
    const result = await command(`/fulfillment-batches/${selected.id}/issue-invoice`, {});
    router.push(`/operations/invoices/${result.data.id}`);
  };
  return (
    <div className="web-form sales-compose">
      <Button className="sales-back" variant="outline" asChild>
        <Link href="/operations/invoices">← Kembali ke daftar</Link>
      </Button>
      <ProformaContents
        review
        documentType="Invoice"
        snapshot={selected?.snapshot ?? { allocations: [] }}
        beforeContent={
          <Panel title="Pilih Packing List">
            <SelectionField
              label="Pilih Packing List"
              options={rows.map((r) => ({
                id: r.id,
                name: `${r.salesOrder?.number} · ${r.salesOrder?.customer?.name} · ${r.fulfillmentBatch?.number}`,
              }))}
              value={selectedId ? [selectedId] : []}
              onChange={(v) => setSelectedId(v[0] ?? "")}
            />
            <DataTable
              data={rows}
              total={rows.length}
              showColumns={false}
              columns={[
                {
                  id: "select",
                  header: "Pilih",
                  cell: ({ row: r }) => (
                    <input
                      type="radio"
                      name="invoice-packing"
                      aria-label={`Pilih Packing List ${r.original.salesOrder?.number}`}
                      checked={selectedId === r.original.id}
                      onChange={() => setSelectedId(r.original.id)}
                    />
                  ),
                },
                {
                  id: "so",
                  header: "Sales Order",
                  cell: ({ row: r }) => r.original.salesOrder?.number ?? "—",
                },
                {
                  id: "packing",
                  header: "Packing List",
                  cell: ({ row: r }) => r.original.fulfillmentBatch?.number ?? "—",
                },
                {
                  id: "customer",
                  header: "Pelanggan",
                  cell: ({ row: r }) => r.original.salesOrder?.customer?.name ?? "—",
                },
              ]}
            />
            {!rows.length && <p>Belum ada Packing List yang siap dibuatkan Invoice.</p>}
          </Panel>
        }
        notes={
          <p className="sales-notice">
            Kuantitas, harga, pajak, dan ongkir mengikuti hasil checking Packing List. Jatuh tempo
            dihitung dari tanggal Invoice + termin.
          </p>
        }
        asideContent={
          <p className="sales-notice">
            Invoice diposting setelah dikonfirmasi dan langsung membentuk AR.
          </p>
        }
      />
      <footer className="so-footer so-detail-actions">
        <Button variant="outline" asChild>
          <Link href="/operations/invoices">Batal</Link>
        </Button>
        <Button
          disabled={pending || !selected}
          onClick={() => void create().catch(() => undefined)}
        >
          Buat Invoice
        </Button>
      </footer>
    </div>
  );
}

function CustomerReturnForm({ command, pending }: { command: Command; pending: boolean }) {
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [deliveryReceiptLineId, setDeliveryReceiptLineId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quarantineLocatorId, setQuarantineLocatorId] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="web-form"
      onSubmit={(event) => {
        event.preventDefault();
        void command(`/customers/${customerId}/returns`, {
          ...(invoiceId ? { sales_invoice_id: invoiceId } : {}),
          reason,
          lines: [
            {
              delivery_receipt_line_id: deliveryReceiptLineId,
              quantity,
              quarantine_locator_id: quarantineLocatorId,
              batch_no: batchNo,
            },
          ],
        }).catch(() => undefined);
      }}
    >
      <Alert>
        <AlertDescription>
          Pilihan pelanggan, invoice, baris POD, dan locator karantina belum memiliki endpoint
          lookup pada layanan operasional. Form ini menerima referensi yang sudah diketahui dan
          tetap divalidasi server.
        </AlertDescription>
      </Alert>
      <Panel title="Dokumen sumber">
        <div className="otc-form-grid">
          <TextField label="ID pelanggan" value={customerId} onChange={setCustomerId} />
          <TextField
            label="ID invoice (opsional)"
            value={invoiceId}
            onChange={setInvoiceId}
            required={false}
          />
          <TextField
            label="ID baris POD"
            value={deliveryReceiptLineId}
            onChange={setDeliveryReceiptLineId}
          />
          <TextField label="Alasan retur" value={reason} onChange={setReason} />
        </div>
      </Panel>
      <Panel title="Barang diretur">
        <div className="otc-form-grid">
          <TextField label="Kuantitas retur" value={quantity} onChange={setQuantity} />
          <TextField label="Batch" value={batchNo} onChange={setBatchNo} />
          <TextField
            label="ID locator karantina"
            value={quarantineLocatorId}
            onChange={setQuarantineLocatorId}
          />
        </div>
      </Panel>
      <div className="so-footer so-detail-actions">
        <Button type="submit" disabled={pending}>
          Ajukan retur
        </Button>
      </div>
    </form>
  );
}

function Invoice({
  row,
  command,
  pending,
  can,
}: {
  row: Row;
  command: Command;
  pending: boolean;
  can: (p: string) => boolean;
}) {
  const { principal } = useSession();
  const banks = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, "banks"],
    queryFn: () =>
      apiRequest<{ data: { id: string; name: string; lastFour: string }[] }>(
        "/finance-controls/banks",
      ),
    enabled: can("customer_receipt.post"),
  });
  const [bank, setBank] = useState("");
  const [draftReference, setDraftReference] = useState(row.issuedSnapshot?.reference ?? "");
  const [draftNotes, setDraftNotes] = useState(row.issuedSnapshot?.notes ?? "");
  const [amount, setAmount] = useState(""),
    [allocationAmount, setAllocationAmount] = useState(""),
    [reference, setReference] = useState(""),
    [proof, setProof] = useState(""),
    [receipt, setReceipt] = useState("");
  return (
    <>
      <div className="so-print-area web-form">
        <InvoiceProgress
          id={row.id}
          draft={row.state === "DRAFT"}
          payment={invoicePaymentStatus(row) ?? null}
        />
        <ProformaContents
          documentNumber={row.number}
          review={row.state === "DRAFT"}
          beforeContent={
            row.state === "DRAFT" ? (
              <Panel title="1 · POD sumber">
                <p>
                  {row.salesOrder?.number} · {row.customer?.name}
                </p>
                <p className="sales-notice">
                  Draft mengikuti POD sumber. Jumlah dan harga mengikuti dokumen yang diterima.
                </p>
              </Panel>
            ) : undefined
          }
          mainContent={
            row.state !== "DRAFT" ? (
              <DocumentHandoff
                kind="invoice"
                id={row.id}
                editable={
                  ["POSTED", "PARTIALLY_PAID", "PAID"].includes(row.state) &&
                  can("sales_invoice.post")
                }
              />
            ) : undefined
          }
          asideContent={
            <>
              {row.state !== "DRAFT" && (
                <>
                  <Panel title="Status tagihan">
                    <div className="sales-checklist">
                      <div>
                        <span>Total</span>
                        <strong>{money(row.total, row.currency)}</strong>
                      </div>
                      <div>
                        <span>Terbayar</span>
                        <strong>
                          {row.total != null && row.outstandingAmount != null
                            ? money(
                                new Decimal(row.total).sub(row.outstandingAmount).toString(),
                                row.currency,
                              )
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        <span>Sisa</span>
                        <strong>{money(row.outstandingAmount, row.currency)}</strong>
                      </div>
                      <div>
                        <span>Jatuh tempo</span>
                        <strong>{formatDate(row.dueDate)}</strong>
                      </div>
                    </div>
                  </Panel>
                  <Panel title="Checklist dokumen">
                    <div className="sales-checklist">
                      <div>
                        <span>Invoice</span>
                        <SalesBadge>Siap</SalesBadge>
                      </div>
                      <div>
                        <span>Faktur pajak</span>
                        <SalesBadge>Belum terverifikasi</SalesBadge>
                      </div>
                      <div>
                        <span>Surat Jalan / POD</span>
                        <SalesBadge>
                          {row.deliveryReceiptId ? "Tersedia" : "Belum tersedia"}
                        </SalesBadge>
                      </div>
                      <div>
                        <span>Kwitansi</span>
                        <SalesBadge>Belum terlacak</SalesBadge>
                      </div>
                    </div>
                    <HandoffStatus kind="invoice" id={row.id} />
                  </Panel>
                </>
              )}
              <div className="sales-payment-card">
                {row.state === "POSTED" && can("customer_receipt.post") && (
                  <form
                    className="web-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void command(`/customers/${row.customerId}/receipts`, {
                        amount,
                        currency: row.currency,
                        bank_reference: reference,
                        bank_account_id: bank,
                        evidence_id: proof,
                      })
                        .then((r) => {
                          setReceipt(r.data.id);
                          setAllocationAmount(amount);
                          setAmount("");
                          setReference("");
                          setProof("");
                        })
                        .catch(() => undefined);
                    }}
                  >
                    <Panel title="Terima pembayaran (Finance)">
                      <FieldGroup>
                        <SelectionField
                          label="Kas/Bank"
                          options={(banks.data?.data ?? []).map((b) => ({
                            id: b.id,
                            name: `${b.name} · ${b.lastFour}`,
                          }))}
                          value={bank ? [bank] : []}
                          onChange={(v) => setBank(v[0] ?? "")}
                        />
                        <TextField label="Jumlah penerimaan" value={amount} onChange={setAmount} />
                        <TextField
                          label="Referensi rekening / mutasi bank"
                          value={reference}
                          onChange={setReference}
                        />
                        <Upload key={receipt} purpose="PAYMENT" onChange={setProof} />
                        <Button disabled={pending || !proof || !bank}>Catat penerimaan</Button>
                      </FieldGroup>
                    </Panel>
                  </form>
                )}
                {row.state === "POSTED" && can("tax_component.read") && (
                  <details className="sales-finance-detail">
                    <summary>Komponen pajak (pelanggan WAPU)</summary>
                    <TaxComponents row={row} can={can} command={command} pending={pending} />
                  </details>
                )}
                {row.state === "POSTED" && can("customer_receipt.allocate") && (
                  <form
                    className="web-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void command(`/customer-receipts/${receipt}/allocate`, {
                        invoice_id: row.id,
                        amount: allocationAmount,
                      })
                        .then(() => setAllocationAmount(""))
                        .catch(() => undefined);
                    }}
                  >
                    <Panel title="Alokasikan penerimaan">
                      <FieldGroup>
                        <SelectionField
                          label="Penerimaan tersedia"
                          options={(row.receipts ?? []).map((r) => ({
                            id: r.id,
                            name: `${r.bankReference} · tersedia ${r.unallocatedAmount}`,
                          }))}
                          value={receipt ? [receipt] : []}
                          onChange={(v) => setReceipt(v[0] ?? "")}
                        />
                        <TextField
                          label="Jumlah alokasi"
                          value={allocationAmount}
                          onChange={setAllocationAmount}
                        />
                        <Button disabled={pending || !receipt}>Alokasikan ke invoice</Button>
                      </FieldGroup>
                    </Panel>
                  </form>
                )}
                <details className="sales-finance-detail">
                  <summary>Bukti penerimaan</summary>
                  <Panel title="Bukti penerimaan">
                    {row.receipts?.map((r) => (
                      <div key={r.id}>
                        <p>
                          {r.bankReference} · {r.amount} · belum dialokasikan {r.unallocatedAmount}
                        </p>
                        <Evidence id={r.evidenceId} />
                      </div>
                    ))}
                  </Panel>
                </details>
              </div>
            </>
          }
          documentType="Invoice"
          snapshot={row.snapshot}
          issuedAt={row.postedAt ?? undefined}
          notes={
            row.state === "DRAFT" && can("sales_invoice.post") ? (
              <div className="grid gap-4">
                <label>
                  Referensi tagihan
                  <Input
                    value={draftReference}
                    maxLength={200}
                    onChange={(e) => setDraftReference(e.target.value)}
                  />
                </label>
                <label>
                  Catatan
                  <Textarea
                    value={draftNotes}
                    maxLength={2000}
                    onChange={(e) => setDraftNotes(e.target.value)}
                  />
                </label>
                <p className="so-help">
                  Simpan draft sebelum posting. Harga, jumlah, pajak dan ongkir mengikuti Packing
                  List.
                </p>
              </div>
            ) : (
              <p>{row.issuedSnapshot?.notes || "Tidak ada catatan."}</p>
            )
          }
        />
      </div>
      <div className="so-footer so-detail-actions so-no-print">
        {row.state === "DRAFT" && can("sales_invoice.post") && row.deliveryReceiptId && (
          <>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                void command(`/sales-invoice-drafts/${row.id}`, {
                  delivery_receipt_id: row.deliveryReceiptId,
                  billing_reference: draftReference,
                  notes: draftNotes,
                  version: row.issuedSnapshot?.version,
                }).catch(() => undefined)
              }
            >
              Simpan perubahan draft
            </Button>
            <Button
              disabled={
                pending ||
                draftReference !== (row.issuedSnapshot?.reference ?? "") ||
                draftNotes !== (row.issuedSnapshot?.notes ?? "")
              }
              onClick={() =>
                void command("/sales-invoices", {
                  delivery_receipt_id: row.deliveryReceiptId,
                }).catch(() => undefined)
              }
            >
              Terbitkan Invoice
            </Button>
          </>
        )}
        {row.state === "POSTED" && (
          <Button onClick={() => window.print()}>
            <Printer />
            Cetak Invoice
          </Button>
        )}
      </div>
    </>
  );
}
function Audit({ id }: { id: string }) {
  const { principal } = useSession();
  const q = useQuery({
    queryKey: ["operations", principal?.user_id, principal?.company_id, "audit", id],
    queryFn: () =>
      apiRequest<{ data: { id: string; action: string; occurredAt: string; actorId: string }[] }>(
        `/operations/audit/${id}`,
      ),
  });
  return (
    <Panel title="Jejak audit">
      {q.error && <ErrorBox message={String(q.error)} />}
      {q.data?.data.map((event) => (
        <p key={event.id}>
          {event.occurredAt} · {event.action} · {event.actorId}
        </p>
      ))}
    </Panel>
  );
}
export function DocumentValue({ value }: { value: unknown }): ReactNode {
  if (value == null) return "—";
  if (Array.isArray(value))
    return (
      <ol>
        {value.map((v, i) => (
          <li key={i}>
            <DocumentValue value={v} />
          </li>
        ))}
      </ol>
    );
  if (typeof value === "object")
    return (
      <dl className="otc-document">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt>{k.replaceAll("_", " ")}</dt>
            <dd>
              <DocumentValue value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return String(value);
}
