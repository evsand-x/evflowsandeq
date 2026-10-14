"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, ApiError } from "@/lib/api";
import {
  actionLabels,
  permissionPresentation,
  type Permission,
  type Role,
  type User,
} from "@/lib/iam";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import "./permission-matrix.css";

const crud = [
  ["read", "Lihat"],
  ["create", "Buat"],
  ["update", "Ubah draf"],
  ["delete", "Hapus draf"],
] as const;
const tabLabels = [
  ["crud", "CRUD"],
  ["special", "Tindakan khusus"],
  ["scope", "Cakupan & data sensitif"],
  ["members", "Anggota"],
  ["history", "Riwayat"],
] as const;
const moduleOrder = [
  "Dashboard",
  "Sales & Marketing",
  "Warehouse & Logistik",
  "Finance",
  "HRIS",
  "Master Data",
  "Setting",
  "Lainnya",
];
const labelFor = (permission: Permission) => permissionPresentation(permission)[1]!;

export function PermissionMatrix({ selectedRoleId }: { selectedRoleId?: string | undefined }) {
  const router = useRouter();
  const params = useSearchParams();
  const { principal } = useSession();
  const client = useQueryClient();
  const roleId = selectedRoleId ?? params.get("role");
  const [tab, setTab] = useState("crud");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [review, setReview] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const context = [principal?.company_id, principal?.user_id];
  const roles = useQuery({
    queryKey: ["setting", "roles", ...context],
    queryFn: () => apiRequest<{ data: Role[] }>("/roles"),
  });
  const permissions = useQuery({
    queryKey: ["setting", "permissions", ...context],
    queryFn: () => apiRequest<{ data: Permission[] }>("/permissions"),
  });
  const canReadUsers = Boolean(principal && hasCompanyPermission(principal, "user.read"));
  const users = useQuery({
    queryKey: ["setting", "users", ...context],
    queryFn: () => apiRequest<{ data: User[] }>("/users"),
    enabled: tab === "members" && canReadUsers,
  });
  const role = roles.data?.data.find((item) => item.id === roleId);
  const grants = role?.permissions ?? [];
  const changed = Object.keys(draft).length;
  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    const confirmLogout = (event: Event) => {
      event.preventDefault();
      if (saving) return;
      const proceed = (event as CustomEvent<{ proceed: () => void }>).detail.proceed;
      setPendingLeave(() => proceed);
      setDiscard(true);
    };
    const guardLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        link &&
        link.getAttribute("target") !== "_blank" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        link.getAttribute("href") !== window.location.pathname
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (saving) return;
        const href = link.getAttribute("href")!;
        setPendingLeave(() => () => router.push(href));
        setDiscard(true);
      }
    };
    document.addEventListener("click", guardLink, true);
    window.addEventListener("evflow:before-logout", confirmLogout);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
      window.removeEventListener("evflow:before-logout", confirmLogout);
    };
  }, [changed, saving, router]);
  const original = (id: string) =>
    grants.some(
      (grant) => grant.permission_id === id && grant.scope_type === "company" && !grant.scope_id,
    );
  const checked = (permission: Permission) => draft[permission.id] ?? original(permission.id);
  const change = (items: Permission[], value: boolean) =>
    setDraft((current) => {
      const next = { ...current };
      for (const item of items) {
        if (value === original(item.id)) delete next[item.id];
        else next[item.id] = value;
      }
      return next;
    });
  const groups = useMemo(() => {
    const modules = new Map<string, Map<string, Permission[]>>();
    for (const permission of permissions.data?.data ?? []) {
      const module = permissionPresentation(permission)[0]!;
      const resources = modules.get(module) ?? new Map<string, Permission[]>();
      resources.set(permission.resource, [
        ...(resources.get(permission.resource) ?? []),
        permission,
      ]);
      modules.set(module, resources);
    }
    return [...modules].sort(([a], [b]) => moduleOrder.indexOf(a) - moduleOrder.indexOf(b));
  }, [permissions.data]);
  const columns = crud;
  const cell = (items: Permission[], action: string, label: string) => {
    const applicable = items.filter((item) => item.action === action);
    if (!applicable.length)
      return (
        <span className="matrix-inapplicable" aria-label={`${label}: tidak berlaku`}>
          —
        </span>
      );
    const count = applicable.filter(checked).length;
    return (
      <Checkbox
        disabled={saving}
        checked={count === applicable.length ? true : count ? "indeterminate" : false}
        onCheckedChange={(value) => change(applicable, value === true)}
        aria-label={label}
      />
    );
  };
  const save = async () => {
    if (!role || saving) return;
    setSaving(true);
    setSaveError("");
    const known = new Set((permissions.data?.data ?? []).map((item) => item.id));
    const retained = grants
      .filter(
        (grant) =>
          !known.has(grant.permission_id) || grant.scope_type !== "company" || grant.scope_id,
      )
      .map(({ permission_id, scope_type, scope_id }) => ({ permission_id, scope_type, scope_id }));
    const company = (permissions.data?.data ?? [])
      .filter(checked)
      .map((p) => ({ permission_id: p.id, scope_type: "company", scope_id: null }));
    try {
      await apiRequest(`/roles/${role.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: [...retained, ...company] }),
      });
      setDraft({});
      setReview(false);
      await client.invalidateQueries({ queryKey: ["setting"] });
      toast.success("Hak akses tersimpan");
    } catch (cause) {
      setSaveError(cause instanceof ApiError ? cause.message : "Hak akses belum tersimpan.");
    } finally {
      setSaving(false);
    }
  };
  if (roles.isPending || permissions.isPending)
    return <p role="status">Memuat matriks hak akses…</p>;
  if (roles.isError || permissions.isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Matriks hak akses belum dapat dimuat.{" "}
          <Button
            variant="outline"
            onClick={() => {
              void roles.refetch();
              void permissions.refetch();
            }}
          >
            Coba lagi
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!role)
    return (
      <Alert>
        <AlertDescription>
          Pilih peran dari daftar Peran untuk mengatur matriks hak akses.{" "}
          <Button variant="outline" onClick={() => router.push("/setting/roles")}>
            Ke daftar Peran
          </Button>
        </AlertDescription>
      </Alert>
    );
  const leave = () => {
    setPendingLeave(null);
    if (changed) setDiscard(true);
    else router.push("/setting/roles");
  };
  return (
    <div className="permission-matrix">
      <nav aria-label="Breadcrumb" className="matrix-breadcrumb">
        Setting <span>/</span> <button onClick={leave}>Peran</button>
      </nav>
      <h1>Peran — Matriks Hak Akses</h1>
      <section className="matrix-panel" aria-labelledby="role-detail-title">
        <h2 id="role-detail-title">Detail peran</h2>
        <dl className="matrix-role-details">
          {[
            ["Nama peran", role.name],
            ["Status", role.active ? "Aktif" : "Nonaktif"],
            ["Anggota", `${role.member_count} pengguna`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Tabs value={tab} onValueChange={setTab} className="matrix-tabs">
        <TabsList aria-label="Pengaturan peran">
          {tabLabels.map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {(tab === "crud" || tab === "special") && (
          <p className="matrix-legend">
            ✓ Diizinkan <span>□ Tidak diizinkan</span> <span>— Tidak berlaku</span>
          </p>
        )}
        {["crud"].map((value) => (
          <TabsContent key={value} value={value} className="matrix-panel">
            <h2>{value === "crud" ? "Matriks CRUD" : "Tindakan khusus"}</h2>
            <Table
              className="matrix-grid"
              style={{
                minWidth: value === "crud" ? 720 : Math.max(720, columns.length * 140 + 260),
              }}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Hak Akses</TableHead>
                  {columns.map(([action, label]) => (
                    <TableHead key={action}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(([module, resources]) => {
                  const items = [...resources.values()]
                    .flat()
                    .filter((item) => columns.some(([action]) => action === item.action));
                  if (!items.length) return null;
                  const open = expanded.includes(`${value}:${module}`);
                  return (
                    <Fragment key={module}>
                      <TableRow>
                        <TableCell>
                          <button
                            className="matrix-group-toggle"
                            aria-expanded={open}
                            onClick={() =>
                              setExpanded((current) =>
                                open
                                  ? current.filter((key) => key !== `${value}:${module}`)
                                  : [...current, `${value}:${module}`],
                              )
                            }
                          >
                            {open ? <ChevronDown /> : <ChevronRight />}
                            {module}
                          </button>
                        </TableCell>
                        {columns.map(([action, label]) => (
                          <TableCell key={action}>
                            {cell(items, action, `${module}: ${label}`)}
                          </TableCell>
                        ))}
                      </TableRow>
                      {open &&
                        [...resources]
                          .filter(([, list]) =>
                            list.some((p) => columns.some(([action]) => action === p.action)),
                          )
                          .map(([resource, list]) => (
                            <TableRow key={resource} className="matrix-resource-row">
                              <TableCell title={resource}>{labelFor(list[0]!)}</TableCell>
                              {columns.map(([action, label]) => (
                                <TableCell key={action}>
                                  {cell(list, action, `${labelFor(list[0]!)}: ${label}`)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                    </Fragment>
                  );
                })}
                {!groups.length && (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1}>
                      Belum ada hak akses dalam katalog.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        ))}
        <TabsContent value="special" className="matrix-panel">
          <h2>Tindakan khusus</h2>
          {groups.map(([module, resources]) => {
            const specialResources = [...resources]
              .map(
                ([resource, items]) =>
                  [
                    resource,
                    items.filter((p) => !crud.some(([action]) => action === p.action)),
                  ] as const,
              )
              .filter(([, items]) => items.length);
            if (!specialResources.length) return null;
            return (
              <section key={module} className="matrix-special-module">
                <h3>{module}</h3>
                {specialResources.map(([resource, items]) => (
                  <div key={resource} className="matrix-special-resource">
                    <strong>{labelFor(items[0]!)}</strong>
                    <div>
                      {items.map((p) => (
                        <label key={p.id}>
                          <Checkbox
                            disabled={saving}
                            checked={checked(p)}
                            onCheckedChange={(value) => change([p], value === true)}
                          />
                          <span>{actionLabels[p.action] ?? p.action.replaceAll("_", " ")}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </TabsContent>
        <TabsContent value="scope" className="matrix-panel">
          <h2>Cakupan & data sensitif</h2>
          <p>
            Checkbox CRUD dan tindakan khusus mengatur cakupan perusahaan. Cakupan khusus yang
            tersimpan tetap dipertahankan; pengeditannya belum tersedia di layar ini. Akses data
            sensitif tetap mengikuti izin dan cakupan yang diperiksa server.
          </p>
          <ul className="matrix-grants">
            {grants.map((grant, index) => (
              <li key={`${grant.permission_id}:${index}`}>
                <strong>{grant.code}</strong>
                <span>
                  {grant.scope_type}
                  {grant.scope_id ? ` · ${grant.scope_id}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {!grants.length && <p>Peran ini belum memiliki hak akses tersimpan.</p>}
        </TabsContent>
        <TabsContent value="members" className="matrix-panel">
          <h2>Anggota peran</h2>
          {!canReadUsers ? (
            <p>Anda tidak memiliki izin melihat pengguna.</p>
          ) : users.isPending ? (
            <p role="status">Memuat anggota…</p>
          ) : users.isError ? (
            <p role="alert">
              Anggota belum dapat dimuat.{" "}
              <Button variant="outline" onClick={() => void users.refetch()}>
                Coba lagi
              </Button>
            </p>
          ) : (
            <ul className="matrix-grants">
              {users.data?.data
                .filter((user) => user.roles.some((r) => r.id === role.id))
                .map((user) => (
                  <li key={user.user_id}>
                    <strong>{user.display_name}</strong>
                    <span>
                      {user.email} · {user.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </li>
                ))}
              {!users.data?.data.some((user) => user.roles.some((r) => r.id === role.id)) && (
                <li>Belum ada anggota pada peran ini.</li>
              )}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="history" className="matrix-panel">
          <h2>Riwayat perubahan</h2>
          <p>
            Perubahan hak akses dicatat oleh backend. Tampilan riwayat peran belum terhubung karena
            endpoint pembacaan riwayat IAM belum tersedia.
          </p>
        </TabsContent>
      </Tabs>
      <aside className="matrix-boundary">
        <h2>Batas perubahan</h2>
        <p>
          Hapus draf hanya tersedia pada jenis yang mengizinkan. Dokumen terbit atau diposting tidak
          dapat diubah atau dihapus langsung. Cakupan ditetapkan per tindakan.
        </p>
        <p>
          Hanya Admin Sistem dapat mengubah matriks. Checkbox mengatur izin peran yang dipilih;
          pengguna dapat memiliki beberapa peran.
        </p>
      </aside>
      {saveError && !review && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      <div className="matrix-actions">
        {changed > 0 && <span role="status">{changed} perubahan belum disimpan</span>}
        <Button variant="outline" disabled={saving} onClick={leave}>
          Batal
        </Button>
        <Button disabled={!changed || saving} onClick={() => setReview(true)}>
          Tinjau perubahan
        </Button>
      </div>
      <Dialog
        open={review}
        onOpenChange={(open) => {
          if (!saving) setReview(open);
        }}
      >
        <DialogContent className="matrix-review">
          <DialogHeader>
            <DialogTitle>Tinjau perubahan</DialogTitle>
            <DialogDescription>
              {role.name} · {changed} perubahan pada cakupan perusahaan. Perubahan berlaku untuk{" "}
              {role.member_count} anggota peran; sesi terdampak akan dicabut.
            </DialogDescription>
          </DialogHeader>
          <ul className="matrix-grants">
            {(permissions.data?.data ?? [])
              .filter((p) => p.id in draft)
              .map((p) => (
                <li key={p.id}>
                  <strong>{p.code}</strong>
                  <span>
                    {draft[p.id] ? "Tidak diizinkan → Diizinkan" : "Diizinkan → Tidak diizinkan"}
                  </span>
                </li>
              ))}
          </ul>
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setReview(false)}>
              Kembali
            </Button>
            <Button disabled={saving || !changed} onClick={() => void save()}>
              {saving ? "Menyimpan…" : "Simpan perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan perubahan?</DialogTitle>
            <DialogDescription>{changed} perubahan hak akses belum disimpan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Lanjut mengedit
            </Button>
            <Button
              onClick={() => {
                setDraft({});
                setDiscard(false);
                if (pendingLeave) pendingLeave();
                else router.push("/setting/roles");
              }}
            >
              Buang perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
