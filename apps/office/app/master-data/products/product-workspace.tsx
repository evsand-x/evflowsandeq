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
import { SelectionField } from "@/components/web/selection-field";
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
import { ReferenceWorkspace, type ReferenceConfig } from "../reference-workspace";
import { ProductForm } from "./product-form";
import { PriceSection, RegistrationSection, UomSection } from "./product-sections";

export const base = "/master-data/products";
type Ref = { id: string; code?: string; name: string };
export type Registration = {
  id: string;
  permit_type: string;
  permit_number: string;
  holder: string;
  issued_on?: string | null;
  expires_on?: string | null;
  status: "PENDING" | "VALID" | "EXPIRED" | "INVALID";
  evidence_object_key?: string | null;
  disposition_reason?: string | null;
};
export type Product = {
  id: string;
  code: string;
  discount_limit?: string | null;
  name: string;
  category: Ref;
  base_uom: Ref;
  batch_required: boolean;
  expiry_required: boolean;
  serial_required: boolean;
  storage_notes?: string | null;
  storage_profile?: Record<string, unknown> | null;
  shelf_life_days?: number | null;
  uoms?: {
    id: string;
    uom: Ref;
    factor_to_base: string;
    effective_from: string;
    effective_to?: string | null;
    active: boolean;
  }[];
  registrations: Registration[];
  reference_prices?: {
    id: string;
    kind: "PURCHASE" | "SALE";
    uom: Ref;
    currency: string;
    unit_price: string;
    effective_from: string;
    effective_to?: string | null;
  }[];
  state: MasterState;
  version: number;
  updated_at: string;
};
type ProductRow = Pick<Product, "id" | "code" | "name" | "category" | "base_uom" | "state"> & {
  registrations: Pick<Registration, "status" | "expires_on">[];
};
export const registrationLabel: Record<string, string> = {
  PENDING: "Menunggu verifikasi",
  VALID: "Valid",
  EXPIRED: "Kedaluwarsa",
  INVALID: "Tidak valid",
};

export function ProductSubNav({ active }: { active: "products" | "categories" | "uoms" }) {
  const can = useCan();
  return (
    <SubNav
      items={[
        ...(can("master_product.read") ? [{ label: "Produk", href: base, active: active === "products" }] : []),
        ...(can("master_product_category.read")
          ? [{ label: "Kategori Produk", href: `${base}/categories`, active: active === "categories" }]
          : []),
        ...(can("master_uom.read") ? [{ label: "Satuan", href: `${base}/uoms`, active: active === "uoms" }] : []),
      ]}
    />
  );
}

const references: Record<string, ReferenceConfig> = {
  categories: {
    resource: "product-categories",
    permission: "master_product_category",
    title: "Kategori Produk",
    singular: "kategori",
    description: "Kategori alat kesehatan yang dipilih pada produk.",
    base: `${base}/categories`,
    parent: { label: "Produk", href: base },
    subnav: <ProductSubNav active="categories" />,
    usageLabel: "Jumlah produk",
  },
  uoms: {
    resource: "uoms",
    permission: "master_uom",
    title: "Satuan",
    singular: "satuan",
    description: "Satuan reusable. Faktor konversi diatur pada detail produk.",
    base: `${base}/uoms`,
    parent: { label: "Produk", href: base },
    subnav: <ProductSubNav active="uoms" />,
  },
};

// Kesiapan aktivasi ditampilkan sebagai bantuan; backend tetap memutuskan saat Aktifkan.
export function activationGaps(row: Product) {
  const gaps: string[] = [];
  const now = new Date();
  if (!row.registrations.some((r) => r.status === "VALID" && (!r.expires_on || new Date(r.expires_on) >= now)))
    gaps.push("Izin edar valid belum tersedia.");
  if (!row.storage_notes?.trim() || !row.storage_profile) gaps.push("Profil penyimpanan belum lengkap.");
  if (row.expiry_required && !row.shelf_life_days) gaps.push("Masa simpan wajib untuk produk dengan expiry.");
  return gaps;
}

