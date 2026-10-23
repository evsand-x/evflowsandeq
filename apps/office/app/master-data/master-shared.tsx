"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectionField } from "@/components/web/selection-field";
import { FilterPopover } from "@/components/web/page-frame";
import { IconSearch } from "@/components/web/icons";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";

export type MasterState = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type MasterPage<T> = { data: T[]; total: number; page: number; page_size: number };
export type Contact = { name?: string; phone?: string; email?: string } | null;

export const stateOptions = [
  { id: "ALL", name: "Semua status" },
  { id: "DRAFT", name: "Draf" },
  { id: "ACTIVE", name: "Aktif" },
  { id: "INACTIVE", name: "Nonaktif" },
];
export const stateLabel: Record<string, string> = {
  DRAFT: "Draf",
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  ARCHIVED: "Diarsipkan",
};

export function useCan() {
  const { principal } = useSession();
  return (code: string) => !!principal && hasCompanyPermission(principal, code);
}

// Kunci cache dipisah per perusahaan, pengguna dan izin agar data tidak bocor antarsesi.
export function useMasterKey() {
  const { principal } = useSession();
  return (...parts: unknown[]) => [
    "master-workspace",
    principal?.company_id,
    principal?.user_id,
    principal?.permissions,
    ...parts,
  ];
}

// State daftar (cari, status, halaman, induk) tersimpan di query string agar dapat dibagikan.
export function useListParams() {
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const q = params.get("q") ?? "",
    state = params.get("state") ?? "ALL",
    parent = params.get("parent") ?? "ALL",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(q);
  const set = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === "" || value === "ALL" || (key === "page" && value === 1))
        next.delete(key);
      else next.set(key, String(value));
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(() => set({ q: search, page: 1 }), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = new URLSearchParams({ q, state, parent, page: String(page) }).toString();
  const get = (name: string) => params.get(name) ?? "ALL";
  return { q, state, parent, page, search, setSearch, set, query, get };
}

// Pencarian tetap terlihat; filter lain di dalam popup Filter. filterKeys = parameter URL yang dihitung.
export function ListFilters({
  list,
  searchLabel,
  status = true,
  filterKeys = [],
  children,
}: {
  list: ReturnType<typeof useListParams>;
  searchLabel: string;
  status?: boolean;
  filterKeys?: string[];
  children?: React.ReactNode;
}) {
  const keys = [...(status ? ["state"] : []), ...filterKeys];
  const count = keys.filter((key) => list.get(key) !== "ALL").length;
  return (
    <>
      <div className="page-frame-search">
        <IconSearch />
        <Input
          aria-label={searchLabel}
          placeholder="Cari kode atau nama…"
          value={list.search}
          onChange={(event) => list.setSearch(event.target.value)}
        />
      </div>
      {(status || children) && (
        <FilterPopover
          count={count}
          onReset={() => list.set({ ...Object.fromEntries(keys.map((key) => [key, "ALL"])), page: 1 })}
        >
          {status && (
            <SelectionField
              label="Status data"
              value={[list.state]}
              options={stateOptions}
              onChange={(value) => list.set({ state: value[0] ?? "ALL", page: 1 })}
            />
          )}
          {children}
        </FilterPopover>
      )}
    </>
  );
}

