"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { NumberFormat } from "@evflow/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageNotice } from "@/components/web/page-frame";
import { SelectionField } from "@/components/web/selection-field";
import { ApiError, apiRequest } from "@/lib/api";
import { setFormatterDefaults } from "@/lib/format";
import { hasCompanyPermission } from "@/lib/navigation";
import { preferencesKey } from "@/lib/settings";
import { useSession } from "../../session-provider";
import type { SettingPolicy } from "../settings-forms";
import { SettingFrame, SettingSection, usePolicyForm, useVersionedDraft } from "../settings-ui";

type Company = {
  base_currency: string;
  timezone: string;
  fiscal_year_start_month: number;
  fiscal_year_start_day: number;
  version: number;
};
type Fiscal = { timezone: string; month: string; day: string };

const months = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const monthOptions = months.map((name, i) => ({ id: String(i + 1), name }));
const thousandOptions = [
  { id: ".", name: "Titik (1.000)" },
  { id: ",", name: "Koma (1,000)" },
  { id: " ", name: "Spasi (1 000)" },
];
const decimalOptions = [
  { id: ",", name: "Koma (0,5)" },
  { id: ".", name: "Titik (0.5)" },
];
const decimalPlaces = [0, 1, 2, 3, 4].map((n) => ({ id: String(n), name: `${n} angka` }));

const groups: Record<string, string> = {
  company: "Perusahaan",
  finance: "Finance",
  warehouse: "Gudang",
  crm: "CRM",
  visit: "Kunjungan",
  hr: "HR",
  system: "Sistem",
};
const scalar = ["string", "integer", "decimal", "boolean"];
/** Sales terms live on the sales page; number format has its own editor above. */
const elsewhere = new Set(["OPS-FLX-01", "OPS-FLX-02", "OPS-FLX-03", "OPS-FLX-04", "OPS-FLX-06"]);

function display(value: unknown) {
  if (value === true) return "Ya";
  if (value === false) return "Tidak";
  if (value == null || value === "") return "Belum diatur";
  if (typeof value === "object") return "Beberapa nilai";
  return String(value);
}

export default function GeneralSettingsPage() {
  const { principal } = useSession();
  const can = (code: string) => (principal ? hasCompanyPermission(principal, code) : false);
  return (
    <SettingFrame
      title="Kebijakan Umum"
      subtitle="Zona waktu, tahun buku, format angka dan parameter umum. Perubahan berlaku untuk transaksi baru."
      permission="setting_general.read"
    >
      <div className="setting-stack">
        <FiscalSection canEdit={can("setting_general.update")} />
        <NumberFormatSection canEdit={can("setting_general.update")} />
        <OtherPolicies canEdit={can("setting_general.update")} />
      </div>
    </SettingFrame>
  );
}

