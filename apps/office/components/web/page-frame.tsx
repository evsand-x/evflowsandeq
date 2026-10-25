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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconClose, IconFilter } from "./icons";
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
  meta,
  actions,
  tabs,
  children,
}: {
  section: Section;
  crumbs: Crumb[];
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  /** Deret status dokumen di bawah subjudul pita (mis. status pesanan, pemenuhan). */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Tab sub-menu di dasar pita (pola daftar canvas); panel isi mulai di bawah pita. */
  tabs?: ReactNode;
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
      <DashboardSidebar
        principal={session.principal}
        activeView="executive"
        activeSection={section}
      />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={session.principal.company_name} />
        <main id="page-main" className="page-frame" data-band-tabs={tabs ? "" : undefined}>
          <header className="page-frame-header page-frame-band">
            <svg
              className="page-frame-band-mark"
              viewBox="0 0 400 400"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M250 36C150 36 64 112 64 214c0 92 70 160 168 160-70-14-118-76-118-156 0-88 60-160 136-182z"
                fill="#ffffff"
                fillOpacity="0.07"
              />
              <path
                d="M286 30c64 26 104 92 104 166 0 104-84 184-188 184"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.16"
                strokeWidth="3"
              />
            </svg>
            <div className="page-frame-heading">
              <Breadcrumb aria-label="Breadcrumb" className="page-frame-crumbs">
                <BreadcrumbList>
                  {crumbs.map((crumb, index) => (
                    <Fragment key={`${crumb.label}-${index}`}>
                      {index > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
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
              {meta && <dl className="page-frame-meta">{meta}</dl>}
            </div>
            {actions && <div className="page-frame-actions">{actions}</div>}
            {tabs && <div className="page-frame-band-tabs">{tabs}</div>}
          </header>
          <div className="page-frame-body">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Filter daftar dalam popup; angka di tombol menunjukkan filter aktif selain pencarian.
export function FilterPopover({
  count,
  onReset,
  resultLabel,
  children,
}: {
  count: number;
  onReset: () => void;
  /** Bila diisi, popup memakai footer canvas: Hapus filter | Tampilkan N … (menutup popup). */
  resultLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="page-frame-filter-trigger">
          <IconFilter />
          Filter
          {count > 0 && <span className="page-frame-filter-count">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        avoidCollisions={false}
        className="page-frame-filter-panel"
      >
        <div className="page-frame-filter-head">
          <strong>Filter</strong>
          {!resultLabel && count > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              Hapus filter
            </Button>
          )}
          {resultLabel && (
            <Button
              variant="ghost"
              size="icon"
              className="page-frame-filter-close"
              aria-label="Tutup filter"
              onClick={() => setOpen(false)}
            >
              <IconClose aria-hidden="true" />
            </Button>
          )}
        </div>
        <div className="page-frame-filter-fields">{children}</div>
        {resultLabel && (
          <div className="page-frame-filter-foot">
            <Button variant="ghost" onClick={onReset} disabled={count === 0}>
              Hapus filter
            </Button>
            <Button onClick={() => setOpen(false)}>{resultLabel}</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Grup chip pilih-satu di popup Filter (canvas Supplier-list); klik chip aktif mengembalikan ke "ALL".
export function FilterChips({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: string;
  options: { id: string; label: string; count?: number | undefined }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="page-frame-chip-group">
      <legend>{legend}</legend>
      <div>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="page-frame-chip"
            aria-pressed={value === option.id}
            onClick={() => onChange(value === option.id ? "ALL" : option.id)}
          >
            {option.label}
            {option.count != null && <span>{option.count}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// Baris "Filter aktif" di bawah toolbar; tiap chip menghapus satu filter.
export function ActiveFilters({
  items,
}: {
  items: { key: string; label: string; onRemove: () => void }[];
}) {
  if (!items.length) return null;
  return (
    <div className="page-frame-active-filters">
      <span>Filter aktif:</span>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="page-frame-chip"
          aria-pressed="true"
          aria-label={`Hapus filter ${item.label}`}
          onClick={item.onRemove}
        >
          {item.label}
          <IconClose aria-hidden="true" />
        </button>
      ))}
    </div>
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

export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="page-frame-meta-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
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
  settingsHref,
}: {
  tone?: "info" | "error";
  children: ReactNode;
  onRetry?: () => void;
  /** Setting page that fixes the problem (problem.settings_href). */
  settingsHref?: string | undefined;
}) {
  return (
    <div
      className="page-frame-notice"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <span>{children}</span>
      {settingsHref && (
        <Button asChild variant="outline" size="sm">
          <Link href={settingsHref}>Buka pengaturan</Link>
        </Button>
      )}
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
  tabs: { id: string; label: string; count?: number | undefined; content: ReactNode }[];
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
            {!!tab.count && <span className="page-frame-tab-count">{tab.count}</span>}
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
        {footerNote && (
          <span className="page-frame-subtitle page-frame-form-note">{footerNote}</span>
        )}
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
