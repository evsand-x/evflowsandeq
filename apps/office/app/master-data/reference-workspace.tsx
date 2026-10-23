"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DataTable,
  DetailTabs,
  FormFrame,
  HistoryList,
  OfficePage,
  PageNotice,
  RecordBadge,
  ValueGrid,
  ValueItem,
  type Crumb,
} from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import {
  DuplicateNotice,
  ListFilters,
  nullableText,
  StateActions,
  stateLabel,
  useCan,
  useDuplicateCheck,
  useListParams,
  useMasterKey,
  type MasterPage,
  type MasterState,
} from "./master-shared";

// Referensi reusable (Kategori Produk, Satuan, Channel, Rayon) sebagai tab halaman induk.
export type ReferenceConfig = {
  resource: "product-categories" | "uoms" | "customer-channels" | "rayons";
  permission: string;
  title: string;
  singular: string;
  description: string;
  base: string;
  parent: Crumb;
  subnav: ReactNode;
  usageLabel?: string;
  coverage?: boolean;
};
type Reference = {
  id: string;
  code: string;
  name: string;
  coverage_notes?: string | null;
  state: MasterState;
  version: number;
  updated_at: string;
  _count?: { products?: number; customers?: number };
};
const usage = (row: Reference) => row._count?.products ?? row._count?.customers;

