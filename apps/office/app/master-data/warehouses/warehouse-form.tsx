"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormFrame, PageNotice } from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import { DuplicateNotice, nullableText, useDuplicateCheck } from "../master-shared";
import { base, type Warehouse } from "./warehouse-workspace";

export function WarehouseForm({ initial }: { initial?: Warehouse | undefined }) {
  const router = useRouter(),
    cache = useQueryClient(),
    duplicate = useDuplicateCheck("warehouses", initial);
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    timezone: initial?.timezone ?? "",
  });
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({});
  const set = (field: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
    setDirty(true);
  };
  const submit = async () => {
    const found: Record<string, string> = {};
    if (values.name.trim().length < 2) found.name = "Nama gudang wajib diisi.";
    if (values.timezone.trim().length < 3) found.timezone = "Zona waktu bisnis wajib diisi.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      name: values.name.trim(),
      address: nullableText(values.address),
      timezone: values.timezone.trim(),
    };
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<{ data: { id: string } }>(
        initial ? `/master-data/warehouses/${initial.id}` : "/master-data/warehouses",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(initial ? { ...body, version: initial.version } : body),
        },
      );
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      setDirty(false);
      toast.success(initial ? "Gudang disimpan" : "Gudang dibuat");
      router.push(`${base}/${saved.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {error && <PageNotice tone="error">{error}</PageNotice>}
      <FormFrame
        dirty={dirty}
        submitting={busy}
        onSubmit={() => void submit()}
        cancelHref={initial ? `${base}/${initial.id}` : base}
        sections={[
          {
            id: "identity",
            title: "Identitas gudang",
            description: "Membuat gudang tidak membuat saldo stok.",
            content: (
              <div className="page-frame-fields">
                <label>
                  Nama gudang *
                  <Input
                    value={values.name}
                    aria-invalid={!!errors.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => void duplicate.check(values.name)}
                  />
                  {errors.name && <span className="page-frame-field-error">{errors.name}</span>}
                </label>
                <label>
                  Zona waktu bisnis *
                  <Input
                    value={values.timezone}
                    placeholder="Asia/Makassar"
                    aria-invalid={!!errors.timezone}
                    onChange={(e) => set("timezone", e.target.value)}
                  />
                  {errors.timezone && <span className="page-frame-field-error">{errors.timezone}</span>}
                </label>
                <DuplicateNotice duplicates={duplicate.duplicates} base={base} />
                <label className="span-full">
                  Alamat
                  <Textarea value={values.address} onChange={(e) => set("address", e.target.value)} />
                </label>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