export function ProductWorkspace({ path }: { path: string[] }) {
  const can = useCan(),
    key = useMasterKey();
  const reference = path[0] ? references[path[0]] : undefined;
  const id = !reference && path[0] && path[0] !== "new" ? path[0] : undefined,
    form = !reference && (path[0] === "new" || path[1] === "edit");
  const detail = useQuery({
    queryKey: key("products", id),
    queryFn: () => apiRequest<{ data: Product }>(`/master-data/products/${id}`),
    enabled: !!id && can("master_product.read"),
  });
  if (reference) return <ReferenceWorkspace config={reference} path={path.slice(1)} />;
  const crumbs = [{ label: "Master Data" }, { label: "Produk", href: base }];
  const row = detail.data?.data;
  if (!can("master_product.read"))
    return (
      <OfficePage section="master" crumbs={crumbs} title="Produk">
        <ProductSubNav active="products" />
        <PageNotice tone="error">Anda tidak memiliki izin melihat Produk.</PageNotice>
      </OfficePage>
    );
  if (id && !row)
    return (
      <OfficePage section="master" crumbs={[...crumbs, { label: "Detail" }]} title="Produk">
        {detail.isError ? (
          <PageNotice tone="error" onRetry={() => void detail.refetch()}>
            {detail.error.message}
          </PageNotice>
        ) : (
          <p role="status">Memuat produk…</p>
        )}
      </OfficePage>
    );
  if (form) {
    const allowed = can(row ? "master_product.update" : "master_product.create");
    return (
      <OfficePage
        section="master"
        crumbs={[
          ...crumbs,
          ...(row ? [{ label: row.code, href: `${base}/${row.id}` }] : []),
          { label: row ? "Ubah" : "Baru" },
        ]}
        title={row ? `Ubah ${row.name}` : "Produk baru"}
        subtitle={row ? row.code : "Kode dibuat otomatis. Izin edar, konversi satuan dan harga acuan ditambahkan dari detail produk."}
      >
        {allowed ? (
          <ProductForm key={row?.id ?? "new"} initial={row} />
        ) : (
          <PageNotice tone="error">Anda tidak memiliki izin menyimpan Produk.</PageNotice>
        )}
      </OfficePage>
    );
  }
  if (row) return <ProductDetail row={row} onChanged={() => void detail.refetch()} />;
  return <ProductList />;
}

function ProductList() {
  const can = useCan(),
    key = useMasterKey(),
    list = useListParams();
  const rows = useQuery({
    queryKey: key("products", "list", list.query),
    queryFn: () => apiRequest<MasterPage<ProductRow>>(`/master-data/workspace/products?${list.query}`),
  });
  const categories = useQuery({
    queryKey: key("product-categories", "options"),
    queryFn: () =>
      apiRequest<{ data: (Ref & { state: MasterState })[] }>("/master-data/product-categories").then((r) => r.data),
    enabled: can("master_product_category.read"),
  });
  const columns: ColumnDef<ProductRow>[] = [
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
    { id: "category", header: "Kategori", cell: ({ row }) => row.original.category?.name ?? "—" },
    { id: "uom", header: "Satuan dasar", cell: ({ row }) => row.original.base_uom?.name ?? "—" },
    {
      id: "permit",
      header: "Izin edar",
      cell: ({ row }) => {
        const latest = row.original.registrations[0];
        return latest ? registrationLabel[latest.status] : "Belum tersedia";
      },
    },
    { id: "state", header: "Status", accessorFn: (row) => stateLabel[row.state] ?? row.state },
  ];
  return (
    <OfficePage
      section="master"
      crumbs={[{ label: "Master Data" }, { label: "Produk" }]}
      title="Produk"
      subtitle="Barang dagang alat kesehatan beserta izin edar, satuan dan profil mutu."
      actions={
        can("master_product.create") && (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus aria-hidden="true" />
              Tambah produk
            </Link>
          </Button>
        )
      }
    >
      <ProductSubNav active="products" />
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
        label="produk"
        toolbar={
          <ListFilters list={list} searchLabel="Cari kode atau nama produk" filterKeys={["parent"]}>
            {categories.data && (
              <SelectionField
                label="Kategori"
                value={[list.parent]}
                options={[{ id: "ALL", name: "Semua kategori" }, ...categories.data.map((c) => ({ id: c.id, name: c.name }))]}
                onChange={(v) => list.set({ parent: v[0] ?? "ALL", page: 1 })}
              />
            )}
          </ListFilters>
        }
      />
    </OfficePage>
  );
}

