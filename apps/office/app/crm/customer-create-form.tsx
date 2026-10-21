"use client";
import { useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";

export function CustomerCreateForm() {
  const { principal } = useSession();
  const cache = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const canCreate = !!principal && hasCompanyPermission(principal, "crm_customer.create");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (busy.current || !canCreate) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<{ data: { id: string; name: string; code: string } }>(
        "/crm/master/customers",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            primary_address: address.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
          }),
        },
      );

      await cache.invalidateQueries({
        queryKey: ["operations", principal?.company_id, principal?.user_id, "so-options"],
      });
      await cache.invalidateQueries({
        queryKey: ["crm", principal?.company_id, principal?.user_id, "customers"],
      });
      toast.success("Draft pelanggan berhasil dibuat");
      router.push(`/crm/customers/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pelanggan gagal disimpan.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (!canCreate) return <p role="alert">Anda tidak memiliki izin membuat Master Pelanggan.</p>;
  return (
    <section className="bg-card max-w-3xl rounded-lg border p-6">
      <h2 className="mb-2 text-lg font-semibold">Informasi pelanggan</h2>
      <p className="text-muted-foreground mb-6 text-sm">
        Pelanggan baru disimpan sebagai draft. Lengkapi dan aktifkan sebelum digunakan untuk
        transaksi.
      </p>
      <form className="grid gap-4" onSubmit={(e) => void save(e)}>
        <fieldset disabled={pending} className="grid gap-4">
          <label className="grid gap-2 text-sm">
            Nama pelanggan *
            <Input
              required
              minLength={2}
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Alamat
            <Textarea
              maxLength={2000}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Telepon
            <Input
              type="tel"
              maxLength={50}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Email
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => router.push("/crm/master/customers")}
          >
            Batal
          </Button>
          <Button type="submit" disabled={pending || name.trim().length < 2}>
            {pending ? "Menyimpan..." : "Simpan pelanggan"}
          </Button>
        </div>
      </form>
    </section>
  );
}
