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
  SubNav,
  SummaryStrip,
  ValueGrid,
  ValueItem,
} from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import {
  ListFilters,
  StateActions,
  stateLabel,
  useCan,
  useListParams,
  useMasterKey,
  type MasterPage,
  type MasterState,
} from "../master-shared";
import { WarehouseForm } from "./warehouse-form";
import { LocatorWorkspace, locatorBase, locatorTypes, type Locator } from "./locator-workspace";

export const base = "/master-data/warehouses";
export type Warehouse = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  timezone: string;
  state: MasterState;
  version: number;
  updated_at: string;
  _count?: { locators: number };
};
const crumbs = [{ label: "Master Data" }, { label: "Gudang", href: base }];

export function WarehouseSubNav({ active }: { active: "warehouses" | "locators" }) {
  const can = useCan();
  return (
    <SubNav
      items={[
        ...(can("master_warehouse.read")
          ? [{ label: "Gudang", href: base, active: active === "warehouses" }]
          : []),
        ...(can("master_locator.read")
          ? [{ label: "Lokator", href: locatorBase, active: active === "locators" }]
          : []),
      ]}
    />
  );
}

export function WarehouseWorkspace({ path }: { path: string[] }) {
  const can = useCan(),
    key = useMasterKey();
  const locators = path[0] === "locators";
  const id = !locators && path[0] && path[0] !== "new" ? path[0] : undefined,
    form = path[0] === "new" || path[1] === "edit";
  const detail = useQuery({
    queryKey: key("warehouses", id),
    queryFn: () => apiRequest<{ data: Warehouse }>(`/master-data/workspace/warehouses/${id}`),
    enabled: !!id && can("master_warehouse.read"),
  });
  if (locators) return <LocatorWorkspace path={path.slice(1)} />;
  const row = detail.data?.data;
  if (!can("master_warehouse.read"))
    return (
      <OfficePage section="master" crumbs={crumbs} title="Gudang">
        <WarehouseSubNav active="warehouses" />
        <PageNotice tone="error">Anda tidak memiliki izin melihat Gudang.</PageNotice>
      </OfficePage>
    );
  if (id && !row)
    return (
      <OfficePage section="master" crumbs={[...crumbs, { label: "Detail" }]} title="Gudang">
        {detail.isError ? (
          <PageNotice tone="error" onRetry={() => void detail.refetch()}>
            {detail.error.message}
          </PageNotice>
        ) : (
          <p role="status">Memuat gudang…</p>
        )}
      </OfficePage>
    );
  if (form) {
    const allowed = can(row ? "master_warehouse.update" : "master_warehouse.create");
    return (
      <OfficePage
        section="master"
        crumbs={[
          ...crumbs,
          ...(row ? [{ label: row.code, href: `${base}/${row.id}` }] : []),
          { label: row ? "Ubah" : "Baru" },
        ]}
        title={row ? `Ubah ${row.name}` : "Gudang baru"}
        subtitle={row ? row.code : "Kode dibuat otomatis saat disimpan."}
      >
        {allowed ? (
          <WarehouseForm key={row?.id ?? "new"} initial={row} />
        ) : (
          <PageNotice tone="error">Anda tidak memiliki izin menyimpan Gudang.</PageNotice>
        )}
      </OfficePage>
    );
  }
  if (row) return <WarehouseDetail row={row} onChanged={() => void detail.refetch()} />;
  return <WarehouseList />;
}

function WarehouseList() {
  const can = useCan(),
    key = useMasterKey(),
    list = useListParams();
  const rows = useQuery({
    queryKey: key("warehouses", "list", list.query),
    queryFn: () =>
      apiRequest<MasterPage<Warehouse>>(`/master-data/workspace/warehouses?${list.query}`),
  });
  const columns: ColumnDef<Warehouse>[] = [
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
    { id: "address", header: "Alamat", cell: ({ row }) => row.original.address || "—" },
    { id: "locators", header: "Jumlah lokator", cell: ({ row }) => row.original._count?.locators ?? 0 },
    { id: "state", header: "Status", accessorFn: (row) => stateLabel[row.state] ?? row.state },
  ];
  return (
    <OfficePage
      section="master"
      crumbs={[{ label: "Master Data" }, { label: "Gudang" }]}
      title="Gudang"
      subtitle="Identitas gudang dan lokator. Saldo dan movement stok dikelola Warehouse & Logistik."
      actions={
        can("master_warehouse.create") && (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus aria-hidden="true" />
              Tambah gudang
            </Link>
          </Button>
        )
      }
    >
      <WarehouseSubNav active="warehouses" />
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
        label="gudang"
        toolbar={<ListFilters list={list} searchLabel="Cari kode atau nama gudang" />}
      />
    </OfficePage>
  );
}

