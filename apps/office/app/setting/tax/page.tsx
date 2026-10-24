"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { canBeDefault, effectiveTaxPercent, taxPayload, type TaxDraft } from "../settings-forms";
import { SettingFrame } from "../settings-ui";

type Tax = {
  id: string;
  name: string;
  kind: string;
  effect: string;
  usage: string;
  accountId: string;
  percentage: string;
  dppFactor: string;
  decimalPlaces: number;
  rounding: string;
  active: boolean;
  version: number;
  effectiveFrom: string;
  isDefaultSales: boolean;
  isDefaultPurchase: boolean;
};
type Account = { id: string; code: string; name: string; category: string; active: boolean };

const listKey = (q: string, page: number) => ["settings", "tax", "list", q, page] as const;
const usageLabels: Record<string, string> = {
  SALES: "Penjualan",
  PURCHASE: "Pembelian",
  BOTH: "Penjualan & Pembelian",
};
const roundingOptions = [
  { id: "HALF_UP", name: "Terdekat, tengah ke atas" },
  { id: "HALF_EVEN", name: "Terdekat, tengah ke genap" },
  { id: "DOWN", name: "Potong desimal" },
];
const factorOptions = [
  { id: "0.9166666667", name: "11/12 dari harga (DPP nilai lain)" },
  { id: "1", name: "Penuh (seluruh harga)" },
];
const percent = (value: string) => `${value.replace(".", ",")}%`;
const factorLabel = (value: string) =>
  factorOptions.find((o) => o.id === String(Number(value)) || o.id === value)?.name ??
  value.replace(".", ",");

