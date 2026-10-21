"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import {
  type Role,
  type User,
  type Permission,
  permissionPresentation,
  actionLabels,
} from "@/lib/iam";
import { useSession } from "../session-provider";
import { DataTable } from "../crm/crm-common";
import "../crm/crm.css";
import "./access-workspace.css";
export const actions = [
  ["read", "Lihat"],
  ["create", "Buat"],
  ["update", "Ubah"],
  ["delete", "Hapus"],
  ["submit", "Ajukan"],
  ["approve", "Setujui/Tolak"],
  ["post", "Posting"],
  ["cancel", "Batalkan"],
  ["export", "Cetak/Ekspor"],
] as const;
export const scopes: Record<string, string> = {
  self: "Diri sendiri",
  subordinate: "Bawahan",
  department: "Departemen",
  rayon: "Rayon",
  warehouse: "Gudang",
  assigned_portfolio: "Portofolio",
  company: "Perusahaan",
  privileged: "Privileged",
};
export const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
    : "—";
export function Status({ active }: { active: boolean }) {
  return (
    <span className={`access-badge ${active ? "is-active" : ""}`}>
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}
export function Note({ children }: { children: ReactNode }) {
  return <div className="access-note">{children}</div>;
}
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="access-panel">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Value({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="access-value">
      <span>{label}</span>
      <strong>{children ?? "Belum tersedia"}</strong>
    </div>
  );
}
export function Heading({
  title,
  section,
  trail,
  back,
  children,
}: {
  title: string;
  section: "users" | "roles";
  trail?: string;
  back?: string;
  children?: ReactNode;
}) {
  return (
    <header className="access-heading">
      <div>
        <nav aria-label="Breadcrumb">
          Setting /{" "}
          <Link href={`/setting/${section}`}>{section === "users" ? "Pengguna" : "Peran"}</Link>
          {trail && ` / ${trail}`}
        </nav>
        <h1>{title}</h1>
      </div>
      <div className="access-actions">
        {back && (
          <Button variant="outline" asChild>
            <Link href={back}>
              <ArrowLeft />
              Kembali
            </Link>
          </Button>
        )}
        {children}
      </div>
    </header>
  );
}
export function useAccessContext() {
  const { principal } = useSession();
  return [principal?.company_id, principal?.user_id, principal?.permissions];
}
export function useRoles() {
  const context = useAccessContext();
  return useQuery({
    queryKey: ["setting", "roles", ...context],
    queryFn: () => apiRequest<{ data: Role[] }>("/roles"),
  });
}
export function useDirtyGuard(dirty: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const link = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a || a.getAttribute("target") === "_blank" || e.ctrlKey || e.metaKey) return;
      const href = a.getAttribute("href");
      if (!href || href === location.pathname) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (window.confirm("Perubahan belum disimpan. Tinggalkan halaman?")) router.push(href);
    };
    const logout = (e: Event) => {
      e.preventDefault();
      if (window.confirm("Perubahan belum disimpan. Keluar dari aplikasi?"))
        (e as CustomEvent<{ proceed: () => void }>).detail.proceed();
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", link, true);
    window.addEventListener("evflow:before-logout", logout);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", link, true);
      window.removeEventListener("evflow:before-logout", logout);
    };
  }, [dirty, router]);
}
export type UserDetail = User & {
  created_at: string;
  created_by: string | null;
  active_sessions: number;
  assignments: { role_id: string; assigned_at: string; assigned_by: string | null }[];
  sessions: {
    id: string;
    device_label: string | null;
    created_at: string;
    last_seen_at: string;
    expires_at: string;
    revoked_at: string | null;
  }[];
};
export type HistoryRow = {
  id: string;
  occurred_at: string;
  action: string;
  reason: string | null;
  actor: { display_name: string } | null;
  changes: { code: string; allowed: boolean; scope_type: string }[];
  affected_members: number | null;
};
const historyLabels: Record<string, string> = {
  "user.created": "Pengguna dibuat",
  "user.updated": "Akun dan penugasan diperbarui",
  "user.roles_changed": "Penugasan peran diubah",
  "user.sessions_revoked": "Sesi dicabut",
  "role.created": "Peran dibuat",
  "role.updated": "Identitas/status peran diperbarui",
  "role.permissions_changed": "Hak akses peran diubah",
  "role.deleted": "Peran dihapus",
};
export function History({ kind, id }: { kind: "users" | "roles"; id: string }) {
  const context = useAccessContext();
  const result = useQuery({
    queryKey: ["setting", kind, id, "history", ...context],
    queryFn: () => apiRequest<{ data: HistoryRow[] }>(`/${kind}/${id}/history`),
  });
  if (result.isError)
    return (
      <p role="alert" className="access-error">
        {result.error.message}
      </p>
    );
  return (
    <>
      <DataTable
        showColumns={false}
        busy={result.isPending}
        data={result.data?.data ?? []}
        total={result.data?.data.length ?? 0}
        columns={[
          {
            accessorKey: "occurred_at",
            header: "Waktu",
            cell: ({ row }) => date(row.original.occurred_at),
          },
          {
            id: "actor",
            header: "Pelaku",
            cell: ({ row }) => row.original.actor?.display_name ?? "Sistem",
          },
          {
            accessorKey: "action",
            header: "Perubahan",
            cell: ({ row }) =>
              row.original.changes?.length ? (
                <div className="access-history-changes">
                  {row.original.changes.map((c, i) => (
                    <div key={i}>
                      {c.allowed ? "Mengizinkan" : "Mencabut"}{" "}
                      {
                        permissionPresentation({
                          resource: c.code.slice(0, c.code.lastIndexOf(".")),
                          code: c.code,
                        })[1]
                      }{" "}
                      · {actionLabels[c.code.split(".").at(-1)!] ?? c.code.split(".").at(-1)} (
                      {scopes[c.scope_type] ?? c.scope_type})
                    </div>
                  ))}
                </div>
              ) : (
                (historyLabels[row.original.action] ?? row.original.action)
              ),
          },
          {
            id: "impact",
            header: "Dampak",
            cell: ({ row }) =>
              [
                "role.permissions_changed",
                "user.updated",
                "user.roles_changed",
                "user.sessions_revoked",
              ].includes(row.original.action)
                ? `${row.original.affected_members === null ? "" : `${row.original.affected_members} anggota · `}Sesi terdampak dicabut`
                : (row.original.reason ?? "—"),
          },
        ]}
      />
      <p className="access-caption">
        100 perubahan terbaru. Rincian historis jumlah anggota tidak tersedia untuk catatan lama.
      </p>
    </>
  );
}
export function EffectiveMatrix({
  roles,
  roleIds,
  effective,
}: {
  roles: Role[];
  roleIds: string[];
  effective?: User["effective_permissions"];
}) {
  const selected = roles.filter((r) => r.active && roleIds.includes(r.id));
  const grants = effective ?? selected.flatMap((r) => r.permissions);
  const resources = [
    ...new Set(grants.map((g) => g.code.slice(0, g.code.lastIndexOf(".")))),
  ].sort();
  const sources = (code: string) =>
    selected
      .flatMap((r, i) =>
        r.permissions.some((g) => g.code === code) ? [String.fromCharCode(65 + i)] : [],
      )
      .join(", ");
  return (
    <>
      <p className="access-caption">
        Sumber peran:{" "}
        {selected.map((r, i) => `${String.fromCharCode(65 + i)} = ${r.name}`).join(" · ") ||
          "Belum ada peran aktif"}
      </p>
      <DataTable
        showColumns={false}
        data={resources.map((resource) => ({ resource }))}
        total={resources.length}
        columns={[
          {
            accessorKey: "resource",
            header: "Hak akses",
            cell: ({ row }) =>
              permissionPresentation({ resource: row.original.resource, code: "" })[1],
          },
          ...actions.map(([action, label]) => ({
            id: action,
            header: label,
            cell: ({ row }: { row: { original: { resource: string } } }) =>
              grants.some((g) => g.code === `${row.original.resource}.${action}`) ? (
                <span
                  className="access-badge is-active"
                  title={grants
                    .filter((g) => g.code === `${row.original.resource}.${action}`)
                    .map((g) => scopes[g.scope_type] ?? g.scope_type)
                    .join(", ")}
                >
                  ✓ {sources(`${row.original.resource}.${action}`)}
                </span>
              ) : (
                "—"
              ),
          })),
          {
            id: "special",
            header: "Tindakan khusus",
            cell: ({ row }) =>
              grants
                .filter(
                  (g) =>
                    g.code.slice(0, g.code.lastIndexOf(".")) === row.original.resource &&
                    !actions.some(([a]) => a === g.code.split(".").at(-1)),
                )
                .map(
                  (g) =>
                    `${actionLabels[g.code.split(".").at(-1)!] ?? g.code.split(".").at(-1)} (${scopes[g.scope_type] ?? g.scope_type})`,
                )
                .join(", ") || "—",
          },
        ]}
      />
      <Note>
        Gabungan izin per tindakan dan cakupan dari seluruh peran aktif. Hanya baca; ubah izin di
        Peran → Matriks Hak Akses.
      </Note>
    </>
  );
}
export function permissionLabel(p: Permission) {
  return `${permissionPresentation(p)[1]} · ${actionLabels[p.action] ?? p.action.replaceAll("_", " ")}`;
}
