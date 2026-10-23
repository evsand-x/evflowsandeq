"use client";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OfficePage, PageNotice } from "@/components/web/page-frame";
import { ApiError, apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { policyFormValue, policyPayload, type SettingPolicy } from "./settings-forms";
import "./settings.css";

/** Page frame for every Setting screen; the server still enforces each permission. */
export function SettingFrame({
  title,
  subtitle,
  permission,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  permission: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { principal } = useSession();
  const allowed = principal ? hasCompanyPermission(principal, permission) : false;
  return (
    <OfficePage
      section="setting"
      crumbs={[{ label: "Setting", href: "/setting" }, { label: title }]}
      title={title}
      subtitle={subtitle}
      actions={allowed ? actions : undefined}
    >
      {allowed ? (
        children
      ) : (
        <PageNotice tone="error">Anda tidak memiliki hak akses ke halaman ini.</PageNotice>
      )}
    </OfficePage>
  );
}

export const policyKey = (code: string) => ["settings", "policy", code] as const;

export function usePolicy(code: string) {
  return useQuery({
    queryKey: policyKey(code),
    queryFn: async () =>
      (await apiRequest<{ data: SettingPolicy }>(`/operational-policies/${code}`)).data,
  });
}

/**
 * Holds an editable copy of one policy value. A stale save (412) keeps the user's input and
 * offers a reload instead of overwriting someone else's change.
 */
export function usePolicyForm<T>(code: string) {
  const query = usePolicy(code),
    cache = useQueryClient();
  const [draft, setDraft] = useState<{ version: number; value: T } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false);
  const policy = query.data;
  const value = draft?.value ?? (policy ? (policyFormValue(policy) as T) : undefined);
  const set = (next: T) => {
    if (!policy?.active_version) return;
    setDraft({ version: draft?.version ?? policy.latest_version_no, value: next });
  };
  const save = async () => {
    if (!policy || value === undefined) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/operational-policies/${code}`, {
        method: "PATCH",
        version: draft?.version ?? policy.latest_version_no,
        body: JSON.stringify(policyPayload(code, value)),
      });
      setDraft(null);
      setConflict(false);
      await cache.invalidateQueries({ queryKey: policyKey(code) });
      toast.success("Pengaturan disimpan");
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) {
        setConflict(true);
        setError("Pengaturan ini baru saja diubah orang lain. Isian Anda belum disimpan.");
      } else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const reload = async () => {
    setDraft(null);
    setConflict(false);
    setError("");
    await cache.invalidateQueries({ queryKey: policyKey(code) });
  };
  return { query, policy, value, set, save, reload, busy, error, conflict, dirty: !!draft };
}

/** One titled settings block with its own save action and inline error. */
export function SettingSection({
  title,
  description,
  form,
  canEdit,
  children,
}: {
  title: string;
  description: string;
  form: Pick<
    ReturnType<typeof usePolicyForm>,
    "save" | "reload" | "busy" | "error" | "conflict" | "dirty" | "query"
  >;
  canEdit: boolean;
  children: ReactNode;
}) {
  const id = `setting-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section className="page-frame-panel setting-section" aria-labelledby={id}>
      <header className="setting-section-head">
        <div>
          <h2 id={id}>{title}</h2>
          <p className="page-frame-subtitle">{description}</p>
        </div>
        {canEdit && (
          <Button disabled={!form.dirty || form.busy} onClick={() => void form.save()}>
            {form.busy ? "Menyimpan…" : "Simpan"}
          </Button>
        )}
      </header>
      {form.error && (
        <PageNotice tone="error" {...(form.conflict ? { onRetry: () => void form.reload() } : {})}>
          {form.error}
        </PageNotice>
      )}
      {form.query.isError ? (
        <PageNotice tone="error" onRetry={() => void form.query.refetch()}>
          Pengaturan belum dapat dimuat.
        </PageNotice>
      ) : form.query.isLoading ? (
        <p role="status" className="page-frame-subtitle">
          Memuat…
        </p>
      ) : (
        children
      )}
    </section>
  );
}
