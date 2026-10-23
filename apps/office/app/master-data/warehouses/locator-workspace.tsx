"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { IconPencil as Pencil, IconPlus as Plus } from "@/components/web/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  DetailTabs,
  FormFrame,
  HistoryList,
  OfficePage,
  PageNotice,
  RecordBadge,
  SummaryStrip,
  ValueGrid,
  ValueItem,
} from "@/components/web/page-frame";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import {
  DuplicateNotice,
  ListFilters,
  StateActions,
  stateLabel,
  useCan,
  useDuplicateCheck,
  useListParams,
  useMasterKey,
  type MasterPage,
  type MasterState,
} from "../master-shared";
import { WarehouseSubNav } from "./warehouse-workspace";

export const locatorBase = "/master-data/warehouses/locators";
export const locatorTypes: Record<string, string> = {
  RECEIVING: "Penerimaan",
  STORAGE: "Penyimpanan",
  QUARANTINE: "Karantina",
  TRANSIT: "Transit",
  CONSIGNMENT: "Konsinyasi",
  DISPATCH: "Pengeluaran",
  RETURN: "Retur",
};
export type Locator = {
  id: string;
  code: string;
  name: string;
  locator_type: string;
  pick_sequence?: number | null;
  state: MasterState;
  version: number;
  updated_at: string;
  warehouse?: { id: string; code: string; name: string };
};
type WarehouseOption = { id: string; code: string; name: string; state: MasterState };
const crumbs = [
  { label: "Master Data" },
  { label: "Gudang", href: "/master-data/warehouses" },
  { label: "Lokator", href: locatorBase },
];

function useWarehouseOptions() {
  const can = useCan(),
    key = useMasterKey();
  return useQuery({
    queryKey: key("warehouses", "options"),
    queryFn: () =>
      apiRequest<{ data: WarehouseOption[] }>("/master-data/warehouses").then((r) => r.data),
    enabled: can("master_warehouse.read"),
  });
}

export function LocatorWorkspace({ path }: { path: string[] }) {
  const can = useCan(),
    key = useMasterKey();
  const id = path[0] && path[0] !== "new" ? path[0] : undefined,
    form = path[0] === "new" || path[1] === "edit";
  const detail = useQuery({
    queryKey: key("locators", id),
    queryFn: () => apiRequest<{ data: Locator }>(`/master-data/workspace/locators/${id}`),
    enabled: !!id && can("master_locator.read"),
  });
  const row = detail.data?.data;
  if (!can("master_locator.read"))
    return (
      <OfficePage section="master" crumbs={crumbs} title="Lokator">
        <WarehouseSubNav active="locators" />
        <PageNotice tone="error">Anda tidak memiliki izin melihat Lokator.</PageNotice>
      </OfficePage>
    );
  if (id && !row)
    return (
      <OfficePage section="master" crumbs={[...crumbs, { label: "Detail" }]} title="Lokator">
        {detail.isError ? (
          <PageNotice tone="error" onRetry={() => void detail.refetch()}>
            {detail.error.message}
          </PageNotice>
        ) : (
          <p role="status">Memuat lokator…</p>
        )}
      </OfficePage>
    );
  if (form) {
    const allowed = can(row ? "master_locator.update" : "master_locator.create");
    return (
      <OfficePage
        section="master"
        crumbs={[
          ...crumbs,
          ...(row ? [{ label: row.code, href: `${locatorBase}/${row.id}` }] : []),
          { label: row ? "Ubah" : "Baru" },
        ]}
        title={row ? `Ubah ${row.name}` : "Lokator baru"}
        subtitle={row ? row.code : "Kode dibuat otomatis saat disimpan."}
      >
        {allowed ? (
          <LocatorForm key={row?.id ?? "new"} initial={row} />
        ) : (
          <PageNotice tone="error">Anda tidak memiliki izin menyimpan Lokator.</PageNotice>
        )}
      </OfficePage>
    );
  }
  if (row) return <LocatorDetail row={row} onChanged={() => void detail.refetch()} />;
  return <LocatorList />;
}