function ProductDetail({ row, onChanged }: { row: Product; onChanged: () => void }) {
  const can = useCan(),
    key = useMasterKey();
  const profile = (row.storage_profile ?? {}) as Record<string, unknown>;
  const gaps = activationGaps(row);
  const latest = row.registrations[0];
  return (
    <OfficePage
      section="master"
      crumbs={[{ label: "Master Data" }, { label: "Produk", href: base }, { label: row.code }]}
      title={row.name}
      status={<RecordBadge state={row.state} />}
      subtitle={`${row.code} · diperbarui ${new Date(row.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`}
      actions={
        <>
          <StateActions resource="products" permission="master_product" row={row} onDone={onChanged} />
          {can("master_product.update") && (
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
      {row.state !== "ACTIVE" && gaps.length > 0 && (
        <PageNotice>Belum siap diaktifkan: {gaps.join(" ")}</PageNotice>
      )}
      <SummaryStrip>
        <ValueItem label="Kategori">{row.category?.name}</ValueItem>
        <ValueItem label="Satuan dasar">{row.base_uom?.name}</ValueItem>
        <ValueItem label="Izin edar">
          {latest && `${latest.permit_type} ${latest.permit_number} · ${registrationLabel[latest.status]}`}
        </ValueItem>
        <ValueItem label="Masa simpan">{row.shelf_life_days ? `${row.shelf_life_days} hari` : undefined}</ValueItem>
      </SummaryStrip>
      <DetailTabs
        tabs={[
          {
            id: "info",
            label: "Informasi",
            content: (
              <ValueGrid>
                <ValueItem label="Nama produk">{row.name}</ValueItem>
                <ValueItem label="Kategori">{row.category?.name}</ValueItem>
                <ValueItem label="Satuan dasar">{row.base_uom && `${row.base_uom.code} — ${row.base_uom.name}`}</ValueItem>
                <ValueItem label="Wajib batch">{row.batch_required ? "Ya" : "Tidak"}</ValueItem>
                <ValueItem label="Wajib tanggal kedaluwarsa">{row.expiry_required ? "Ya" : "Tidak"}</ValueItem>
                <ValueItem label="Wajib nomor seri">{row.serial_required ? "Ya" : "Tidak"}</ValueItem>
              </ValueGrid>
            ),
          },
          { id: "uoms", label: "Satuan & konversi", content: <UomSection product={row} onChanged={onChanged} /> },
          {
            id: "permits",
            label: "Izin edar",
            content: <RegistrationSection product={row} onChanged={onChanged} />,
          },
          {
            id: "storage",
            label: "Penyimpanan & mutu",
            content: (
              <ValueGrid>
                <ValueItem label="Suhu minimum (°C)">{profile.min_temp as string | undefined}</ValueItem>
                <ValueItem label="Suhu maksimum (°C)">{profile.max_temp as string | undefined}</ValueItem>
                <ValueItem label="Batas kelembapan">{profile.humidity_limits as string | undefined}</ValueItem>
                <ValueItem label="Sumber ketentuan">{profile.source_document as string | undefined}</ValueItem>
                <ValueItem label="Catatan penanganan">{row.storage_notes}</ValueItem>
                <ValueItem label="Masa simpan">{row.shelf_life_days ? `${row.shelf_life_days} hari` : undefined}</ValueItem>
              </ValueGrid>
            ),
          },
          { id: "prices", label: "Harga acuan", content: <PriceSection product={row} onChanged={onChanged} /> },
          {
            id: "history",
            label: "Riwayat",
            content: (
              <HistoryList
                queryKey={key("products", row.id, "history", row.version)}
                path={`/master-data/products/${row.id}/history`}
              />
            ),
          },
        ]}
      />
    </OfficePage>
  );
}
