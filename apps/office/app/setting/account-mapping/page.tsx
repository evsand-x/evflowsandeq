"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../../session-provider";
import { FinanceConfiguration } from "../../operations/extended-controls";
import { SettingFrame } from "../settings-ui";

/** Setting > Pemetaan Akun: akun jurnal otomatis, rekening bank dan periode. Server menegakkan account_mapping.*. */
export default function AccountMappingPage() {
  const { principal } = useSession();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const keys = useRef(new Map<string, string>());
  const can = (permission: string) => !!principal && hasCompanyPermission(principal, permission);
  const command = async (url: string, body: unknown = {}) => {
    const fingerprint = `${url}:${JSON.stringify(body)}`;
    let key = keys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(fingerprint, key);
    }
    setPending(true);
    try {
      const result = await apiRequest<{ data: unknown }>(url, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
      keys.current.delete(fingerprint);
      await client.invalidateQueries({ queryKey: ["operations"] });
      toast.success("Konfigurasi tersimpan.");
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Konfigurasi belum tersimpan.");
      throw error;
    } finally {
      setPending(false);
    }
  };
  return (
    <SettingFrame
      title="Pemetaan Akun"
      subtitle="Akun untuk jurnal otomatis, rekening bank dan periode terbuka. Berlaku umum untuk seluruh transaksi."
      permission="account_mapping.read"
    >
      <FinanceConfiguration can={can} command={command} pending={pending} />
    </SettingFrame>
  );
}