function WarehouseLocators({ warehouse }: { warehouse: Warehouse }) {
  const can = useCan(),
    key = useMasterKey();
  const query = new URLSearchParams({ parent: warehouse.id, page: "1" }).toString();
  const rows = useQuery({
    queryKey: key("locators", "list", query),
    queryFn: () => apiRequest<MasterPage<Locator>>(`/master-data/workspace/locators?${query}`),
    enabled: can("master_locator.read"),
  });
  if (!can("master_locator.read"))
    return <p className="page-frame-subtitle">Memerlukan izin melihat Lokator.</p>;
  const columns: ColumnDef<Locator>[] = [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => (
        <Link className="page-frame-link" href={`${locatorBase}/${row.original.id}`}>
          {row.original.code}
        </Link>
      ),
    },
    { accessorKey: "name", header: "Nama" },
    {
      id: "type",
      header: "Jenis",
      cell: ({ row }) => locatorTypes[row.original.locator_type] ?? row.original.locator_type,
    },
    { id: "sequence", header: "Urutan picking", cell: ({ row }) => row.original.pick_sequence ?? "—" },
    { id: "state", header: "Status", accessorFn: (row) => stateLabel[row.state] ?? row.state },
  ];
  return (
    <>
      {can("master_locator.create") && warehouse.state === "ACTIVE" && (
        <div className="page-frame-actions" style={{ marginBottom: 12 }}>
          <Button variant="outline" asChild>
            <Link href={`${locatorBase}/new?parent=${warehouse.id}`}>
              <Plus aria-hidden="true" />
              Tambah lokator
            </Link>
          </Button>
        </div>
      )}
      <DataTable
        data={rows.data?.data ?? []}
        columns={columns}
        total={rows.data?.total ?? 0}
        busy={rows.isFetching}
        label="lokator"
        showColumns={false}
        {...(rows.data && rows.data.total > rows.data.page_size
          ? {
              footerLabel: `${rows.data.page_size} dari ${rows.data.total} lokator · lihat semua di menu Lokator`,
            }
          : {})}
      />
    </>
  );
}

function WarehouseDetail({ row, onChanged }: { row: Warehouse; onChanged: () => void }) {
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
          <StateActions resource="warehouses" permission="master_warehouse" row={row} onDone={onChanged} />
          {can("master_warehouse.update") && (
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
        <ValueItem label="Zona waktu">{row.timezone}</ValueItem>
        <ValueItem label="Jumlah lokator">{String(row._count?.locators ?? 0)}</ValueItem>
        <ValueItem label="Penanggung jawab" />
        <ValueItem label="Profil penyimpanan" />
      </SummaryStrip>
      <DetailTabs
        tabs={[
          {
            id: "info",
            label: "Informasi",
            content: (
              <ValueGrid>
                <ValueItem label="Nama gudang">{row.name}</ValueItem>
                <ValueItem label="Zona waktu">{row.timezone}</ValueItem>
                <ValueItem label="Alamat">{row.address}</ValueItem>
              </ValueGrid>
            ),
          },
          { id: "locators", label: "Lokator", content: <WarehouseLocators warehouse={row} /> },
          {
            id: "history",
            label: "Riwayat",
            content: (
              <HistoryList
                queryKey={key("warehouses", row.id, "history", row.version)}
                path={`/master-data/workspace/warehouses/${row.id}/history`}
              />
            ),
          },
        ]}
      />
    </OfficePage>
  );
}
