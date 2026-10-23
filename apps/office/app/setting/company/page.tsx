"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageNotice } from "@/components/web/page-frame";
import { ApiError, apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { preferencesKey } from "@/lib/settings";
import { useSession } from "../../session-provider";
import { SettingFrame } from "../settings-ui";

type Company = {
  name: string;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_identity: string | null;
  version: number;
};
const fields = ["name", "legal_name", "address", "phone", "email", "tax_identity"] as const;
type Values = Record<(typeof fields)[number], string>;
const toValues = (c: Company): Values =>
  Object.fromEntries(fields.map((f) => [f, c[f] ?? ""])) as Values;

export default function CompanyProfilePage() {
  const { principal, reload } = useSession(),
    cache = useQueryClient();
  const canEdit = principal ? hasCompanyPermission(principal, "company_profile.update") : false;
  const query = useQuery({
    queryKey: ["settings", "company"],
    queryFn: async () => (await apiRequest<{ data: Company }>("/company-profile")).data,
  });
  const [draft, setDraft] = useState<Values | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [nameError, setNameError] = useState("");
  const values = draft ?? (query.data ? toValues(query.data) : null);
  const set = (field: keyof Values, value: string) => {
    if (!values) return;
    setDraft({ ...values, [field]: value });
    if (field === "name") setNameError("");
  };
  const save = async () => {
    if (!values || !query.data) return;
    if (values.name.trim().length < 2) return setNameError("Nama perusahaan wajib diisi.");
    setBusy(true);
    setError("");
    try {
      await apiRequest("/company-profile", {
        method: "PATCH",
        version: query.data.version,
        body: JSON.stringify({
          name: values.name.trim(),
          ...Object.fromEntries(
            fields.filter((f) => f !== "name").map((f) => [f, values[f].trim() || null]),
          ),
        }),
      });
      setDraft(null);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["settings", "company"] }),
        cache.invalidateQueries({ queryKey: preferencesKey }),
      ]);
      await reload();
      toast.success("Profil perusahaan disimpan");
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 412
          ? "Profil baru saja diubah orang lain. Muat ulang untuk melihat versi terbaru; isian Anda belum disimpan."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setBusy(false);
    }
  };
  const field = (key: keyof Values, label: string, input: "input" | "textarea" = "input") => (
    <label className={input === "textarea" ? "span-full" : undefined}>
      {label}
      {input === "textarea" ? (
        <Textarea
          value={values?.[key] ?? ""}
          disabled={!canEdit}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <Input
          value={values?.[key] ?? ""}
          disabled={!canEdit}
          aria-invalid={key === "name" && !!nameError}
          type={key === "email" ? "email" : "text"}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
      {key === "name" && nameError && <span className="page-frame-field-error">{nameError}</span>}
    </label>
  );
  return (
    <SettingFrame
      title="Profil Perusahaan"
      subtitle="Identitas ini tampil di aplikasi dan dokumen baru. Dokumen yang sudah terbit tidak berubah."
      permission="company_profile.read"
      actions={
        canEdit && (
          <Button disabled={!draft || busy} onClick={() => void save()}>
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        )
      }
    >
      {error && (
        <PageNotice
          tone="error"
          onRetry={() => {
            setDraft(null);
            setError("");
            void query.refetch();
          }}
        >
          {error}
        </PageNotice>
      )}
      {query.isError ? (
        <PageNotice tone="error" onRetry={() => void query.refetch()}>
          Profil perusahaan belum dapat dimuat.
        </PageNotice>
      ) : !values ? (
        <p role="status">Memuat…</p>
      ) : (
        <section className="page-frame-panel">
          <div className="page-frame-fields web-form">
            {field("name", "Nama perusahaan *")}
            {field("legal_name", "Nama legal")}
            {field("tax_identity", "NPWP")}
            {field("phone", "Telepon")}
            {field("email", "Email")}
            {field("address", "Alamat", "textarea")}
          </div>
        </section>
      )}
    </SettingFrame>
  );
}
