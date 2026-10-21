"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { type Role, type User, effectivePermissions } from "@/lib/iam";
import { useSession } from "../session-provider";
import { DataTable } from "../crm/crm-common";
import { SettingShell } from "./setting-shell";
import { PermissionMatrix } from "./permission-matrix";
import {
  Heading,
  Panel,
  Value,
  Note,
  Status,
  History,
  EffectiveMatrix,
  useRoles,
  useDirtyGuard,
  useAccessContext,
  date,
  scopes,
  type UserDetail,
} from "./access-ui";
const base = (kind: string) => `/setting/${kind}`;
export function AccessWorkspace({
  section,
  path = [],
}: {
  section: "users" | "roles";
  path?: string[];
}) {
  const id = path[0] && path[0] !== "new" ? path[0] : undefined,
    form = path[0] === "new" || path[1] === "edit";
  return (
    <SettingShell
      matrix
      permission={section === "users" ? ["user.read", "role.read"] : "role.read"}
    >
      <div className="access-workspace">
        {!path.length ? (
          <AccessList section={section} />
        ) : section === "users" ? (
          id ? (
            <UserLoader id={id} edit={form} />
          ) : (
            <UserForm />
          )
        ) : form ? (
          <RoleForm id={id} />
        ) : (
          <PermissionMatrix selectedRoleId={id} />
        )}
      </div>
    </SettingShell>
  );
}
function AccessList({ section }: { section: "users" | "roles" }) {
  const users = section === "users",
    { principal } = useSession(),
    context = useAccessContext(),
    roles = useRoles(),
    cache = useQueryClient();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [status, setStatus] = useState("all"),
    [role, setRole] = useState("all"),
    [page, setPage] = useState(1),
    [target, setTarget] = useState<{
      id: string;
      name: string;
      kind: "users" | "roles";
      members?: number;
    } | null>(null),
    [deleting, setDeleting] = useState(false),
    [deleteError, setDeleteError] = useState("");
  async function confirmDelete() {
    if (!target || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await apiRequest<{ data: { archived?: boolean } }>(
        `/${target.kind}/${target.id}`,
        { method: "DELETE" },
      );
      await cache.invalidateQueries({ queryKey: ["setting"] });
      toast.success(
        target.kind === "users"
          ? response.data.archived
            ? "Pengguna diarsipkan"
            : "Pengguna dihapus"
          : "Peran dihapus",
      );
      setTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Penghapusan gagal.");
    } finally {
      setDeleting(false);
    }
  }
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  const result = useQuery({
    queryKey: ["setting", section, "page", ...context, term, status, role, page],
    queryFn: () =>
      apiRequest<{ data: (User & Role)[]; total: number }>(
        `/access-workspace/${section}?q=${encodeURIComponent(term)}&status=${status}&role=${role}&page=${page}`,
      ),
  });
  const columns: ColumnDef<User & Role>[] = users
    ? [
        {
          accessorKey: "display_name",
          header: "Nama",
          cell: ({ row }) => (
            <Link className="access-link" href={`${base(section)}/${row.original.user_id}`}>
              {row.original.display_name} ↗
            </Link>
          ),
        },
        { accessorKey: "email", header: "Email" },
        {
          id: "roles",
          header: "Peran",
          cell: ({ row }) => (
            <div className="access-badges">
              {row.original.roles.length
                ? row.original.roles.slice(0, 2).map((r) => (
                    <span key={r.id} className="access-role-badge">
                      {r.name}
                    </span>
                  ))
                : "Belum ada peran"}
              {row.original.roles.length > 2 && (
                <Link
                  className="access-role-badge"
                  href={`/setting/users/${row.original.user_id}`}
                  title={row.original.roles
                    .slice(2)
                    .map((r) => r.name)
                    .join(", ")}
                >
                  +{row.original.roles.length - 2} peran
                </Link>
              )}
            </div>
          ),
        },
        {
          id: "active",
          header: "Status",
          cell: ({ row }) => <Status active={row.original.active} />,
        },
        {
          accessorKey: "last_active_at",
          header: "Terakhir aktif",
          cell: ({ row }) => date(row.original.last_active_at),
        },
        {
          id: "actions",
          header: "Aksi",
          cell: ({ row }) =>
            can("user.delete") && row.original.user_id !== principal?.user_id ? (
              <Button
                variant="outline"
                onClick={() => {
                  setTarget({
                    id: row.original.user_id,
                    name: row.original.display_name,
                    kind: "users",
                  });
                  setDeleteError("");
                }}
              >
                <Trash2 /> Hapus
              </Button>
            ) : (
              "—"
            ),
        },
      ]
    : [
        {
          accessorKey: "name",
          header: "Nama peran",
          cell: ({ row }) => (
            <Link className="access-link" href={`${base(section)}/${row.original.id}`}>
              {row.original.name} ↗
            </Link>
          ),
        },
        {
          accessorKey: "description",
          header: "Deskripsi",
          cell: ({ row }) => row.original.description || "—",
        },
        { accessorKey: "member_count", header: "Anggota" },
        {
          id: "permissions",
          header: "Izin",
          cell: ({ row }) => new Set(row.original.permissions.map((p) => p.code)).size,
        },
        {
          id: "active",
          header: "Status",
          cell: ({ row }) => <Status active={row.original.active} />,
        },
        {
          id: "actions",
          header: "Aksi",
          cell: ({ row }) => (
            <div className="access-tab-actions">
              {can("permission.read") && (
                <Button variant="outline" asChild>
                  <Link href={`/setting/roles/${row.original.id}/permissions`}>Atur Hak Akses</Link>
                </Button>
              )}
              {can("role.delete") && row.original.code !== "ADMIN_SYSTEM" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setTarget({
                      id: row.original.id,
                      name: row.original.name,
                      kind: "roles",
                      members: row.original.member_count,
                    });
                    setDeleteError("");
                  }}
                >
                  <Trash2 /> Hapus
                </Button>
              )}
            </div>
          ),
        },
      ];
  return (
    <>
      <Heading title={users ? "Pengguna" : "Peran"} section={section}>
        {can(users ? "user.create" : "role.create") && (
          <Button asChild>
            <Link href={`${base(section)}/new`}>
              <Plus />
              Tambah {users ? "Pengguna" : "Peran"}
            </Link>
          </Button>
        )}
      </Heading>
      <Note>
        {users
          ? "Admin Sistem menetapkan satu atau beberapa peran untuk setiap pengguna. Hak akses mengikuti gabungan izin peran tersebut."
          : "Pilih Atur Hak Akses untuk mengubah izin peran melalui matriks. Tetapkan peran kepada akun melalui menu Pengguna."}
      </Note>
      {result.isError ? (
        <p role="alert">
          {result.error.message}{" "}
          <Button variant="outline" onClick={() => void result.refetch()}>
            Coba lagi
          </Button>
        </p>
      ) : (
        <DataTable
          label={users ? "pengguna" : "peran"}
          data={result.data?.data ?? []}
          columns={columns}
          busy={result.isPending}
          total={result.data?.total ?? 0}
          page={page}
          onPage={setPage}
          densityControl
          toolbar={
            <>
              <Input
                aria-label={users ? "Cari pengguna" : "Cari peran"}
                placeholder={users ? "Cari nama atau email" : "Cari nama peran"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <SelectionField
                label="Status"
                value={[status]}
                options={[
                  { id: "all", name: "Semua" },
                  { id: "active", name: "Aktif" },
                  { id: "inactive", name: "Nonaktif" },
                ]}
                onChange={(v) => {
                  setStatus(v[0] ?? "all");
                  setPage(1);
                }}
              />
              {users && (
                <SelectionField
                  label="Peran"
                  value={[role]}
                  options={[{ id: "all", name: "Semua" }, ...(roles.data?.data ?? [])]}
                  onChange={(v) => {
                    setRole(v[0] ?? "all");
                    setPage(1);
                  }}
                />
              )}
            </>
          }
        />
      )}
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !deleting) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus {target?.kind === "users" ? "pengguna" : "peran"}?</DialogTitle>
            <DialogDescription>
              {target?.name}.{" "}
              {target?.kind === "users"
                ? "Akun yang belum dipakai dihapus permanen. Jika sudah memiliki riwayat, akun diarsipkan dan disembunyikan dari daftar. Sesi akan dicabut."
                : `Penugasan pada ${target?.members ?? 0} pengguna akan dilepas dan sesi mereka dicabut.`}
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p role="alert">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function UserLoader({ id, edit }: { id: string; edit: boolean }) {
  const context = useAccessContext();
  const result = useQuery({
    queryKey: ["setting", "users", id, ...context],
    queryFn: () => apiRequest<{ data: UserDetail }>(`/users/${id}`),
  });
  if (result.isPending) return <p role="status">Memuat pengguna…</p>;
  if (result.isError)
    return (
      <div role="alert">
        <p>{result.error.message}</p>
        <Button variant="secondary" onClick={() => void result.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  return edit ? (
    <UserForm key={id} initial={result.data.data} />
  ) : (
    <UserDetails user={result.data.data} />
  );
}
function UserForm({ initial }: { initial?: UserDetail }) {
  const { principal } = useSession(),
    router = useRouter(),
    cache = useQueryClient(),
    roles = useRoles();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const permitted = initial ? can("user.update") && can("user.role.assign") : can("user.create");
  const [name, setName] = useState(initial?.display_name ?? ""),
    [email, setEmail] = useState(initial?.email ?? ""),
    [password, setPassword] = useState(""),
    [active, setActive] = useState(initial?.active ?? true),
    [ids, setIds] = useState(initial?.roles.map((r) => r.id) ?? []),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false);
  useDirtyGuard(dirty && !saving);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !permitted) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiRequest<{ data: { user_id: string } }>(
        initial ? `/users/${initial.user_id}` : "/users",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify({
            display_name: name,
            email,
            active,
            role_ids: ids,
            ...(!initial ? { password } : {}),
          }),
        },
      );
      setPassword("");
      setDirty(false);
      await cache.invalidateQueries({ queryKey: ["setting"] });
      toast.success("Pengguna tersimpan");
      router.push(`${base("users")}/${response.data.user_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Data belum tersimpan.");
    } finally {
      setSaving(false);
    }
  }
  if (!permitted) return <p role="alert">Anda tidak memiliki izin menyimpan pengguna.</p>;
  return (
    <>
      <Heading
        title={initial ? "Ubah Pengguna" : "Tambah Pengguna"}
        section="users"
        trail={initial ? `${initial.display_name} / Ubah` : "Baru"}
        back={initial ? `${base("users")}/${initial.user_id}` : base("users")}
      >
        <span className="access-role-badge">
          {dirty || !initial ? "Belum disimpan" : "Tersimpan"}
        </span>
      </Heading>
      <form
        className="access-form web-form"
        onSubmit={(e) => void save(e)}
        onChange={() => setDirty(true)}
      >
        <fieldset disabled={saving}>
          <Panel title="Akun">
            <div className="access-form-grid">
              <label>
                Nama lengkap
                <Input
                  required
                  minLength={2}
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Email
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {!initial && (
                <label>
                  Kata sandi awal (minimal 12 karakter)
                  <Input
                    type="password"
                    required
                    minLength={12}
                    maxLength={200}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              <div>
                <span className="access-field-label">Status akun</span>
                <label className="access-switch">
                  <Switch
                    checked={active}
                    onCheckedChange={(v) => {
                      setActive(v);
                      setDirty(true);
                    }}
                  />
                  Akun {active ? "dapat" : "tidak dapat"} masuk
                </label>
              </div>
            </div>
          </Panel>
          <Panel title="Peran">
            <Note>
              Satu pengguna boleh memiliki beberapa peran. Izin efektif adalah gabungan izin peran
              aktif sesuai cakupan. Jabatan tidak otomatis memberi peran.
            </Note>
            {roles.isPending ? (
              <p role="status">Memuat peran…</p>
            ) : roles.isError ? (
              <p role="alert">Peran gagal dimuat.</p>
            ) : (
              <div className="access-role-options">
                {roles.data.data.map((r) => (
                  <label key={r.id} className="access-role-option">
                    <Checkbox
                      disabled={!r.active && !ids.includes(r.id)}
                      checked={ids.includes(r.id)}
                      onCheckedChange={(v) => {
                        setIds((old) => (v ? [...old, r.id] : old.filter((id) => id !== r.id)));
                        setDirty(true);
                      }}
                    />
                    <span>
                      <strong>{r.name}</strong>
                      <small>
                        {r.description || "Tanpa deskripsi"}
                        {!r.active ? " · Nonaktif" : ""}
                      </small>
                    </span>
                    <small>
                      {r.member_count} anggota ·{" "}
                      {Array.from(
                        new Set(r.permissions.map((g) => scopes[g.scope_type] ?? g.scope_type)),
                      ).join(", ") || "Belum ada izin"}
                    </small>
                  </label>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Pratinjau izin efektif">
            <div className="access-preview-stats">
              <Value label="Peran dipilih">{ids.length} peran</Value>
              <Value label="Izin efektif">
                {effectivePermissions(roles.data?.data ?? [], ids).length} izin
              </Value>
            </div>
            <Button type="button" variant="outline" onClick={() => setPreview((v) => !v)}>
              {preview ? "Tutup pratinjau" : "Lihat pratinjau lengkap"}
            </Button>
            {preview && <EffectiveMatrix roles={roles.data?.data ?? []} roleIds={ids} />}
          </Panel>
        </fieldset>
        {error && (
          <p role="alert" className="access-error">
            {error}
          </p>
        )}
        <footer className="access-actions">
          <Button type="submit" disabled={saving || roles.isPending || roles.isError}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link href={base("users")}>Batal</Link>
          </Button>
        </footer>
      </form>
    </>
  );
}
function UserDetails({ user }: { user: UserDetail }) {
  const { principal } = useSession(),
    roles = useRoles(),
    cache = useQueryClient();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p);
  const canEdit = can("user.update") && can("user.role.assign");
  const [action, setAction] = useState<"status" | "sessions" | string | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function apply() {
    if (!action || saving) return;
    setSaving(true);
    setError("");
    try {
      if (action === "sessions")
        await apiRequest(`/users/${user.user_id}/revoke-sessions`, { method: "POST" });
      else if (action === "status")
        await apiRequest(`/users/${user.user_id}`, {
          method: "PATCH",
          body: JSON.stringify({
            display_name: user.display_name,
            email: user.email,
            active: !user.active,
            role_ids: user.roles.map((r) => r.id),
          }),
        });
      else
        await apiRequest(`/users/${user.user_id}/roles`, {
          method: "PATCH",
          body: JSON.stringify({
            role_ids: user.roles.filter((r) => r.id !== action).map((r) => r.id),
          }),
        });
      await cache.invalidateQueries({ queryKey: ["setting"] });
      toast.success("Perubahan tersimpan");
      setAction(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan belum tersimpan.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Heading
        title={user.display_name}
        section="users"
        trail={user.display_name}
        back={base("users")}
      />
      <div className="access-actions">
        <strong>{user.email}</strong>
        <Status active={user.active} />
      </div>
      <div className="access-actions">
        {canEdit && (
          <Button asChild>
            <Link href={`${base("users")}/${user.user_id}/edit`}>Ubah</Link>
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outline"
            onClick={() => {
              setAction("status");
              setError("");
            }}
          >
            {user.active ? "Nonaktifkan" : "Aktifkan"} akun
          </Button>
        )}
        {can("user.update") && (
          <Button
            variant="outline"
            onClick={() => {
              setAction("sessions");
              setError("");
            }}
          >
            Cabut sesi
          </Button>
        )}
      </div>
      <Panel>
        <div className="access-overview">
          <Value label="Email">{user.email}</Value>
          <Value label="Status akun">{user.active ? "Aktif" : "Nonaktif"}</Value>
          <Value label="Terakhir aktif">{date(user.last_active_at)}</Value>
          <Value label="Jumlah peran">{user.roles.length}</Value>
          <Value label="Izin efektif">
            {new Set(user.effective_permissions.map((g) => g.code)).size} izin
          </Value>
          <Value label="Sesi aktif">{user.active_sessions} sesi</Value>
          <Value label="Dibuat">{date(user.created_at)}</Value>
          <Value label="Dibuat oleh">{user.created_by ?? "Tidak tercatat"}</Value>
        </div>
      </Panel>
      <Tabs defaultValue="roles" className="access-tabs">
        <TabsList aria-label="Detail pengguna">
          {[
            ["roles", "Peran & Cakupan"],
            ["effective", "Izin Efektif"],
            ["sessions", "Sesi"],
            ["history", "Riwayat"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value!}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="roles">
          <DataTable
            showColumns={false}
            data={user.roles}
            total={user.roles.length}
            columns={[
              { accessorKey: "name", header: "Peran" },
              {
                id: "scope",
                header: "Cakupan",
                cell: ({ row }) =>
                  Array.from(
                    new Set(
                      roles.data?.data
                        .find((r) => r.id === row.original.id)
                        ?.permissions.map((g) => scopes[g.scope_type] ?? g.scope_type),
                    ),
                  ).join(", ") || "Belum ada izin",
              },
              {
                id: "since",
                header: "Ditetapkan sejak",
                cell: ({ row }) =>
                  date(user.assignments.find((a) => a.role_id === row.original.id)?.assigned_at),
              },
              {
                id: "by",
                header: "Ditetapkan oleh",
                cell: ({ row }) =>
                  user.assignments.find((a) => a.role_id === row.original.id)?.assigned_by ??
                  "Tidak tercatat",
              },
              {
                id: "action",
                header: "Aksi",
                cell: ({ row }) =>
                  can("user.role.assign") ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAction(row.original.id);
                        setError("");
                      }}
                    >
                      Cabut peran
                    </Button>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
          {canEdit && (
            <div className="access-tab-actions">
              <Button asChild>
                <Link href={`${base("users")}/${user.user_id}/edit`}>
                  <Plus />
                  Tetapkan peran
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="effective">
          <EffectiveMatrix
            roles={roles.data?.data ?? []}
            roleIds={user.roles.map((r) => r.id)}
            effective={user.effective_permissions}
          />
        </TabsContent>
        <TabsContent value="sessions">
          <DataTable
            showColumns={false}
            data={user.sessions}
            total={user.sessions.length}
            columns={[
              {
                accessorKey: "device_label",
                header: "Perangkat",
                cell: ({ row }) => row.original.device_label ?? "Perangkat tidak tercatat",
              },
              {
                accessorKey: "created_at",
                header: "Masuk",
                cell: ({ row }) => date(row.original.created_at),
              },
              {
                accessorKey: "last_seen_at",
                header: "Terakhir aktif",
                cell: ({ row }) => date(row.original.last_seen_at),
              },
              {
                accessorKey: "expires_at",
                header: "Berakhir",
                cell: ({ row }) => date(row.original.expires_at),
              },
              {
                id: "status",
                header: "Status",
                cell: ({ row }) => (
                  <span className="access-role-badge">
                    {row.original.revoked_at
                      ? "Dicabut"
                      : new Date(row.original.expires_at) <= new Date()
                        ? "Kedaluwarsa"
                        : "Aktif"}
                  </span>
                ),
              },
            ]}
          />
          <p className="access-caption">
            100 sesi terbaru. Pencabutan berlaku pada seluruh sesi perusahaan ini.
          </p>
        </TabsContent>
        <TabsContent value="history">
          <History kind="users" id={user.user_id} />
        </TabsContent>
      </Tabs>
      <Note>
        Mencabut atau menambah peran dicatat di audit dan mencabut sesi pengguna yang terdampak.
      </Note>
      <Dialog
        open={!!action}
        onOpenChange={(v) => {
          if (!v && !saving) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "sessions"
                ? "Cabut sesi pengguna?"
                : action === "status"
                  ? `${user.active ? "Nonaktifkan" : "Aktifkan"} akun?`
                  : "Cabut peran?"}
            </DialogTitle>
            <DialogDescription>
              {user.display_name} · perubahan berlaku pada perusahaan ini dan sesi terkait akan
              dicabut.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setAction(null)}>
              Kembali
            </Button>
            <Button disabled={saving} onClick={() => void apply()}>
              {saving ? "Menyimpan…" : "Terapkan perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function RoleForm({ id }: { id?: string | undefined }) {
  const roles = useRoles();
  if (id && roles.isPending) return <p role="status">Memuat peran…</p>;
  if (id && roles.isError) return <p role="alert">{roles.error.message}</p>;
  const role = roles.data?.data.find((r) => r.id === id);
  if (id && !role) return <p role="alert">Peran tidak ditemukan.</p>;
  return <RoleEditor key={id ?? "new"} initial={role} />;
}
function RoleEditor({ initial }: { initial?: Role | undefined }) {
  const { principal } = useSession(),
    router = useRouter(),
    cache = useQueryClient();
  const allowed =
    !!principal && hasCompanyPermission(principal, initial ? "role.update" : "role.create");
  const [name, setName] = useState(initial?.name ?? ""),
    [description, setDescription] = useState(initial?.description ?? ""),
    [active, setActive] = useState(initial?.active ?? true),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useDirtyGuard(dirty && !saving);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!allowed || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiRequest<{ data: { id: string } }>(
        initial ? `/roles/${initial.id}` : "/roles",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify({
            name,
            description,
            active,
            ...(!initial
              ? { code: `ROLE_${crypto.randomUUID().replaceAll("-", "").toUpperCase()}` }
              : {}),
          }),
        },
      );
      setDirty(false);
      await cache.invalidateQueries({ queryKey: ["setting"] });
      toast.success("Peran tersimpan");
      router.push(`${base("roles")}/${response.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Peran belum tersimpan.");
    } finally {
      setSaving(false);
    }
  }
  if (!allowed) return <p role="alert">Anda tidak memiliki izin menyimpan peran.</p>;
  return (
    <>
      <Heading
        title={initial ? "Ubah Peran" : "Tambah Peran"}
        section="roles"
        trail={initial ? `${initial.name} / Ubah` : "Baru"}
        back={base("roles")}
      >
        <span className="access-role-badge">
          {dirty || !initial ? "Belum disimpan" : "Tersimpan"}
        </span>
      </Heading>
      <form
        className="access-form web-form"
        onSubmit={(e) => void save(e)}
        onChange={() => setDirty(true)}
      >
        <fieldset disabled={saving}>
          <Panel title="Peran">
            <div className="access-form-grid">
              <label>
                Nama peran (minimal 2 karakter)
                <Input
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Deskripsi
                <Input
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div>
                <span className="access-field-label">Status</span>
                <label className="access-switch">
                  <Switch
                    disabled={initial?.code === "ADMIN_SYSTEM"}
                    checked={active}
                    onCheckedChange={(v) => {
                      setActive(v);
                      setDirty(true);
                    }}
                  />
                  Peran {active ? "aktif" : "nonaktif"}
                </label>
              </div>
            </div>
          </Panel>
        </fieldset>
        <Note>
          {initial
            ? "Perubahan identitas peran tidak mengubah hak akses. Atur izin melalui Matriks Hak Akses."
            : "Peran baru langsung mendapat seluruh izin yang tersedia pada cakupan perusahaan. Anda dapat membatasi izinnya melalui Matriks Hak Akses setelah disimpan."}
        </Note>
        {error && <p role="alert">{error}</p>}
        <footer className="access-actions">
          <Button disabled={saving} type="submit">
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button variant="outline" asChild>
            <Link href={base("roles")}>Batal</Link>
          </Button>
        </footer>
      </form>
    </>
  );
}
