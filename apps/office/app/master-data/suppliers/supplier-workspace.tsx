"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { IconPencil as Pencil, IconPlus as Plus } from "@/components/web/icons";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DetailTabs,
  HistoryList,
  OfficePage,
  PageNotice,
  RecordBadge,
  SummaryStrip,
  ValueGrid,
  ValueItem,
} from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import {
  contactText,
  ListFilters,
  StateActions,
  stateLabel,
  useCan,
  useListParams,
  useMasterKey,
  type Contact,
  type MasterPage,
  type MasterState,
} from "../master-shared";
import { SupplierForm } from "./supplier-form";

export const base = "/master-data/suppliers";
export type Supplier = {
  id: string;
  code: string;
  name: string;
  categories: string[];
  primary_address?: string | null;
  phone?: string | null;
  sales_contact?: Contact;
  finance_contact?: Contact;
  shipping_contact?: Contact;
  tax_identity?: string | null;
  technical_responsible_name?: string | null;
  technical_responsible_license?: Record<string, unknown> | null;
  legal_documents?: Record<string, unknown>[] | null;
  agreement_number?: string | null;
  agreement_details?: Record<string, unknown> | null;
  state: MasterState;
  version: number;
  updated_at: string;
};
const crumbs = [{ label: "Master Data" }, { label: "Supplier", href: base }];

export function SupplierWorkspace({ path }: { path: string[] }) {
  const can = useCan(),
    key = useMasterKey();
  const id = path[0] && path[0] !== "new" ? path[0] : undefined,
    form = path[0] === "new" || path[1] === "edit";
  const detail = useQuery({
    queryKey: key("suppliers", id),
    queryFn: () => apiRequest<{ data: Supplier }>(`/master-data/workspace/suppliers/${id}`),
    enabled: !!id && can("master_supplier.read"),
  });
  const row = detail.data?.data;
  if (!can("master_supplier.read"))
    return (
      <OfficePage section="master" crumbs={crumbs} title="Supplier">
        <PageNotice tone="error">Anda tidak memiliki izin melihat Supplier.</PageNotice>
      </OfficePage>
    );
  if (id && !row)
    return (
      <OfficePage section="master" crumbs={[...crumbs, { label: "Detail" }]} title="Supplier">
        {detail.isError ? (
          <PageNotice tone="error" onRetry={() => void detail.refetch()}>
            {detail.error.message}
          </PageNotice>
        ) : (
          <p role="status">Memuat supplier…</p>
        )}
      </OfficePage>
    );
  if (form) {
    const allowed = can(row ? "master_supplier.update" : "master_supplier.create");
    return (
      <OfficePage
        section="master"
        crumbs={[
          ...crumbs,
          ...(row ? [{ label: row.code, href: `${base}/${row.id}` }] : []),
          { label: row ? "Ubah" : "Baru" },
        ]}
        title={row ? `Ubah ${row.name}` : "Supplier baru"}
        subtitle={row ? row.code : "Kode dibuat otomatis saat disimpan."}
      >
        {allowed ? (
          <SupplierForm key={row?.id ?? "new"} initial={row} />
        ) : (
          <PageNotice tone="error">Anda tidak memiliki izin menyimpan Supplier.</PageNotice>
        )}
      </OfficePage>
    );
  }
  if (row) return <SupplierDetail row={row} onChanged={() => void detail.refetch()} />;
  return <SupplierList />;
}

function SupplierList() {
  const can = useCan(),
    key = useMasterKey(),
    list = useListParams();
  const rows = useQuery({
    queryKey: key("suppliers", "list", list.query),
    queryFn: () => apiRequest<MasterPage<Supplier>>(`/master-data/workspace/suppliers?${list.query}`),
  });
  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => (
        <Link className="page-frame-link" href={`${base}/${row.original.id}`}>
          {row.original.code}
        </Link>
      ),
    },
    { accessorKey: "name", header: "Nama" },
    {
      id: "categories",
      header: "Kategori",
      cell: ({ row }) => row.original.categories?.join(", ") || "—",
    },
    { id: "phone", header: "Telepon", cell: ({ row }) => row.original.phone || "—" },
    {
      id: "sales",
      header: "PIC penjualan",
      cell: ({ row }) => row.original.sales_contact?.name || "—",
    },
    {
      id: "state",
      header: "Status",
      accessorFn: (row) => stateLabel[row.state] ?? row.state,
    },
  ];
  return (
    <OfficePage
      section="master"
      crumbs={[{ label: "Master Data" }, { label: "Supplier" }]}
      title="Supplier"
      subtitle="Pemasok barang dagang berdasarkan MOU."
      actions={
        can("master_supplier.create") && (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus aria-hidden="true" />
              Tambah supplier
            </Link>
          </Button>
        )
      }
    >
      {rows.isError && (
        <PageNotice tone="error" onRetry={() => void rows.refetch()}>
          {rows.error.message}
        </PageNotice>
      )}
      <DataTable
        data={rows.data?.data ?? []}
        columns={columns}
        total={rows.data?.total ?? 0}
        page={list.page}
        onPage={(page) => list.set({ page })}
        busy={rows.isFetching}
        label="supplier"
        toolbar={<ListFilters list={list} searchLabel="Cari kode atau nama supplier" />}
      />
    </OfficePage>
  );
}

