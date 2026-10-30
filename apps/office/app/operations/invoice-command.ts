"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { invoiceMessage } from "./invoice-utils";

/** Perintah Invoice dengan Idempotency-Key per isi permintaan; sukses hanya setelah server menjawab. */
export function useInvoiceCommand() {
  const client = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const run = async <T = { id: string; number: string; state: string; version: number }>(
    url: string,
    body: unknown,
    method = "POST",
  ) => {
    const sig = `${method}:${url}:${JSON.stringify(body)}`;
    const key = keys.current.get(sig) ?? crypto.randomUUID();
    keys.current.set(sig, key);
    setPending(true);
    setError("");
    try {
      const r = await apiRequest<{ data: T }>(url, {
        method,
        headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      keys.current.delete(sig);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["invoices"] }),
        client.invalidateQueries({ queryKey: ["surat-jalan"] }),
      ]);
      return r.data;
    } catch (e) {
      setError(invoiceMessage(e));
      throw e;
    } finally {
      setPending(false);
    }
  };
  return { run, error, pending, setError };
}
