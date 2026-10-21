"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { type Permission, permissionPresentation, actionLabels } from "@/lib/iam";
import {
  matrixPermissionChecked,
  missingMatrixActionLabel,
  navigationMatrixRows,
  matrixTree,
  visibleMatrixTree,
  toggleMatrixBranch,
  matrixSubtreePermissions,
  matrixSelectionState,
  type MatrixTreeRow,
} from "@/lib/access-matrix-navigation";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DataTable } from "../crm/crm-common";
import {
  Heading,
  Panel,
  Value,
  Note,
  Status,
  History,
  useAccessContext,
  useRoles,
  useDirtyGuard,
  actions,
  scopes,
  date,
  permissionLabel,
} from "./access-ui";
type MatrixRow = MatrixTreeRow;
export function PermissionMatrix({ selectedRoleId }: { selectedRoleId?: string | undefined }) {
  const params = useSearchParams(),
    id = selectedRoleId ?? params.get("role"),
    roles = useRoles(),
    router = useRouter(),
    context = useAccessContext(),
    cache = useQueryClient(),
    { principal } = useSession();
  const can = (p: string) => !!principal && hasCompanyPermission(principal, p),
    editable = can("role.permission.update");
  const permissions = useQuery({
    queryKey: ["setting", "permissions", ...context],
    queryFn: () => apiRequest<{ data: Permission[] }>("/permissions"),
    enabled: can("permission.read"),
  });
  const [tab, setTab] = useState("matrix"),
    [expanded, setExpanded] = useState<Record<string, boolean>>({
      "Sales & Marketing": true,
      "Sales & Marketing › CRM": true,
      "Master Data": true,
    }),
    [search, setSearch] = useState(""),
    [show, setShow] = useState("all"),
    [draft, setDraft] = useState<Record<string, boolean>>({}),
    [review, setReview] = useState(false),
    [saving, setSaving] = useState(false),
    [deleting, setDeleting] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [error, setError] = useState("");
  const role = roles.data?.data.find((r) => r.id === id),
    adminRole = role?.code === "ADMIN_SYSTEM",
    grants = role?.permissions ?? [],
    changed = Object.keys(draft).length;
  useDirtyGuard(changed > 0 && !saving);
  const original = (id: string) =>
    grants.some((g) => g.permission_id === id && g.scope_type === "company" && !g.scope_id);
  const checked = (p: Permission) => matrixPermissionChecked(adminRole, p.id, grants, draft);
  const change = (p: Permission, value: boolean) =>
    setDraft((old) => {
      const next = { ...old };
      if (value === original(p.id)) delete next[p.id];
      else next[p.id] = value;
      return next;
    });
  const selectAll = () => {
    setDraft((old) => {
      const next = { ...old };
      for (const permission of permissions.data?.data ?? []) {
        if (original(permission.id)) delete next[permission.id];
        else next[permission.id] = true;
      }
      return next;
    });
  };
  const groups = useMemo(
    () => navigationMatrixRows(permissions.data?.data ?? []),
    [permissions.data],
  );
  const filtered = groups.filter(
    (row) =>
      (!search ||
        `${row.path} ${row.items.map(permissionLabel).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (show === "all" ||
        row.items.some((p) =>
          show === "allowed" ? checked(p) : show === "changed" ? p.id in draft : !checked(p),
        )),
  );
  const tree = useMemo(() => matrixTree(groups), [groups]);
  const filtering = !!search || show !== "all";
  const matchedPaths = new Set(filtered.map((row) => row.path));
  const rows = visibleMatrixTree(
    tree,
    expanded,
    filtering ? (row) => matchedPaths.has(row.path) : undefined,
  );
  const toggleBranch = (row: MatrixRow) => {
    const allRows = visibleMatrixTree(tree, {}, () => true);
    setExpanded((old) =>
      toggleMatrixBranch(
        Object.fromEntries(
          allRows
            .filter((item) => item.children.length)
            .map((item) => [item.path, old[item.path] ?? filtering]),
        ),
        row.path,
        old[row.path] ?? filtering,
      ),
    );
  };
  const control = (p: Permission, label: string) => (
    <span
      key={p.id}
      className={`access-check ${p.id in draft ? "is-changed" : ""} ${adminRole ? "is-inherited" : ""}`}
    >
      <Checkbox
        disabled={saving || !editable || adminRole}
        checked={checked(p)}
        aria-label={`${label} (${p.code})${adminRole ? ", hak otomatis Admin Sistem" : ""}`}
        onCheckedChange={(v) => change(p, v === true)}
      />
    </span>
  );
  const bulkControl = (items: Permission[], label: string) =>
    items.length ? (
      <span className="access-check access-group-check">
        <Checkbox
          disabled={saving || !editable || adminRole}
          checked={matrixSelectionState(items, checked)}
          aria-label={label}
          onCheckedChange={(value) =>
            setDraft((old) => {
              const next = { ...old };
              for (const p of items) {
                if ((value === true) === original(p.id)) delete next[p.id];
                else next[p.id] = value === true;
              }
              return next;
            })
          }
        />
      </span>
    ) : null;
  const columns: ColumnDef<MatrixRow>[] = [
    {
      accessorKey: "path",
      header: "Hak akses",
      cell: ({ row }) => (
        <div
          className={`access-tree-label ${row.original.children.length ? "is-branch" : ""}`}
          style={{ paddingLeft: row.original.depth * 18 }}
        >
          {row.original.children.length ? (
            <button
              type="button"
              className="access-tree-toggle"
              aria-expanded={expanded[row.original.path] ?? filtering}
              aria-label={`${(expanded[row.original.path] ?? filtering) ? "Tutup" : "Buka"} ${row.original.path}`}
              onClick={() => toggleBranch(row.original)}
            >
              <ChevronRight aria-hidden="true" size={15} />
              <span>{row.original.label}</span>
            </button>
          ) : (
            <span className="access-tree-leaf">{row.original.label}</span>
          )}
          {!row.original.items.length && !row.original.children.length && (
            <span className="access-unavailable">Izin belum tersedia</span>
          )}
          {row.original.children.length > 0 && (
            <span className="access-group-summary">
              {matrixSubtreePermissions(row.original).filter(checked).length}/
              {matrixSubtreePermissions(row.original).length} izin dipilih
            </span>
          )}
          {row.original.items[0] && permissionPresentation(row.original.items[0])[2] && (
            <span className="access-sensitive">Data sensitif</span>
          )}
        </div>
      ),
    },
    {
      id: "select-row",
      header: "Semua",
      cell: ({ row }) =>
        bulkControl(
          matrixSubtreePermissions(row.original),
          `Pilih semua izin ${row.original.path}`,
        ),
    },
    ...actions.map(([action, label]) => ({
      id: action,
      header: label,
      cell: ({ row }: { row: { original: MatrixRow } }) =>
        !row.original.items.length && row.original.children.length ? (
          bulkControl(
            matrixSubtreePermissions(row.original).filter((p) => p.action === action),
            `Pilih semua ${label}: ${row.original.path}`,
          )
        ) : row.original.items.filter((p) => p.action === action).length ? (
          row.original.items
            .filter((p) => p.action === action)
            .map((p) => control(p, `${row.original.path}: ${label}`))
        ) : (
          <span className="access-cell-state">
            {missingMatrixActionLabel(row.original, action)}
          </span>
        ),
    })),
    {
      id: "special",
      header: "Tindakan khusus",
      cell: ({ row }) =>
        !row.original.items.length && row.original.children.length ? null : (
          <div className="access-special">
            {row.original.items
              .filter((p) => !actions.some(([a]) => a === p.action))
              .map((p) => (
                <label key={p.id}>
                  {control(p, permissionLabel(p))}
                  {actionLabels[p.action] ?? p.action.replaceAll("_", " ")}
                </label>
              ))}
            {!row.original.items.some((p) => !actions.some(([a]) => a === p.action)) && (
              <span className="access-cell-state">Belum tersedia</span>
            )}
          </div>
        ),
    },
    {
      id: "scope",
      header: "Cakupan",
      cell: ({ row }) =>
        !row.original.items.length && row.original.children.length ? null : (
          <span className="access-role-badge">
            {!row.original.items.length
              ? "Belum tersedia"
              : adminRole
                ? "Penuh otomatis"
                : [
                    ...new Set([
                      "Perusahaan",
                      ...grants
                        .filter((g) => row.original.items.some((p) => p.id === g.permission_id))
                        .map((g) => scopes[g.scope_type] ?? g.scope_type),
                    ]),
                  ].join(", ")}
          </span>
        ),
    },
  ];
  const members = useQuery({
    queryKey: ["setting", "roles", id, "members", ...context],
    queryFn: () =>
      apiRequest<{
        data: {
          user_id: string;
          display_name: string;
          email: string;
          active: boolean;
          assigned_at: string;
        }[];
      }>(`/roles/${id}/members`),
    enabled: !!id && tab === "members" && can("user.read"),
  });
  async function save() {
    if (!role || saving || !editable) return;
    setSaving(true);
    setError("");
    const known = new Set(permissions.data?.data.map((p) => p.id));
    const retained = grants
      .filter((g) => !known.has(g.permission_id) || g.scope_type !== "company" || g.scope_id)
      .map(({ permission_id, scope_type, scope_id }) => ({ permission_id, scope_type, scope_id }));
    try {
      await apiRequest(`/roles/${role.id}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({
          expected_permissions: grants.map(({ permission_id, scope_type, scope_id }) => ({
            permission_id,
            scope_type,
            scope_id,
          })),
          permissions: [
            ...retained,
            ...(permissions.data?.data ?? [])
              .filter(checked)
              .map((p) => ({ permission_id: p.id, scope_type: "company", scope_id: null })),
          ],
        }),
      });
      setDraft({});
      setReview(false);
      await cache.invalidateQueries({ queryKey: ["setting"] });
      toast.success("Hak akses tersimpan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan belum tersimpan.");
    } finally {
      setSaving(false);
    }
  }
  async function deleteRole() {
    if (!role || deleting || role.code === "ADMIN_SYSTEM" || !can("role.delete")) return;
    setDeleting(true);
    setError("");
    try {
      await apiRequest(`/roles/${role.id}`, { method: "DELETE" });
      await cache.invalidateQueries({ queryKey: ["setting"] });
      toast.success("Peran dihapus");
      router.push("/setting/roles");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Peran belum dapat dihapus.");
      setDeleting(false);
    }
  }
  if (roles.isPending) return <p role="status">Memuat peran…</p>;
  if (roles.isError) return <p role="alert">{roles.error.message}</p>;
  if (!role)
    return (
      <p>
        Pilih peran dari{" "}
        <Link href="/setting/roles" className="access-link">
          daftar Peran
        </Link>
        .
      </p>
    );
  const catalog = permissions.data?.data ?? [];
  return (
    <div className="access-workspace access-role-detail">
      <Heading
        title={role.name}
        section="roles"
        trail={`${role.name} / ${tab === "matrix" ? "Hak Akses" : tab === "scope" ? "Cakupan & Data Sensitif" : tab === "members" ? "Anggota" : "Riwayat"}`}
        back="/setting/roles"
      >
        {can("role.update") && (
          <Button variant="outline" asChild>
            <Link href={`/setting/roles/${role.id}/edit`}>Ubah peran</Link>
          </Button>
        )}
        {role.code !== "ADMIN_SYSTEM" && can("role.delete") && (
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            Hapus peran
          </Button>
        )}
      </Heading>
      <Panel title="Detail peran">
        <div className="access-overview">
          <Value label="Nama peran">{role.name}</Value>
          <Value label="Status">
            <Status active={role.active} />
          </Value>
          <Value label="Anggota">{role.member_count} pengguna</Value>
          <Value label="Hak akses">
            {adminRole
              ? "Penuh dalam perusahaan aktif"
              : `${new Set(grants.map((g) => g.code)).size} izin`}
          </Value>
        </div>
      </Panel>
      {adminRole && (
        <Note>
          Semua tindakan yang tersedia di katalog tercentang otomatis untuk Admin Sistem. Hak ini
          tidak bergantung pada grant tersimpan dan tidak dapat diubah melalui matriks.
        </Note>
      )}
      {!adminRole && grants.length === 0 && (
        <Note>
          Peran ini belum memiliki izin tersimpan. Untuk memberi akses penuh sesuai katalog saat
          ini, pilih <strong>Pilih semua izin</strong>, tinjau dampaknya, lalu simpan. Perubahan
          hanya berlaku untuk peran ini.
        </Note>
      )}
      <Tabs className="access-tabs" value={tab} onValueChange={setTab}>
        <TabsList aria-label="Pengaturan peran">
          {[
            ["matrix", "Matriks Hak Akses"],
            ["scope", "Cakupan & Data Sensitif"],
            ["members", "Anggota"],
            ["history", "Riwayat"],
          ].map(([v, l]) => (
            <TabsTrigger value={v!} key={v}>
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="matrix">
          <Note>
            Setiap tampilan Dashboard yang operasional memiliki izin Lihat tersendiri. Data di
            dalamnya tetap mengikuti izin dan cakupan fitur sumber. Menu yang belum operasional
            tetap tampil. “Belum tersedia” berarti izin tindakan belum tersedia atau belum
            dipetakan; “Tidak berlaku” berarti tindakan tidak relevan untuk fitur tersebut. Setiap
            submenu memiliki izin sendiri. Checkbox pada kelompok memilih izin anak satu per satu;
            tanda sebagian berarti hanya beberapa izin anak dipilih.
          </Note>
          {!can("permission.read") ? (
            <p className="access-caption">Anda tidak memiliki izin membaca katalog hak akses.</p>
          ) : permissions.isError ? (
            <p role="alert" className="access-error">
              {permissions.error.message}
            </p>
          ) : (
            <div className="access-matrix-table">
              <DataTable
                label="matriks hak akses"
                data={rows}
                columns={columns}
                total={filtered.length}
                footerLabel={`${rows.length} baris ditampilkan · ${filtered.length} menu${filtering ? " sesuai filter" : ""}`}
                busy={permissions.isPending}
                showColumns={false}
                toolbar={
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setExpanded(
                          Object.fromEntries(
                            visibleMatrixTree(tree, {}, () => true)
                              .filter((row) => row.children.length)
                              .map((row) => [row.path, true]),
                          ),
                        )
                      }
                    >
                      Buka semua menu
                    </Button>
                    <Button variant="outline" onClick={() => setExpanded({})}>
                      Tutup semua menu
                    </Button>
                    {!adminRole && editable && (
                      <Button
                        variant="outline"
                        disabled={
                          saving ||
                          permissions.isPending ||
                          !(permissions.data?.data ?? []).some((p) => !checked(p))
                        }
                        onClick={selectAll}
                      >
                        Pilih semua izin
                      </Button>
                    )}
                    <Input
                      aria-label="Cari hak akses"
                      placeholder="Cari hak akses…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setExpanded({});
                      }}
                    />
                    <SelectionField
                      label="Tampilkan"
                      value={[show]}
                      options={[
                        { id: "all", name: "Semua" },
                        { id: "allowed", name: "Diizinkan" },
                        { id: "denied", name: "Tidak diizinkan" },
                        { id: "changed", name: "Berubah" },
                      ]}
                      onChange={(v) => {
                        setShow(v[0] ?? "all");
                        setExpanded({});
                      }}
                    />
                    <span className="access-legend">
                      ☑ Diizinkan · □ Tidak diizinkan · Belum tersedia: izin belum dapat diatur ·
                      Tidak berlaku: tindakan tidak relevan
                    </span>
                  </>
                }
              />
            </div>
          )}
        </TabsContent>
        <TabsContent value="scope">
          <DataTable
            showColumns={false}
            data={grants}
            total={grants.length}
            columns={[
              {
                accessorKey: "code",
                header: "Hak akses",
                cell: ({ row }) => {
                  const p = catalog.find((p) => p.id === row.original.permission_id);
                  return p ? permissionLabel(p) : row.original.code;
                },
              },
              {
                id: "scope",
                header: "Cakupan data",
                cell: ({ row }) => (
                  <fieldset disabled>
                    <SelectionField
                      label={`Cakupan ${row.original.code}`}
                      value={[row.original.scope_type]}
                      options={Object.entries(scopes).map(([id, name]) => ({ id, name }))}
                      onChange={() => {}}
                    />
                  </fieldset>
                ),
              },
              {
                id: "description",
                header: "Keterangan",
                cell: ({ row }) =>
                  row.original.scope_id
                    ? `Cakupan tertentu · ${row.original.scope_id}`
                    : row.original.scope_type === "company"
                      ? "Perusahaan aktif"
                      : "Mengikuti cakupan tersimpan",
              },
            ]}
          />
          <div className="access-tab-actions">
            <h2>Data sensitif</h2>
            <DataTable
              showColumns={false}
              data={[
                "Harga modal / biaya modal",
                "Gaji / payroll",
                "Rekening",
                "Dokumen pribadi",
              ].map((name) => ({ name }))}
              total={4}
              columns={[
                { accessorKey: "name", header: "Data" },
                {
                  id: "allowed",
                  header: "Boleh dilihat",
                  cell: () => "Izin khusus belum tersedia di katalog",
                },
              ]}
            />
            <Note>
              Cakupan tersimpan tetap dipertahankan. Matriks mengubah izin cakupan perusahaan;
              pengaturan cakupan khusus dan empat izin data sensitif terpisah belum tersedia.
            </Note>
          </div>
        </TabsContent>
        <TabsContent value="members">
          {!can("user.read") ? (
            <p className="access-caption">Anda tidak memiliki izin melihat pengguna.</p>
          ) : members.isError ? (
            <p role="alert">{members.error.message}</p>
          ) : (
            <DataTable
              showColumns={false}
              busy={members.isPending}
              data={members.data?.data ?? []}
              total={members.data?.data.length ?? 0}
              columns={[
                {
                  accessorKey: "display_name",
                  header: "Nama",
                  cell: ({ row }) => (
                    <Link href={`/setting/users/${row.original.user_id}`} className="access-link">
                      {row.original.display_name}
                    </Link>
                  ),
                },
                { accessorKey: "email", header: "Email" },
                {
                  id: "active",
                  header: "Status",
                  cell: ({ row }) => <Status active={row.original.active} />,
                },
                {
                  accessorKey: "assigned_at",
                  header: "Ditetapkan sejak",
                  cell: ({ row }) => date(row.original.assigned_at),
                },
              ]}
            />
          )}
          <div className="access-tab-actions">
            <Note>Penugasan peran dilakukan dari menu Pengguna. Daftar ini hanya baca.</Note>
          </div>
        </TabsContent>
        <TabsContent value="history">
          <History kind="roles" id={role.id} />
        </TabsContent>
      </Tabs>
      <footer className="access-sticky-actions">
        <span role="status">
          <strong>{changed} perubahan belum disimpan</strong> · sel yang berubah ditandai
        </span>
        <div className="access-actions">
          <Button
            variant="outline"
            disabled={!changed || saving}
            onClick={() => {
              setDraft({});
              setError("");
            }}
          >
            Batalkan perubahan
          </Button>
          <Button disabled={!changed || saving || !editable} onClick={() => setReview(true)}>
            Tinjau perubahan
          </Button>
        </div>
      </footer>
      <Dialog
        open={review}
        onOpenChange={(v) => {
          if (!saving) setReview(v);
        }}
      >
        <DialogContent className="access-review">
          <DialogHeader>
            <DialogTitle>Tinjau perubahan</DialogTitle>
            <DialogDescription>
              {role.name} · {changed} perubahan pada cakupan perusahaan. Berlaku untuk{" "}
              {role.member_count} anggota peran; sesi terdampak akan dicabut.
            </DialogDescription>
          </DialogHeader>
          <div className="access-review-list">
            {catalog
              .filter((p) => p.id in draft)
              .map((p) => (
                <div key={p.id}>
                  <strong>{permissionLabel(p)}</strong>
                  <span>
                    {draft[p.id] ? "Tidak diizinkan → Diizinkan" : "Diizinkan → Tidak diizinkan"}
                  </span>
                </div>
              ))}
          </div>
          <Note>Perubahan dicatat di Riwayat beserta pelakunya.</Note>
          {error && (
            <p role="alert" className="access-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setReview(false)}>
              Kembali
            </Button>
            <Button disabled={saving || !changed} onClick={() => void save()}>
              {saving ? "Menyimpan…" : "Terapkan perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus peran {role.name}?</DialogTitle>
            <DialogDescription>
              Peran akan dilepas dari {role.member_count} pengguna. Sesi mereka dicabut dan
              perubahan dicatat.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="access-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button disabled={deleting} onClick={() => void deleteRole()}>
              {deleting ? "Menghapus…" : "Hapus peran"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