function LocatorList() {
  const can = useCan(),
    key = useMasterKey(),
    list = useListParams(),
    warehouses = useWarehouseOptions();
  const rows = useQuery({
    queryKey: key("locators", "list", list.query),
    queryFn: () => apiRequest<MasterPage<Locator>>(`/master-data/workspace/locators?${list.query}`),
  });
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
    { id: "warehouse", header: "Gudang", cell: ({ row }) => row.original.warehouse?.name ?? "—" },
    {
      id: "type",
      header: "Jenis",
      cell: ({ row }) => locatorTypes[row.original.locator_type] ?? row.original.locator_type,
    },
    { id: "sequence", header: "Urutan picking", cell: ({ row }) => row.original.pick_sequence ?? "—" },
    { id: "state", header: "Status", accessorFn: (row) => stateLabel[row.state] ?? row.state },
  ];
  return (
    <OfficePage
      section="master"
      crumbs={[{ label: "Master Data" }, { label: "Gudang", href: "/master-data/warehouses" }, { label: "Lokator" }]}
      title="Lokator"
      subtitle="Lokasi penyimpanan di dalam gudang. Lokasi tidak menetapkan kepemilikan atau kelayakan stok."
      actions={
        can("master_locator.create") && (
          <Button asChild>
            <Link href={`${locatorBase}/new${list.parent !== "ALL" ? `?parent=${list.parent}` : ""}`}>
              <Plus aria-hidden="true" />
              Tambah lokator
            </Link>
          </Button>
        )
      }
    >
      <WarehouseSubNav active="locators" />
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
        label="lokator"
        toolbar={
          <ListFilters list={list} searchLabel="Cari kode atau nama lokator" filterKeys={["parent"]}>
            {warehouses.data && (
              <SelectionField
                label="Gudang"
                value={[list.parent]}
                options={[
                  { id: "ALL", name: "Semua gudang" },
                  ...warehouses.data.map((w) => ({ id: w.id, name: w.name, code: w.code })),
                ]}
                onChange={(v) => list.set({ parent: v[0] ?? "ALL", page: 1 })}
              />
            )}
          </ListFilters>
        }
      />
    </OfficePage>
  );
}

function LocatorDetail({ row, onChanged }: { row: Locator; onChanged: () => void }) {
  const can = useCan(),
    key = useMasterKey();
  return (
    <OfficePage
      section="master"
      crumbs={[...crumbs, { label: row.code }]}
      title={row.name}
      status={<RecordBadge state={row.state} />}
      subtitle={`${row.code} · ${row.warehouse?.name ?? ""}`}
      actions={
        <>
          <StateActions resource="locators" permission="master_locator" row={row} onDone={onChanged} />
          {can("master_locator.update") && (
            <Button asChild>
              <Link href={`${locatorBase}/${row.id}/edit`}>
                <Pencil aria-hidden="true" />
                Ubah
              </Link>
            </Button>
          )}
        </>
      }
    >
      <SummaryStrip>
        <ValueItem label="Gudang">{row.warehouse?.name}</ValueItem>
        <ValueItem label="Jenis">{locatorTypes[row.locator_type]}</ValueItem>
        <ValueItem label="Urutan picking">{row.pick_sequence?.toString()}</ValueItem>
        <ValueItem label="Profil suhu" />
      </SummaryStrip>
      <DetailTabs
        tabs={[
          {
            id: "info",
            label: "Informasi",
            content: (
              <ValueGrid>
                <ValueItem label="Nama lokator">{row.name}</ValueItem>
                <ValueItem label="Gudang">
                  {row.warehouse && (
                    <Link className="page-frame-link" href={`/master-data/warehouses/${row.warehouse.id}`}>
                      {row.warehouse.code} {row.warehouse.name}
                    </Link>
                  )}
                </ValueItem>
                <ValueItem label="Jenis">{locatorTypes[row.locator_type]}</ValueItem>
                <ValueItem label="Urutan picking">{row.pick_sequence?.toString()}</ValueItem>
              </ValueGrid>
            ),
          },
          {
            id: "history",
            label: "Riwayat",
            content: (
              <HistoryList
                queryKey={key("locators", row.id, "history", row.version)}
                path={`/master-data/workspace/locators/${row.id}/history`}
              />
            ),
          },
        ]}
      />
    </OfficePage>
  );
}

