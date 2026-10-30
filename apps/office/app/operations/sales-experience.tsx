"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DataTable } from "../crm/crm-common";
import { Upload, Evidence } from "./workspace";
import "./sales-experience.css";

export function SalesNavigation({ active }: { active: "orders" | "proformas" | "invoices" }) {
  const { principal } = useSession();
  const items = [
    { key: "orders", name: "Sales Order", permissions: ["sales_order.read"] },
    { key: "invoices", name: "Invoice", permissions: ["sales_invoice.read"] },
  ];
  return (
    <nav className="sales-document-nav" aria-label="Dokumen penjualan">
      {items
        .filter((i) => principal && i.permissions.some((p) => hasCompanyPermission(principal, p)))
        .map((i) => (
          <Link
            key={i.key}
            href={`/operations/${i.key}`}
            aria-current={active === i.key ? "page" : undefined}
          >
            {i.name}
          </Link>
        ))}
    </nav>
  );
}

export function SalesPeriod() {
  return (
    <Button
      type="button"
      variant="outline"
      disabled
      title="Filter periode belum tersedia pada sumber daftar ini. Data mencakup seluruh periode."
    >
      Periode: Semua
    </Button>
  );
}
export function SalesBadge({ children }: { children: string }) {
  const tone = /ditahan|perlu revisi|batal|belum dibayar/i.test(children)
    ? "danger"
    : /sebagian|backorder|menunggu|proses|^belum/i.test(children)
      ? "warning"
      : /lunas|lolos|^diterbitkan$|^terbit$|selesai|^diserahkan$|open/i.test(children)
        ? "success"
        : "neutral";
  return <span className={`sales-badge sales-badge-${tone}`}>{children}</span>;
}
type Handoff = {
  id: string;
  occurredAt: string;
  metadata: {
    delivered_at: string;
    delivered_by: string;
    recipient: string;
    medium: string;
    evidence_id: string;
    promise_date?: string;
    notes?: string;
  };
};
export function DocumentHandoff({
  kind,
  id,
  editable,
}: {
  kind: "proforma" | "invoice";
  id: string;
  editable: boolean;
}) {
  const { principal } = useSession();
  const client = useQueryClient();
  const endpoint = `/operations/commercial-handoffs/${kind}/${id}`;
  const query = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      endpoint,
    ],
    queryFn: () => apiRequest<{ data: Handoff[] }>(endpoint),
  });
  const [date, setDate] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [person, setPerson] = useState(principal?.display_name ?? ""),
    [recipient, setRecipient] = useState(""),
    [medium, setMedium] = useState("IN_PERSON"),
    [promise, setPromise] = useState(""),
    [notes, setNotes] = useState(""),
    [proof, setProof] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const keys = useRef(new Map<string, string>()),
    busy = useRef(false);
  async function save() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const body = JSON.stringify({
        delivered_at: new Date(date).toISOString(),
        delivered_by: person,
        recipient,
        medium,
        evidence_id: proof,
        promise_date: promise || null,
        notes,
      });
      const key = keys.current.get(body) ?? crypto.randomUUID();
      keys.current.set(body, key);
      await apiRequest(endpoint, { method: "POST", headers: { "Idempotency-Key": key }, body });
      keys.current.delete(body);
      await client.invalidateQueries({ queryKey: ["operations"] });
      toast.success("Penyerahan dokumen tersimpan.");
      setProof("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const rows = query.data?.data ?? [];
  return (
    <>
      <section className="sales-handoff so-no-print">
        <header>
          <h2>
            {kind === "invoice" ? "Catat tukar faktur / follow-up" : "Catat penyerahan dokumen"}
          </h2>
          <SalesBadge>
            {query.isPending
              ? "Memuat"
              : query.isError
                ? "Belum terverifikasi"
                : rows.length
                  ? "Diserahkan"
                  : "Belum diserahkan"}
          </SalesBadge>
        </header>
        {(error || query.error) && <p role="alert">{error || String(query.error)}</p>}
        {editable && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={pending}>
              <div className="sales-field-grid">
                <label>
                  Tanggal serah
                  <Input
                    type="datetime-local"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label>
                  Diserahkan oleh
                  <Input
                    required
                    maxLength={200}
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                  />
                </label>
                <label>
                  Diterima oleh (PIC pelanggan)
                  <Input
                    required
                    maxLength={200}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </label>
                <SelectionField
                  label="Media"
                  options={[
                    { id: "IN_PERSON", name: "Tatap muka" },
                    { id: "COURIER", name: "Kurir" },
                    { id: "EMAIL", name: "Email" },
                    { id: "OTHER", name: "Lainnya" },
                  ]}
                  value={[medium]}
                  onChange={(v) => setMedium(v[0] ?? "IN_PERSON")}
                />
                {kind === "invoice" && (
                  <label>
                    Janji bayar (opsional)
                    <Input
                      type="date"
                      value={promise}
                      onChange={(e) => setPromise(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Catatan
                  <Textarea
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>
              <Upload
                key={rows.length}
                purpose={kind === "invoice" ? "INVOICE_HANDOFF" : "PROFORMA_HANDOFF"}
                onChange={setProof}
              />
              <p className="sales-notice">
                Status Diserahkan memerlukan bukti terima. Janji bayar tidak mengurangi saldo atau
                mengubah jatuh tempo. Bukti saat ini JPEG/PNG hingga 2 MB.
              </p>
              <Button disabled={pending || !proof}>
                {pending ? "Menyimpan…" : "Simpan penyerahan"}
              </Button>
            </fieldset>
          </form>
        )}
      </section>
      <section className="sales-handoff so-no-print">
        <h2>{kind === "invoice" ? "Riwayat penagihan" : "Riwayat penyerahan"}</h2>
        <DataTable
          data={rows}
          total={rows.length}
          showColumns={false}
          columns={[
            {
              id: "date",
              header: "Tanggal",
              cell: ({ row: r }) =>
                new Date(r.original.metadata.delivered_at).toLocaleString("id-ID"),
            },
            {
              id: "actor",
              header: "Petugas",
              cell: ({ row: r }) => r.original.metadata.delivered_by,
            },
            {
              id: "recipient",
              header: "PIC pelanggan",
              cell: ({ row: r }) => r.original.metadata.recipient,
            },
            {
              id: "promise",
              header: "Janji bayar",
              cell: ({ row: r }) => r.original.metadata.promise_date ?? "—",
            },
            {
              id: "proof",
              header: "Bukti",
              cell: ({ row: r }) => <Evidence id={r.original.metadata.evidence_id} />,
            },
          ]}
        />
      </section>
    </>
  );
}

export function HandoffStatus({ kind, id }: { kind: "invoice" | "proforma"; id: string }) {
  const { principal } = useSession();
  const endpoint = `/operations/commercial-handoffs/${kind}/${id}`;
  const q = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      endpoint,
    ],
    queryFn: () => apiRequest<{ data: Handoff[] }>(endpoint),
  });
  return (
    <div className="sales-checklist">
      <div>
        <span>Dicetak</span>
        <SalesBadge>Belum terlacak</SalesBadge>
      </div>
      <div>
        <span>Bukti terima</span>
        <SalesBadge>
          {q.isPending
            ? "Memuat"
            : q.isError
              ? "Belum terverifikasi"
              : q.data?.data.length
                ? "Diserahkan"
                : "Belum ada"}
        </SalesBadge>
      </div>
    </div>
  );
}

export function InvoiceProgress({
  id,
  draft,
  payment,
}: {
  id: string;
  draft: boolean;
  payment: string | null;
}) {
  const { principal } = useSession();
  const endpoint = `/operations/commercial-handoffs/invoice/${id}`;
  const query = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      endpoint,
    ],
    queryFn: () => apiRequest<{ data: Handoff[] }>(endpoint),
    enabled: !draft,
  });
  const active = draft
    ? 0
    : payment === "Lunas"
      ? 4
      : payment?.toLowerCase() === "dibayar sebagian"
        ? 3
        : query.data?.data.length
          ? 2
          : 1;
  return (
    <ol className="sales-progress so-no-print" aria-label="Tahap Invoice">
      {["Draft", "Diposting", "Diserahkan", "Dibayar sebagian", "Lunas"].map((label, index) => (
        <li key={label} aria-current={active === index ? "step" : undefined}>
          {label}
        </li>
      ))}
    </ol>
  );
}