function FiscalSection({ canEdit }: { canEdit: boolean }) {
  const cache = useQueryClient(),
    { reload } = useSession();
  const query = useQuery({
    queryKey: ["settings", "general"],
    queryFn: async () => (await apiRequest<{ data: Company }>("/settings/general")).data,
  });
  const company = query.data;
  const draft = useVersionedDraft<Fiscal>(
    company
      ? {
          version: company.version,
          value: {
            timezone: company.timezone,
            month: String(company.fiscal_year_start_month),
            day: String(company.fiscal_year_start_day),
          },
        }
      : undefined,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false);
  const zones = useMemo(
    () =>
      Array.from(new Set(["UTC", ...Intl.supportedValuesOf("timeZone")])).map((id) => ({
        id,
        name: id,
      })),
    [],
  );
  const value = draft.value;
  const day = Number(value?.day);
  const dayError =
    value && (!Number.isInteger(day) || day < 1 || day > 28)
      ? "Tanggal awal tahun buku 1 sampai 28."
      : "";
  const save = async () => {
    if (!company || !value || dayError) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/settings/general", {
        method: "PATCH",
        version: draft.version ?? company.version,
        body: JSON.stringify({
          timezone: value.timezone,
          fiscal_year_start_month: Number(value.month),
          fiscal_year_start_day: day,
        }),
      });
      draft.reset();
      setConflict(false);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["settings", "general"] }),
        cache.invalidateQueries({ queryKey: preferencesKey }),
      ]);
      await reload();
      toast.success("Zona waktu dan tahun buku disimpan");
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) {
        setConflict(true);
        setError("Pengaturan ini baru saja diubah orang lain. Isian Anda belum disimpan.");
      } else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const reloadLatest = async () => {
    draft.reset();
    setConflict(false);
    setError("");
    await query.refetch();
  };
  return (
    <SettingSection
      title="Zona waktu dan tahun buku"
      description="Menentukan tanggal bisnis, nomor dokumen bulanan dan periode tahun buku."
      canEdit={canEdit}
      form={{
        save,
        reload: reloadLatest,
        busy,
        error,
        conflict,
        dirty: draft.dirty && !dayError,
        query,
      }}
    >
      {value && company && (
        <div className="page-frame-fields web-form setting-form">
          <SelectionField
            label="Zona waktu"
            value={[value.timezone]}
            options={zones}
            onChange={(v) => canEdit && v[0] && draft.set({ ...value, timezone: v[0] })}
          />
          <SelectionField
            label="Bulan awal tahun buku"
            value={[value.month]}
            options={monthOptions}
            onChange={(v) => canEdit && v[0] && draft.set({ ...value, month: v[0] })}
          />
          <label>
            Tanggal awal tahun buku
            <Input
              inputMode="numeric"
              value={value.day}
              disabled={!canEdit}
              aria-invalid={!!dayError}
              onChange={(e) => draft.set({ ...value, day: e.target.value })}
            />
            {dayError && <span className="page-frame-field-error">{dayError}</span>}
          </label>
          <label>
            Mata uang dasar
            <Input value={company.base_currency} disabled readOnly />
          </label>
        </div>
      )}
    </SettingSection>
  );
}

function NumberFormatSection({ canEdit }: { canEdit: boolean }) {
  const cache = useQueryClient();
  const form = usePolicyForm<NumberFormat>("OPS-FLX-06", (saved) => {
    setFormatterDefaults(saved);
    void cache.invalidateQueries({ queryKey: preferencesKey });
  });
  const value = form.value;
  const patch = (change: Partial<NumberFormat>) =>
    value && canEdit && form.set({ ...value, ...change });
  return (
    <SettingSection
      title="Format angka"
      description="Cara angka uang dan kuantitas ditampilkan di seluruh aplikasi dan dokumen baru."
      form={form}
      canEdit={canEdit}
    >
      {value && (
        <div className="page-frame-fields web-form setting-form">
          <SelectionField
            label="Pemisah ribuan"
            value={[value.thousand_separator]}
            options={thousandOptions}
            onChange={(v) =>
              v[0] && patch({ thousand_separator: v[0] as NumberFormat["thousand_separator"] })
            }
          />
          <SelectionField
            label="Pemisah desimal"
            value={[value.decimal_separator]}
            options={decimalOptions}
            onChange={(v) =>
              v[0] && patch({ decimal_separator: v[0] as NumberFormat["decimal_separator"] })
            }
          />
          <SelectionField
            label="Desimal uang"
            value={[String(value.money_decimals)]}
            options={decimalPlaces}
            onChange={(v) => v[0] && patch({ money_decimals: Number(v[0]) })}
          />
          <SelectionField
            label="Desimal kuantitas"
            value={[String(value.quantity_decimals)]}
            options={decimalPlaces}
            onChange={(v) => v[0] && patch({ quantity_decimals: Number(v[0]) })}
          />
        </div>
      )}
    </SettingSection>
  );
}

