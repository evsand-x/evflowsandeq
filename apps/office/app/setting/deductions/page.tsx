"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { SelectionField } from "@/components/web/selection-field";
import { ApiError, apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../../session-provider";
import { SettingFrame } from "../settings-ui";

type Deduction = {
  id: string;
  name: string;
  settleAccountId: string;
  proofType: "BUKTI_POTONG" | "SSP_NTPN" | "NONE";
  proofRequired: boolean;
  active: boolean;
  version: number;
};
type Account = { id: string; code: string; name: string; category: string; active: boolean };

const listKey = ["settings", "deduction-types"] as const;
const proofLabels: Record<string, string> = {
  BUKTI_POTONG: "Bukti potong",
  SSP_NTPN: "SSP / NTPN",
  NONE: "Tanpa bukti",
};

export default function DeductionTypesPage() {
  const { principal } = useSession();
  const canEdit = principal ? hasCompanyPermission(principal, "deduction_type.manage") : false;
  const [editing, setEditing] = useState<Deduction | "new" | null>(null);
  const list = useQuery({
    queryKey: listKey,
    queryFn: async () =>
      (await apiRequest<{ data: Deduction[] }>("/settings/deduction-types")).data,
  });
  const accounts = useQuery({
    queryKey: [...listKey, "accounts"],
    queryFn: async () =>
      (await apiRequest<{ data: Account[] }>("/settings/deduction-types/accounts")).data,
  });
  const accountName = (id: string) => {
    const a = accounts.data?.find((x) => x.id === id);
    return a ? `${a.code} · ${a.name}${a.active ? "" : " (nonaktif)"}` : "—";
  };
  return (
    <SettingFrame
      title="Jenis Potongan"
      subtitle="Potongan yang boleh dipotong pelanggan dari pembayaran. Setiap jenis punya akun penyelesaian dan aturan bukti; berlaku umum, tidak per pelanggan."
      permission="deduction_type.read"
      actions={
        canEdit ? (
          <Button onClick={() => setEditing("new")} disabled={!accounts.data}>
            Buat Jenis Potongan
          </Button>
        ) : undefined
      }
    >
      <section className="page-frame-panel setting-section" aria-labelledby="deduction-list">
        <header className="setting-section-head">
          <div>
            <h2 id="deduction-list">Daftar jenis potongan</h2>
            <p className="page-frame-subtitle">
              Hanya jenis yang aktif muncul saat menerima pembayaran. Perubahan tidak mengubah
              pembayaran yang sudah dicatat.
            </p>
          </div>
        </header>
        {list.isError ? (
          <PageNotice tone="error" onRetry={() => void list.refetch()}>
            Daftar jenis potongan belum dapat dimuat.
          </PageNotice>
        ) : !list.data ? (
          <p role="status" className="page-frame-subtitle">
            Memuat…
          </p>
        ) : list.data.length === 0 ? (
          <p className="page-frame-subtitle">Belum ada jenis potongan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th scope="col">Nama</th>
                  <th scope="col">Akun penyelesaian</th>
                  <th scope="col">Jenis bukti</th>
                  <th scope="col">Bukti wajib</th>
                  <th scope="col">Status</th>
                  {canEdit && (
                    <th scope="col">
                      <span className="sr-only">Aksi</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {list.data.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="py-2">{row.name}</td>
                    <td>{accountName(row.settleAccountId)}</td>
                    <td>{proofLabels[row.proofType] ?? row.proofType}</td>
                    <td>{row.proofRequired ? "Ya" : "Tidak"}</td>
                    <td>{row.active ? "Aktif" : "Nonaktif"}</td>
                    {canEdit && (
                      <td className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!accounts.data}
                          onClick={() => setEditing(row)}
                        >
                          Ubah
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && accounts.data && (
        <DeductionDialog
          key={editing === "new" ? "new" : editing.id}
          row={editing === "new" ? undefined : editing}
          accounts={accounts.data}
          onClose={() => setEditing(null)}
        />
      )}
    </SettingFrame>
  );
}

function DeductionDialog({
  row,
  accounts,
  onClose,
}: {
  row?: Deduction | undefined;
  accounts: Account[];
  onClose: () => void;
}) {
  const cache = useQueryClient();
  // The version is fixed when the dialog opens, so a concurrent change is refused, not overwritten.
  const version = useRef(row?.version);
  const [draft, setDraft] = useState({
    name: row?.name ?? "",
    settle_account_id: row?.settleAccountId ?? "",
    proof_type: row?.proofType ?? "BUKTI_POTONG",
    proof_required: row?.proofRequired ?? false,
    active: row?.active ?? true,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false);
  const valid =
    draft.name.trim() !== "" &&
    draft.settle_account_id !== "" &&
    !(draft.proof_required && draft.proof_type === "NONE");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/settings/deduction-types${row ? `/${row.id}` : ""}`, {
        method: row ? "PATCH" : "POST",
        ...(row && version.current ? { version: version.current } : {}),
        body: JSON.stringify({ ...draft, name: draft.name.trim() }),
      });
      await cache.invalidateQueries({ queryKey: listKey });
      toast.success("Jenis potongan disimpan");
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStale(e instanceof ApiError && e.status === 412);
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? `Ubah ${row.name}` : "Buat jenis potongan"}</DialogTitle>
          <DialogDescription>
            Akun penyelesaian harus akun rincian yang aktif. Bukti yang diwajibkan harus dilampirkan
            sebelum pembayaran dapat diselesaikan.
          </DialogDescription>
        </DialogHeader>
        <div className="web-form setting-form grid gap-3">
          <label>
            Nama *
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </label>
          <SelectionField
            label="Akun penyelesaian *"
            value={draft.settle_account_id ? [draft.settle_account_id] : []}
            options={accounts
              .filter((a) => a.active || a.id === draft.settle_account_id)
              .map((a) => ({
                id: a.id,
                name: `${a.code} · ${a.name}${a.active ? "" : " (nonaktif)"}`,
              }))}
            onChange={(v) => v[0] && setDraft((d) => ({ ...d, settle_account_id: v[0]! }))}
          />
          <SelectionField
            label="Jenis bukti"
            value={[draft.proof_type]}
            options={Object.entries(proofLabels).map(([id, name]) => ({ id, name }))}
            onChange={(v) =>
              v[0] &&
              setDraft((d) => ({
                ...d,
                proof_type: v[0] as Deduction["proofType"],
                proof_required: v[0] === "NONE" ? false : d.proof_required,
              }))
            }
          />
          <label className="setting-inline">
            <Switch
              checked={draft.proof_required}
              disabled={draft.proof_type === "NONE"}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, proof_required: v }))}
            />
            Bukti wajib untuk menyelesaikan pembayaran
          </label>
          <label className="setting-inline">
            <Switch
              checked={draft.active}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))}
            />
            Aktif
          </label>
          {error && (
            <PageNotice
              tone="error"
              {...(stale
                ? {
                    onRetry: () => {
                      void cache.invalidateQueries({ queryKey: listKey });
                      onClose();
                    },
                  }
                : {})}
            >
              {error}
            </PageNotice>
          )}
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
