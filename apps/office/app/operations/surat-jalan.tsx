"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { ErrorBox, Upload, Evidence } from "./workspace";
import { remainingQuantity } from "./surat-jalan-utils";
import "./outbound.css";

type Line = {
  id: string;
  product: { name: string; code: string; baseUom?: { name: string } };
  orderedQuantity?: string;
  ordered?: string;
  accepted?: string;
  deliveredQuantity?: string;
  remaining?: string;
  warehouseId?: string | null;
};
type Note = {
  id: string;
  number: string;
  state: "DRAFT" | "ISSUED";
  salesOrderId: string;
  salesOrder: { number: string; customer?: { name: string } };
  lines: {
    id: string;
    salesOrderLineId: string;
    quantity: string;
    deliveredQuantity?: string;
    product?: { name: string; code: string };
  }[];
  issuedAt?: string | null;
  receiverName?: string | null;
  evidenceId?: string | null;
  notes?: string | null;
};
const keyFor = (url: string, body: unknown) => `${url}:${JSON.stringify(body)}`;

export function SuratJalanWorkspace({ path }: { path: string[] }) {
  const id = path[1];
  const fromOrder = path[1] === "from-order" ? path[2] : undefined;
  const { principal, state } = useSession();
  const canRead = !!principal && hasCompanyPermission(principal, "outbound_shipping.read");
  const canDispatch = !!principal && hasCompanyPermission(principal, "fulfillment.dispatch");
  const canInvoice = !!principal && hasCompanyPermission(principal, "sales_invoice.post");
  if (!principal)
    return (
      <main className="ob-auth">
        <p>{state === "loading" ? "Memuat sesi…" : "Silakan masuk."}</p>
        <Link href="/login">Masuk</Link>
      </main>
    );
  if (!canRead)
    return (
      <main className="ob-auth">
        <p role="alert">Anda tidak memiliki izin melihat Surat Jalan.</p>
      </main>
    );
  if (!id) return <SuratJalanList />;
  if (fromOrder) return <SuratJalanDraft orderId={fromOrder} canDispatch={canDispatch} />;
  return <SuratJalanDetail id={id} canDispatch={canDispatch} canInvoice={canInvoice} />;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="ob-page">
      <header className="ob-page-header">
        <div>
          <p className="ob-eyebrow">Warehouse & Logistik · Barang Keluar</p>
          <h1>{title}</h1>
          <p className="ob-page-subtitle">
            Surat Jalan terbit menjadi bukti serah terima dan sumber Invoice.
          </p>
        </div>
        <Link className="ob-link" href="/operations/orders">
          Kembali ke Sales Order
        </Link>
      </header>
      {children}
    </main>
  );
}
function useCommand() {
  const client = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const run = async (url: string, body: unknown, method = "POST") => {
    const sig = keyFor(url, body);
    const key = keys.current.get(sig) ?? crypto.randomUUID();
    keys.current.set(sig, key);
    setPending(true);
    setError("");
    try {
      const r = await apiRequest<{ data: Note }>(url, {
        method,
        headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      keys.current.delete(sig);
      await client.invalidateQueries({ queryKey: ["surat-jalan"] });
      return r.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan belum terkonfirmasi.");
      throw e;
    } finally {
      setPending(false);
    }
  };
  return { run, error, pending };
}
function SuratJalanList() {
  const { principal } = useSession();
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["surat-jalan", principal?.company_id, search],
    queryFn: () =>
      apiRequest<{ data: { rows: Note[]; total: number } }>(
        `/delivery-notes?search=${encodeURIComponent(search)}`,
      ),
  });
  const rows = q.data?.data.rows ?? [];
  return (
    <Shell title="Surat Jalan">
      <div className="ob-toolbar">
        <Input
          aria-label="Cari Surat Jalan"
          placeholder="Cari nomor, SO atau pelanggan"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {q.isPending && <p>Memuat Surat Jalan…</p>}
      {q.isError && <ErrorBox message="Daftar Surat Jalan belum dapat dimuat." />}
      {!q.isPending && !rows.length && <p className="ob-empty">Belum ada Surat Jalan.</p>}{" "}
      {!!rows.length && (
        <div className="ob-table-wrap">
          <table className="ob-table">
            <thead>
              <tr>
                <th>Nomor</th>
                <th>Sales Order</th>
                <th>Pelanggan</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td>
                    <Link className="ob-link" href={`/operations/delivery-notes/${n.id}`}>
                      {n.number}
                    </Link>
                  </td>
                  <td>{n.salesOrder.number}</td>
                  <td>{n.salesOrder.customer?.name ?? "Belum tersedia"}</td>
                  <td>
                    <span className="ob-badge">{n.state === "ISSUED" ? "Terbit" : "Draf"}</span>
                  </td>
                  <td>
                    <Link href={`/operations/delivery-notes/${n.id}`}>Buka</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
function SuratJalanDraft({ orderId, canDispatch }: { orderId: string; canDispatch: boolean }) {
  const { principal } = useSession();
  const q = useQuery({
    queryKey: ["surat-jalan", "order", principal?.company_id, orderId],
    queryFn: () =>
      apiRequest<{
        data: { id: string; number: string; lines: Line[]; customer?: { name: string } };
      }>(`/operations/orders/${orderId}`),
  });
  const progress = useQuery({
    queryKey: ["surat-jalan", "delivered", principal?.company_id, orderId],
    queryFn: () => apiRequest<{ data: Record<string, string> }>(`/delivery-notes/orders/${orderId}/delivered`),
  });
  const { run, error, pending } = useCommand();
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const lines = q.data?.data.lines ?? [];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      sales_order_id: orderId,
      notes,
      lines: lines
        .filter((l) => qty[l.id] && new Decimal(qty[l.id] ?? "0").gt(0))
        .map((l) => ({
          sales_order_line_id: l.id,
          quantity: qty[l.id],
          ...(l.warehouseId ? { warehouse_id: l.warehouseId } : {}),
        })),
    };
    if (!payload.lines.length || progress.isPending || progress.isError) return;
    const note = await run("/delivery-notes", payload);
    window.location.href = `/operations/delivery-notes/${note.id}`;
  };
  return (
    <Shell title="Buat Surat Jalan">
      <form className="ob-panel" onSubmit={submit}>
        {error && <ErrorBox message={error} />} {q.isPending && <p>Memuat Sales Order…</p>}
        {q.isError && <ErrorBox message="Sales Order belum dapat dimuat." />}
        {progress.isPending && <p>Memuat jumlah terkirim…</p>}
        {progress.isError && <ErrorBox message="Jumlah terkirim belum dapat dimuat." />}
        {lines.map((l) => {
          const delivered = progress.data?.data[l.id] ?? "0";
          const ordered = l.orderedQuantity ?? l.ordered ?? "0";
          const rem = remainingQuantity(ordered, delivered);
          return (
            <div className="ob-line" key={l.id}>
              <div>
                <strong>{l.product.name}</strong>
                <small>
                  {l.product.code} · Dipesan {ordered} · Terkirim {delivered} · Sisa {rem}
                </small>
              </div>
              <Input
                aria-label={`Jumlah ${l.product.name}`}
                inputMode="decimal"
                value={qty[l.id] ?? ""}
                placeholder={rem}
                onChange={(e) => setQty((old) => ({ ...old, [l.id]: e.target.value }))}
              />
            </div>
          );
        })}
        <label className="ob-field">
          <span>Catatan</span>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <footer className="ob-actions">
          <Button type="submit" disabled={!canDispatch || pending || progress.isPending || progress.isError}>
            {pending ? "Menyimpan…" : "Simpan draf"}
          </Button>
        </footer>
      </form>
    </Shell>
  );
}
function SuratJalanDetail({
  id,
  canDispatch,
  canInvoice,
}: {
  id: string;
  canDispatch: boolean;
  canInvoice: boolean;
}) {
  const { principal } = useSession();
  const q = useQuery({
    queryKey: ["surat-jalan", principal?.company_id, id],
    queryFn: () => apiRequest<{ data: Note }>(`/delivery-notes/${id}`),
  });
  const { run, error, pending } = useCommand();
  const [receiver, setReceiver] = useState("");
  const [handover, setHandover] = useState(() => new Date().toISOString().slice(0, 16));
  const [evidence, setEvidence] = useState("");
  const note = q.data?.data;
  const issue = async () => {
    if (!note) return;
    const result = await run(`/delivery-notes/${id}/issue`, {
      handover_at: new Date(handover).toISOString(),
      receiver_name: receiver,
      evidence_id: evidence,
      lines: note.lines.map((l) => ({
        sales_order_line_id: l.salesOrderLineId,
        delivered_quantity: l.quantity,
      })),
    });
    window.location.href = `/operations/delivery-notes/${result.id}`;
  };
  const invoice = async () => {
    const result = await run("/sales-invoices/from-delivery-note", { surat_jalan_id: id });
    window.location.href = `/operations/invoices/${result.id}`;
  };
  return (
    <Shell title={note ? `${note.number} · Surat Jalan` : "Surat Jalan"}>
      {q.isPending && <p>Memuat Surat Jalan…</p>}
      {q.isError && <ErrorBox message="Surat Jalan belum dapat dimuat." />}
      {note && (
        <>
          <section className="ob-panel">
            <dl className="ob-summary">
              <div>
                <dt>Sales Order</dt>
                <dd>{note.salesOrder.number}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{note.state === "ISSUED" ? "Terbit" : "Draf"}</dd>
              </div>
            </dl>
            {error && <ErrorBox message={error} />}{" "}
            {note.state === "DRAFT" && (
              <>
                <label className="ob-field">
                  <span>Diterima oleh *</span>
                  <Input required value={receiver} onChange={(e) => setReceiver(e.target.value)} />
                </label>
                <label className="ob-field">
                  <span>Waktu serah terima *</span>
                  <Input
                    type="datetime-local"
                    required
                    value={handover}
                    onChange={(e) => setHandover(e.target.value)}
                  />
                </label>
                <Upload purpose="SURAT_JALAN" onChange={setEvidence} />
                <Button
                  disabled={!canDispatch || pending || !receiver || !evidence}
                  onClick={() => void issue()}
                >
                  Terbitkan Surat Jalan
                </Button>
              </>
            )}
            {note.state === "ISSUED" && (
              <>
                <p className="ob-success">Surat Jalan terbit dan tercatat sebagai serah terima.</p>
                <Evidence id={note.evidenceId ?? ""} />
                {canInvoice && (
                  <Button disabled={pending} onClick={() => void invoice()}>
                    Buat Invoice
                  </Button>
                )}
              </>
            )}
          </section>
          <section className="ob-panel">
            <h2>Rincian barang</h2>
            <ul>
              {note.lines.map((l) => (
                <li key={l.id}>
                  {l.product?.name ?? l.salesOrderLineId} · {l.quantity}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Shell>
  );
}