// Aktifkan/Nonaktifkan memakai If-Match; backend tetap memeriksa izin dan kelengkapan data.
export function StateActions({
  resource,
  permission,
  row,
  onDone,
}: {
  resource: string;
  permission: string;
  row: { id: string; state: MasterState; version: number; name: string };
  onDone: () => void;
}) {
  const can = useCan(),
    cache = useQueryClient();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const activate = row.state !== "ACTIVE";
  const allowed = can(`${permission}.${activate ? "activate" : "update"}`);
  if (!allowed || row.state === "ARCHIVED") return null;
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/master-data/${resource}/${row.id}/${activate ? "activate" : "deactivate"}`, {
        method: "POST",
        version: row.version,
        body: JSON.stringify(reason.trim() ? { version: row.version, reason: reason.trim() } : { version: row.version }),
      });
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      toast.success(activate ? `${row.name} diaktifkan` : `${row.name} dinonaktifkan`);
      setOpen(false);
      setReason("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {activate ? "Aktifkan" : "Nonaktifkan"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activate ? "Aktifkan" : "Nonaktifkan"} {row.name}?</DialogTitle>
            <DialogDescription>
              {activate
                ? "Data aktif dapat dipilih pada transaksi baru."
                : "Data nonaktif tidak dapat dipilih pada transaksi baru. Dokumen lama tidak berubah."}
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-2 text-xs font-medium">
            Alasan (opsional)
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          {error && (
            <p role="alert" className="page-frame-field-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void submit()} disabled={busy || (reason.trim().length > 0 && reason.trim().length < 3)}>
              {busy ? "Menyimpan…" : activate ? "Aktifkan" : "Nonaktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type ContactValues = { name: string; position: string; phone: string; email: string };
const textOf = (value: unknown) => (typeof value === "string" ? value : "");
export function contactOf(value: unknown): ContactValues {
  const record = (value ?? {}) as Record<string, unknown>;
  return {
    name: textOf(record.name),
    position: textOf(record.position),
    phone: textOf(record.phone),
    email: textOf(record.email),
  };
}
export function contactPayload(contact: ContactValues) {
  const entries = Object.entries(contact)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value);
  return entries.length ? Object.fromEntries(entries) : null;
}
export function parseCategories(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
export const nullableText = (value: string) => value.trim() || null;

export function ContactFieldset({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ContactValues;
  onChange: (field: keyof ContactValues, value: string) => void;
}) {
  return (
    <fieldset className="page-frame-fields">
      <legend className="span-full text-xs font-semibold">{label}</legend>
      {(
        [
          ["name", "Nama"],
          ["position", "Jabatan"],
          ["phone", "Telepon/WhatsApp"],
          ["email", "Email"],
        ] as const
      ).map(([field, fieldLabel]) => (
        <label key={field}>
          {fieldLabel}
          <Input
            type={field === "email" ? "email" : "text"}
            inputMode={field === "phone" ? "tel" : undefined}
            value={value[field]}
            onChange={(event) => onChange(field, event.target.value)}
          />
        </label>
      ))}
    </fieldset>
  );
}

type Duplicate = { id: string; code: string; name: string };
// Kandidat duplikat ditampilkan sebelum simpan; constraint unik backend tetap pengaman terakhir.
export function useDuplicateCheck(resource: string, initial?: { id: string; name: string }) {
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const check = async (name: string) => {
    const value = name.trim();
    if (value.length < 2 || value === initial?.name) return setDuplicates([]);
    try {
      const result = await apiRequest<{ data: Duplicate[] }>(
        `/master-data/workspace/${resource}/duplicate-check`,
        {
          method: "POST",
          body: JSON.stringify({ name: value, ...(initial ? { exclude_id: initial.id } : {}) }),
        },
      );
      setDuplicates(result.data);
    } catch {
      setDuplicates([]);
    }
  };
  return { duplicates, check };
}
export function DuplicateNotice({ duplicates, base }: { duplicates: Duplicate[]; base: string }) {
  if (!duplicates.length) return null;
  return (
    <div className="span-full page-frame-notice" role="status">
      <span>
        Nama mirip sudah terdaftar:{" "}
        {duplicates.map((d, i) => (
          <span key={d.id}>
            {i > 0 && ", "}
            <Link className="page-frame-link" href={`${base}/${d.id}`} target="_blank">
              {d.code} {d.name}
            </Link>
          </span>
        ))}
      </span>
    </div>
  );
}

// Nilai desimal dari API berupa string; diformat tanpa konversi ke number.
export function formatDecimal(value?: string | null, prefix?: string | null) {
  if (value == null || value === "") return undefined;
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = value.replace(/^-/, "").split(".");
  const trimmed = fraction.replace(/0+$/, "");
  const text = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${trimmed ? `,${trimmed}` : ""}`;
  return `${negative ? "-" : ""}${prefix ? `${prefix} ` : ""}${text}`;
}

export function contactText(contact: Contact | undefined) {
  if (!contact) return undefined;
  return [contact.name, contact.phone, contact.email].filter(Boolean).join(" · ") || undefined;
}