function SupplierDetail({ row, onChanged }: { row: Supplier; onChanged: () => void }) {
  const can = useCan(),
    key = useMasterKey();
  const contacts = [
    ["PIC penjualan", row.sales_contact],
    ["PIC keuangan", row.finance_contact],
    ["PIC pengiriman", row.shipping_contact],
  ] as const;
  return (
    <OfficePage
      section="master"
      crumbs={[...crumbs, { label: row.code }]}
      title={row.name}
      status={<RecordBadge state={row.state} />}
      subtitle={`${row.code} · diperbarui ${new Date(row.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`}
      actions={
        <>
          <StateActions resource="suppliers" permission="master_supplier" row={row} onDone={onChanged} />
          {can("master_supplier.update") && (
            <Button asChild>
              <Link href={`${base}/${row.id}/edit`}>
                <Pencil aria-hidden="true" />
                Ubah
              </Link>
            </Button>
          )}
        </>
      }
    >
      <SummaryStrip>
        <ValueItem label="Kategori">{row.categories?.join(", ")}</ValueItem>
        <ValueItem label="Telepon">{row.phone}</ValueItem>
        <ValueItem label="NPWP">{row.tax_identity}</ValueItem>
        <ValueItem label="Nomor MOU">{row.agreement_number}</ValueItem>
      </SummaryStrip>
      <DetailTabs
        tabs={[
          {
            id: "info",
            label: "Informasi",
            content: (
              <ValueGrid>
                <ValueItem label="Nama badan usaha">{row.name}</ValueItem>
                <ValueItem label="Kategori">{row.categories?.join(", ")}</ValueItem>
                <ValueItem label="Alamat utama">{row.primary_address}</ValueItem>
                <ValueItem label="Telepon">{row.phone}</ValueItem>
              </ValueGrid>
            ),
          },
          {
            id: "contacts",
            label: "Kontak PIC",
            content: (
              <ValueGrid>
                {contacts.map(([label, contact]) => (
                  <ValueItem key={label} label={label}>
                    {contactText(contact)}
                  </ValueItem>
                ))}
              </ValueGrid>
            ),
          },
          {
            id: "legal",
            label: "Legalitas & PJT",
            content: (
              <ValueGrid>
                <ValueItem label="NPWP">{row.tax_identity}</ValueItem>
                <ValueItem label="Penanggung jawab teknis">{row.technical_responsible_name}</ValueItem>
                <ValueItem label="Dokumen legalitas">
                  {row.legal_documents?.length ? `${row.legal_documents.length} dokumen` : undefined}
                </ValueItem>
              </ValueGrid>
            ),
          },
          {
            id: "agreement",
            label: "Kontrak/MOU",
            content: (
              <>
                <ValueGrid>
                  <ValueItem label="Nomor MOU">{row.agreement_number}</ValueItem>
                </ValueGrid>
                <p className="page-frame-subtitle" style={{ marginTop: 16 }}>
                  Isi MOU, harga, minimum pesanan dan TOP dikelola di Warehouse &amp; Logistik →
                  Pengadaan.
                </p>
              </>
            ),
          },
          {
            id: "history",
            label: "Riwayat",
            content: (
              <HistoryList
                queryKey={key("suppliers", row.id, "history", row.version)}
                path={`/master-data/workspace/suppliers/${row.id}/history`}
              />
            ),
          },
        ]}
      />
    </OfficePage>
  );
}