function OtherPolicies({ canEdit }: { canEdit: boolean }) {
  const query = useQuery({
    queryKey: ["settings", "policies"],
    queryFn: async () =>
      (await apiRequest<{ data: SettingPolicy[] }>("/operational-policies")).data,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const byGroup = Object.entries(
    (query.data ?? [])
      .filter((policy) => !elsewhere.has(policy.code))
      .reduce<Record<string, SettingPolicy[]>>((acc, policy) => {
        (acc[policy.group] ??= []).push(policy);
        return acc;
      }, {}),
  );
  if (query.isError)
    return (
      <PageNotice tone="error" onRetry={() => void query.refetch()}>
        Kebijakan belum dapat dimuat.
      </PageNotice>
    );
  if (!query.data) return <p role="status">Memuat…</p>;
  return (
    <>
      {byGroup.map(([group, policies]) => (
        <section key={group} className="page-frame-panel setting-section">
          <h2 className="font-semibold">{groups[group] ?? group}</h2>
          <ul className="grid gap-1">
            {policies.map((policy) => (
              <li key={policy.code} className="border-t py-2">
                {editing === policy.code ? (
                  <PolicyEditor policy={policy} onDone={() => setEditing(null)} />
                ) : (
                  <div className="setting-section-head">
                    <div>
                      <strong>{policy.name}</strong>
                      <p className="page-frame-subtitle">
                        {display(policy.active_version?.value)}
                        {policy.active_version &&
                          ` · diubah oleh ${policy.active_version.saved_by}`}
                      </p>
                    </div>
                    {!scalar.includes(policy.value_type) ? (
                      <span className="page-frame-subtitle">Diubah melalui halaman terkait</span>
                    ) : (
                      canEdit && (
                        <Button variant="outline" size="sm" onClick={() => setEditing(policy.code)}>
                          Ubah
                        </Button>
                      )
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="page-frame-subtitle">
        Termin, ongkos kirim dan kredit diatur di{" "}
        <Link className="page-frame-link" href="/setting/sales">
          halaman Penjualan
        </Link>
        .
      </p>
    </>
  );
}

function PolicyEditor({ policy, onDone }: { policy: SettingPolicy; onDone: () => void }) {
  const cache = useQueryClient();
  const options = policy.validation_schema?.enum;
  const draft = useVersionedDraft<unknown>(
    policy.active_version
      ? { version: policy.latest_version_no, value: policy.active_version.value }
      : undefined,
  );
  const value = draft.value ?? "";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = policy.value_type === "integer" ? Number.parseInt(String(value), 10) : value;
      await apiRequest(`/operational-policies/${policy.code}`, {
        method: "PATCH",
        version: draft.version ?? policy.latest_version_no,
        body: JSON.stringify({ value: payload }),
      });
      await cache.invalidateQueries({ queryKey: ["settings", "policies"] });
      toast.success("Kebijakan disimpan");
      onDone();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 412
          ? "Kebijakan ini baru saja diubah orang lain. Muat ulang lalu ubah kembali."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="web-form setting-form grid gap-2">
      <strong>{policy.name}</strong>
      {policy.value_type === "boolean" ? (
        <label className="setting-inline">
          <Switch checked={value === true} onCheckedChange={(v) => draft.set(v)} />
          {value === true ? "Ya" : "Tidak"}
        </label>
      ) : options ? (
        <SelectionField
          label="Nilai"
          value={[String(value)]}
          options={options.map((o) => ({ id: String(o), name: String(o) }))}
          onChange={(v) => draft.set(v[0] ?? value)}
        />
      ) : (
        <Input
          aria-label={policy.name}
          inputMode={policy.value_type === "string" ? "text" : "decimal"}
          value={String(value ?? "")}
          onChange={(e) => draft.set(e.target.value)}
        />
      )}
      {error && (
        <PageNotice
          tone="error"
          onRetry={() => void cache.invalidateQueries({ queryKey: ["settings", "policies"] })}
        >
          {error}
        </PageNotice>
      )}
      <div className="setting-inline">
        <Button variant="outline" onClick={onDone}>
          Batal
        </Button>
        <Button disabled={busy || !draft.dirty} onClick={() => void save()}>
          {busy ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
