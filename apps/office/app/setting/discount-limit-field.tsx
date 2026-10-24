"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "../session-provider";
import { hasCompanyPermission } from "@/lib/navigation";

/** Edits a role's or one person's discount limit (percent). Saved on its own; blank means no limit of its own. */
export function DiscountLimitField({
  kind,
  id,
  value,
  version,
}: {
  kind: "roles" | "users";
  id: string;
  value: string | null;
  version?: number | undefined;
}) {
  const { principal } = useSession();
  const canEdit = principal ? hasCompanyPermission(principal, "discount_limit.manage") : false;
  const [text, setText] = useState(value ?? "");
  const [current, setCurrent] = useState(version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  useEffect(() => setText(value ?? ""), [value, id]);
  useEffect(() => setCurrent(version), [version, id]);
  const normalized = text.trim().replace(/\.$/, "");
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await apiRequest<{ data: { version: number } }>(
        `/settings/discount-limit/${kind}/${id}`,
        {
          method: "PATCH",
          ...(current ? { version: current } : {}),
          body: JSON.stringify({ discount_limit: normalized === "" ? null : normalized }),
        },
      );
      setCurrent(saved.data.version);
      await client.invalidateQueries({ queryKey: ["setting"] });
      toast.success("Batas diskon disimpan");
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 412
          ? "Data baru saja diubah orang lain. Tutup lalu buka kembali untuk memuat ulang."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <label className="flex flex-col gap-1.5">
        Batas diskon (%)
        <Input
          inputMode="decimal"
          placeholder={kind === "roles" ? "Ikuti bawaan perusahaan" : "Ikuti batas peran"}
          value={text}
          disabled={!canEdit}
          onChange={(e) => {
            const next = e.target.value.trim().replace(",", ".");
            if (next === "" || /^\d{0,3}(\.\d{0,4})?$/.test(next)) setText(next);
          }}
          className="h-9 rounded-sm"
        />
      </label>
      <small className="text-muted-foreground text-xs font-normal">
        {kind === "roles"
          ? "Batas tertinggi dari semua peran pengguna berlaku bila orangnya tidak punya batas sendiri."
          : "Menggantikan batas peran. Batas produk tetap membatasi bila lebih kecil."}
      </small>
      {error && <small className="text-destructive text-xs font-normal">{error}</small>}
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={saving || normalized === (value ?? "")}
          onClick={() => void save()}
        >
          {saving ? "Menyimpan..." : "Simpan batas diskon"}
        </Button>
      )}
    </div>
  );
}
