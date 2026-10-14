"use client";

import { RefreshCw } from "lucide-react";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

export function businessDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export function formatBusinessTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function WorkspaceEmpty({ title, reason }: { title: string; reason?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {reason && <EmptyDescription>{reason}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}
export function WorkspaceFreshness({
  preview,
  loading,
  failed,
  updatedAt,
  refresh,
  scope,
}: {
  preview: boolean;
  loading: boolean;
  failed: boolean;
  updatedAt?: string | undefined;
  refresh: () => void;
  scope: string;
}) {
  return (
    <div className="executive-freshness">
      <span>{scope}</span>
      <button className="executive-refresh" disabled={loading} onClick={refresh}>
        <RefreshCw aria-hidden="true" className="executive-refresh-icon" />
        {failed
          ? "Gagal diperbarui — coba lagi"
          : loading
            ? "Memuat…"
            : preview
              ? "Diperbarui 28 Sep 2026, 09.41 WITA"
              : updatedAt
                ? `Diperiksa ${formatBusinessTime(updatedAt)} WITA`
                : "Belum tersedia"}
      </button>
    </div>
  );
}
