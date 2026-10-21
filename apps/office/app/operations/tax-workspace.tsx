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
import { Upload, Evidence } from "./workspace";
import "../crm/crm.css";
import "./tax-workspace.css";

type Tax = {
  id: string;
  name: string;
  kind: string;
  effect: string;
  usage: string;
  accountId: string;
  percentage: string;
  decimalPlaces: number;
  rounding: string;
  active: boolean;
  version: number;
  effectiveFrom: string;
};
type Document = { number: string; documentDate: string; evidenceId: string; version: number };
type Invoice = {
  id: string;
  number: string;
  state: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  currency: string;
  customer?: { name: string };
  supplier?: { name: string };
  document: Document | null;
};
type Account = { id: string; code: string; name: string; category: string; active: boolean };
const usageLabels: Record<string, string> = {
  SALES: "Penjualan",
  PURCHASE: "Pembelian",
  BOTH: "Penjualan & Pembelian",
};
const roundingLabels: Record<string, string> = {
  HALF_UP: "Terdekat, tengah ke atas",
  HALF_EVEN: "Terdekat, tengah ke genap",
  DOWN: "Potong desimal",
};
const accountLabels: Record<string, string> = {
  ASSET: "Aset",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};
const kindLabel = (kind: string) => (kind === "PPH" ? "PPh" : kind);
const percentLabel = (value: string) => `${value.replace(".", ",")}%`;
const dateLabel = (value: string) => new Date(value).toLocaleString("id-ID");
const base = "/operations/tax-rules";
export function TaxWorkspace({ path }: { path: string[] }) {
  const { principal, state } = useSession(),
    router = useRouter();
  useEffect(() => {
    if (state === "anonymous") router.replace("/login?session=ended");
  }, [state, router]);
  const master = path[0] === "tax-rules",
    direction = path[0] === "tax-input" ? "input" : "output";
  const title = master
    ? "Daftar & Aturan Pajak"
    : direction === "input"
      ? "Faktur Masukan"
      : "Faktur Keluaran";
  if (!principal)
    return (
      <main role={state === "error" ? "alert" : "status"}>
        {state === "error" ? "Sesi gagal dimuat." : "Memuat sesi…"}
      </main>
    );
  const can = (code: string) => hasCompanyPermission(principal, code);
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <DashboardSidebar principal={principal} activeView="executive" activeSection="finance" />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        <main className="executive-content crm-content tax-workspace">
          <header className="executive-heading">
            <div>
              <nav className="executive-breadcrumb" aria-label="Breadcrumb">
                Finance / Pajak /{" "}
                {path[1] ? (
                  <Link href={base}>{title}</Link>
                ) : (
                  <span aria-current="page">{title}</span>
                )}
                {path[1]
                  ? ` / ${path[1] === "new" ? "Buat" : path[2] === "edit" ? "Ubah" : "Detail"}`
                  : ""}
              </nav>
              <h1>{title}</h1>
            </div>
            {master && !path[1] && can("tax_master.create") && (
              <Button asChild>
                <Link href={`${base}/new`}>Buat Pajak</Link>
              </Button>
            )}
            {master && path[1] && (
              <Button variant="outline" asChild>
                <Link href={base}>Kembali</Link>
              </Button>
            )}
          </header>
          {!can(master ? "tax_master.read" : `tax_${direction}.read`) ? (
            <p role="alert">Anda tidak memiliki izin melihat halaman ini.</p>
          ) : master ? (
            <TaxMaster id={path[1]} edit={path[1] === "new" || path[2] === "edit"} />
          ) : (
            <TaxInvoices direction={direction} />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
function useTaxQuery<T>(suffix: string, enabled = true) {
  const { principal } = useSession();
  return useQuery({
    queryKey: ["tax", principal?.company_id, principal?.user_id, principal?.permissions, suffix],
    enabled,
    queryFn: ({ signal }) => apiRequest<T>(`/tax/${suffix}`, { signal }),
  });
}
function TaxMaster({ id, edit }: { id?: string | undefined; edit: boolean }) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const q = useTaxQuery<{ data: Tax[]; total: number }>(
    `master?q=${encodeURIComponent(search)}&page=${page}`,
    !id,
  );
  const detail = useTaxQuery<{
    data: Tax;
    revisions: { version: number; createdAt: string; snapshot: Tax }[];
  }>(`master/${id}`, !!id && id !== "new");
  const accounts = useTaxQuery<{ data: Account[] }>("accounts");
  const { principal } = useSession();
  const can = (code: string) => !!principal && hasCompanyPermission(principal, code);
  if (q.isError || detail.isError || accounts.isError)
    return (
      <p role="alert">{q.error?.message || detail.error?.message || accounts.error?.message}</p>
    );
  if (id && id !== "new" && !detail.data) return <p role="status">Memuat pajak…</p>;
  if (edit)
    return can(id === "new" ? "tax_master.create" : "tax_master.update") ? (
      <TaxForm key={id} row={detail.data?.data} accounts={accounts.data?.data ?? []} />
    ) : (
      <p role="alert">Anda tidak memiliki izin mengubah pajak.</p>
    );
  if (id && detail.data) {
    const row = detail.data.data;
    const taxAccount = accounts.data?.data.find((a) => a.id === row.accountId);
    return (
      <section className="tax-panel">
        <h2>{row.name}</h2>
        <dl className="tax-grid">
          {Object.entries({
            "Jenis Pajak": kindLabel(row.kind),
            Penggunaan: usageLabels[row.usage] ?? "Penjualan & Pembelian",
            "Perlakuan Transaksi": row.effect === "ADD" ? "Ditambahkan" : "Dipotong",
            "Akun Pajak": taxAccount ? `${taxAccount.code} · ${taxAccount.name}` : row.accountId,
            "Kelompok Akun": taxAccount
              ? (accountLabels[taxAccount.category] ?? taxAccount.category)
              : "Tidak tersedia",
            "Tarif (%)": percentLabel(row.percentage),
            Status: row.active ? "Aktif" : "Nonaktif",
            Versi: row.version,
            "Mulai berlaku": dateLabel(row.effectiveFrom),
            Pembulatan: roundingLabels[row.rounding] ?? row.rounding,
            "Jumlah desimal": row.decimalPlaces,
          }).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {can("tax_master.update") && (
          <Button asChild>
            <Link href={`${base}/${id}/edit`}>Ubah Pajak</Link>
          </Button>
        )}
        <h3>Riwayat versi</h3>
        <ul>
          {detail.data.revisions.map((v) => (
            <li key={v.version}>
              <strong>Versi {v.version}</strong> · {dateLabel(v.createdAt)}
              <p>
                {v.snapshot.name} · {kindLabel(v.snapshot.kind)} ·{" "}
                {percentLabel(v.snapshot.percentage)} ·{" "}
                {usageLabels[v.snapshot.usage] ?? "Penjualan & Pembelian"} ·{" "}
                {v.snapshot.effect === "ADD" ? "Ditambahkan" : "Dipotong"} ·{" "}
                {v.snapshot.active ? "Aktif" : "Nonaktif"}
              </p>
              <p>
                Akun:{" "}
                {accounts.data?.data.find((a) => a.id === v.snapshot.accountId)?.name ??
                  v.snapshot.accountId}{" "}
                · Berlaku {dateLabel(v.snapshot.effectiveFrom)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <DataTable
      data={q.data?.data ?? []}
      total={q.data?.total ?? 0}
      busy={q.isFetching}
      page={page}
      onPage={setPage}
      label="pajak"
      toolbar={
        <Input
          aria-label="Cari pajak"
          placeholder="Cari nama pajak…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      }
      columns={[
        {
          accessorKey: "name",
          header: "Nama Pajak",
          cell: ({ row }) => <Link href={`${base}/${row.original.id}`}>{row.original.name}</Link>,
        },
        {
          accessorKey: "kind",
          header: "Jenis Pajak",
          cell: ({ row }) => kindLabel(row.original.kind),
        },
        {
          accessorKey: "usage",
          header: "Penggunaan",
          cell: ({ row }) => usageLabels[row.original.usage],
        },
        {
          id: "account",
          header: "Akun Pajak",
          cell: ({ row }) => {
            const a = accounts.data?.data.find((a) => a.id === row.original.accountId);
            return a
              ? `${a.code} · ${a.name}${a.active ? "" : " (Nonaktif)"}`
              : "Akun tidak tersedia";
          },
        },
        {
          accessorKey: "percentage",
          header: "Tarif (%)",
          cell: ({ row }) => percentLabel(row.original.percentage),
        },
        {
          id: "effect",
          header: "Perlakuan Transaksi",
          cell: ({ row }) => (row.original.effect === "ADD" ? "Ditambahkan" : "Dipotong"),
        },
        {
          id: "active",
          header: "Status",
          cell: ({ row }) => (row.original.active ? "Aktif" : "Nonaktif"),
        },
      ]}
    />
  );
}
function TaxForm({ row, accounts }: { row?: Tax | undefined; accounts: Account[] }) {
  const [name, setName] = useState(row?.name ?? ""),
    [kind, setKind] = useState(row?.kind ?? "PPN"),
    [usage, setUsage] = useState(row?.usage ?? "SALES"),
    [effect, setEffect] = useState(row?.effect ?? "ADD"),
    [account, setAccount] = useState(row?.accountId ?? ""),
    [percentage, setPercentage] = useState(row?.percentage ?? ""),
    [places, setPlaces] = useState(String(row?.decimalPlaces ?? 2)),
    [rounding, setRounding] = useState(row?.rounding ?? "HALF_UP"),
    [active, setActive] = useState(row?.active ?? true),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const cache = useQueryClient(),
    router = useRouter();
  const choice = (
    label: string,
    value: string,
    set: (v: string) => void,
    options: { id: string; name: string }[],
  ) => (
    <SelectionField
      label={label}
      value={value ? [value] : []}
      options={options}
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
          const result = await apiRequest<{ data: Tax }>(`/tax/master${row ? `/${row.id}` : ""}`, {
            method: row ? "PATCH" : "POST",
            headers: {
              "Idempotency-Key": crypto.randomUUID(),
              ...(row ? { "If-Match": `"${row.version}"` } : {}),
            },
            body: JSON.stringify({
              name,
              kind,
              usage,
              effect,
              account_id: account,
              percentage: percentage.trim().replace(",", "."),
              decimal_places: Number(places),
              rounding,
              active,
              effective_from: new Date().toISOString(),
            }),
          });
          await cache.invalidateQueries({ queryKey: ["tax"] });
          await cache.invalidateQueries({ queryKey: ["tax-options"] });
          toast.success("Pajak tersimpan");
          router.push(`${base}/${result.data.id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Pajak gagal disimpan.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2>{row ? "Ubah Pajak" : "Buat Pajak"}</h2>
      <div className="tax-grid">
        <label>
          Nama Pajak
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {choice("Jenis Pajak", kind, setKind, [
          { id: "PPN", name: "PPN" },
          { id: "PPH", name: "PPh" },
        ])}
        {choice(
          "Penggunaan",
          usage,
          setUsage,
          Object.entries(usageLabels).map(([id, name]) => ({ id, name })),
        )}
        {choice("Perlakuan Transaksi", effect, setEffect, [
          { id: "ADD", name: "Ditambahkan" },
          { id: "DEDUCT", name: "Dipotong" },
        ])}
        {choice(
          "Akun Pajak",
          account,
          setAccount,
          accounts
            .filter((a) => a.active || a.id === account)
            .map((a) => ({
              id: a.id,
              name: `${a.code} · ${a.name} — ${accountLabels[a.category] ?? a.category}${a.active ? "" : " (Nonaktif)"}`,
            })),
        )}
        <label>
          Tarif (%)
          <Input
            required
            inputMode="decimal"
            value={percentage}
            aria-describedby="tax-rate-help"
            pattern="[0-9]{1,3}([.,][0-9]{1,8})?"
            maxLength={12}
            onChange={(e) => setPercentage(e.target.value)}
          />
        </label>
        <label>
          Jumlah desimal
          <Input
            required
            type="number"
            min="0"
            max="8"
            value={places}
            onChange={(e) => setPlaces(e.target.value)}
          />
        </label>
        {choice("Pembulatan", rounding, setRounding, [
          { id: "HALF_UP", name: "Terdekat, tengah ke atas" },
          { id: "HALF_EVEN", name: "Terdekat, tengah ke genap" },
          { id: "DOWN", name: "Potong desimal" },
        ])}
        {choice("Status", active ? "ACTIVE" : "INACTIVE", (v) => setActive(v === "ACTIVE"), [
          { id: "ACTIVE", name: "Aktif" },
          { id: "INACTIVE", name: "Nonaktif" },
        ])}
      </div>
      <p className="tax-help">
        Satu master memakai satu akun buku besar. Buat master terpisah jika akun pajak penjualan dan
        pembelian berbeda.
      </p>
      <p id="tax-rate-help" className="tax-help">
        Tarif diisi antara 0–100%. Nilai pajak dihitung dari dasar transaksi. Jenis pajak dan
        perlakuan transaksi dipilih secara terpisah.
      </p>
      <p className="tax-help">
        Berlaku sejak disimpan. Transaksi sebelumnya tetap menggunakan versi pajaknya.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button disabled={pending || !account}>{pending ? "Menyimpan…" : "Simpan Pajak"}</Button>
    </form>
  );
}
function TaxInvoices({ direction }: { direction: "input" | "output" }) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Invoice | null>(null);
  const q = useTaxQuery<{ data: Invoice[]; total: number }>(
    `invoices/${direction}?q=${encodeURIComponent(search)}&page=${page}`,
  );
  const { principal } = useSession();
  return (
    <>
      {q.isError && <p role="alert">{q.error.message}</p>}
      <DataTable
        data={q.data?.data ?? []}
        total={q.data?.total ?? 0}
        page={page}
        onPage={setPage}
        busy={q.isFetching}
        label="faktur"
        toolbar={
          <Input
            aria-label="Cari invoice"
            placeholder="Cari nomor invoice…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        }
        columns={[
          { accessorKey: "number", header: "Invoice sumber" },
          {
            id: "party",
            header: direction === "output" ? "Pelanggan" : "Pemasok",
            cell: ({ row }) => row.original.customer?.name ?? row.original.supplier?.name,
          },
          { accessorKey: "state", header: "Status transaksi" },
          { accessorKey: "subtotal", header: "Dasar transaksi" },
          { accessorKey: "taxAmount", header: "Nilai pajak" },
          { accessorKey: "currency", header: "Mata uang" },
          {
            id: "officialNumber",
            header: "Nomor faktur resmi",
            cell: ({ row }) => row.original.document?.number ?? "Belum dicatat",
          },
          {
            id: "action",
            header: "Dokumen",
            cell: ({ row }) => (
              <Button variant="outline" onClick={() => setSelected(row.original)}>
                Detail
              </Button>
            ),
          },
        ]}
      />
      {selected && (
        <InvoiceDocument
          key={selected.id}
          row={selected}
          direction={direction}
          canEdit={!!principal && hasCompanyPermission(principal, `tax_${direction}.update`)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function InvoiceDocument({
  row,
  direction,
  canEdit,
  onClose,
}: {
  row: Invoice;
  direction: "input" | "output";
  canEdit: boolean;
  onClose: () => void;
}) {
  const [number, setNumber] = useState(row.document?.number ?? ""),
    [date, setDate] = useState(row.document?.documentDate.slice(0, 10) ?? ""),
    [evidence, setEvidence] = useState(row.document?.evidenceId ?? ""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const cache = useQueryClient();
  return (
    <section className="tax-panel">
      <h2>Faktur · {row.number}</h2>
      <p>
        Nilai pajak {row.taxAmount} {row.currency} berasal dari transaksi sumber.
      </p>
      {row.document && (
        <>
          <p>
            {row.document.number} · {row.document.documentDate.slice(0, 10)}
          </p>
          <Evidence id={row.document.evidenceId} />
        </>
      )}
      {canEdit && row.state === "POSTED" ? (
        <form
          className="web-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            setPending(true);
            setError("");
            try {
              await apiRequest(`/tax/invoices/${direction}/${row.id}`, {
                method: "POST",
                headers: { "Idempotency-Key": crypto.randomUUID() },
                body: JSON.stringify({
                  number,
                  document_date: date,
                  evidence_id: evidence,
                  version: row.document?.version ?? 0,
                }),
              });
              await cache.invalidateQueries({ queryKey: ["tax"] });
              toast.success("Faktur tercatat");
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Gagal menyimpan");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="tax-grid">
            <label>
              Nomor faktur resmi
              <Input required value={number} onChange={(e) => setNumber(e.target.value)} />
            </label>
            <label>
              Tanggal faktur
              <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <Upload
            purpose={direction === "output" ? "TAX_OUTPUT" : "TAX_INPUT"}
            onChange={setEvidence}
          />
          {error && <p role="alert">{error}</p>}
          <Button disabled={pending || !evidence}>
            {pending ? "Menyimpan…" : "Simpan Faktur"}
          </Button>
        </form>
      ) : (
        row.state !== "POSTED" && (
          <p>Nomor dan lampiran resmi dapat dicatat setelah invoice diposting.</p>
        )
      )}
      <Button variant="outline" onClick={onClose}>
        Tutup
      </Button>
    </section>
  );
}
