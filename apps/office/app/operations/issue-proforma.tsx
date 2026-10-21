"use client";
import { SalesNavigation, SalesBadge } from "./sales-experience";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { previewProformaSchema, type ProformaPreview } from "@evflow/contracts";
import { ArrowLeft, FileCheck2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import { DashboardSidebar } from "../dashboard-sidebar";
import { ExecutiveTopbar } from "../dashboard-executive";

import { Panel, Value } from "./sales-order";
import { ErrorBox } from "./workspace";
import { ProformaContents } from "./proforma";

export function ProformaDraftDetail({ orderId, batchId }: { orderId: string; batchId: string }) {
  const { principal, state } = useSession();
  const router = useRouter();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [freightEnabled, setFreightEnabled] = useState(false);
  const [freightAmount, setFreightAmount] = useState("0");
  const [freightTaxable, setFreightTaxable] = useState(false);
  const [freightTouched, setFreightTouched] = useState(false);
  const busy = useRef(false);
  const keys = useRef(new Map<string, string>());
  const allowed = !!principal && hasCompanyPermission(principal, "proforma.issue");
  const query = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      "proforma-preview",
      batchId,
    ],
    queryFn: ({ signal }) =>
      apiRequest<{ data: ProformaPreview }>(
        `/operations/fulfillment-batches/${batchId}/proforma-preview`,
        { signal },
      ),
    enabled: allowed,
    staleTime: 0,
    retry: false,
  });
  const preview = query.data?.data;
  const data = preview?.snapshot;
  const freightInput = {
    amount: freightEnabled ? freightAmount.trim() : "0",
    tax_mode: freightEnabled && freightTaxable ? "TAXABLE" : "NON_TAXABLE",
  };
  const freightValid = previewProformaSchema.safeParse({ freight: freightInput }).success;
  const freightBody = JSON.stringify({ freight: freightInput });
  const [settledFreightBody, setSettledFreightBody] = useState(freightBody);
  useEffect(() => {
    const timer = setTimeout(() => setSettledFreightBody(freightBody), 300);
    return () => clearTimeout(timer);
  }, [freightBody]);
  const freightQuery = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      "proforma-freight-preview",
      batchId,
      preview?.version,
      settledFreightBody,
    ],
    queryFn: ({ signal }) =>
      apiRequest<{ data: ProformaPreview }>(
        `/operations/fulfillment-batches/${batchId}/proforma-preview`,
        { method: "POST", signal, body: settledFreightBody },
      ),
    enabled:
      allowed && !!preview && freightTouched && freightValid && freightBody === settledFreightBody,
    retry: false,
    staleTime: 0,
  });
  const totalsPending =
    freightTouched &&
    (!freightValid ||
      freightBody !== settledFreightBody ||
      freightQuery.isFetching ||
      !freightQuery.data ||
      freightQuery.isError);
  useEffect(() => {
    if (!data?.freight || freightTouched) return;
    setFreightEnabled(Number(data.freight.amount) > 0);
    setFreightAmount(data.freight.amount);
    setFreightTaxable(!!data.freight.tax_snapshot);
  }, [data?.freight, freightTouched]);
  useEffect(() => {
    if (preview?.existing && !query.isFetching && !query.isError)
      router.replace(`/operations/proformas/${preview.existing.id}`);
  }, [preview?.existing, query.isFetching, query.isError, router]);
  const issue = async () => {
    if (!preview || busy.current || !allowed || totalsPending || query.isFetching) return;
    busy.current = true;
    setPending(true);
    setError("");
    const payload = JSON.stringify({
      version: freightTouched ? freightQuery.data!.data.version : preview.version,
      ...(freightTouched ? { freight: freightInput } : {}),
    });
    const key = keys.current.get(payload) ?? crypto.randomUUID();
    keys.current.set(payload, key);
    try {
      const result = await apiRequest<{ data: { id: string } }>(
        `/fulfillment-batches/${batchId}/issue-proforma`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: payload,
        },
      );
      await client.invalidateQueries({ queryKey: ["operations"] });
      toast.success("Proforma berhasil diterbitkan.");
      router.push(`/operations/proformas/${result.data.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Penerbitan belum terkonfirmasi. Muat ulang pratinjau.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  if (!principal || state !== "authenticated")
    return (
      <main>
        <p role="status">
          {state === "loading" ? "Memuat sesi…" : "Silakan masuk untuk meninjau Proforma."}
        </p>
        <Link href="/login">Masuk</Link>
      </main>
    );
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <DashboardSidebar principal={principal} activeView="sales" activeSection="sales" />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        <main className="executive-content crm-content otc-workspace so-workspace sales-sketch">
          <header className="executive-heading">
            <div>
              <nav aria-label="Breadcrumb" className="executive-breadcrumb">
                Sales &amp; Marketing /{" "}
                <Link href={`/operations/orders/${orderId}`}>Sales Order</Link> / Detail Proforma
              </nav>
              <h1>Detail Proforma</h1>
              <p>Rincian produk, alokasi, dan nilai Proforma.</p>
            </div>
            <SalesNavigation active="proformas" />
          </header>
          <Button className="sales-back" variant="outline" asChild>
            <Link href="/operations/proformas">← Kembali ke daftar</Link>
          </Button>
          {!allowed ? (
            <ErrorBox message="Anda tidak memiliki izin menerbitkan Proforma." />
          ) : (
            <>
              {query.isFetching && !data && <p role="status">Memuat pratinjau terbaru…</p>}
              {(query.isError || error) && (
                <ErrorBox
                  message={
                    error ||
                    (query.error instanceof Error
                      ? query.error.message
                      : "Pratinjau tidak dapat dimuat. Coba muat ulang data.")
                  }
                />
              )}
              {data && preview && !query.isError && (
                <>
                  <ProformaContents
                    review
                    beforeContent={
                      <Panel title="Konteks tahap">
                        <Value label="Sales Order">
                          {data.order_number} · {data.customer}
                        </Value>
                        <Value label="Tahap">{data.batch_number}</Value>
                        <Value label="Alokasi dimuat">
                          {query.dataUpdatedAt
                            ? new Date(query.dataUpdatedAt).toLocaleTimeString("id-ID")
                            : "Memuat"}
                        </Value>
                        <Button
                          variant="outline"
                          disabled={pending || query.isFetching}
                          onClick={() => void query.refetch()}
                        >
                          <RefreshCw />
                          Muat ulang alokasi
                        </Button>
                      </Panel>
                    }
                    asideContent={
                      <Panel title="Syarat penerbitan">
                        <Value label="Izin menerbitkan Proforma">
                          <SalesBadge>{allowed ? "Ada" : "Tidak ada"}</SalesBadge>
                        </Value>
                        <Value label="Alokasi tahap ini">
                          <SalesBadge>
                            {data.allocations.length ? "Ada" : "Belum ada stok yang dapat dipenuhi"}
                          </SalesBadge>
                        </Value>
                        <p className="sales-notice sales-warning">
                          {preview.existing
                            ? `Proforma ${preview.existing.number} sudah diterbitkan.`
                            : preview.supersedes
                              ? `Menggantikan ${preview.supersedes.number}; dokumen lama tetap tersimpan.`
                              : "Nomor dokumen diberikan setelah penerbitan berhasil."}
                        </p>
                      </Panel>
                    }
                    snapshot={
                      freightTouched && !totalsPending ? freightQuery.data!.data.snapshot : data
                    }
                    batchNumber={data.batch_number}
                    totalsPending={totalsPending}
                    freightControls={
                      <Panel title="Ongkos kirim" className="so-freight-card">
                        <div className="so-freight-controls">
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <p className="text-sm font-medium">Tambahkan ongkos kirim</p>
                              <p className="text-muted-foreground text-xs">
                                Nilai ini berlaku untuk pengiriman terkait.
                              </p>
                            </div>
                            <Switch
                              disabled={pending}
                              checked={freightEnabled}
                              onCheckedChange={(checked) => {
                                setFreightEnabled(checked);
                                setFreightTouched(true);
                              }}
                              aria-label="Aktifkan ongkos kirim Proforma"
                            />
                          </div>
                          {freightEnabled && (
                            <div className="mt-4 grid gap-3">
                              <label className="grid gap-2 text-sm font-medium">
                                Nominal ongkos kirim
                                <Input
                                  disabled={pending}
                                  inputMode="decimal"
                                  value={freightAmount}
                                  onChange={(e) => {
                                    setFreightAmount(e.target.value);
                                    setFreightTouched(true);
                                  }}
                                />
                              </label>
                              <div className="flex items-center justify-between rounded-lg border p-3">
                                <span className="text-sm font-medium">Kena PPN</span>
                                <Switch
                                  disabled={pending}
                                  checked={freightTaxable}
                                  onCheckedChange={(checked) => {
                                    setFreightTaxable(checked);
                                    setFreightTouched(true);
                                  }}
                                  aria-label="Ongkos kirim kena PPN"
                                />
                              </div>
                            </div>
                          )}
                          <div className="so-freight-status" aria-live="polite">
                            {freightTouched && !freightValid && (
                              <ErrorBox message="Isi nominal ongkos kirim dengan angka positif atau nol. Gunakan titik untuk desimal tanpa pemisah ribuan." />
                            )}
                            {freightTouched &&
                              freightValid &&
                              freightBody === settledFreightBody &&
                              freightQuery.isError && (
                                <div>
                                  <ErrorBox
                                    message={
                                      freightQuery.error instanceof Error
                                        ? freightQuery.error.message
                                        : "Ringkasan nilai gagal dihitung."
                                    }
                                  />
                                  <Button
                                    variant="outline"
                                    onClick={() => void freightQuery.refetch()}
                                  >
                                    Hitung ulang
                                  </Button>
                                </div>
                              )}
                            {freightTouched &&
                              freightValid &&
                              !freightQuery.isError &&
                              totalsPending && (
                                <p role="status">
                                  Menghitung ongkos kirim, PPN, dan total tagihan…
                                </p>
                              )}
                          </div>
                        </div>
                      </Panel>
                    }
                  />
                </>
              )}
            </>
          )}
          <div className="so-footer so-detail-actions">
            <Button variant="outline" asChild>
              <Link href={`/operations/orders/${orderId}`}>
                <ArrowLeft />
                Batal
              </Link>
            </Button>
            {allowed &&
              preview &&
              !query.isError &&
              (preview.existing ? (
                <Button asChild>
                  <Link href={`/operations/proformas/${preview.existing.id}`}>Buka Proforma</Link>
                </Button>
              ) : (
                <Button
                  disabled={
                    pending ||
                    query.isFetching ||
                    totalsPending ||
                    !!error ||
                    !data?.allocations.length
                  }
                  onClick={() => void issue()}
                >
                  <FileCheck2 />
                  {pending ? "Menerbitkan…" : "Terbitkan Proforma"}
                </Button>
              ))}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