export function ReferenceWorkspace({ config, path }: { config: ReferenceConfig; path: string[] }) {
  const can = useCan(),
    key = useMasterKey();
  const id = path[0] && path[0] !== "new" ? path[0] : undefined,
    form = path[0] === "new" || path[1] === "edit";
  const detail = useQuery({
    queryKey: key(config.resource, id),
    queryFn: () => apiRequest<{ data: Reference }>(`/master-data/workspace/${config.resource}/${id}`),
    enabled: !!id && can(`${config.permission}.read`),
  });
  const crumbs: Crumb[] = [{ label: "Master Data" }, config.parent, { label: config.title, href: config.base }];
  const row = detail.data?.data;
  if (!can(`${config.permission}.read`))
    return (
      <OfficePage section="master" crumbs={crumbs} title={config.title}>
        {config.subnav}
        <PageNotice tone="error">Anda tidak memiliki izin melihat {config.title}.</PageNotice>
      </OfficePage>
    );
  if (id && !row)
    return (
      <OfficePage section="master" crumbs={[...crumbs, { label: "Detail" }]} title={config.title}>
        {detail.isError ? (
          <PageNotice tone="error" onRetry={() => void detail.refetch()}>
            {detail.error.message}
          </PageNotice>
        ) : (
          <p role="status">Memuat {config.singular}…</p>
        )}
      </OfficePage>
    );
  if (form) {
    const allowed = can(`${config.permission}.${row ? "update" : "create"}`);
    return (
      <OfficePage
        section="master"
        crumbs={[
          ...crumbs,
          ...(row ? [{ label: row.code, href: `${config.base}/${row.id}` }] : []),
          { label: row ? "Ubah" : "Baru" },
        ]}
        title={row ? `Ubah ${row.name}` : `${config.singular[0]!.toUpperCase()}${config.singular.slice(1)} baru`}
        subtitle={row ? `Kode ${row.code} tidak dapat diubah.` : undefined}
      >
        {allowed ? (
          <ReferenceForm key={row?.id ?? "new"} config={config} initial={row} />
        ) : (
          <PageNotice tone="error">Anda tidak memiliki izin menyimpan {config.title}.</PageNotice>
        )}
      </OfficePage>
    );
  }
  if (row)
    return (
      <OfficePage
        section="master"
        crumbs={[...crumbs, { label: row.code }]}
        title={row.name}
        status={<RecordBadge state={row.state} />}
        subtitle={row.code}
        actions={
          <>
            <StateActions
              resource={config.resource}
              permission={config.permission}
              row={row}
              onDone={() => void detail.refetch()}
            />
            {can(`${config.permission}.update`) && (
              <Button asChild>
                <Link href={`${config.base}/${row.id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Ubah
                </Link>
              </Button>
            )}
          </>
        }
      >
        <DetailTabs
          tabs={[
            {
              id: "info",
              label: "Informasi",
              content: (
                <ValueGrid>
                  <ValueItem label="Kode">{row.code}</ValueItem>
                  <ValueItem label="Nama">{row.name}</ValueItem>
                  {config.coverage && <ValueItem label="Catatan cakupan">{row.coverage_notes}</ValueItem>}
                  {config.usageLabel && (
                    <ValueItem label={config.usageLabel}>{usage(row)?.toString()}</ValueItem>
                  )}
                </ValueGrid>
              ),
            },
            {
              id: "history",
              label: "Riwayat",
              content: (
                <HistoryList
                  queryKey={key(config.resource, row.id, "history", row.version)}
                  path={`/master-data/workspace/${config.resource}/${row.id}/history`}
                />
              ),
            },
          ]}
        />
      </OfficePage>
    );
  return <ReferenceList config={config} crumbs={crumbs} />;
}

function ReferenceList({ config, crumbs }: { config: ReferenceConfig; crumbs: Crumb[] }) {
  const can = useCan(),
    key = useMasterKey(),
    list = useListParams();
  const rows = useQuery({
    queryKey: key(config.resource, "list", list.query),
    queryFn: () =>
      apiRequest<MasterPage<Reference>>(`/master-data/workspace/${config.resource}?${list.query}`),
  });
  const columns: ColumnDef<Reference>[] = [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => (
        <Link className="page-frame-link" href={`${config.base}/${row.original.id}`}>
          {row.original.code}
        </Link>
      ),
    },
    { accessorKey: "name", header: "Nama" },
    ...(config.coverage
      ? [{ id: "coverage", header: "Catatan cakupan", cell: ({ row }: { row: { original: Reference } }) => row.original.coverage_notes || "—" }]
      : []),
    ...(config.usageLabel
      ? [{ id: "usage", header: config.usageLabel, cell: ({ row }: { row: { original: Reference } }) => usage(row.original) ?? 0 }]
      : []),
    { id: "state", header: "Status", accessorFn: (row) => stateLabel[row.state] ?? row.state },
  ];
  return (
    <OfficePage
      section="master"
      crumbs={[crumbs[0]!, crumbs[1]!, { label: config.title }]}
      title={config.title}
      subtitle={config.description}
      actions={
        can(`${config.permission}.create`) && (
          <Button asChild>
            <Link href={`${config.base}/new`}>
              <Plus aria-hidden="true" />
              Tambah {config.singular}
            </Link>
          </Button>
        )
      }
    >
      {config.subnav}
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
        label={config.singular}
        toolbar={<ListFilters list={list} searchLabel={`Cari kode atau nama ${config.singular}`} />}
      />
    </OfficePage>
  );
}

function ReferenceForm({ config, initial }: { config: ReferenceConfig; initial?: Reference | undefined }) {
  const router = useRouter(),
    cache = useQueryClient(),
    duplicate = useDuplicateCheck(config.resource, initial);
  const [values, setValues] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    coverage_notes: initial?.coverage_notes ?? "",
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
    if (!initial && !values.code.trim()) found.code = "Kode wajib diisi.";
    if (values.name.trim().length < 2) found.name = "Nama wajib diisi.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      name: values.name.trim(),
      ...(config.coverage ? { coverage_notes: nullableText(values.coverage_notes) } : {}),
    };
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<{ data: { id: string } }>(
        initial ? `/master-data/${config.resource}/${initial.id}` : `/master-data/${config.resource}`,
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(
            initial ? { ...body, version: initial.version } : { ...body, code: values.code.trim() },
          ),
        },
      );
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      setDirty(false);
      toast.success(`${config.title} disimpan`);
      router.push(`${config.base}/${saved.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {error && <PageNotice tone="error">{error}</PageNotice>}
      <FormFrame
        dirty={dirty}
        submitting={busy}
        onSubmit={() => void submit()}
        cancelHref={initial ? `${config.base}/${initial.id}` : config.base}
        sections={[
          {
            id: "identity",
            title: "Identitas",
            content: (
              <div className="page-frame-fields">
                <label>
                  Kode *
                  <Input
                    value={values.code}
                    disabled={!!initial}
                    aria-invalid={!!errors.code}
                    onChange={(e) => set("code", e.target.value)}
                  />
                  {errors.code && <span className="page-frame-field-error">{errors.code}</span>}
                </label>
                <label>
                  Nama *
                  <Input
                    value={values.name}
                    aria-invalid={!!errors.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => void duplicate.check(values.name)}
                  />
                  {errors.name && <span className="page-frame-field-error">{errors.name}</span>}
                </label>
                <DuplicateNotice duplicates={duplicate.duplicates} base={config.base} />
                {config.coverage && (
                  <label className="span-full">
                    Catatan cakupan
                    <Textarea
                      value={values.coverage_notes}
                      onChange={(e) => set("coverage_notes", e.target.value)}
                    />
                  </label>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
