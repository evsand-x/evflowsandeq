"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageNotice } from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../../session-provider";
import { previewDocumentNumber } from "../settings-forms";
import { SettingFrame } from "../settings-ui";

type Row = {
  document_kind: string;
  label: string;
  prefix: string | null;
  digits: number | null;
  year_format: "YYYY" | "YY" | null;
  reset_period: "YEARLY" | "MONTHLY" | null;
  effective_from: string | null;
  next_preview: string | null;
  pending: { reset_period: "YEARLY" | "MONTHLY"; effective_from: string } | null;
  active: boolean;
};
const key = ["settings", "numbering"] as const;
const today = new Intl.DateTimeFormat("en-CA").format(new Date());
const resetLabel = { YEARLY: "Reset tahunan", MONTHLY: "Reset bulanan" } as const;

export default function NumberingPage() {
  const { principal } = useSession();
  const canEdit = principal ? hasCompanyPermission(principal, "numbering_rule.manage") : false;
  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await apiRequest<{ data: Row[] }>("/settings/numbering")).data,
  });
  const [editing, setEditing] = useState<Row | null>(null);
  return (
    <SettingFrame
      title="Penomoran Dokumen"
      subtitle="Format nomor untuk setiap jenis dokumen. Perubahan berlaku untuk dokumen baru."
      permission="numbering_rule.read"
    >
      {query.isError ? (
        <PageNotice tone="error" onRetry={() => void query.refetch()}>
          Penomoran belum dapat dimuat.
        </PageNotice>
      ) : !query.data ? (
        <p role="status">Memuat…</p>
      ) : (
        <section className="page-frame-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th scope="col">Jenis dokumen</th>
                <th scope="col">Format</th>
                <th scope="col">Nomor berikutnya</th>
                <th scope="col">Berlaku sejak</th>
                {canEdit && (
                  <th scope="col">
                    <span className="sr-only">Aksi</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {query.data.map((row) => (
                <tr key={row.document_kind} className="border-t">
                  <td className="py-2">{row.label}</td>
                  <td>
                    {row.active ? (
                      <>
                        {`${row.prefix}.${row.year_format === "YY" ? "TT" : "TTTT"}.BB.${"0".repeat(row.digits ?? 0)}`}
                        <span className="page-frame-subtitle block">
                          {row.reset_period ? resetLabel[row.reset_period] : ""}
                          {row.pending
                            ? ` � ${resetLabel[row.pending.reset_period]} mulai ${row.pending.effective_from}`
                            : ""}
                        </span>
                      </>
                    ) : (
                      "Belum diatur"
                    )}
                  </td>
                  <td>{row.next_preview ?? "—"}</td>
                  <td>{row.effective_from ?? "—"}</td>
                  {canEdit && (
                    <td className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                        Ubah
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} />}
    </SettingFrame>
  );
}

function EditDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const cache = useQueryClient();
  const [prefix, setPrefix] = useState(row.prefix ?? ""),
    [digits, setDigits] = useState(String(row.digits ?? 4)),
    [yearFormat, setYearFormat] = useState<"YYYY" | "YY">(row.year_format ?? "YYYY"),
    [resetPeriod, setResetPeriod] = useState<"YEARLY" | "MONTHLY">(row.reset_period ?? "MONTHLY"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // One key per dialog so a double click or a retry cannot create two revisions.
  const idempotency = useRef(crypto.randomUUID());
  const digitCount = Number.parseInt(digits, 10);
  const valid = /^[A-Z0-9/._-]{1,20}$/.test(prefix) && digitCount >= 3 && digitCount <= 10;
  const next = row.next_preview?.match(/(\d+)$/)?.[1]?.replace(/^0+(?=\d)/, "") ?? "1";
  const resetChanges = row.active && row.reset_period !== null && resetPeriod !== row.reset_period;
  const [yy, mm] = today.split("-").map(Number) as [number, number];
  const boundary =
    resetPeriod === "YEARLY" || mm === 12
      ? `${yy + 1}-01-01`
      : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/settings/numbering/${row.document_kind}`, {
        method: "PUT",
        headers: { "Idempotency-Key": idempotency.current },
        body: JSON.stringify({
          prefix,
          year_format: yearFormat,
          digits: digitCount,
          reset_period: resetPeriod,
        }),
      });
      await cache.invalidateQueries({ queryKey: key });
      toast.success("Format nomor disimpan");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah format {row.label}</DialogTitle>
          <DialogDescription>
            Urutan nomor tetap berlanjut; nomor yang sudah terpakai tidak berubah.
          </DialogDescription>
        </DialogHeader>
        <div className="web-form setting-form grid gap-3">
          <label>
            Awalan *
            <Input
              value={prefix}
              aria-invalid={!valid && prefix !== ""}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            />
            <span className="page-frame-subtitle">Huruf besar, angka, atau / . _ -</span>
          </label>
          <label>
            Jumlah digit urutan *
            <Input
              inputMode="numeric"
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
            />
            <span className="page-frame-subtitle">Antara 3 dan 10.</span>
          </label>
          <label>
            Format tahun
            <select
              value={yearFormat}
              onChange={(e) => setYearFormat(e.target.value as "YYYY" | "YY")}
            >
              <option value="YYYY">4 digit (2026)</option>
              <option value="YY">2 digit (26)</option>
            </select>
          </label>
          <label className="setting-inline">
            <Checkbox
              checked={resetPeriod === "MONTHLY"}
              onCheckedChange={(v) => setResetPeriod(v === true ? "MONTHLY" : "YEARLY")}
            />
            Reset bulanan (urutan kembali ke 1 setiap bulan; jika tidak, reset tahunan)
          </label>
          {resetChanges && (
            <p className="page-frame-subtitle">Perubahan reset berlaku mulai {boundary}.</p>
          )}
          <p className="text-sm">
            Contoh nomor berikutnya:{" "}
            <strong>
              {valid ? previewDocumentNumber(prefix, yearFormat, digitCount, today, next) : "�"}
            </strong>
          </p>
          {error && <PageNotice tone="error">{error}</PageNotice>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!valid || busy} onClick={() => void save()}>
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
