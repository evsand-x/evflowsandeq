"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageNotice } from "@/components/web/page-frame";
import { SelectionField } from "@/components/web/selection-field";
import { ApiError, apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../../session-provider";
import type { SettingPolicy } from "../settings-forms";
import { SettingFrame } from "../settings-ui";

const groups: Record<string, string> = {
  company: "Perusahaan",
  sales: "Penjualan",
  finance: "Finance",
  warehouse: "Gudang",
  crm: "CRM",
  visit: "Kunjungan",
  hr: "HR",
  system: "Sistem",
};
const scalar = ["string", "integer", "decimal", "boolean"];
const salesPage = new Set(["OPS-FLX-01", "OPS-FLX-02", "OPS-FLX-03", "OPS-FLX-04"]);

function display(value: unknown) {
  if (value === true) return "Ya";
  if (value === false) return "Tidak";
  if (value == null || value === "") return "Belum diatur";
  if (typeof value === "object") return "Beberapa nilai";
  return String(value);
}

export default function PoliciesPage() {
  const { principal } = useSession();
  const canEdit = principal ? hasCompanyPermission(principal, "operational_policy.update") : false;
  const query = useQuery({
    queryKey: ["settings", "policies"],
    queryFn: async () =>
      (await apiRequest<{ data: SettingPolicy[] }>("/operational-policies")).data,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const byGroup = Object.entries(
    (query.data ?? []).reduce<Record<string, SettingPolicy[]>>((acc, policy) => {
      (acc[policy.group] ??= []).push(policy);
      return acc;
    }, {}),
  );
  return (
    <SettingFrame
      title="Kebijakan Operasional"
      subtitle="Parameter bisnis yang dapat diubah. Perubahan berlaku untuk transaksi baru."
      permission="operational_policy.read"
    >
      {query.isError ? (
        <PageNotice tone="error" onRetry={() => void query.refetch()}>
          Kebijakan belum dapat dimuat.
        </PageNotice>
      ) : !query.data ? (
        <p role="status">Memuat…</p>
      ) : (
        <div className="setting-stack">
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
                        {salesPage.has(policy.code) ? (
                          <Link className="page-frame-link" href="/setting/sales">
                            Atur di halaman Penjualan
                          </Link>
                        ) : !scalar.includes(policy.value_type) ? (
                          <span className="page-frame-subtitle">
                            Diubah melalui halaman terkait
                          </span>
                        ) : (
                          canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing(policy.code)}
                            >
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
        </div>
      )}
    </SettingFrame>
  );
}

function PolicyEditor({ policy, onDone }: { policy: SettingPolicy; onDone: () => void }) {
  const cache = useQueryClient();
  const options = policy.validation_schema?.enum;
  const [value, setValue] = useState<unknown>(policy.active_version?.value ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = policy.value_type === "integer" ? Number.parseInt(String(value), 10) : value;
      await apiRequest(`/operational-policies/${policy.code}`, {
        method: "PATCH",
        version: policy.latest_version_no,
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
    <div className="web-form grid gap-2">
      <strong>{policy.name}</strong>
      {policy.value_type === "boolean" ? (
        <label className="setting-inline">
          <Switch checked={value === true} onCheckedChange={(v) => setValue(v)} />
          {value === true ? "Ya" : "Tidak"}
        </label>
      ) : options ? (
        <SelectionField
          label="Nilai"
          value={[String(value)]}
          options={options.map((o) => ({ id: String(o), name: String(o) }))}
          onChange={(v) => setValue(v[0] ?? value)}
        />
      ) : (
        <Input
          aria-label={policy.name}
          inputMode={policy.value_type === "string" ? "text" : "decimal"}
          value={String(value ?? "")}
          onChange={(e) => setValue(e.target.value)}
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
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