function LocatorForm({ initial }: { initial?: Locator | undefined }) {
  const router = useRouter(),
    params = useSearchParams(),
    cache = useQueryClient(),
    warehouses = useWarehouseOptions(),
    duplicate = useDuplicateCheck("locators", initial);
  const [values, setValues] = useState({
    warehouse_id: initial?.warehouse?.id ?? params.get("parent") ?? "",
    name: initial?.name ?? "",
    locator_type: initial?.locator_type ?? "STORAGE",
    pick_sequence: initial?.pick_sequence?.toString() ?? "",
  });
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({});
  const set = (field: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
    setDirty(true);
  };
  const submit = async () => {
    const found: Record<string, string> = {};
    if (!initial && !values.warehouse_id) found.warehouse_id = "Pilih gudang aktif.";
    if (values.name.trim().length < 2) found.name = "Nama lokator wajib diisi.";
    if (values.pick_sequence && !/^[1-9]\d*$/.test(values.pick_sequence))
      found.pick_sequence = "Urutan picking berupa bilangan bulat positif.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      name: values.name.trim(),
      locator_type: values.locator_type,
      pick_sequence: values.pick_sequence ? Number(values.pick_sequence) : null,
    };
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<{ data: { id: string } }>(
        initial ? `/master-data/locators/${initial.id}` : "/master-data/locators",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(
            initial
              ? { ...body, version: initial.version }
              : { ...body, warehouse_id: values.warehouse_id },
          ),
        },
      );
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      setDirty(false);
      toast.success(initial ? "Lokator disimpan" : "Lokator dibuat");
      router.push(`${locatorBase}/${saved.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const activeWarehouses = (warehouses.data ?? []).filter((w) => w.state === "ACTIVE");
  return (
    <>
      {error && <PageNotice tone="error">{error}</PageNotice>}
      <FormFrame
        dirty={dirty}
        submitting={busy}
        onSubmit={() => void submit()}
        cancelHref={initial ? `${locatorBase}/${initial.id}` : locatorBase}
        sections={[
          {
            id: "identity",
            title: "Identitas lokator",
            description: "Hanya gudang aktif yang dapat dipilih. Gudang induk tidak diubah setelah lokator dibuat.",
            content: (
              <div className="page-frame-fields">
                {initial ? (
                  <label>
                    Gudang
                    <Input value={initial.warehouse?.name ?? ""} disabled />
                  </label>
                ) : warehouses.isError || !warehouses.data ? (
                  <PageNotice tone={warehouses.isError ? "error" : "info"}>
                    {warehouses.isError ? warehouses.error.message : "Memerlukan izin melihat Gudang untuk memilih gudang."}
                  </PageNotice>
                ) : (
                  <SelectionField
                    label="Gudang *"
                    value={values.warehouse_id ? [values.warehouse_id] : []}
                    options={activeWarehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
                    placeholder="Pilih gudang"
                    error={errors.warehouse_id}
                    onChange={(v) => set("warehouse_id", v[0] ?? "")}
                  />
                )}
                <label>
                  Nama lokator *
                  <Input
                    value={values.name}
                    aria-invalid={!!errors.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => void duplicate.check(values.name)}
                  />
                  {errors.name && <span className="page-frame-field-error">{errors.name}</span>}
                </label>
                <DuplicateNotice duplicates={duplicate.duplicates} base={locatorBase} />
                <SelectionField
                  label="Jenis lokator *"
                  value={[values.locator_type]}
                  options={Object.entries(locatorTypes).map(([id, name]) => ({ id, name }))}
                  onChange={(v) => set("locator_type", v[0] ?? "STORAGE")}
                />
                <label>
                  Urutan picking
                  <Input
                    inputMode="numeric"
                    value={values.pick_sequence}
                    aria-invalid={!!errors.pick_sequence}
                    onChange={(e) => set("pick_sequence", e.target.value)}
                  />
                  {errors.pick_sequence && (
                    <span className="page-frame-field-error">{errors.pick_sequence}</span>
                  )}
                </label>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
