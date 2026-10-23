"use client";
import {
  Fragment,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/app/session-provider";
import { DashboardSidebar } from "@/app/dashboard-sidebar";
import { ExecutiveTopbar } from "@/app/dashboard-executive";
import "@/app/crm/crm.css";
import "./page-frame.css";

// Kerangka halaman Office: Daftar, Detail dan Form (docs/mockup/web-design-standard.md).
export { DataTable } from "@/app/crm/crm-common";

export type Crumb = { label: string; href?: string | undefined };
type Section = "master" | "sales" | "warehouse" | "finance" | "setting";

export function OfficePage({
  section,
  crumbs,
  title,
  subtitle,
  status,
  actions,
  children,
}: {
  section: Section;
  crumbs: Crumb[];
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const session = useSession(),
    router = useRouter();
  useEffect(() => {
    if (session.state === "anonymous") router.replace("/login?session=ended");
  }, [session.state, router]);
  if (!session.principal) return <p role="status">Memuat sesi…</p>;
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <a className="sr-only focus:not-sr-only" href="#page-main">
        Lewati navigasi
      </a>
      <DashboardSidebar principal={session.principal} activeView="executive" activeSection={section} />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={session.principal.company_name} />
        <main id="page-main" className="page-frame">
          <header className="page-frame-header">
            <div className="page-frame-heading">
              <Breadcrumb aria-label="Breadcrumb" className="page-frame-crumbs">
                <BreadcrumbList>
                  {crumbs.map((crumb, index) => (
                    <Fragment key={`${crumb.label}-${index}`}>
                      {index > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        {crumb.href && index < crumbs.length - 1 ? (
                          <BreadcrumbLink asChild>
                            <Link href={crumb.href}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        ) : index === crumbs.length - 1 ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          crumb.label
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="page-frame-title">
                <h1>{title}</h1>
                {status}
              </div>
              {subtitle && <p className="page-frame-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="page-frame-actions">{actions}</div>}
          </header>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Sub-submenu sebagai tab tautan (mis. Gudang › Lokator); setiap item memakai route dan izinnya sendiri.
export function SubNav({ items }: { items: { label: string; href: string; active: boolean }[] }) {
  if (items.length < 2) return null;
  return (
    <nav className="page-frame-subnav" aria-label="Sub menu">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

const stateLabels: Record<string, string> = {
  DRAFT: "Draf",
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  ARCHIVED: "Diarsipkan",
};
export function RecordBadge({ state, label }: { state: string; label?: string }) {
  return (
    <span className="page-frame-badge" data-tone={state}>
      {label ?? stateLabels[state] ?? state}
    </span>
  );
}

export function ValueItem({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="page-frame-value">
      <dt>{label}</dt>
      <dd data-empty={empty || undefined}>{empty ? "Belum tersedia" : children}</dd>
    </div>
  );
}

export function SummaryStrip({ children }: { children: ReactNode }) {
  return <dl className="page-frame-summary">{children}</dl>;
}

export function ValueGrid({ children }: { children: ReactNode }) {
  return <dl className="page-frame-values">{children}</dl>;
}

export function PageNotice({
  tone = "info",
  children,
  onRetry,
}: {
  tone?: "info" | "error";
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="page-frame-notice" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <span>{children}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

// Tab detail tersimpan di ?tab= agar dapat dibagikan dan bertahan saat kembali.
export function DetailTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
}) {
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const requested = params.get("tab");
  const active = tabs.some((tab) => tab.id === requested) ? requested! : tabs[0]!.id;
  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        const next = new URLSearchParams(params.toString());
        if (value === tabs[0]!.id) next.delete("tab");
        else next.set("tab", value);
        router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
      }}
      className="page-frame-tabs"
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="page-frame-panel">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function FormFrame({
  sections,
  onSubmit,
  submitting,
  cancelHref,
  dirty,
  submitLabel = "Simpan",
  aside,
  extraActions,
  footerNote,
}: {
  sections: { id: string; title: string; description?: string; content: ReactNode }[];
  onSubmit: () => void;
  submitting: boolean;
  cancelHref: string;
  dirty: boolean;
  submitLabel?: string;
  aside?: ReactNode;
  extraActions?: ReactNode;
  footerNote?: ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState(sections[0]?.id);
  const ids = sections.map((section) => section.id).join(",");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    ids.split(",").forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [ids]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <form
      className="page-frame-form web-form"
      noValidate
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <nav className="page-frame-form-nav" aria-label="Bagian formulir">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active === section.id ? "true" : undefined}
            onClick={() => setActive(section.id)}
          >
            {section.title}
          </a>
        ))}
      </nav>
      <div className="page-frame-form-body">
        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="page-frame-panel page-frame-section"
            aria-labelledby={`${section.id}-title`}
          >
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            {section.description && <p className="page-frame-subtitle">{section.description}</p>}
            {section.content}
          </section>
        ))}
        {aside}
      </div>
      <footer className="page-frame-form-footer">
        {footerNote && <span className="page-frame-subtitle page-frame-form-note">{footerNote}</span>}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // Navigasi klien tidak memicu beforeunload, jadi Batal meminta konfirmasi sendiri.
            if (!dirty || window.confirm("Perubahan belum disimpan. Tinggalkan formulir?"))
              router.push(cancelHref);
          }}
        >
          Batal
        </Button>
        {extraActions}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Menyimpan…" : submitLabel}
        </Button>
      </footer>
    </form>
  );
}

type HistoryEvent = {
  id: string;
  occurred_at: string;
  action: string;
  reason?: string | null;
  actor?: { display_name: string } | null;
};
const actionLabels: Record<string, string> = {
  created: "Dibuat",
  updated: "Diubah",
  active: "Diaktifkan",
  inactive: "Dinonaktifkan",
  archived: "Diarsipkan",
};
export function HistoryList({ queryKey, path }: { queryKey: unknown[]; path: string }) {
  const history = useQuery({
    queryKey,
    queryFn: () => apiRequest<{ data: HistoryEvent[] }>(path),
  });
  if (history.isPending) return <p role="status">Memuat riwayat…</p>;
  if (history.isError)
    return (
      <PageNotice tone="error" onRetry={() => void history.refetch()}>
        {history.error.message}
      </PageNotice>
    );
  if (!history.data.data.length) return <p className="page-frame-subtitle">Belum ada riwayat.</p>;
  return (
    <ol className="page-frame-history">
      {history.data.data.map((event) => (
        <li key={event.id}>
          <strong>{actionLabels[event.action.split(".").pop() ?? ""] ?? event.action}</strong>
          <span>
            {new Date(event.occurred_at).toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {event.actor ? ` · ${event.actor.display_name}` : ""}
          </span>
          {event.reason && <p>{event.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
