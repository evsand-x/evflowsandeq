"use client";

import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "../dashboard-sidebar";
import { useSession } from "../session-provider";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode, type CSSProperties } from "react";
import { ExecutiveTopbar } from "../dashboard-executive";
import { hasCompanyPermission } from "@/lib/navigation";

export function SettingShell({
  children,
  permission,
  matrix = false,
}: {
  children: ReactNode;
  permission: string | string[];
  matrix?: boolean;
}) {
  const { state, principal } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (state === "anonymous") router.replace("/login?session=ended");
  }, [router, state]);
  if (state === "error")
    return (
      <main role="alert" className="p-6 text-sm">
        Layanan sesi belum dapat dijangkau.{" "}
        <Button variant="outline" onClick={() => window.location.reload()}>
          Coba lagi
        </Button>
      </main>
    );
  if (state !== "authenticated" || !principal)
    return (
      <main role="status" className="text-muted-foreground p-6 text-sm">
        Menyiapkan akses…
      </main>
    );
  if (
    !(Array.isArray(permission) ? permission : [permission]).every((code) =>
      hasCompanyPermission(principal, code),
    )
  )
    return (
      <main role="alert" className="p-6 text-sm">
        Anda tidak memiliki hak akses ke halaman ini.
      </main>
    );
  return (
    <SidebarProvider className="executive-shell" style={{ "--sidebar-width": "248px" } as CSSProperties}>
      <DashboardSidebar principal={principal} activeView="executive" activeSection="setting" />
      <SidebarInset className="bg-background min-h-dvh min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        <main
          className={
            matrix
              ? "permission-matrix-main"
              : "mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8"
          }
        >
          {!matrix && (
            <div className="text-muted-foreground mb-4 flex items-center gap-2 text-xs">
              <SidebarTrigger className="size-8 rounded-sm" aria-label="Buka atau tutup menu" />
              <span>Setting</span>
            </div>
          )}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
