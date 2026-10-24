"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DashboardSidebar } from "../dashboard-sidebar";
import { ExecutiveTopbar } from "../dashboard-executive";
import { DataTable } from "../crm/crm-common";
import { Upload, Evidence } from "./workspace";
import "../crm/crm.css";
import "./tax-workspace.css";

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
/** Faktur Keluaran/Masukan stay in Finance; the tax master lives in Setting > Pajak. */
export function TaxWorkspace({ path }: { path: string[] }) {
  const { principal, state } = useSession(),
    router = useRouter();
  useEffect(() => {
    if (state === "anonymous") router.replace("/login?session=ended");
  }, [state, router]);
  const direction = path[0] === "tax-input" ? "input" : "output";
  const title = direction === "input" ? "Faktur Masukan" : "Faktur Keluaran";
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
                Finance / Pajak / <span aria-current="page">{title}</span>
              </nav>
              <h1>{title}</h1>
            </div>
          </header>
          {!can(`tax_${direction}.read`) ? (
            <p role="alert">Anda tidak memiliki izin melihat halaman ini.</p>
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
