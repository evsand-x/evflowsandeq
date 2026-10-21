"use client";

import type { DashboardSummary } from "@evflow/contracts";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type CSSProperties } from "react";
import { ApiError, apiRequest } from "../lib/api";
import {
  dashboardViews,
  hasCompanyPermission,
  visibleDashboardViews,
  type DashboardView,
} from "../lib/navigation";
import { DashboardSidebar } from "./dashboard-sidebar";
import { ExecutiveDashboard, ExecutiveTopbar } from "./dashboard-executive";
import { useSession } from "./session-provider";
import { SalesDashboard } from "./dashboard-sales";
import { WarehouseDashboard } from "./dashboard-warehouse";
import { FinanceDashboard } from "./dashboard-finance";
import { HrisDashboard } from "./dashboard-hris";
import { ActionsDashboard } from "./dashboard-actions";
import { ReportsDashboard } from "./dashboard-reports";

function DashboardContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, principal, reload } = useSession();

  useEffect(() => {
    if (state === "anonymous") router.replace("/login?session=ended");
  }, [router, state]);

  const summary = useQuery({
    queryKey: [
      "dashboard",
      "summary",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
    ],
    queryFn: () => apiRequest<{ data: DashboardSummary }>("/dashboard/summary"),
    enabled:
      state === "authenticated" &&
      Boolean(principal) &&
      hasCompanyPermission(principal!, "dashboard_executive.read"),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (summary.error instanceof ApiError && summary.error.status === 401) void reload();
  }, [reload, summary.error]);

  if (state === "error") {
    return (
      <main
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-sm"
      >
        <span>Layanan sesi belum dapat dijangkau.</span>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Coba lagi
        </Button>
      </main>
    );
  }
  if (state !== "authenticated" || !principal) {
    return (
      <main
        role="status"
        className="text-muted-foreground flex min-h-dvh items-center justify-center text-sm"
      >
        Menyiapkan akses…
      </main>
    );
  }

  const allowedViews = visibleDashboardViews(principal);
  const requested = params.get("view");
  const selected = (allowedViews.find((view) => view.id === requested)?.id ??
    allowedViews[0]?.id ??
    "executive") as DashboardView;
  const label = dashboardViews.find((view) => view.id === selected)?.label ?? "Ringkasan Eksekutif";
  const data = summary.data?.data;

  return (
    <SidebarProvider
      className="executive-shell modern-dashboard"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <a
        href="#dashboard-main"
        className="bg-card text-primary sr-only rounded-sm p-2 focus:not-sr-only focus:absolute focus:z-50 focus:m-2"
      >
        Lewati navigasi
      </a>
      <DashboardSidebar principal={principal} activeView={selected} />
      <SidebarInset className="bg-background min-h-dvh min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        {!allowedViews.length ? (
          <main id="dashboard-main" className="p-8" role="status">
            Anda belum memiliki izin untuk tampilan Dashboard. Hubungi Admin Sistem untuk mengatur
            peran Anda.
          </main>
        ) : selected === "executive" ? (
          <ExecutiveDashboard
            name={principal.display_name}
            principal={principal}
            asOf={data?.as_of}
            loading={summary.isPending}
            failed={summary.isError}
            onRefresh={() => void summary.refetch()}
          />
        ) : selected === "sales" ? (
          <SalesDashboard principal={principal} />
        ) : selected === "warehouse" ? (
          <WarehouseDashboard principal={principal} />
        ) : selected === "finance" ? (
          <FinanceDashboard principal={principal} />
        ) : selected === "hris" ? (
          <HrisDashboard principal={principal} />
        ) : selected === "actions" ? (
          <ActionsDashboard principal={principal} />
        ) : selected === "reports" ? (
          <ReportsDashboard principal={principal} />
        ) : (
          <section
            id="dashboard-main"
            tabIndex={-1}
            className="p-8"
            aria-labelledby="dashboard-view-title"
          >
            <h1 id="dashboard-view-title" className="text-xl font-semibold">
              {label}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Tampilan ini belum tersedia pada sumber data dashboard saat ini.
            </p>
          </section>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main role="status" className="text-muted-foreground p-6 text-sm">
          Menyiapkan Dashboard…
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
