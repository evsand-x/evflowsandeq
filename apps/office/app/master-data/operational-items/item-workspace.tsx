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
  formatDecimal,
  ListFilters,
  StateActions,
  stateLabel,
  useCan,
  useListParams,
  useMasterKey,
  type MasterPage,
  type MasterState,
} from "../master-shared";
import { ItemForm } from "./item-form";

export const base = "/master-data/operational-items";
export const itemKinds: Record<string, string> = {
  SUPPLY: "Barang operasional",
  ASSET_MODEL: "Model aset",
  SERVICE: "Jasa",
};
export type OperationalItem = {
  id: string;
  code: string;
  name: string;
  kind: "SUPPLY" | "ASSET_MODEL" | "SERVICE";
  category: string;
  specification?: string | null;
  reference_purchase_price?: string | null;
  currency?: string | null;
  minimum_stock?: string | null;
  stock_controlled: boolean;
  base_uom?: { id: string; code: string; name: string };
  state: MasterState;
  version: number;
  updated_at: string;
};
const crumbs = [{ label: "Master Data" }, { label: "Item Operasional", href: base }];
const price = (row: OperationalItem) =>
  formatDecimal(row.reference_purchase_price, row.currency);

export function ItemWorkspace({ path }: { path: string[] }) {
  const can = useCan(),
    key = useMasterKey();
  const id = path[0] && path[0] !== "new" ? path[0] : undefined,
    form = path[0] === "new" || path[1] === "edit";
  const detail = useQuery({
    queryKey: key("operational-items", id),
    queryFn: () =>
      apiRequest<{ data: OperationalItem }>(`/master-data/workspace/operational-items/${id}`),
    enabled: !!id && can("master_operational_item.read"),
  });
  const row = detail.data?.data;
  if (!can("master_operational_item.read"))
    return (
      <OfficePage section="master" crumbs={crumbs} title="Item Operasional">
        <PageNotice tone="error">Anda tidak memiliki izin melihat Item Operasional.</PageNotice>
      </OfficePage>
    );
  if (id && !row)
    return (
      <OfficePage section="master" crumbs={[...crumbs, { label: "Detail" }]} title="Item Operasional">
        {detail.isError ? (
          <PageNotice tone="error" onRetry={() => void detail.refetch()}>
            {detail.error.message}
          </PageNotice>
        ) : (
          <p role="status">Memuat item…</p>
        )}
      </OfficePage>
    );
  if (form) {
    const allowed = can(row ? "master_operational_item.update" : "master_operational_item.create");
    return (
      <OfficePage
        section="master"
        crumbs={[
          ...crumbs,
          ...(row ? [{ label: row.code, href: `${base}/${row.id}` }] : []),
          { label: row ? "Ubah" : "Baru" },
        ]}
        title={row ? `Ubah ${row.name}` : "Item operasional baru"}
        subtitle={row ? row.code : "Kode dibuat otomatis saat disimpan."}
      >
        {allowed ? (
          <ItemForm key={row?.id ?? "new"} initial={row} />
        ) : (
          <PageNotice tone="error">Anda tidak memiliki izin menyimpan Item Operasional.</PageNotice>
        )}
      </OfficePage>
    );
  }
  if (row) return <ItemDetail row={row} onChanged={() => void detail.refetch()} />;
  return <ItemList />;
}

function ItemList() {
  const can = useCan(),
    key = useMasterKey(),
    list = useListParams();
  const rows = useQuery({
    queryKey: key("operational-items", "list", list.query),
    queryFn: () =>
      apiRequest<MasterPage<OperationalItem>>(
        `/master-data/workspace/operational-items?${list.query}`,
      ),
  });
  const columns: ColumnDef<OperationalItem>[] = [
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
    { id: "kind", header: "Jenis", cell: ({ row }) => itemKinds[row.original.kind] ?? row.original.kind },
    { accessorKey: "category", header: "Kategori" },
    { id: "uom", header: "Satuan", cell: ({ row }) => row.original.base_uom?.name ?? "—" },
    {
      id: "price",
      header: "Harga Beli Acuan",
      cell: ({ row }) => price(row.original) ?? "Belum tersedia",
    },
    { id: "state", header: "Status", accessorFn: (row) => stateLabel[row.state] ?? row.state },
  ];
  return (
    <OfficePage
      section="master"
      crumbs={[{ label: "Master Data" }, { label: "Item Operasional" }]}
      title="Item Operasional"
      subtitle="Barang operasional, model aset dan jasa berulang di luar barang dagang."
      actions={
        can("master_operational_item.create") && (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus aria-hidden="true" />
              Tambah item
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
        label="item"
        toolbar={<ListFilters list={list} searchLabel="Cari kode atau nama item" />}
      />
    </OfficePage>
  );
}

function ItemDetail({ row, onChanged }: { row: OperationalItem; onChanged: () => void }) {
  const can = useCan(),
    key = useMasterKey();
  return (
    <OfficePage
      section="master"
      crumbs={[...crumbs, { label: row.code }]}
      title={row.name}
      status={<RecordBadge state={row.state} />}
      subtitle={`${row.code} · diperbarui ${new Date(row.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`}
      actions={
        <>
          <StateActions
            resource="operational-items"
            permission="master_operational_item"
            row={row}
            onDone={onChanged}
          />
          {can("master_operational_item.update") && (
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
        <ValueItem label="Jenis">{itemKinds[row.kind]}</ValueItem>
        <ValueItem label="Kategori">{row.category}</ValueItem>
        <ValueItem label="Satuan dasar">{row.base_uom?.name}</ValueItem>
        <ValueItem label="Harga Beli Acuan">{price(row)}</ValueItem>
      </SummaryStrip>
      <DetailTabs
        tabs={[
          {
            id: "info",
            label: "Informasi",
            content: (
              <ValueGrid>
                <ValueItem label="Nama item">{row.name}</ValueItem>
                <ValueItem label="Jenis">{itemKinds[row.kind]}</ValueItem>
                <ValueItem label="Kategori">{row.category}</ValueItem>
                <ValueItem label="Satuan dasar">
                  {row.base_uom && `${row.base_uom.code} — ${row.base_uom.name}`}
                </ValueItem>
                <ValueItem label="Spesifikasi/ruang lingkup">{row.specification}</ValueItem>
                <ValueItem label="Harga Beli Acuan">{price(row)}</ValueItem>
                <ValueItem label="Dikelola sebagai stok">{row.stock_controlled ? "Ya" : "Tidak"}</ValueItem>
                {row.stock_controlled && (
                  <ValueItem label="Stok minimum">{formatDecimal(row.minimum_stock)}</ValueItem>
                )}
              </ValueGrid>
            ),
          },
          {
            id: "history",
            label: "Riwayat",
            content: (
              <HistoryList
                queryKey={key("operational-items", row.id, "history", row.version)}
                path={`/master-data/workspace/operational-items/${row.id}/history`}
              />
            ),
          },
        ]}
      />
      <p className="page-frame-subtitle">
        Harga Beli Acuan hanya untuk estimasi permintaan dan anggaran; bukan HPP, beban atau nilai aset.
      </p>
    </OfficePage>
  );
}
