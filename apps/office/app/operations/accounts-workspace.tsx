"use client";
import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DashboardSidebar } from "../dashboard-sidebar";
import { ExecutiveTopbar } from "../dashboard-executive";
import { DataTable } from "../crm/crm-common";
import "../crm/crm.css";
import "./tax-workspace.css";
import "./accounts-workspace.css";

type Account = {
  id: string;
  code: string;
  name: string;
  category: string;
  categoryLabel: string | null;
  description: string | null;
  parentId: string | null;
  accountType: string;
  normalBalance: string;
  psak118Category: string | null;
  active: boolean;
  controlKind: string | null;
  version: number;
};
type References = { used: boolean; activeReferences: boolean; children: number; reasons: string[] };
type Detail = {
  data: Account;
  references: References;
  history: {
    id: string;
    action: string;
    occurredAt: string;
    metadata: { reason?: string } | null;
  }[];
};
type Options = {
  parents: Pick<Account, "id" | "code" | "name" | "category" | "active">[];
  categories: { categoryLabel: string | null; category: string }[];
};
const groups: Record<string, string> = {
  ASSET: "Aset",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};
const base = "/operations/accounts";
function useAccounts<T>(suffix: string, enabled = true) {
  const { principal } = useSession();
  return useQuery({
    queryKey: [
      "accounts",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      suffix,
    ],
    enabled: !!principal && enabled,
    queryFn: ({ signal }) => apiRequest<T>(`/accounts${suffix}`, { signal }),
  });
}
export function AccountsWorkspace({ path }: { path: string[] }) {
  const { principal, state } = useSession(),
    router = useRouter();
  useEffect(() => {
    if (state === "anonymous") router.replace("/login?session=ended");
  }, [state, router]);
  if (!principal)
    return <main role="status">{state === "error" ? "Sesi gagal dimuat." : "Memuat sesi…"}</main>;
  const can = (code: string) => hasCompanyPermission(principal, code),
    id = path[1],
    edit = id === "new" || path[2] === "edit";
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <DashboardSidebar principal={principal} activeView="executive" activeSection="finance" />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        <main className="executive-content crm-content accounts-workspace">
          <header className="executive-heading">
            <div>
              <nav className="executive-breadcrumb" aria-label="Breadcrumb">
                Finance / Akuntansi /{" "}
                {id ? (
                  <>
                    <Link href={base}>Akun</Link> /{" "}
                    {id === "new" ? "Buat" : edit ? "Edit" : "Detail"}
                  </>
                ) : (
                  <span aria-current="page">Akun</span>
                )}
              </nav>
              <h1>
                {id === "new" ? "Buat Akun" : edit ? "Edit Akun" : id ? "Detail Akun" : "Akun"}
              </h1>
            </div>
            {!id && can("account.create") && (
              <Button asChild>
                <Link href={`${base}/new`}>Buat Akun</Link>
              </Button>
            )}
            {id && (
              <Button variant="outline" asChild>
                <Link href={base}>Kembali</Link>
              </Button>
            )}
          </header>
          {can("account.read") ? (
            <AccountsBody id={id} edit={edit} can={can} />
          ) : (
            <p role="alert">Anda tidak memiliki izin melihat akun.</p>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
function AccountsBody({
  id,
  edit,
  can,
}: {
  id: string | undefined;
  edit: boolean;
  can: (s: string) => boolean;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState("active"),
    [page, setPage] = useState(1);
  const query = useAccounts<{ data: Account[]; total: number }>(
    `?q=${encodeURIComponent(search)}&page=${page}${category ? `&category=${category}` : ""}${status ? `&status=${status}` : ""}`,
    !id,
  );
  const detail = useAccounts<Detail>(`/${id}`, !!id && id !== "new"),
    options = useAccounts<Options>("/options");
  if (query.isError || detail.isError || options.isError)
    return (
      <div role="alert">
        {query.error?.message || detail.error?.message || options.error?.message}
        <Button
          variant="outline"
          onClick={() => {
            void query.refetch();
            void options.refetch();
            if (id && id !== "new") void detail.refetch();
          }}
        >
          Coba Lagi
        </Button>
      </div>
    );
  if (id && id !== "new" && !detail.data) return <p role="status">Memuat akun…</p>;
  if (edit)
    return can(id === "new" ? "account.create" : "account.update") ? (
      <AccountForm
        row={detail.data?.data}
        references={detail.data?.references}
        options={options.data ?? { parents: [], categories: [] }}
      />
    ) : (
      <p role="alert">Anda tidak memiliki izin mengubah akun.</p>
    );
  if (id && detail.data) {
    const { data: r, references, history } = detail.data;
    return (
      <section className="tax-panel">
        <h2>
          {r.code} · {r.name}
        </h2>
        <dl className="tax-grid">
          {Object.entries({
            "Kode Akun": r.code,
            "Nama Akun": r.name,
            Kategori: r.categoryLabel ?? "Belum diisi",
            "Kelompok Akun": groups[r.category],
            Tipe: r.accountType === "HEADER" ? "Header" : "Detail",
            "Saldo Normal": r.normalBalance === "DEBIT" ? "Debit" : "Kredit",
            "Akun Induk":
              options.data?.parents.find((p) => p.id === r.parentId)?.name ??
              r.parentId ??
              "Tanpa induk",
            "Kategori PSAK 118": r.psak118Category ?? "Belum diisi",
            Deskripsi: r.description ?? "Belum diisi",
            Status: r.active ? "Aktif" : "Nonaktif",
            "Kontrol Sistem": r.controlKind ?? "Tidak ada",
            Versi: r.version,
          }).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="tax-help">
          {references.reasons.length
            ? `Digunakan pada: ${references.reasons.join(", ")}.`
            : "Belum digunakan oleh transaksi atau pengaturan."}{" "}
          Saldo keuangan berasal dari jurnal dan tidak diubah melalui master akun.
        </p>
        {can("account.update") && (
          <Button asChild>
            <Link href={`${base}/${id}/edit`}>Edit Akun</Link>
          </Button>
        )}
        <h3>Riwayat perubahan</h3>
        <ul>
          {history.map((h) => (
            <li key={h.id}>
              {h.action === "account.created" ? "Akun dibuat" : "Akun diperbarui"} ·{" "}
              {new Date(h.occurredAt).toLocaleString("id-ID")}
              {h.metadata?.reason && <p>{h.metadata.reason}</p>}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <DataTable
      data={query.data?.data ?? []}
      total={query.data?.total ?? 0}
      page={page}
      pageSize={25}
      onPage={setPage}
      busy={query.isFetching}
      label="akun"
      toolbar={
        <div className="accounts-filters">
          <Input
            aria-label="Cari akun"
            placeholder="Cari kode, nama, atau kategori…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <SelectionField
            label="Kelompok Akun"
            value={category ? [category] : []}
            options={Object.entries(groups).map(([id, name]) => ({ id, name }))}
            onChange={(v) => {
              setCategory(v[0] ?? "");
              setPage(1);
            }}
          />
          <SelectionField
            label="Status"
            value={status ? [status] : []}
            options={[
              { id: "active", name: "Aktif" },
              { id: "inactive", name: "Nonaktif" },
            ]}
            onChange={(v) => {
              setStatus(v[0] ?? "");
              setPage(1);
            }}
          />
          {(category || status !== "active" || search) && (
            <Button
              variant="ghost"
              onClick={() => {
                setCategory("");
                setStatus("active");
                setSearch("");
                setPage(1);
              }}
            >
              Reset
            </Button>
          )}
        </div>
      }
      columns={[
        {
          accessorKey: "code",
          header: "Kode Akun",
          cell: ({ row }) => <Link href={`${base}/${row.original.id}`}>{row.original.code}</Link>,
        },
        {
          accessorKey: "name",
          header: "Nama Akun",
          cell: ({ row }) => <Link href={`${base}/${row.original.id}`}>{row.original.name}</Link>,
        },
        {
          accessorKey: "categoryLabel",
          header: "Kategori",
          cell: ({ row }) => row.original.categoryLabel ?? groups[row.original.category],
        },
        {
          accessorKey: "accountType",
          header: "Tipe",
          cell: ({ row }) => (row.original.accountType === "HEADER" ? "Header" : "Detail"),
        },
        {
          accessorKey: "normalBalance",
          header: "Saldo Normal",
          cell: ({ row }) => (row.original.normalBalance === "DEBIT" ? "Debit" : "Kredit"),
        },
        {
          accessorKey: "active",
          header: "Status",
          cell: ({ row }) => (row.original.active ? "Aktif" : "Nonaktif"),
        },
        {
          id: "action",
          header: "Tindakan",
          cell: ({ row }) => (
            <div className="accounts-actions">
              <Link href={`${base}/${row.original.id}`}>Detail</Link>
              {can("account.update") && <Link href={`${base}/${row.original.id}/edit`}>Edit</Link>}
            </div>
          ),
        },
      ]}
    />
  );
}
function AccountForm({
  row,
  references,
  options,
}: {
  row: Account | undefined;
  references: References | undefined;
  options: Options;
}) {
  const [code, setCode] = useState(row?.code ?? ""),
    [name, setName] = useState(row?.name ?? ""),
    [category, setCategory] = useState(row?.category ?? "ASSET"),
    [categoryLabel, setCategoryLabel] = useState(row?.categoryLabel ?? ""),
    [description, setDescription] = useState(row?.description ?? ""),
    [parent, setParent] = useState(row?.parentId ?? ""),
    [type, setType] = useState(row?.accountType ?? "DETAIL"),
    [normal, setNormal] = useState(row?.normalBalance ?? "DEBIT"),
    [psak, setPsak] = useState(row?.psak118Category ?? ""),
    [active, setActive] = useState(row?.active ?? true),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const cache = useQueryClient(),
    router = useRouter(),
    locked = !!references?.used;
  const choice = (
    label: string,
    value: string,
    set: (s: string) => void,
    items: { id: string; name: string }[],
  ) => (
    <SelectionField
      label={label}
      value={value ? [value] : []}
      options={items}
      onChange={(v) => set(v[0] ?? "")}
    />
  );
  return (
    <form
      className="tax-panel web-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError("");
        try {
          const result = await apiRequest<{ data: Account }>(
            `/accounts${row ? `/${row.id}` : ""}`,
            {
              method: row ? "PATCH" : "POST",
              headers: {
                "Idempotency-Key": crypto.randomUUID(),
                ...(row ? { "If-Match": `"${row.version}"` } : {}),
              },
              body: JSON.stringify({
                code,
                name,
                category,
                category_label: categoryLabel.trim() || null,
                description: description.trim() || null,
                parent_id: parent || null,
                account_type: type,
                normal_balance: normal,
                psak118_category: psak.trim() || null,
                active,
                reason,
              }),
            },
          );
          await cache.invalidateQueries({ queryKey: ["accounts"] });
          await cache.invalidateQueries({ queryKey: ["tax"] });
          toast.success("Akun tersimpan");
          router.push(`${base}/${result.data.id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Gagal menyimpan akun.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2>Identitas akun</h2>
      <div className="tax-grid">
        <label>
          Kode Akun
          <Input required maxLength={30} value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label>
          Nama Akun
          <Input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Deskripsi
          <Input
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {choice("Status", active ? "active" : "inactive", (s) => setActive(s === "active"), [
          { id: "active", name: "Aktif" },
          { id: "inactive", name: "Nonaktif" },
        ])}
      </div>
      <h3>Klasifikasi dan struktur</h3>
      {locked && (
        <p className="tax-help">
          Klasifikasi terkunci karena akun digunakan pada {references?.reasons.join(", ")}. Nama,
          kode dan deskripsi dapat diperbarui dengan alasan.
        </p>
      )}
      <fieldset disabled={locked} className="tax-grid accounts-classification">
        {choice(
          "Kelompok Akun",
          category,
          (s) => {
            setCategory(s);
            setNormal(["LIABILITY", "EQUITY", "REVENUE"].includes(s) ? "CREDIT" : "DEBIT");
            setParent("");
          },
          Object.entries(groups).map(([id, name]) => ({ id, name })),
        )}
        <label>
          Kategori
          <Input
            list="account-category-options"
            maxLength={100}
            value={categoryLabel}
            onChange={(e) => setCategoryLabel(e.target.value)}
          />
          <datalist id="account-category-options">
            {options.categories
              .filter((c) => c.category === category)
              .map((c) => (
                <option key={c.categoryLabel} value={c.categoryLabel ?? ""} />
              ))}
          </datalist>
        </label>
        {choice("Tipe Akun", type, setType, [
          { id: "DETAIL", name: "Detail — dapat digunakan transaksi" },
          { id: "HEADER", name: "Header — pengelompokan" },
        ])}
        {choice("Saldo Normal", normal, setNormal, [
          { id: "DEBIT", name: "Debit" },
          { id: "CREDIT", name: "Kredit" },
        ])}
        {choice("Akun Induk", parent || "none", (s) => setParent(s === "none" ? "" : s), [
          { id: "none", name: "Tanpa induk" },
          ...options.parents
            .filter(
              (p) => p.id !== row?.id && p.category === category && (p.active || p.id === parent),
            )
            .map((p) => ({ id: p.id, name: `${p.code} · ${p.name}` })),
        ])}
        <label>
          Kategori PSAK 118
          <Input maxLength={150} value={psak} onChange={(e) => setPsak(e.target.value)} />
        </label>
      </fieldset>
      {row && (
        <label>
          Alasan perubahan{locked ? " (wajib)" : ""}
          <Input
            required={locked}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      <p className="tax-help">
        Saldo normal adalah posisi debit/kredit, bukan nominal saldo. Saldo awal dicatat melalui
        proses jurnal terpisah.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan Akun"}</Button>
    </form>
  );
}
