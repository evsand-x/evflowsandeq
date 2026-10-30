"use client";
import { useMemo, useRef, useState } from "react";
import { parseBankStatementCsv } from "@evflow/contracts";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldGroup } from "@/components/ui/field";
import { SelectionField } from "@/components/web/selection-field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/api";
import { useSession } from "../session-provider";
import { DataTable, Notice } from "../crm/crm-common";
import { Panel, TextField, Upload, Evidence, type Row } from "./workspace";

type Props = {
  can: (p: string) => boolean;
  command: (path: string, body?: unknown) => Promise<unknown>;
  pending: boolean;
};
type Exception = {
  id: string;
  kind: string;
  state: string;
  reason: string;
  amountLimit: string;
  expiresAt: string;
  evidenceId: string;
  evaluation?: { state: string; last_error: string | null };
  actions: { id: string; actorId: string; decision: string; reason: string }[];
};
function useData<T>(path: string, enabled = true) {
  const { principal } = useSession();
  return useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, path],
    queryFn: () => apiRequest<{ data: T }>(path),
    enabled: !!principal && enabled,
  });
}

export function Backorders({
  command,
  pending,
  can,
  warehouse = false,
}: Props & { warehouse?: boolean }) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  type Remainder = {
    id: string;
    orderedQuantity: string;
    backorderQuantity: string;
    product: { name: string };
    salesOrder: { id: string; number: string; version: number; customer: { name: string } };
  };
  const q = useData<{ rows: Remainder[]; total: number }>(
    `/operations/${warehouse ? "warehouse-backorders" : "backorders"}?page=${page}&search=${encodeURIComponent(search)}`,
    can(warehouse ? "warehouse_allocation.read" : "sales_backorder.read"),
  );
  return (
    <>
      {q.error && <Notice>{String(q.error)}</Notice>}
      <DataTable
        data={q.data?.data.rows ?? []}
        total={q.data?.data.total ?? 0}
        page={page}
        onPage={setPage}
        busy={q.isFetching}
        label="sisa pesanan"
        toolbar={
          <Input
            aria-label="Cari nama atau nomor dokumen"
            placeholder="Cari nama atau nomor dokumen"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        }
        columns={[
          {
            id: "order",
            header: "SO / pelanggan",
            cell: ({ row }) =>
              can("sales_order.read") ? (
                <Link href={`/operations/orders/${row.original.salesOrder.id}`}>
                  {row.original.salesOrder.number} · {row.original.salesOrder.customer.name}
                </Link>
              ) : (
                `${row.original.salesOrder.number} · ${row.original.salesOrder.customer.name}`
              ),
          },
          { id: "product", header: "Produk", cell: ({ row }) => row.original.product.name },
          { accessorKey: "orderedQuantity", header: "Dipesan" },
          { accessorKey: "backorderQuantity", header: "Sisa" },
          {
            id: "state",
            header: "Status sisa",
            cell: () => <Badge variant="outline">Backorder</Badge>,
          },
          { id: "estimate", header: "Perkiraan pemenuhan", cell: () => "Belum tersedia" },
          {
            id: "actions",
            header: "Tindakan",
            cell: ({ row }) =>
              can("sales_order.reallocate") && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void command(`/operations/orders/${row.original.salesOrder.id}/reallocate`, {
                      version: row.original.salesOrder.version,
                    }).catch(() => undefined)
                  }
                >
                  Evaluasi & alokasi ulang
                </Button>
              ),
          },
        ]}
      />
    </>
  );
}
const reasonOptions = [
  { id: "CREDIT_HOLD", name: "Limit kredit terlampaui" },
  { id: "CUSTOMER_PAST_DUE", name: "Invoice lewat jatuh tempo" },
  { id: "CUSTOMER_CREDIT_FROZEN", name: "Kredit dibekukan" },
];
export function SalesExceptions({ row, can, command, pending }: Props & { row: Row }) {
  const q = useData<Exception[]>(`/operations/orders/${row.id}/exceptions`);
  const [kind, setKind] = useState("SALES_ORDER_UNLOCK"),
    [reasons, setReasons] = useState<string[]>([]),
    [line, setLine] = useState(""),
    [reason, setReason] = useState(""),
    [limit, setLimit] = useState(""),
    [evidence, setEvidence] = useState("");
  return (
    <>
      <Panel title="Pengajuan pengecualian kredit / harga khusus">
        {q.error && <Notice>{String(q.error)}</Notice>}
        <form
          className="web-form"
          onSubmit={(e) => {
            e.preventDefault();
            void command(`/operations/orders/${row.id}/exceptions`, {
              kind,
              version: row.version,
              ...(kind === "SPECIAL_PRICE" ? { line_id: line } : {}),
              reasons: kind === "SPECIAL_PRICE" ? [] : reasons,
              reason,
              evidence_id: evidence,
              amount_limit: limit,
            })
              .then(() => setReason(""))
              .catch(() => undefined);
          }}
        >
          <FieldGroup className="otc-form-grid">
            <SelectionField
              label="Jenis pengajuan"
              value={[kind]}
              onChange={(v) => setKind(v[0] ?? "SALES_ORDER_UNLOCK")}
              options={[
                { id: "SALES_ORDER_UNLOCK", name: "Unlock SO" },
                { id: "SPECIAL_PRICE", name: "Harga khusus per produk" },
              ]}
            />
            {kind === "SPECIAL_PRICE" ? (
              <SelectionField
                label="Produk / satuan"
                value={line ? [line] : []}
                onChange={(v) => setLine(v[0] ?? "")}
                options={(row.lines ?? []).map((l) => ({
                  id: l.id,
                  name: `${l.product.name} · ${l.orderedQuantity} × ${l.unitPrice}`,
                }))}
              />
            ) : (
              <SelectionField
                label="Alasan kunci yang diajukan"
                multiple
                value={reasons}
                onChange={setReasons}
                options={reasonOptions}
              />
            )}
            <TextField label="Batas nilai pengajuan" value={limit} onChange={setLimit} />
            <TextField label="Alasan pengajuan" value={reason} onChange={setReason} />
            <Upload purpose="SALES_ORDER" onChange={setEvidence} />
          </FieldGroup>
          <p className="text-muted-foreground">
            Pemberi keputusan dan masa berlaku mengikuti aturan aktif. Persetujuan tidak mengubah
            limit pelanggan atau kelayakan stok.
          </p>
          <Button
            disabled={
              pending ||
              !evidence ||
              !can(kind === "SPECIAL_PRICE" ? "price_request.submit" : "sales_order.unlock.request")
            }
          >
            Kirim Pengajuan
          </Button>
        </form>
      </Panel>
      {(q.data?.data ?? []).map((request) => (
        <Decision
          key={request.id}
          request={request}
          can={can}
          command={command}
          pending={pending}
        />
      ))}
    </>
  );
}
function Decision({ request, can, command, pending }: Props & { request: Exception }) {
  const [decision, setDecision] = useState(""),
    [reason, setReason] = useState("");
  return (
    <Panel
      title={
        request.kind === "SPECIAL_PRICE" ? "Tinjau harga khusus" : "Tinjau pengecualian kredit"
      }
    >
      <div className="otc-summary">
        <Badge variant="outline">{request.state}</Badge>
        <span>Batas {request.amountLimit}</span>
        <span>Berlaku hingga {new Date(request.expiresAt).toLocaleString("id-ID")}</span>
      </div>
      <p>{request.reason}</p>
      {request.evaluation && (
        <p role="status">
          Evaluasi SO: {request.evaluation.state}
          {request.evaluation.last_error ? ` · ${request.evaluation.last_error}` : ""}
        </p>
      )}
      <Evidence id={request.evidenceId} />
      <DataTable
        data={request.actions}
        total={request.actions.length}
        showColumns={false}
        columns={[
          { accessorKey: "actorId", header: "Peninjau" },
          { accessorKey: "decision", header: "Keputusan" },
          { accessorKey: "reason", header: "Catatan" },
        ]}
      />
      {request.state === "SUBMITTED" &&
        can(
          request.kind === "SPECIAL_PRICE" ? "price_request.approve" : "sales_order.unlock.approve",
        ) && (
          <form
            className="web-form"
            onSubmit={(e) => {
              e.preventDefault();
              void command(`/operations/exceptions/${request.id}/decisions`, {
                decision,
                reason,
              }).catch(() => undefined);
            }}
          >
            <FieldGroup className="otc-form-grid">
              <SelectionField
                label="Keputusan"
                value={decision ? [decision] : []}
                onChange={(v) => setDecision(v[0] ?? "")}
                options={[
                  { id: "APPROVED", name: "Setujui" },
                  { id: "REVISION_REQUIRED", name: "Minta revisi" },
                  { id: "REJECTED", name: "Tolak" },
                ]}
              />
              <TextField label="Alasan keputusan" value={reason} onChange={setReason} />
            </FieldGroup>
            <Button disabled={pending || !decision}>Simpan Keputusan</Button>
          </form>
        )}
    </Panel>
  );
}
type TaxLine = {
  id: string;
  kind: string;
  taxType: string;
  dpp: string;
  amount: string;
  number: string;
  documentDate: string;
  taxPeriod: string;
  evidenceId: string;
  state: string;
  snapshot: { rate: string };
};
type TaxRule = { id: string; customerId: string; kind: string; taxType: string; rate: string };
export function TaxComponents({ row, can, command, pending }: Props & { row: Row }) {
  const q = useData<TaxLine[]>(`/finance-controls/invoices/${row.id}/tax-components`);
  const rules = useData<TaxRule[]>("/finance-controls/tax-rules", can("tax_rule.read"));
  const [rule, setRule] = useState(""),
    [dpp, setDpp] = useState(""),
    [number, setNumber] = useState(""),
    [date, setDate] = useState(""),
    [period, setPeriod] = useState(""),
    [evidence, setEvidence] = useState(""),
    [reason, setReason] = useState("");
  const run = (id: string, action: string, body: unknown) =>
    void command(`/finance-controls/tax-components/${id}/${action}`, body).catch(() => undefined);
  return (
    <Panel title="Komponen Pajak">
      {q.error && <Notice>{String(q.error)}</Notice>}
      <DataTable
        data={q.data?.data ?? []}
        total={q.data?.data.length ?? 0}
        showColumns={false}
        columns={[
          {
            id: "kind",
            header: "Jenis",
            cell: ({ row: r }) =>
              r.original.kind === "vat_collected_by_customer"
                ? "PPN Dipungut WAPU"
                : `PPh Dipotong · ${r.original.taxType}`,
          },
          { accessorKey: "dpp", header: "DPP" },
          { id: "rate", header: "Tarif", cell: ({ row: r }) => r.original.snapshot.rate },
          { accessorKey: "amount", header: "Nominal" },
          {
            id: "document",
            header: "Nomor / Tanggal / Masa",
            cell: ({ row: r }) =>
              `${r.original.number} / ${r.original.documentDate.slice(0, 10)} / ${r.original.taxPeriod}`,
          },
          {
            id: "evidence",
            header: "Bukti / Verifikasi",
            cell: ({ row: r }) => (
              <>
                <Evidence id={r.original.evidenceId} />
                <Badge variant="outline">{r.original.state}</Badge>
              </>
            ),
          },
          {
            id: "action",
            header: "Tindakan",
            cell: ({ row: r }) => (
              <div className="crm-actions">
                {r.original.state === "PENDING" && can("tax_component.verify") && (
                  <>
                    <Button
                      variant="outline"
                      disabled={pending || !reason}
                      onClick={() => run(r.original.id, "verify", { decision: "verify", reason })}
                    >
                      Verifikasi
                    </Button>
                    <Button
                      variant="outline"
                      disabled={pending || !reason}
                      onClick={() => run(r.original.id, "verify", { decision: "reject", reason })}
                    >
                      Tolak
                    </Button>
                  </>
                )}
                {r.original.state === "VERIFIED" && can("tax_component.post") && (
                  <Button
                    disabled={pending || !reason}
                    onClick={() => run(r.original.id, "post", { reason })}
                  >
                    Posting penyelesaian
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      <TextField
        label="Catatan verifikasi / posting"
        value={reason}
        onChange={setReason}
        required={false}
      />
      <p className="text-muted-foreground">
        Hanya bukti terverifikasi dan diposting yang mengurangi piutang. Uang masuk bank dicatat
        terpisah.
      </p>
      {can("tax_component.create") && (
        <form
          className="web-form"
          onSubmit={(e) => {
            e.preventDefault();
            void command("/finance-controls/tax-components", {
              invoice_id: row.id,
              rule_id: rule,
              dpp,
              number,
              document_date: date,
              tax_period: period,
              evidence_id: evidence,
            })
              .then(() => {
                setNumber("");
                setDpp("");
              })
              .catch(() => undefined);
          }}
        >
          <FieldGroup className="otc-form-grid">
            <SelectionField
              label="Jenis / aturan pajak"
              value={rule ? [rule] : []}
              onChange={(v) => setRule(v[0] ?? "")}
              options={(rules.data?.data ?? [])
                .filter((r) => r.customerId === row.customerId)
                .map((r) => ({
                  id: r.id,
                  name: `${r.kind === "vat_collected_by_customer" ? "PPN WAPU" : "PPh Dipotong"} · ${r.taxType}`,
                }))}
            />
            <TextField label="DPP bukti" value={dpp} onChange={setDpp} />
            <TextField label="Nomor bukti" value={number} onChange={setNumber} />
            <TextField label="Tanggal bukti" type="date" value={date} onChange={setDate} />
            <TextField label="Masa pajak" type="month" value={period} onChange={setPeriod} />
            <Upload purpose="TAX" onChange={setEvidence} />
          </FieldGroup>
          <Button disabled={pending || !rule || !evidence}>Tambah Komponen</Button>
        </form>
      )}
    </Panel>
  );
}
type Statement = {
  id: string;
  state: string;
  startsOn: string;
  endsOn: string;
  openingBalance: string;
  closingBalance: string;
  lines: {
    id: string;
    reference: string;
    valueDate: string;
    amount: string;
    receiptId: string | null;
    matched: boolean;
    matchedAmount: string;
    remainingAmount: string;
    matches: { receipt_id: string; amount: string }[];
  }[];
};
type Review = {
  statement: Statement;
  book: string;
  difference: string;
  control: string;
  ready: boolean;
  not_in_bank: { id: string; amount: string; bankReference: string }[];
};
export function FinanceWorkspace({
  kind,
  id,
  can,
  command,
  pending,
}: Props & { kind: string; id?: string | undefined }) {
  const statements = useData<Statement[]>(
    "/finance-controls/statements",
    can("bank_reconciliation.read"),
  );
  const q = useData<Review>(`/finance-controls/statements/${id}`, !!id);
  const gl = useData<{
    balanced: boolean;
    totals: { kind: string; currency: string; subledger: string; gl: string; difference: string }[];
    ar: { currency: string; open_items: string; gl: string; difference: string }[];
    unmapped_sources: { id: string; sourceType: string }[];
  }>("/finance-controls/reconciliation", can("journal.read") && can("inventory.cost.read"));
  const [selected, setSelected] = useState<Record<string, string>>({});
  const matchAmounts = useRef<Record<string, string>>({});
  if (kind === "tax-documents")
    return <OfficialTaxDocuments can={can} command={command} pending={pending} />;
  if (kind === "bank-statements")
    return <StatementImport can={can} command={command} pending={pending} />;
  const row = q.data?.data;
  return (
    <Tabs defaultValue="matching">
      <TabsList>
        <TabsTrigger value="matching">Pencocokan</TabsTrigger>
        <TabsTrigger value="balance">Saldo & Review</TabsTrigger>
        {can("journal.read") && can("inventory.cost.read") && (
          <TabsTrigger value="gl">Buku Besar</TabsTrigger>
        )}
      </TabsList>
      {(statements.error || q.error || gl.error) && (
        <Notice>{String(statements.error || q.error || gl.error)}</Notice>
      )}
      <TabsContent value="matching">
        {!id ? (
          <>
            <div className="crm-actions">
              <Button asChild>
                <Link href="/operations/bank-statements">Impor Mutasi</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/operations/accounting">Pengaturan Jurnal</Link>
              </Button>
            </div>
            <DataTable
              data={statements.data?.data ?? []}
              total={statements.data?.data.length ?? 0}
              columns={[
                {
                  id: "period",
                  header: "Periode",
                  cell: ({ row: r }) => (
                    <Link href={`/operations/reconciliation/${r.original.id}`}>
                      {r.original.startsOn.slice(0, 10)} – {r.original.endsOn.slice(0, 10)}
                    </Link>
                  ),
                },
                { accessorKey: "openingBalance", header: "Saldo awal" },
                { accessorKey: "closingBalance", header: "Saldo koran" },
                { accessorKey: "state", header: "Status" },
              ]}
            />
          </>
        ) : (
          row && (
            <>
              <div className="otc-kpis">
                {[
                  ["Saldo koran", row.statement.closingBalance],
                  ["Saldo buku", row.book],
                  ["Selisih", row.difference],
                ].map(([label, value]) => (
                  <Panel key={label} title={label!}>
                    <strong>{value}</strong>
                  </Panel>
                ))}
              </div>
              <Panel title="Pencocokan Bank ↔ ERP">
                <DataTable
                  data={row.statement.lines}
                  total={row.statement.lines.length}
                  showColumns={false}
                  columns={[
                    { accessorKey: "reference", header: "Mutasi Bank" },
                    {
                      id: "date",
                      header: "Tanggal",
                      cell: ({ row: r }) => r.original.valueDate.slice(0, 10),
                    },
                    { accessorKey: "amount", header: "Nominal" },
                    {
                      id: "candidate",
                      header: "Kandidat ERP",
                      cell: ({ row: r }) =>
                        r.original.matched ? (
                          "Seluruh nominal cocok"
                        ) : (
                          <SelectionField
                            label="Penerimaan ERP"
                            value={selected[r.original.id] ? [selected[r.original.id]!] : []}
                            onChange={(v) =>
                              setSelected((s) => ({ ...s, [r.original.id]: v[0] ?? "" }))
                            }
                            options={row.not_in_bank.map((x) => ({
                              id: x.id,
                              name: `${x.bankReference} · ${x.amount}`,
                            }))}
                          />
                        ),
                    },
                    {
                      id: "state",
                      header: "Status",
                      cell: ({ row: r }) =>
                        r.original.matched ? "Cocok Manual" : `Sisa ${r.original.remainingAmount}`,
                    },
                    {
                      id: "match-amount",
                      header: "Nominal dicocokkan",
                      cell: ({ row: r }) =>
                        !r.original.matched && (
                          <Input
                            aria-label={`Nominal pencocokan ${r.original.reference}`}
                            defaultValue={
                              matchAmounts.current[r.original.id] ?? r.original.remainingAmount
                            }
                            onChange={(e) => {
                              matchAmounts.current[r.original.id] = e.target.value;
                            }}
                          />
                        ),
                    },
                    {
                      id: "actions",
                      header: "Tindakan",
                      cell: ({ row: r }) =>
                        !r.original.matched &&
                        can("bank_reconciliation.match") && (
                          <Button
                            disabled={pending || !selected[r.original.id]}
                            variant="outline"
                            onClick={() =>
                              void command(
                                `/finance-controls/statement-lines/${r.original.id}/match`,
                                {
                                  receipt_id: selected[r.original.id],
                                  amount:
                                    matchAmounts.current[r.original.id] ??
                                    r.original.remainingAmount,
                                },
                              ).catch(() => undefined)
                            }
                          >
                            Cocokkan
                          </Button>
                        ),
                    },
                  ]}
                />
              </Panel>
            </>
          )
        )}
      </TabsContent>
      <TabsContent value="balance">
        {row ? (
          <Panel title="Rekonsiliasi Saldo">
            <Badge variant="outline">
              {{
                STAGING: "Dalam pencocokan",
                BLOCKED: "Tertahan",
                READY: "Siap ditutup",
                CLOSED: "Ditutup",
              }[row.statement.state] ?? row.statement.state}
            </Badge>
            <DataTable
              showColumns={false}
              data={[
                ["Saldo awal koran", row.statement.openingBalance],
                ["Saldo akhir koran", row.statement.closingBalance],
                ["Saldo buku", row.book],
                ["Kontrol mutasi koran", row.control],
                ["Selisih", row.difference],
              ].map(([name, value]) => ({ name, value }))}
              total={5}
              columns={[
                { accessorKey: "name", header: "Komponen" },
                { accessorKey: "value", header: "Nilai" },
              ]}
            />
            <p>Penutupan tertahan sampai seluruh baris dan selisih diselesaikan.</p>
            <div className="crm-actions">
              {can("bank_reconciliation.review") && (
                <Button
                  variant="outline"
                  disabled={pending || row.statement.state === "CLOSED"}
                  onClick={() =>
                    void command(`/finance-controls/statements/${id}/review`).catch(() => undefined)
                  }
                >
                  Validasi Kesiapan Tutup
                </Button>
              )}
              {can("bank_reconciliation.close") && (
                <Button
                  disabled={pending || !row.ready || row.statement.state !== "READY"}
                  onClick={() =>
                    void command(`/finance-controls/statements/${id}/close`).catch(() => undefined)
                  }
                >
                  Tutup Rekonsiliasi
                </Button>
              )}
            </div>
          </Panel>
        ) : (
          <Notice>Pilih periode rekonsiliasi terlebih dahulu.</Notice>
        )}
      </TabsContent>
      <TabsContent value="gl">
        <Panel title="Rekonsiliasi subledger dan GL">
          <Badge variant="outline">{gl.data?.data.balanced ? "Sesuai" : "Perlu tindakan"}</Badge>
          <DataTable
            data={gl.data?.data.totals ?? []}
            total={gl.data?.data.totals.length ?? 0}
            columns={[
              { accessorKey: "kind", header: "Subledger" },
              { accessorKey: "currency", header: "Mata uang" },
              { accessorKey: "subledger", header: "Nilai sumber" },
              { accessorKey: "gl", header: "Buku besar" },
              { accessorKey: "difference", header: "Selisih" },
            ]}
          />
          <DataTable
            data={gl.data?.data.ar ?? []}
            total={gl.data?.data.ar.length ?? 0}
            columns={[
              { accessorKey: "currency", header: "Mata uang" },
              { accessorKey: "open_items", header: "Piutang terbuka" },
              { accessorKey: "gl", header: "GL AR" },
              { accessorKey: "difference", header: "Selisih" },
            ]}
          />
          {!!gl.data?.data.unmapped_sources.length && (
            <Notice>
              {gl.data.data.unmapped_sources.length} sumber historis belum memiliki jurnal
              terpetakan; perlu migrasi terverifikasi.
            </Notice>
          )}
        </Panel>
      </TabsContent>
    </Tabs>
  );
}
type StatementInputLine = {
  external_id: string;
  reference: string;
  value_date: string;
  amount: string;
  description: string;
};
function StatementImport({ command, pending, can }: Props) {
  const banks = useData<{ id: string; name: string }[]>(
    "/finance-controls/banks",
    can("bank_statement.import") || can("bank_reconciliation.read"),
  );
  const [bank, setBank] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [opening, setOpening] = useState(""),
    [closing, setClosing] = useState("");
  const [lines, setLines] = useState([
    { external_id: "", reference: "", value_date: "", amount: "", description: "" },
  ]);
  const [saved, setSaved] = useState("");
  const [importError, setImportError] = useState("");
  const lineColumns = useMemo(
    () =>
      Object.entries({
        external_id: "ID transaksi bank",
        reference: "Referensi",
        value_date: "Tanggal nilai",
        amount: "Nominal bertanda",
        description: "Uraian",
      }).map<ColumnDef<StatementInputLine>>(([field, label]) => ({
        id: field,
        header: label,
        cell: ({ row: r }) => (
          <TextField
            label={`${label} ${r.index + 1}`}
            value={r.original[field as keyof StatementInputLine]}
            type={field === "value_date" ? "date" : "text"}
            onChange={(value) =>
              setLines((old) => old.map((l, n) => (n === r.index ? { ...l, [field]: value } : l)))
            }
          />
        ),
      })),
    [],
  );
  return (
    <form
      className="web-form"
      onSubmit={(e) => {
        e.preventDefault();
        void command("/finance-controls/statements", {
          bank_account_id: bank,
          starts_on: from,
          ends_on: to,
          opening_balance: opening,
          closing_balance: closing,
          lines,
        })
          .then((r) => setSaved((r as { data: { id: string } }).data.id))
          .catch(() => undefined);
      }}
    >
      <Panel title="Sumber rekening koran">
        <Field>
          <FieldLabel htmlFor="bank-csv">Berkas mutasi CSV</FieldLabel>
          <Input
            id="bank-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImportError("");
              try {
                if (file.size > 2_000_000) throw new Error("CSV melebihi batas 2 MB.");
                setLines(parseBankStatementCsv(await file.text()));
                setSaved("");
              } catch (error) {
                setImportError(error instanceof Error ? error.message : "CSV gagal dibaca.");
              }
            }}
          />
          <p>
            Header: external_id,reference,value_date,amount,description. Tanggal YYYY-MM-DD; nominal
            memakai titik desimal tanpa pemisah ribuan.
          </p>
        </Field>
        {importError && <Notice>{importError}</Notice>}
        <FieldGroup className="otc-form-grid">
          <SelectionField
            label="Rekening"
            options={banks.data?.data ?? []}
            value={bank ? [bank] : []}
            onChange={(v) => setBank(v[0] ?? "")}
          />
          <TextField label="Mulai periode" type="date" value={from} onChange={setFrom} />
          <TextField label="Akhir periode" type="date" value={to} onChange={setTo} />
          <TextField label="Saldo awal koran" value={opening} onChange={setOpening} />
          <TextField label="Saldo akhir koran" value={closing} onChange={setClosing} />
        </FieldGroup>
      </Panel>
      <Panel title="Baris mutasi — staging">
        <DataTable
          formTable
          showColumns={false}
          data={lines}
          total={lines.length}
          columns={lineColumns}
        />
        <Button
          variant="outline"
          type="button"
          onClick={() =>
            setLines((l) => [
              ...l,
              { external_id: "", reference: "", value_date: "", amount: "", description: "" },
            ])
          }
        >
          Tambah Baris
        </Button>
        <Button disabled={pending || !can("bank_statement.import") || !bank}>Simpan Staging</Button>
        {saved && (
          <Link href={`/operations/reconciliation/${saved}`}>Buka pencocokan mutasi tersimpan</Link>
        )}
      </Panel>
    </form>
  );
}
export function FinanceConfiguration({ command, pending, can }: Props) {
  const q = useData<{
    accounts: { id: string; code: string; name: string }[];
    account_options: { id: string; code: string; name: string }[];
    periods: { id: string; startsOn: string; endsOn: string; state: string }[];
    profiles: { id: string; effectiveFrom: string; effectiveTo: string }[];
  }>("/finance-controls/configuration");
  const [kind, setKind] = useState("account"),
    [v, setV] = useState<Record<string, string>>({}),
    [mapping, setMapping] = useState<Record<string, string>>({});
  const text = (key: string, label: string, type = "text") => (
    <TextField
      key={key}
      label={label}
      type={type}
      value={v[key] ?? ""}
      onChange={(value) => setV((old) => ({ ...old, [key]: value }))}
    />
  );
  const kinds = [
    "INVENTORY",
    "INVENTORY_TRANSIT",
    "SALES_TAX",
    "SALE_REVENUE",
    "SALE_COGS",
    "UNBILLED_AR",
    "AR",
    "CUSTOMER_ADVANCE",
    "CASH_RECEIPT",
    "CASH_REFUND",
    "SALES_RETURN",
    "WAPU_TAX",
    "WITHHELD_TAX",
    "GRNI",
    "AP",
    "PURCHASE_RECEIPT",
    "PURCHASE_TAX",
  ];
  return (
    <>
      <Panel title="Konfigurasi akun dan posting">
        <SelectionField
          label="Jenis konfigurasi"
          value={[kind]}
          onChange={(x) => {
            setKind(x[0] ?? "account");
            setV({});
          }}
          options={[
            { id: "account", name: "Akun GL" },
            { id: "bank", name: "Rekening bank" },
            { id: "period", name: "Periode terbuka" },
            { id: "profile", name: "Pemetaan jurnal efektif" },
          ]}
        />
        <form
          className="web-form"
          onSubmit={(e) => {
            e.preventDefault();
            void command(
              `/finance-controls/configuration/${kind}`,
              kind === "profile" ? { ...v, mappings: mapping } : v,
            ).catch(() => undefined);
          }}
        >
          <FieldGroup className="otc-form-grid">
            {["account", "bank"].includes(kind) && (
              <>
                {text("code", "Kode")}
                {text("name", "Nama")}
              </>
            )}
            {kind === "account" && (
              <>
                <SelectionField
                  label="Klasifikasi"
                  options={["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((id) => ({
                    id,
                    name: id,
                  }))}
                  value={v.category ? [v.category] : []}
                  onChange={(x) => setV((s) => ({ ...s, category: x[0] ?? "" }))}
                />
                {text("control_kind", "Jenis kontrol (BANK untuk kas/bank)")}
              </>
            )}
            {kind === "bank" && (
              <>
                {text("bank_name", "Nama bank")}
                {text("last_four", "Empat digit terakhir rekening")}
                {text("currency", "Mata uang")}
                <SelectionField
                  label="Akun GL bank"
                  options={(q.data?.data.account_options ?? []).map((a) => ({
                    id: a.id,
                    name: `${a.code} · ${a.name}`,
                  }))}
                  value={v.account_id ? [v.account_id] : []}
                  onChange={(x) => setV((s) => ({ ...s, account_id: x[0] ?? "" }))}
                />
              </>
            )}
            {kind === "period" && (
              <>
                {text("starts_on", "Mulai periode", "date")}
                {text("ends_on", "Akhir periode", "date")}
              </>
            )}
            {kind === "profile" && (
              <>
                {text("effective_from", "Mulai berlaku", "date")}
                {text("effective_to", "Berakhir", "date")}
                {kinds.map((k) => (
                  <SelectionField
                    key={k}
                    label={k}
                    options={(q.data?.data.account_options ?? []).map((a) => ({
                      id: a.id,
                      name: `${a.code} · ${a.name}`,
                    }))}
                    value={mapping[k] ? [mapping[k]!] : []}
                    onChange={(x) => setMapping((m) => ({ ...m, [k]: x[0] ?? "" }))}
                  />
                ))}
              </>
            )}
          </FieldGroup>
          <Button
            disabled={
              pending ||
              !can(
                {
                  profile: "account_mapping.manage",
                  account: "account.create",
                  period: "finance_period.close",
                  bank: "bank_account.manage",
                }[kind] ?? "account_mapping.manage",
              )
            }
          >Simpan Konfigurasi</Button>
        </form>
      </Panel>
      {q.error && <Notice>{String(q.error)}</Notice>}
      <DataTable
        data={q.data?.data.accounts ?? []}
        total={q.data?.data.accounts.length ?? 0}
        columns={[
          { accessorKey: "code", header: "Kode Akun" },
          { accessorKey: "name", header: "Nama Akun" },
        ]}
      />
      <DataTable
        data={q.data?.data.periods ?? []}
        total={q.data?.data.periods.length ?? 0}
        columns={[
          { accessorKey: "startsOn", header: "Mulai" },
          { accessorKey: "endsOn", header: "Berakhir" },
          { accessorKey: "state", header: "Status periode" },
        ]}
      />
    </>
  );
}

type OfficialDocument = {
  id: string;
  number: string;
  sourceType: string;
  sourceId: string;
  documentDate: string;
  state: string;
  evidenceId: string;
};
function OfficialTaxDocuments({ command, pending, can }: Props) {
  const q = useData<OfficialDocument[]>("/finance-controls/official-tax-documents");
  const sources = useData<{
    invoices: { id: string; number: string }[];
    advances: { id: string; amount: string; receiptId: string }[];
  }>("/finance-controls/tax-sources", can("tax_component.create"));
  const [type, setType] = useState("SALES_INVOICE"),
    [source, setSource] = useState(""),
    [number, setNumber] = useState(""),
    [date, setDate] = useState(""),
    [evidence, setEvidence] = useState(""),
    [reason, setReason] = useState("");
  const options =
    type === "SALES_INVOICE"
      ? (sources.data?.data.invoices ?? []).map((r) => ({ id: r.id, name: r.number }))
      : (sources.data?.data.advances ?? []).map((r) => ({
          id: r.id,
          name: `${r.receiptId} · pajak ${r.amount}`,
        }));
  return (
    <>
      {(q.error || sources.error) && <Notice>{String(q.error || sources.error)}</Notice>}
      <Panel title="Dokumen Faktur Pajak Keluaran">
        <DataTable
          data={q.data?.data ?? []}
          total={q.data?.data.length ?? 0}
          columns={[
            { accessorKey: "number", header: "Nomor faktur pajak" },
            {
              id: "date",
              header: "Tanggal",
              cell: ({ row }) => row.original.documentDate.slice(0, 10),
            },
            {
              id: "sourceType",
              header: "Sumber",
              cell: ({ row }) =>
                row.original.sourceType === "SALES_INVOICE" ? "Invoice komersial" : "Uang muka",
            },
            {
              id: "state",
              header: "Status verifikasi",
              cell: ({ row }) =>
                ({
                  VERIFIED: "Terverifikasi",
                  REJECTED: "Ditolak",
                  PENDING_VERIFICATION: "Menunggu verifikasi",
                })[row.original.state] ?? row.original.state,
            },
            {
              id: "evidence",
              header: "Bukti",
              cell: ({ row }) => <Evidence id={row.original.evidenceId} />,
            },
            {
              id: "actions",
              header: "Tindakan",
              cell: ({ row }) =>
                row.original.state === "PENDING_VERIFICATION" &&
                can("tax_component.verify") && (
                  <div className="crm-actions">
                    {[
                      { decision: "VERIFIED", label: "Verifikasi" },
                      { decision: "REJECTED", label: "Tolak" },
                    ].map((x) => (
                      <Button
                        key={x.decision}
                        variant="outline"
                        disabled={pending || !reason.trim()}
                        onClick={() =>
                          void command(
                            `/finance-controls/official-tax-documents/${row.original.id}/verify`,
                            { decision: x.decision, reason },
                          ).catch(() => undefined)
                        }
                      >
                        {x.label}
                      </Button>
                    ))}
                  </div>
                ),
            },
          ]}
        />
        <TextField
          label="Catatan pemeriksaan bukti"
          value={reason}
          onChange={setReason}
          required={false}
        />
      </Panel>
      {can("tax_component.create") && (
        <Panel title="Catat Faktur Pajak Resmi">
          <form
            className="web-form"
            onSubmit={(e) => {
              e.preventDefault();
              void command("/finance-controls/official-tax-documents", {
                source_type: type,
                source_id: source,
                number,
                document_date: date,
                evidence_id: evidence,
              })
                .then(() => {
                  setNumber("");
                  setSource("");
                })
                .catch(() => undefined);
            }}
          >
            <FieldGroup className="otc-form-grid">
              <SelectionField
                label="Jenis sumber"
                value={[type]}
                onChange={(v) => {
                  setType(v[0] ?? "SALES_INVOICE");
                  setSource("");
                }}
                options={[
                  { id: "SALES_INVOICE", name: "Invoice komersial" },
                  { id: "ADVANCE_TAX", name: "Pajak uang muka" },
                ]}
              />
              <SelectionField
                label="Dokumen sumber"
                value={source ? [source] : []}
                onChange={(v) => setSource(v[0] ?? "")}
                options={options}
              />
              <TextField label="Nomor faktur pajak resmi" value={number} onChange={setNumber} />
              <TextField label="Tanggal faktur pajak" type="date" value={date} onChange={setDate} />
              <Upload purpose="TAX" onChange={setEvidence} />
            </FieldGroup>
            <p className="text-muted-foreground">
              Pencatatan bukti resmi terpisah dari invoice komersial. Nomor dan bukti berasal dari
              dokumen pajak yang diterbitkan.
            </p>
            <Button disabled={pending || !evidence || !source}>Simpan Dokumen</Button>
          </form>
        </Panel>
      )}
    </>
  );
}