export default function TaxSettingPage() {
  const { principal } = useSession();
  const canEdit = principal ? hasCompanyPermission(principal, "tax_setting.update") : false;
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<Tax | "new" | null>(null);
  const list = useQuery({
    queryKey: listKey(search, page),
    queryFn: () =>
      apiRequest<{ data: Tax[]; total: number }>(
        `/tax/master?q=${encodeURIComponent(search)}&page=${page}`,
      ),
  });
  const defaults = useQuery({
    queryKey: ["settings", "tax", "defaults"],
    queryFn: async () => (await apiRequest<{ data: Tax[] }>("/tax/options")).data,
  });
  const accounts = useQuery({
    queryKey: ["settings", "tax", "accounts"],
    queryFn: async () => (await apiRequest<{ data: Account[] }>("/tax/accounts")).data,
  });
  const accountName = (id: string) => {
    const a = accounts.data?.find((x) => x.id === id);
    return a ? `${a.code} · ${a.name}${a.active ? "" : " (nonaktif)"}` : "—";
  };
  const sales = defaults.data?.find((t) => t.isDefaultSales);
  const purchase = defaults.data?.find((t) => t.isDefaultPurchase);
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 20));
  return (
    <SettingFrame
      title="Pajak"
      subtitle="Daftar pajak dan pajak bawaan. Setiap invoice penjualan memakai PPN bawaan; perubahan hanya berlaku untuk dokumen baru."
      permission="tax_setting.read"
      actions={
        canEdit ? (
          <Button onClick={() => setEditing("new")} disabled={!accounts.data}>
            Buat Pajak
          </Button>
        ) : undefined
      }
    >
      <div className="setting-stack">
        <section className="page-frame-panel setting-section" aria-labelledby="tax-defaults">
          <header className="setting-section-head">
            <div>
              <h2 id="tax-defaults">Pajak bawaan</h2>
              <p className="page-frame-subtitle">
                Dipakai otomatis tanpa pilihan per baris. Dokumen menyimpan tarif, faktor DPP dan
                akun saat dibuat.
              </p>
            </div>
          </header>
          {defaults.isError ? (
            <PageNotice tone="error" onRetry={() => void defaults.refetch()}>
              Pajak bawaan belum dapat dimuat.
            </PageNotice>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(
                [
                  ["Penjualan (PPN Keluaran)", sales],
                  ["Pembelian (PPN Masukan)", purchase],
                ] as const
              ).map(([label, tax]) => (
                <div key={label}>
                  <dt className="page-frame-subtitle">{label}</dt>
                  <dd>
                    {defaults.isLoading
                      ? "Memuat…"
                      : tax
                        ? `${tax.name} · ${percent(tax.percentage)} × ${factorLabel(tax.dppFactor)} = efektif ${percent(effectiveTaxPercent(tax.percentage, tax.dppFactor) ?? "")}`
                        : "Belum diatur"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {defaults.isSuccess && !sales && (
            <PageNotice tone="error">
              Pajak penjualan bawaan belum diatur. Sales Order tidak dapat diajukan sampai satu
              pajak ditandai sebagai bawaan penjualan.
            </PageNotice>
          )}
        </section>
        <section className="page-frame-panel setting-section" aria-labelledby="tax-list">
          <header className="setting-section-head">
            <div>
              <h2 id="tax-list">Daftar pajak</h2>
              <p className="page-frame-subtitle">
                Satu pajak memakai satu akun buku besar. Pajak bawaan tidak dapat dinonaktifkan.
              </p>
            </div>
            <Input
              aria-label="Cari pajak"
              placeholder="Cari nama pajak…"
              className="max-w-xs"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </header>
          {list.isError ? (
            <PageNotice tone="error" onRetry={() => void list.refetch()}>
              Daftar pajak belum dapat dimuat.
            </PageNotice>
          ) : !list.data ? (
            <p role="status" className="page-frame-subtitle">
              Memuat…
            </p>
          ) : list.data.data.length === 0 ? (
            <p className="page-frame-subtitle">Belum ada pajak.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th scope="col">Nama pajak</th>
                    <th scope="col">Penggunaan</th>
                    <th scope="col">Tarif</th>
                    <th scope="col">Bagian harga dikenai pajak</th>
                    <th scope="col">Akun</th>
                    <th scope="col">Status</th>
                    {canEdit && (
                      <th scope="col">
                        <span className="sr-only">Aksi</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {list.data.data.map((tax) => (
                    <tr key={tax.id} className="border-t align-top">
                      <td className="py-2">
                        {tax.name}
                        <span className="page-frame-subtitle block">
                          {[
                            tax.kind === "PPH" ? "PPh" : tax.kind,
                            tax.effect === "ADD" ? "ditambahkan" : "dipotong",
                            tax.isDefaultSales && "bawaan penjualan",
                            tax.isDefaultPurchase && "bawaan pembelian",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </td>
                      <td>{usageLabels[tax.usage] ?? tax.usage}</td>
                      <td>{percent(tax.percentage)}</td>
                      <td>{factorLabel(tax.dppFactor)}</td>
                      <td>{accountName(tax.accountId)}</td>
                      <td>{tax.active ? "Aktif" : "Nonaktif"}</td>
                      {canEdit && (
                        <td className="text-right">
                          <div className="setting-inline justify-end">
                            {(["SALES", "PURCHASE"] as const).map((usage) =>
                              canBeDefault(tax, usage) &&
                              !(usage === "SALES" ? tax.isDefaultSales : tax.isDefaultPurchase) ? (
                                <DefaultButton key={usage} tax={tax} usage={usage} />
                              ) : null,
                            )}
                            <Button variant="outline" size="sm" onClick={() => setEditing(tax)}>
                              Ubah
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="setting-inline justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </Button>
              <span className="page-frame-subtitle">
                Halaman {page} dari {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </section>
      </div>
      {editing && accounts.data && (
        <TaxDialog
          key={editing === "new" ? "new" : editing.id}
          row={editing === "new" ? undefined : editing}
          accounts={accounts.data}
          onClose={() => setEditing(null)}
        />
      )}
    </SettingFrame>
  );
}

function DefaultButton({ tax, usage }: { tax: Tax; usage: "SALES" | "PURCHASE" }) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const label = usage === "SALES" ? "Jadikan bawaan penjualan" : "Jadikan bawaan pembelian";
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiRequest(`/tax/master/${tax.id}/default`, {
            method: "POST",
            version: tax.version,
            headers: { "Idempotency-Key": crypto.randomUUID() },
            body: JSON.stringify({ usage }),
          });
          await cache.invalidateQueries({ queryKey: ["settings", "tax"] });
          await cache.invalidateQueries({ queryKey: ["tax-options"] });
          toast.success(
            `${tax.name} menjadi pajak bawaan ${usage === "SALES" ? "penjualan" : "pembelian"}`,
          );
        } catch (e) {
          toast.error(e instanceof Error ? e.message : String(e));
          await cache.invalidateQueries({ queryKey: ["settings", "tax"] });
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

function TaxDialog({
  row,
  accounts,
  onClose,
}: {
  row?: Tax | undefined;
  accounts: Account[];
  onClose: () => void;
}) {
  const cache = useQueryClient();
  // The version is fixed when the dialog opens, so a concurrent change is refused, not overwritten.
  const version = useRef(row?.version);
  const idempotency = useRef(crypto.randomUUID());
  const [draft, setDraft] = useState<TaxDraft>({
    name: row?.name ?? "",
    kind: row?.kind ?? "PPN",
    usage: row?.usage ?? "SALES",
    effect: row?.effect ?? "ADD",
    account_id: row?.accountId ?? "",
    percentage: row?.percentage ?? "",
    dpp_factor: row ? (String(Number(row.dppFactor)) === "1" ? "1" : row.dppFactor) : "1",
    decimal_places: String(row?.decimalPlaces ?? 2),
    rounding: row?.rounding ?? "HALF_UP",
    active: row?.active ?? true,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false);
  const set = <K extends keyof TaxDraft>(key: K, value: TaxDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const isDefault = !!row && (row.isDefaultSales || row.isDefaultPurchase);
  const effective = effectiveTaxPercent(draft.percentage, draft.dpp_factor);
  const places = Number(draft.decimal_places);
  const valid =
    draft.name.trim() !== "" &&
    draft.account_id !== "" &&
    /^\d{1,3}([.,]\d{1,8})?$/.test(draft.percentage.trim()) &&
    /^\d([.,]\d{1,10})?$/.test(draft.dpp_factor.trim()) &&
    Number(draft.dpp_factor.replace(",", ".")) > 0 &&
    Number(draft.dpp_factor.replace(",", ".")) <= 1 &&
    Number.isInteger(places) &&
    places >= 0 &&
    places <= 8;
  const choice = (
    label: string,
    key: "kind" | "usage" | "effect" | "rounding" | "account_id" | "dpp_factor",
    options: { id: string; name: string }[],
  ) => (
    <SelectionField
      label={label}
      value={draft[key] ? [draft[key]] : []}
      options={options}
      onChange={(v) => v[0] && set(key, v[0])}
    />
  );
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/tax/master${row ? `/${row.id}` : ""}`, {
        method: row ? "PATCH" : "POST",
        ...(row && version.current ? { version: version.current } : {}),
        headers: { "Idempotency-Key": idempotency.current },
        body: JSON.stringify(taxPayload(draft, new Date().toISOString())),
      });
      await cache.invalidateQueries({ queryKey: ["settings", "tax"] });
      await cache.invalidateQueries({ queryKey: ["tax-options"] });
      toast.success("Pajak disimpan");
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStale(e instanceof ApiError && /diubah orang lain/.test(message));
      setError(message);
      // A refused command may be retried with changed input; it needs a fresh key.
      idempotency.current = crypto.randomUUID();
    } finally {
      setBusy(false);
    }
  };
  const factorChoices = factorOptions.some((o) => o.id === draft.dpp_factor)
    ? factorOptions
    : [...factorOptions, { id: draft.dpp_factor, name: draft.dpp_factor.replace(".", ",") }];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? `Ubah ${row.name}` : "Buat pajak"}</DialogTitle>
          <DialogDescription>
            Berlaku sejak disimpan. Dokumen yang sudah dibuat tetap memakai tarif lamanya.
          </DialogDescription>
        </DialogHeader>
        <div className="web-form setting-form grid gap-3">
          <label>
            Nama pajak *
            <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          {choice("Jenis pajak", "kind", [
            { id: "PPN", name: "PPN" },
            { id: "PPH", name: "PPh" },
          ])}
          {choice(
            "Penggunaan",
            "usage",
            Object.entries(usageLabels).map(([id, name]) => ({ id, name })),
          )}
          {choice("Perlakuan pada transaksi", "effect", [
            { id: "ADD", name: "Ditambahkan ke tagihan" },
            { id: "DEDUCT", name: "Dipotong dari tagihan" },
          ])}
          {choice(
            "Akun pajak *",
            "account_id",
            accounts
              .filter((a) => a.active || a.id === draft.account_id)
              .map((a) => ({ id: a.id, name: `${a.code} · ${a.name}` })),
          )}
          <label>
            Tarif (%) *
            <Input
              inputMode="decimal"
              value={draft.percentage}
              onChange={(e) => set("percentage", e.target.value)}
            />
          </label>
          {choice("Bagian harga yang dikenai pajak (DPP)", "dpp_factor", factorChoices)}
          <p className="page-frame-subtitle">
            {effective
              ? `Pajak efektif ${percent(effective)} dari harga.`
              : "Isi tarif untuk melihat pajak efektif."}{" "}
            PPN 12% dengan DPP 11/12 menghasilkan 11% dari harga.
          </p>
          <label>
            Jumlah desimal
            <Input
              inputMode="numeric"
              value={draft.decimal_places}
              onChange={(e) => set("decimal_places", e.target.value.replace(/\D/g, ""))}
            />
          </label>
          {choice("Pembulatan", "rounding", roundingOptions)}
          <label className="setting-inline">
            <Switch
              checked={draft.active}
              disabled={isDefault}
              onCheckedChange={(v) => set("active", v)}
            />
            Aktif
          </label>
          {isDefault && (
            <p className="page-frame-subtitle">
              Pajak bawaan tidak dapat dinonaktifkan. Jadikan pajak lain sebagai bawaan terlebih
              dahulu.
            </p>
          )}
          {error && (
            <PageNotice
              tone="error"
              {...(stale
                ? {
                    onRetry: () => {
                      void cache.invalidateQueries({ queryKey: ["settings", "tax"] });
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
