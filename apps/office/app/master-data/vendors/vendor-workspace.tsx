"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
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
import { VendorForm } from "./vendor-form";

export const base = "/master-data/vendors";
export const vendorTypes: Record<string, string> = {
  COMPANY: "Badan usaha",
  INDIVIDUAL: "Perorangan",
};
export const taxStatuses: Record<string, string> = {
  PKP: "PKP",
  NON_PKP: "Non-PKP",
  UNVERIFIED: "Belum diverifikasi",
};
export type Vendor = {
  id: string;
  code: string;
  name: string;
  vendor_type: "COMPANY" | "INDIVIDUAL";
  categories: string[];
  primary_address?: string | null;
  phone?: string | null;
  email?: string | null;
  order_contact?: Contact;
  finance_contact?: Contact;
  service_contact?: Contact;
  tax_identity?: string | null;
  tax_status?: string | null;
  agreement_number?: string | null;
  state: MasterState;
  version: number;
  updated_at: string;
};
const crumbs = [{ label: "Master Data" }, { label: "Vendor", href: base }];

export function VendorWorkspace({ path }: { path: string[] }) {
  const can = useCan(),
    key = useMasterKey();
  const id = path[0] && path[0] !== "new" ? path[0] : undefined,
    form = path[0] === "new" || path[1] === "edit";
  const detail = useQuery({
    queryKey: key("vendors", id),
    queryFn: () => apiRequest<{ data: Vendor }>(`/master-data/workspace/vendors/${id}`),
    enabled: !!id && can("master_vendor.read"),
  });
  const row = detail.data?.data;
  if (!can("master_vendor.read"))
    return (
      <OfficePage section="master" crumbs={crumbs} title="Vendor">
        <PageNotice tone="error">Anda tidak memiliki izin melihat Vendor.</PageNotice>
      </OfficePage>
    );
  if (id && !row)
    return (
      <OfficePage section="master" crumbs={[...crumbs, { label: "Detail" }]} title="Vendor">
        {detail.isError ? (
          <PageNotice tone="error" onRetry={() => void detail.refetch()}>
            {detail.error.message}
          </PageNotice>
        ) : (
          <p role="status">Memuat vendor…</p>
        )}
      </OfficePage>
    );
  if (form) {
    const allowed = can(row ? "master_vendor.update" : "master_vendor.create");
    return (
      <OfficePage
        section="master"
        crumbs={[
          ...crumbs,
          ...(row ? [{ label: row.code, href: `${base}/${row.id}` }] : []),
          { label: row ? "Ubah" : "Baru" },
        ]}
        title={row ? `Ubah ${row.name}` : "Vendor baru"}
        subtitle={row ? row.code : "Kode dibuat otomatis saat disimpan."}
      >
        {allowed ? (
          <VendorForm key={row?.id ?? "new"} initial={row} />
        ) : (
          <PageNotice tone="error">Anda tidak memiliki izin menyimpan Vendor.</PageNotice>
        )}
      </OfficePage>
    );
  }
  if (row) return <VendorDetail row={row} onChanged={() => void detail.refetch()} />;
  return <VendorList />;
}

function VendorList() {
  const can = useCan(),
    key = useMasterKey(),
    list = useListParams();
  const rows = useQuery({
    queryKey: key("vendors", "list", list.query),
    queryFn: () => apiRequest<MasterPage<Vendor>>(`/master-data/workspace/vendors?${list.query}`),
  });
  const columns: ColumnDef<Vendor>[] = [
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
      id: "type",
      header: "Jenis",
      cell: ({ row }) => vendorTypes[row.original.vendor_type] ?? row.original.vendor_type,
    },
    {
      id: "categories",
      header: "Kategori",
      cell: ({ row }) => row.original.categories?.join(", ") || "—",
    },
    { id: "phone", header: "Telepon", cell: ({ row }) => row.original.phone || "—" },
    { id: "state", header: "Status", accessorFn: (row) => stateLabel[row.state] ?? row.state },
  ];
  return (
    <OfficePage
      section="master"
      crumbs={[{ label: "Master Data" }, { label: "Vendor" }]}
      title="Vendor"
      subtitle="Penyedia aset, barang operasional dan jasa."
      actions={
        can("master_vendor.create") && (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus aria-hidden="true" />
              Tambah vendor
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
        label="vendor"
        toolbar={<ListFilters list={list} searchLabel="Cari kode atau nama vendor" />}
      />
    </OfficePage>
  );
}

function VendorDetail({ row, onChanged }: { row: Vendor; onChanged: () => void }) {
  const can = useCan(),
    key = useMasterKey();
  const contacts = [
    ["PIC penjualan/pemesanan", row.order_contact],
    ["PIC keuangan", row.finance_contact],
    ["PIC pelaksanaan/pengiriman", row.service_contact],
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
          <StateActions resource="vendors" permission="master_vendor" row={row} onDone={onChanged} />
          {can("master_vendor.update") && (
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
        <ValueItem label="Jenis">{vendorTypes[row.vendor_type]}</ValueItem>
        <ValueItem label="Kategori">{row.categories?.join(", ")}</ValueItem>
        <ValueItem label="Telepon">{row.phone}</ValueItem>
        <ValueItem label="Status PKP">{row.tax_status ? taxStatuses[row.tax_status] ?? row.tax_status : undefined}</ValueItem>
      </SummaryStrip>
      <DetailTabs
        tabs={[
          {
            id: "info",
            label: "Informasi",
            content: (
              <ValueGrid>
                <ValueItem label="Nama">{row.name}</ValueItem>
                <ValueItem label="Jenis">{vendorTypes[row.vendor_type]}</ValueItem>
                <ValueItem label="Kategori">{row.categories?.join(", ")}</ValueItem>
                <ValueItem label="Alamat utama">{row.primary_address}</ValueItem>
                <ValueItem label="Telepon">{row.phone}</ValueItem>
                <ValueItem label="Email">{row.email}</ValueItem>
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
            id: "tax",
            label: "Legalitas & Pajak",
            content: (
              <ValueGrid>
                <ValueItem label="NPWP">{row.tax_identity}</ValueItem>
                <ValueItem label="Status PKP">
                  {row.tax_status ? taxStatuses[row.tax_status] ?? row.tax_status : undefined}
                </ValueItem>
                <ValueItem label="Dokumen legalitas" />
              </ValueGrid>
            ),
          },
          {
            id: "payment",
            label: "Pembayaran",
            content: (
              <>
                <ValueGrid>
                  <ValueItem label="Rekening pembayaran" />
                  <ValueItem label="Saldo awal utang" />
                </ValueGrid>
                <p className="page-frame-subtitle" style={{ marginTop: 16 }}>
                  Rekening dan saldo awal utang dikelola serta diverifikasi oleh Finance.
                </p>
              </>
            ),
          },
          {
            id: "agreement",
            label: "Kontrak & Status",
            content: (
              <ValueGrid>
                <ValueItem label="Nomor kontrak/SPK/perjanjian">{row.agreement_number}</ValueItem>
                <ValueItem label="Status">{stateLabel[row.state]}</ValueItem>
              </ValueGrid>
            ),
          },
          {
            id: "history",
            label: "Riwayat",
            content: (
              <HistoryList
                queryKey={key("vendors", row.id, "history", row.version)}
                path={`/master-data/workspace/vendors/${row.id}/history`}
              />
            ),
          },
        ]}
      />
    </OfficePage>
  );
}
