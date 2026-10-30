"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

const messages: Record<string, string> = {
  DELIVERY_NOTE_NOT_ISSUED: "Terbitkan Surat Jalan sebelum mencatat penerimaan.",
  DELIVERY_NOTE_ALREADY_RECEIVED: "Penerimaan sudah dicatat. Muat ulang untuk melihat datanya.",
  DELIVERY_NOTE_RECEIPT_DATE_INVALID:
    "Waktu penerimaan harus setelah SJ terbit dan tidak boleh di masa depan.",
  DELIVERY_NOTE_RECEIPT_QTY_INVALID: "Jumlah diterima tidak boleh melebihi jumlah yang dikirim.",
  DELIVERY_NOTE_DISCREPANCY_REASON_REQUIRED: "Isi alasan selisih jumlah diterima.",
  SURAT_JALAN_EVIDENCE_REQUIRED: "Lampirkan bukti penerimaan yang sesuai.",
  STOCK_INSUFFICIENT: "Stok layak tidak cukup untuk menerbitkan Surat Jalan ini.",
};

/** Perintah dengan Idempotency-Key per isi permintaan; sukses hanya setelah server menjawab. */
export function useNoteCommand() {
  const client = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const run = async (url: string, body: unknown, method = "POST") => {
    const sig = `${method}:${url}:${JSON.stringify(body)}`;
    const key = keys.current.get(sig) ?? crypto.randomUUID();
    keys.current.set(sig, key);
    setPending(true);
    setError("");
    try {
      const r = await apiRequest<{ data: { id: string; number: string; state: string } }>(url, {
        method,
        headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      keys.current.delete(sig);
      await client.invalidateQueries({ queryKey: ["surat-jalan"] });
      if (url.endsWith("/issue")) {
        await Promise.all(
          ["operations", "invoices", "inventory"].map((key) =>
            client.invalidateQueries({ queryKey: [key] }),
          ),
        );
      }
      return r.data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Permintaan belum terkonfirmasi.";
      setError(messages[message] ?? message);
      throw e;
    } finally {
      setPending(false);
    }
  };
  return { run, error, pending, setError };
}
