"use client";
import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload } from "./workspace";
import { amount } from "./sales-order-types";
import { quantityText } from "./surat-jalan-utils";
import { useNoteCommand } from "./surat-jalan-command";
import "./sales-order-r1.css";
import "./surat-jalan-form.css";
const D = Decimal.clone({ precision: 50 });
const qtyPattern = /^\d{1,14}(\.\d{1,10})?$/;
const localNow = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
};
const reasons = ["Ditolak: kemasan rusak", "Kurang muat dari gudang", "Lainnya"];

export function ReceiptDialog({
  open,
  noteId,
  lines,
  onClose,
  onReceived,
}: {
  open: boolean;
  noteId: string;
  lines: { id: string; name: string; unit: string; sent: string }[];
  onClose: () => void;
  onReceived: (id: string) => void;
}) {
  const { run, error, pending, setError } = useNoteCommand();
  const [handoverAt, setHandoverAt] = useState(localNow);
  const [receiver, setReceiver] = useState("");
  const [receiverTitle, setReceiverTitle] = useState("");
  const [received, setReceived] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    if (open) {
      setHandoverAt(localNow());
      setReceiver("");
      setReceiverTitle("");
      setEvidence("");
      setReason("");
      setOtherReason("");
      setReceived({});
      setLocalError("");
      setError("");
    }
  }, [open, noteId, setError]);
  const rows = lines.map((l) => {
    const raw = received[l.id] ?? l.sent;
    const value = qtyPattern.test(raw) ? new D(raw) : null;
    const diff = value ? new D(l.sent).sub(value) : null;
    return { ...l, raw, value, diff };
  });
  const hasDiff = rows.some((r) => r.diff && r.diff.gt(0));
  const reasonText = reason === "Lainnya" ? otherReason.trim() : reason;
  const confirm = async () => {
    setLocalError("");
    if (!handoverAt) return setLocalError("Isi waktu serah terima.");
    if (receiver.trim().length < 2) return setLocalError("Isi nama penerima.");
    const bad = rows.find((r) => !r.value || r.value.lt(0) || r.value.gt(r.sent));
    if (bad)
      return setLocalError(
        `Qty diterima ${bad.name} harus 0 atau lebih dan paling banyak ${amount(bad.sent)}.`,
      );
    if (hasDiff && !reasonText) return setLocalError("Pilih alasan selisih.");
    if (!evidence) return setLocalError("Lampirkan bukti serah terima.");
    try {
      await run(`/delivery-notes/${noteId}/receipt`, {
        handover_at: new Date(handoverAt).toISOString(),
        receiver_name: receiver.trim(),
        ...(receiverTitle.trim() ? { receiver_title: receiverTitle.trim() } : {}),
        evidence_id: evidence,
        lines: rows.map((r) => ({
          sales_order_line_id: r.id,
          delivered_quantity: r.value!.toString(),
          ...(r.diff && r.diff.gt(0) ? { discrepancy_reason: reasonText } : {}),
        })),
      });
      onReceived(noteId);
    } catch {
      // Pesan server tampil di dialog; tidak ada perubahan stok bila ditolak.
    }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="sj-issue web-form sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Penerimaan Barang</DialogTitle>
          <DialogDescription>
            Catat barang yang diterima pelanggan beserta bukti penerimaannya.
          </DialogDescription>
        </DialogHeader>
        <div className="sor-grid" style={{ marginTop: 0 }}>
          <label className="sor-field">
            Waktu serah terima *
            <Input
              type="datetime-local"
              step="0.001"
              value={handoverAt}
              onChange={(e) => setHandoverAt(e.target.value)}
            />
          </label>
          <label className="sor-field">
            Nama penerima *
            <Input value={receiver} maxLength={200} onChange={(e) => setReceiver(e.target.value)} />
          </label>
          <label className="sor-field" style={{ gridColumn: "1 / -1" }}>
            <span>
              Jabatan / unit penerima <span className="sor-hint">Opsional</span>
            </span>
            <Input
              value={receiverTitle}
              maxLength={200}
              onChange={(e) => setReceiverTitle(e.target.value)}
            />
          </label>
        </div>
        <table className="sj-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th className="sor-num">Dikirim</th>
              <th className="sor-num" style={{ width: 130 }}>
                Diterima *
              </th>
              <th className="sor-num">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong className="sj-product">{r.name}</strong>
                </td>
                <td className="sor-num">{quantityText(r.sent, r.unit)}</td>
                <td className="sor-num">
                  <Input
                    aria-label={`Qty diterima ${r.name}`}
                    inputMode="decimal"
                    className="sor-num"
                    value={r.raw}
                    onChange={(e) =>
                      setReceived((old) => ({ ...old, [r.id]: e.target.value.trim() }))
                    }
                  />
                </td>
                <td className={`sor-num ${r.diff && r.diff.gt(0) ? "sj-warn" : ""}`}>
                  {r.diff && r.diff.gt(0) ? `âˆ’${amount(r.diff.toString())}` : "0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasDiff && (
          <div className="sor-grid" style={{ marginTop: 0 }}>
            <label className="sor-field">
              Alasan selisih / penolakan *
              <select
                className="sj-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">Pilih alasan</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <span className="sor-hint">
                Selisih dicatat untuk ditindaklanjuti. Stok dan invoice tidak berubah otomatis.
              </span>
            </label>
            {reason === "Lainnya" && (
              <label className="sor-field">
                Keterangan alasan *
                <Input
                  value={otherReason}
                  maxLength={1000}
                  onChange={(e) => setOtherReason(e.target.value)}
                />
              </label>
            )}
          </div>
        )}
        <div>
          <Upload purpose="SURAT_JALAN" onChange={setEvidence} />
          <span className="sor-hint">
            Foto Surat Jalan bertanda tangan. Disimpan privat, hanya untuk pengguna berizin.
          </span>
        </div>
        {(localError || error) && (
          <p role="alert" className="sor-err">
            {localError || error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Batal
          </Button>
          <Button type="button" disabled={pending} onClick={() => void confirm()}>
            {pending ? "Menyimpan…" : "Simpan penerimaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
