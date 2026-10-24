"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { DiscountLimitField } from "./discount-limit-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { Edit3, Plus, Search, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { apiRequest, ApiError } from "../../lib/api";
import { effectivePermissionSummary, type Role, type User } from "../../lib/iam";
import { PermissionMatrix } from "./permission-matrix";
import { AccessWorkspace } from "./access-workspace";
import { SettingShell } from "./setting-shell";
import { useSession } from "../session-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { hasCompanyPermission } from "@/lib/navigation";

const statusText = (active: boolean) => (active ? "Aktif" : "Nonaktif");
const statusClass = (active: boolean) =>
  active
    ? "border-green-200 bg-green-50 text-green-700"
    : "border-pink-200 bg-pink-50 text-pink-700";

function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="access-page-heading flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function UsersView() {
  const { principal } = useSession();
  const canCreate = !!principal && hasCompanyPermission(principal, "user.create");
  const canEdit =
    !!principal &&
    hasCompanyPermission(principal, "user.update") &&
    hasCompanyPermission(principal, "user.role.assign");
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const users = useQuery({
    queryKey: ["setting", "users"],
    queryFn: () => apiRequest<{ data: User[] }>("/users"),
  });
  const roles = useQuery({
    queryKey: ["setting", "roles"],
    queryFn: () => apiRequest<{ data: Role[] }>("/roles"),
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const rows = useMemo(
    () =>
      (users.data?.data ?? []).filter(
        (user) =>
          (!search ||
            `${user.display_name} ${user.email}`.toLowerCase().includes(search.toLowerCase())) &&
          (filter === "all" || (filter === "active" ? user.active : !user.active)),
      ),
    [filter, search, users.data],
  );
  const openUser = (user: User | null) => {
    setSelected(user);
    setName(user?.display_name ?? "");
    setEmail(user?.email ?? "");
    setPassword("");
    setActive(user?.active ?? true);
    setRoleIds(user?.roles.map((role) => role.id) ?? []);
    setError("");
    setOpen(true);
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (selected)
        await apiRequest(`/users/${selected.user_id}`, {
          method: "PATCH",
          body: JSON.stringify({ display_name: name, email, active, role_ids: roleIds }),
        });
      else
        await apiRequest("/users", {
          method: "POST",
          body: JSON.stringify({
            display_name: name,
            email,
            password,
            role_ids: roleIds,
          }),
        });
      await client.invalidateQueries({ queryKey: ["setting"] });
      setOpen(false);
      toast.success("Tersimpan");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Perubahan belum tersimpan.");
    } finally {
      setSaving(false);
    }
  };
  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "display_name",
      header: "Nama",
      cell: ({ row }) => <span className="font-medium">{row.original.display_name}</span>,
    },
    { accessorKey: "email", header: "Email" },
    {
      id: "roles",
      header: "Peran",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.slice(0, 2).map((role) => (
            <Badge
              key={role.id}
              variant="outline"
              className="rounded-full bg-[#F4F8FD] text-[11px]"
            >
              {role.name}
            </Badge>
          ))}
          {row.original.roles.length > 2 ? (
            <Badge variant="outline" className="rounded-full">
              +{row.original.roles.length - 2}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={`rounded-full ${statusClass(row.original.active)}`}>
          {statusText(row.original.active)}
        </Badge>
      ),
    },
    {
      accessorKey: "last_active_at",
      header: "Terakhir Aktif",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.last_active_at
            ? new Date(row.original.last_active_at).toLocaleString("id-ID")
            : "Belum aktif"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            disabled={!canEdit}
            variant="ghost"
            size="icon"
            className="size-8 rounded-sm"
            aria-label={`Edit ${row.original.display_name}`}
            onClick={(event) => {
              event.stopPropagation();
              openUser(row.original);
            }}
          >
            <Edit3 />
          </Button>
          <Button
            disabled={!canEdit}
            variant="ghost"
            size="icon"
            className="size-8 rounded-sm"
            aria-label={`${row.original.active ? "Nonaktifkan" : "Aktifkan"} ${row.original.display_name}`}
            onClick={(event) => {
              event.stopPropagation();
              openUser(row.original);
            }}
          >
            {row.original.active ? <UserX /> : <UserCheck />}
          </Button>
        </div>
      ),
    },
  ];
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <>
      <PageHeading
        title="Pengguna"
        description="Admin Sistem menetapkan satu atau beberapa peran untuk setiap pengguna. Hak akses mengikuti gabungan izin peran tersebut."
        action={
          canCreate ? (
            <Button className="h-9 rounded-sm" onClick={() => openUser(null)}>
              <Plus data-icon="inline-start" />
              Tambah Pengguna
            </Button>
          ) : undefined
        }
      />
      <Card className="border-ev-border mt-5 rounded-md shadow-none">
        <CardHeader className="flex-row flex-wrap items-center gap-2 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama atau email"
              className="h-9 rounded-sm pl-8"
              aria-label="Cari pengguna"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-36 rounded-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {users.isPending ? (
            <p className="text-muted-foreground p-8 text-sm">Memuat...</p>
          ) : users.isError ? (
            <Alert variant="destructive" className="m-4">
              <AlertDescription>Data pengguna belum dapat dimuat.</AlertDescription>
            </Alert>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground p-10 text-center text-sm">
              Belum ada pengguna.
              {canCreate && (
                <div className="mt-3">
                  <Button size="sm" onClick={() => openUser(null)}>
                    Tambah Pengguna
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <UserTable table={table} onOpen={openUser} />
          )}
        </CardContent>
      </Card>
      <UserDetailDrawer
        open={open}
        onOpenChange={setOpen}
        selected={selected}
        saving={saving}
        canSave={
          (selected ? Boolean(canEdit) : canCreate) &&
          !roles.isPending &&
          !roles.isError &&
          Boolean(name.trim()) &&
          Boolean(email.trim()) &&
          (Boolean(selected) || password.length >= 12)
        }
        onSave={() => void save()}
      >
        <div className="flex flex-col gap-4 overflow-y-auto px-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Nama
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 rounded-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-9 rounded-sm"
            />
          </label>
          {!selected ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Kata sandi awal
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                className="h-9 rounded-sm"
              />
              <small className="text-muted-foreground text-xs font-normal">
                Minimal 12 karakter; sampaikan kepada pengguna melalui kanal aman.
              </small>
            </label>
          ) : null}
          {selected ? (
            <div className="flex items-center justify-between rounded-sm border border-[#CAD9E8] p-3 text-sm">
              <span>
                Status akun
                <small className="text-muted-foreground block text-xs font-normal">
                  {active ? "Akun dapat masuk" : "Akun tidak dapat masuk"}
                </small>
              </span>
              <Switch checked={active} onCheckedChange={setActive} aria-label="Status akun" />
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium">Peran</p>
            {roles.isPending && (
              <p role="status" className="text-muted-foreground text-xs">
                Memuat peran...
              </p>
            )}
            {roles.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  Peran tidak dapat dimuat. Perubahan akun tidak dapat disimpan.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              {(roles.data?.data ?? []).map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roleIds.includes(role.id)}
                    onCheckedChange={(checked) =>
                      setRoleIds((current) =>
                        checked ? [...current, role.id] : current.filter((id) => id !== role.id),
                      )
                    }
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          {selected ? (
            <DiscountLimitField
              kind="users"
              id={selected.user_id}
              value={selected.discount_limit ?? null}
              version={selected.version}
            />
          ) : null}
          {selected ? <EffectivePanel roles={roles.data?.data ?? []} roleIds={roleIds} /> : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </UserDetailDrawer>
    </>
  );
}

export function UserDetailDrawer({
  open,
  onOpenChange,
  selected,
  saving,
  canSave,
  onSave,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: User | null;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-ev-border w-full border-l sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{selected ? "Edit Pengguna" : "Tambah Pengguna"}</DrawerTitle>
          <DrawerDescription>
            Perubahan izin berlaku setelah server mengonfirmasi dan sesi terkait dimuat ulang.
          </DrawerDescription>
        </DrawerHeader>
        {children}
        <DrawerFooter>
          <Button disabled={saving || !canSave} onClick={onSave}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Batal</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function UserTable({
  table,
  onOpen,
}: {
  table: TanstackTable<User>;
  onOpen: (user: User) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[760px]">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpen(row.original)}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function EffectivePanel({ roles, roleIds }: { roles: Role[]; roleIds: string[] }) {
  const grouped = effectivePermissionSummary(roles, roleIds);
  return (
    <div className="rounded-sm border border-[#CAD9E8] bg-[#F4F8FD] p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="text-primary size-4" />
        Hak Akses Efektif
      </div>
      {grouped.length ? (
        <div className="mt-3 flex flex-col gap-2 text-xs">
          {grouped.map(({ module, labels }) => (
            <div key={module}>
              <span className="font-medium">{module}</span>
              <span className="text-muted-foreground ml-2">{labels.join(" · ")}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">
          Belum ada hak akses dari peran terpilih.
        </p>
      )}
    </div>
  );
}

export function RolesView() {
  const { principal } = useSession();
  const can = (code: string) => !!principal && hasCompanyPermission(principal, code);
  const router = useRouter();
  const client = useQueryClient();
  const roles = useQuery({
    queryKey: ["setting", "roles"],
    queryFn: () => apiRequest<{ data: Role[] }>("/roles"),
  });
  const [selected, setSelected] = useState<Role | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await apiRequest(selected ? `/roles/${selected.id}` : "/roles", {
        method: selected ? "PATCH" : "POST",
        body: JSON.stringify(
          selected
            ? { name, description }
            : {
                code: name
                  .toUpperCase()
                  .replace(/[^A-Z0-9]+/g, "_")
                  .replace(/^_|_$/g, ""),
                name,
                description,
              },
        ),
      });
      await client.invalidateQueries({ queryKey: ["setting", "roles"] });
      setOpen(false);
      toast.success("Tersimpan");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Perubahan belum tersimpan.");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (role: Role) => {
    if (role.code === "ADMIN_SYSTEM") return;
    if (!window.confirm(`Hapus peran ${role.name} dan lepaskan dari ${role.member_count} pengguna? Sesi mereka akan dicabut.`)) return;
    try {
      await apiRequest(`/roles/${role.id}`, { method: "DELETE" });
      await client.invalidateQueries({ queryKey: ["setting", "roles"] });
      toast.success("Peran dihapus");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Peran belum dapat dihapus.");
    }
  };
  return (
    <>
      <PageHeading
        title="Peran"
        description="Pilih Atur Hak Akses untuk mengubah izin peran melalui matriks. Tetapkan peran kepada akun melalui menu Pengguna."
        action={
          can("role.create") ? (
            <Button
              className="h-9 rounded-sm"
              onClick={() => {
                setSelected(null);
                setName("");
                setDescription("");
                setOpen(true);
              }}
            >
              <Plus data-icon="inline-start" />
              Tambah Peran
            </Button>
          ) : undefined
        }
      />
      <Card className="border-ev-border mt-5 rounded-md shadow-none">
        <CardContent className="p-0">
          {roles.isPending ? (
            <p className="text-muted-foreground p-8 text-sm">Memuat...</p>
          ) : roles.isError ? (
            <Alert variant="destructive" className="m-4">
              <AlertDescription>Data peran belum dapat dimuat.</AlertDescription>
            </Alert>
          ) : roles.data?.data.length === 0 ? (
            <div className="text-muted-foreground p-10 text-center text-sm">
              Belum ada peran.
              {can("role.create") && (
                <div className="mt-3">
                  <Button size="sm" onClick={() => setOpen(true)}>
                    Tambah Peran
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <RoleTable
              roles={roles.data?.data ?? []}
              canEdit={can("role.update")}
              canMatrix={can("role.permission.update") && can("permission.read")}
              canRemove={can("role.delete")}
              onEdit={(role) => {
                setSelected(role);
                setName(role.name);
                setDescription(role.description ?? "");
                setOpen(true);
              }}
              onMatrix={(role) => router.push(`/setting/roles/${role.id}/permissions`)}
              onRemove={(role) => void remove(role)}
            />
          )}
        </CardContent>
      </Card>
      {error && !open ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <RoleFormDrawer
        open={open}
        onOpenChange={setOpen}
        selected={selected}
        name={name}
        onName={setName}
        description={description}
        onDescription={setDescription}
        error={error}
        saving={saving}
        onSave={() => void save()}
      />
    </>
  );
}

export function RoleFormDrawer({
  open,
  onOpenChange,
  selected,
  name,
  onName,
  description,
  onDescription,
  error,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: Role | null;
  name: string;
  onName: (value: string) => void;
  description: string;
  onDescription: (value: string) => void;
  error: string;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-ev-border w-full border-l sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{selected ? "Edit Peran" : "Tambah Peran"}</DrawerTitle>
          <DrawerDescription>
            Nama dan deskripsi peran tersimpan setelah server mengonfirmasi.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Nama Peran
            <Input
              value={name}
              onChange={(event) => onName(event.target.value)}
              className="h-9 rounded-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Deskripsi
            <Input
              value={description}
              onChange={(event) => onDescription(event.target.value)}
              className="h-9 rounded-sm"
            />
          </label>
          {selected ? (
            <DiscountLimitField
              kind="roles"
              id={selected.id}
              value={selected.discount_limit ?? null}
              version={selected.version}
            />
          ) : null}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DrawerFooter>
          <Button disabled={saving || name.trim().length < 2} onClick={onSave}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Batal</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function RoleTable({
  roles,
  canEdit,
  canMatrix,
  canRemove,
  onEdit,
  onMatrix,
  onRemove,
}: {
  roles: Role[];
  canEdit: boolean;
  canMatrix: boolean;
  canRemove: boolean;
  onEdit: (role: Role) => void;
  onMatrix: (role: Role) => void;
  onRemove: (role: Role) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead>Nama Peran</TableHead>
            <TableHead>Jumlah Pengguna</TableHead>
            <TableHead>Deskripsi</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-medium">{role.name}</TableCell>
              <TableCell>{role.member_count}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {role.description ?? "—"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => onEdit(role)}
                  >
                    <Edit3 data-icon="inline-start" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canMatrix}
                    onClick={() => onMatrix(role)}
                  >
                    Atur Hak Akses
                  </Button>
                  {role.code !== "ADMIN_SYSTEM" && canRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${role.name}`}
                      onClick={() => onRemove(role)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AccessPage({section,roleId}:{section:"users"|"roles"|"matrix";roleId?:string}) {
 if(section!=="matrix")return <AccessWorkspace section={section}/>;
 return <SettingShell matrix permission={["role.read","permission.read"]}><PermissionMatrix selectedRoleId={roleId}/></SettingShell>;
}
