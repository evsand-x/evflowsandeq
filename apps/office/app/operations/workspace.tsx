"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  invoices: "Tagihan",
  "invoice-create": "Buat Invoice",
  documents: "Dokumen Transaksi",
};
function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("id-ID") : "—";
}
function money(value?: string | null, currency = "IDR") {
  if (value == null) return "—";
  const [integer = "0", fraction = "00"] = new Decimal(value).toFixed(2).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${currency} ${grouped},${fraction}`;
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
        <CardTitle>{title}</CardTitle>
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
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Field>
      <FieldLabel htmlFor={`upload-${purpose}`}>Bukti dokumen (JPEG/PNG, maksimal 2 MB)</FieldLabel>
      <Input
        id={`upload-${purpose}`}
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
      backorders: "sales_order.read",
      "warehouse-backorders": "sales_order.read",
      "pick-slips": "fulfillment.read",
      warehouse: "fulfillment.read",
      returns: "fulfillment.read",
      invoices: "sales_invoice.read",
      "invoice-create": "sales_invoice.post",
      documents: "fulfillment.read",
    }[kind] ?? "";
  const enabled =
    !!principal &&
    (configuring
      ? [
          "customer.payment_policy.manage",
          "sales_tax_rule.manage",
          "transaction_approval.manage",
          "inventory.quality.decide",
        ].some(can)
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
            ? ["sales_order.read", "fulfillment.read", "sales_invoice.read"].some(can)
            : can(permission));
  const endpoint =
    kind === "documents"
      ? `/operations/documents/${id}`
      : invoiceCreation
        ? "/receivables/invoice-candidates"
        : id && !creating
          ? `/operations/${kind === "pick-slips" ? "warehouse" : kind}/${id}`
          : `/operations/lists/${kind === "warehouse-backorders" ? "backorders" : kind}?page=${page}&search=${encodeURIComponent(search)}${kind === "warehouse" && stage && warehouseStageTitles[stage] ? `&stage=${stage}` : ""}`;
  const query = useQuery({
    queryKey: ["operations", principal?.user_id, principal?.company_id, endpoint],
    queryFn: () =>
      apiRequest<{ data: Row & { rows: Row[]; total: number; snapshot: unknown } }>(endpoint),
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
    enabled: enabled && invoiceCreation,
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
  const stageQuery = kind === "warehouse" && stage && warehouseStageTitles[stage] ? `?stage=${stage}` : "";
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
    ...(outboundView ? [{
      id: "salesOrder", header: "Sales Order",
      cell: ({ row: r }: { row: { original: Row } }) => r.original.salesOrder?.number ?? "—",
    }] : []),
    ...(kind !== "invoices"
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
                  title={invoiceDocumentNote(r.original.state) ?? "Status pembayaran berdasarkan sisa tagihan"}
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
              invoiceDocumentNote(r.original.state) ?? r.original.description ?? "Belum terverifikasi",
          },
        ]
      : []),
    ...(kind === "warehouse" ? [
      { id: "pickState", header: "Status picking", cell: ({ row: r }: { row: { original: Row } }) => <Badge variant="outline">{r.original.pickList?.state ?? "Belum dibuat"}</Badge> },
      { id: "action", header: "Tindakan", cell: ({ row: r }: { row: { original: Row } }) => (
        <Button variant="outline" size="sm" asChild><Link href={`/operations/warehouse/${r.original.id}${stageQuery}`}>
          {stage === "checking" ? "Periksa barang" : stage === "shipping" ? "Siapkan pengiriman" : stage === "pod" ? "Buka penerimaan" : "Buka detail"}
        </Link></Button>
      ) },
    ] : []),
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
              return (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/operations/warehouse/${r.original.id}`}>Buka Pick Slip</Link>
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
          className={`executive-content crm-content otc-workspace ${["invoices", "invoice-create"].includes(kind) ? "so-workspace" : ""}`}
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
                      : (row?.number ?? (kind === "warehouse" && stage ? warehouseStageTitles[stage] : undefined) ?? titles[kind] ?? "Halaman tidak ditemukan")}
              </h1>
            </div>
            <div className="crm-actions">
              {id && (
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
              {!id && kind === "invoices" && (
                can("sales_invoice.post") ? (
                  <Button asChild>
                    <Link href="/operations/invoice-create">
                      <Plus />
                      Buat Invoice
                    </Link>
                  </Button>
                ) : can("sales_invoice.read") ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled
                    title="Memerlukan izin posting Invoice"
                    aria-label="Buat Invoice — memerlukan izin posting Invoice"
                  >
                    <Plus />
                    Buat Invoice
                  </Button>
                ) : null
              )}
            </div>
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
          {!id && kind === "invoices" && can("sales_invoice.read") && !can("sales_invoice.post") && (
            <Alert className="mb-4">
              <AlertDescription>
                Anda dapat melihat Tagihan, tetapi belum memiliki izin posting Invoice. Hubungi
                Administrator atau Finance Supervisor untuk mengaktifkan tindakan ini.
              </AlertDescription>
            </Alert>
          )}
          {!enabled ? (
            <ErrorBox message="Izin Anda belum mencukupi untuk layar ini." />
          ) : (
            <>
              {(error || query.error || candidateQuery.error) && (
                <ErrorBox message={error || String(query.error || candidateQuery.error)} />
              )}
              {query.isFetching && <p role="status">Memuat data terbaru…</p>}
              {outboundView && !id && kind !== "returns" && (
                <Panel title="Antrean tindakan">
                  <p>{kind === "pick-slips" ? "Siapkan Pick Slip dan konfirmasikan pengambilan barang sesuai alokasi." : stage === "checking" ? "Periksa hasil picking sebelum menerbitkan packing dan menyiapkan pengiriman." : stage === "shipping" ? "Lengkapi pengiriman untuk barang yang sudah lolos checking. Kelayakan kirim diperiksa kembali oleh server." : stage === "pod" ? "Catat penerimaan pelanggan untuk pengiriman yang belum terselesaikan." : "Pantau seluruh tahap pemenuhan pesanan."}</p>
                  <p role="status">{query.isError ? "Jumlah tugas belum dapat dimuat." : row ? `${row.total} tahap pemenuhan sesuai pencarian` : "Memuat jumlah tugas…"}</p>
                </Panel>
              )}
              {invoiceCreation ? (
                <InvoiceCreation
                  rows={candidateQuery.data?.data ?? []}
                  pending={pending}
                  command={command}
                  onCreated={() => router.push("/operations/invoices")}
                />
              ) : ["backorders", "warehouse-backorders"].includes(kind) ? (
                <Backorders can={can} command={command} pending={pending} />
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
                <Panel title="Retur Pelanggan">
                  <p role="status">Daftar dan detail retur belum tersedia pada aplikasi Office. Penerimaan fisik retur dan tindak lanjut kualitas belum dapat dikerjakan dari halaman ini.</p>
                </Panel>
              ) : !id ? (
                <DataTable
                  data={row?.rows ?? []}
                  columns={columns}
                  total={row?.total ?? 0}
                  page={page}
                  onPage={setPage}
                  busy={query.isFetching}
                  label={(kind === "warehouse" && stage ? warehouseStageTitles[stage] : undefined) ?? titles[kind] ?? "Transaksi"}
                  toolbar={
                    <Input
                      aria-label="Cari nomor dokumen"
                      placeholder="Cari nomor dokumen…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  }
                />
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
                    {kind === "warehouse" && (
                      <Warehouse
                        key={row.id}
                        row={row}
                        command={command}
                        pending={pending}
                        can={can}
                        stage={stage ?? "checking"}
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
  const isShipping = stage === "shipping";
  const isPod = stage === "pod";
  const [driver, setDriver] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [receiver, setReceiver] = useState(""),
    [proof, setProof] = useState("");
  const [accepted, setAccepted] = useState<Record<string, string>>({});
  const [freightEnabled, setFreightEnabled] = useState(false),
    [freightAmount, setFreightAmount] = useState(""),
    [freightTaxable, setFreightTaxable] = useState(false);
  const run = (url: string, data?: unknown) => {
    void command(url, data).catch(() => undefined);
  };
  return (
    <>
      <Panel title={isChecking ? "Dokumen Checking / Packing" : isShipping ? "Dokumen Pengiriman" : isPod ? "Dokumen POD" : "Dokumen Pemenuhan"}>
        <p>
          {row.salesOrder?.number} · {row.salesOrder?.customer?.name} · {row.state}
        </p>
        <p>{row.salesOrder?.deliveryAddress}</p>
      </Panel>
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
      {isChecking && <div className="crm-actions">
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
        {row.pickList?.state === "PICKED" && can("fulfillment.check") && (
          <Button
            disabled={pending}
            onClick={() => run(`/pick-lists/${row.pickList!.id}/confirm-check`)}
          >
            Konfirmasi checking
          </Button>
        )}
      </div>}
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
      {isPod && ["DISPATCHED", "PARTIALLY_DELIVERED"].includes(row.state) &&
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
      {isShipping && <Panel title="Surat Jalan">
        {row.documents?.map((doc) => (
          <p key={doc.id}>
            <Link href={`/operations/documents/${doc.id}`} className="text-primary underline">
              {doc.number}
            </Link>
          </p>
        ))}
      </Panel>}
      {isPod && <Panel title="POD & penagihan">
        {row.deliveryReceipts?.map((pod) => (
          <div key={pod.id}>
            <p>Penerima: {pod.receiverName}</p>
            {can("delivery_receipt.read") && <Evidence id={pod.evidenceId} />}
            {pod.invoices.length
              ? pod.invoices.map((i) => (
                  <p key={i.id}>
                    <Link href={`/operations/invoices/${i.id}`} className="text-primary underline">
                      {i.number}
                    </Link>
                  </p>
                ))
              : can("sales_invoice.post") && (
                  <Button
                    disabled={pending}
                    onClick={() => run("/sales-invoices", { delivery_receipt_id: pod.id })}
                  >
                    Terbitkan invoice dari POD
                  </Button>
                )}
          </div>
        ))}
      </Panel>}
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
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const selected = rows.find((row) => row.id === selectedId);
  const existing = selected?.invoices?.find((invoice) => invoice.state !== "VOID");
  const save = async () => {
    if (!selected || existing) return;
    const result = await command("/sales-invoice-drafts", {
      delivery_receipt_id: selected.id,
      billing_reference: reference,
      notes,
    });
    router.push(`/operations/invoices/${result.data.id}`);
  };
  return (
    <div className="web-form">
      <div className="so-footer so-detail-actions">
        <Button variant="outline" asChild>
          <Link href="/operations/invoices">
            <ArrowLeft />
            Daftar Invoice
          </Link>
        </Button>
        {existing ? (
          <Button asChild>
            <Link href={`/operations/invoices/${existing.id}`}>Buka Invoice {existing.number}</Link>
          </Button>
        ) : (
          <Button
            disabled={pending || !selected}
            onClick={() => void save().catch(() => undefined)}
          >
            {pending ? "Menyimpan…" : "Simpan Draft Invoice"}
          </Button>
        )}
      </div>
      <Panel title="Sumber Invoice">
        <SelectionField
          label="Pilih POD"
          options={rows.map((r) => ({
            id: r.id,
            name: `${r.salesOrder?.number} · ${r.salesOrder?.customer?.name} · ${r.fulfillmentBatch?.number} · ${formatDate(r.acceptedAt)}`,
          }))}
          value={selectedId ? [selectedId] : []}
          onChange={(values) => setSelectedId(values[0] ?? "")}
        />
        {!rows.length && <p>Belum ada POD yang siap ditagihkan.</p>}
      </Panel>
      {selected && (
        <>
          <div className="so-detail-overview">
            <div>
              <span className="so-eyebrow">INVOICE</span>
              <h2>Draft baru</h2>
              <p>{selected.salesOrder?.customer?.name}</p>
            </div>
            <Badge variant="outline">Belum disimpan</Badge>
          </div>
          <ProformaContents
            documentType="Invoice"
            snapshot={selected.snapshot}
            batchNumber={selected.fulfillmentBatch?.number}
            notes={
              <div className="grid gap-4">
                <label>
                  Referensi tagihan
                  <Input
                    value={reference}
                    maxLength={200}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
                <label>
                  Catatan
                  <Textarea
                    value={notes}
                    maxLength={2000}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <p className="so-help">
                  Produk, jumlah, harga, pajak, dan ongkir mengikuti dokumen sumber. Draft dapat
                  diperbarui sebelum posting.
                </p>
              </div>
            }
          />
        </>
      )}
    </div>
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
        <div className="so-detail-overview">
          <div>
            <span className="so-eyebrow">INVOICE</span>
            <h2>{row.number}</h2>
            <p>{row.customer?.name ?? "Pelanggan belum tersedia"}</p>
          </div>
          <div className="so-dimensions">
            <div>
              <span>Status pembayaran</span>
              <Badge variant="outline">{invoicePaymentStatus(row) ?? "—"}</Badge>
              {invoiceDocumentNote(row.state) && <p className="so-help">{invoiceDocumentNote(row.state)}</p>}
            </div>
            <div>
              <span>Sales Order</span>
              <strong>{row.salesOrder?.number ?? "—"}</strong>
            </div>
          </div>
        </div>
        <ProformaContents
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
                  Simpan draft sebelum posting. Harga, jumlah, pajak dan ongkir mengikuti sumber
                  POD.
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
      <Panel title="Status penagihan">
        <p>
          Dibuat: {formatDate(row.createdAt)} · Jatuh tempo: {formatDate(row.dueDate)}
        </p>
        <p>
          Sisa tagihan:{" "}
          {row.state === "POSTED"
            ? money(row.outstandingAmount, row.currency)
            : "Belum membentuk piutang"}
        </p>
        <p>{row.description ?? "Belum terverifikasi"}</p>
      </Panel>
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
          <Panel title="Penerimaan pembayaran">
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
        <TaxComponents row={row} can={can} command={command} pending={pending} />
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
