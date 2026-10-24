"use client";

import type { AuthPrincipal } from "@evflow/contracts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Boxes,
  ChartNoAxesCombined,
  ChevronDown,
  Info,
  ChevronRight,
  Database,
  LayoutDashboard,
  ChevronLeft,
  Settings,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import "./dashboard-sidebar.css";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toggleSidebarBranch } from "../lib/sidebar-state";
import type { DashboardView } from "../lib/navigation";
import {
  hasCompanyPermission,
  masterDataPermissions,
  masterDataRoutes,
  menuRoutes,
  settingPermissions,
  visibleDashboardViews,
  visibleModules,
} from "../lib/navigation";

const moduleIcons: Record<
  string,
  ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  "Sales & Marketing": ChartNoAxesCombined,
  "Warehouse & Logistik": Warehouse,
  Finance: Wallet,
  HRIS: Users,
  "Master Data": Database,
  Setting: Settings,
};

type NavigationPreference = { groups: Record<string, boolean>; branch: string; scroll: number };
// UI preferences only; no session credentials or business records are retained.
const navigationPreferences = new Map<string, NavigationPreference>();

function NavigationBranch({
  label,
  icon: Icon,
  active,
  open,
  onOpenChange,
  collapsed,
  flyoutOpen,
  onFlyoutChange,
  children,
}: {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collapsed: boolean;
  flyoutOpen: boolean;
  onFlyoutChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const button = (
    <SidebarMenuButton
      isActive={active}
      className="ev-sidebar-module"
      aria-label={`Buka ${label}`}
      tooltip={{ children: label, hidden: flyoutOpen || !collapsed }}
    >
      <Icon aria-hidden={true} />
      <span>{label}</span>
      <ChevronRight aria-hidden="true" className="ev-sidebar-chevron ml-auto" />
    </SidebarMenuButton>
  );
  return (
    <SidebarMenuItem>
      {collapsed ? (
        <Popover open={flyoutOpen} onOpenChange={onFlyoutChange}>
          <PopoverTrigger asChild>{button}</PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={12}
            collisionPadding={12}
            className="ev-sidebar-flyout"
            aria-label={label}
            onKeyDownCapture={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onFlyoutChange(false);
              }
            }}
          >
            <h2 className="ev-sidebar-flyout-title">{label}</h2>
            {children}
          </PopoverContent>
        </Popover>
      ) : (
        <Collapsible open={open} onOpenChange={onOpenChange}>
          <CollapsibleTrigger asChild>{button}</CollapsibleTrigger>
          <CollapsibleContent>{children}</CollapsibleContent>
        </Collapsible>
      )}
    </SidebarMenuItem>
  );
}

export function DashboardSidebar({
  principal,
  activeView,
  activeSection = "dashboard",
  preview = false,
  outboundStage,
}: {
  principal: AuthPrincipal;
  activeView: DashboardView;
  activeSection?: "dashboard" | "setting" | "sales" | "master" | "warehouse" | "finance";
  preview?: boolean;
  outboundStage?: string;
}) {
  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const scope = `${principal.user_id}:${principal.company_id}:${preview}`;
  const moduleLabel = {
    dashboard: "Dashboard",
    sales: "Sales & Marketing",
    master: "Master Data",
    warehouse: "Warehouse & Logistik",
    finance: "Finance",
    setting: "Setting",
  }[activeSection];
  const route = pathname?.replace(/^\/preview/, "").split("/")[2];
  const activeGroup = pathname?.includes("/crm/")
    ? "CRM"
    : (
        {
          orders: "Pesanan Pelanggan",
          proformas: "Pesanan Pelanggan",
          backorders: "Pesanan Pelanggan",
          "warehouse-backorders": "Barang Keluar",
          "pick-slips": "Barang Keluar",
          warehouse: "Barang Keluar",
          returns: "Barang Keluar",
          invoices: "Piutang (AR)",
          reconciliation: "Kas & Bank",
          "bank-statements": "Kas & Bank",
          accounting: "Akuntansi",
          accounts: "Akuntansi",
          "tax-rules": "Pajak",
          "tax-documents": "Pajak",
          "tax-input": "Pajak",
        } as Record<string, string>
      )[route ?? ""];
  const branch = `${moduleLabel}/${
    route === "backorders" && activeSection === "warehouse" ? "Barang Keluar" : (activeGroup ?? "")
  }`;
  const [groups, setGroups] = useState<Record<string, boolean>>({
    [moduleLabel]: true,
    ...(activeGroup ? { [branch]: true } : {}),
  });
  const [flyout, setFlyout] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const saved = navigationPreferences.get(scope) ?? { groups: {}, branch: "", scroll: 0 };
    const changed = saved.branch !== branch;
    if (changed) {
      saved.groups = {
        [moduleLabel]: true,
        ...(activeGroup ? { [branch]: true } : {}),
      };
      saved.branch = branch;
    }
    navigationPreferences.set(scope, saved);
    setGroups(saved.groups);
    setFlyout(null);
    const frame = requestAnimationFrame(() => {
      const content = contentRef.current;
      if (!content) return;
      content.scrollTop = saved.scroll;
      const active = content.querySelector('[aria-current="page"]');
      if (changed && active) {
        const bounds = content.getBoundingClientRect();
        const item = active.getBoundingClientRect();
        if (item.bottom > bounds.bottom) content.scrollTop += item.bottom - bounds.bottom;
        else if (item.top < bounds.top) content.scrollTop -= bounds.top - item.top;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [scope, branch, moduleLabel, activeGroup]);
  useLayoutEffect(() => {
    if (state !== "expanded" && !isMobile) return;
    const frame = requestAnimationFrame(() => {
      if (contentRef.current)
        contentRef.current.scrollTop = navigationPreferences.get(scope)?.scroll ?? 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [state, isMobile, scope]);
  function changeGroup(key: string, open: boolean) {
    setGroups((previous) => {
      const next = toggleSidebarBranch(previous, key, open);
      const saved = navigationPreferences.get(scope);
      if (saved) saved.groups = next;
      return next;
    });
  }
  function closeNavigation() {
    setOpenMobile(false);
    setFlyout(null);
  }
  const views = visibleDashboardViews(principal);
  const modules = visibleModules(principal);

  return (
    <Sidebar collapsible="icon" className="ev-sidebar" data-preview={preview || undefined}>
      <SidebarHeader className="ev-sidebar-brand">
        <Link
          href={preview ? "/preview/dashboard" : "/"}
          className="ev-sidebar-logo"
          aria-label="evflow Dashboard"
        >
          <img src="/evflow-logo.webp" alt="evflow" width={2000} height={699} />
        </Link>
        <button
          type="button"
          className="ev-sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={
            isMobile ? "Tutup menu" : state === "expanded" ? "Ciutkan sidebar" : "Perluas sidebar"
          }
        >
          {isMobile || state === "expanded" ? (
            <ChevronLeft aria-hidden="true" />
          ) : (
            <ChevronRight aria-hidden="true" />
          )}
        </button>
      </SidebarHeader>
      <SidebarContent
        ref={contentRef}
        className="ev-sidebar-content"
        onScroll={(event) => {
          const saved = navigationPreferences.get(scope);
          if (saved && (isMobile || state === "expanded"))
            saved.scroll = event.currentTarget.scrollTop;
        }}
      >
        <SidebarGroup>
          <nav aria-label="Navigasi utama">
            <SidebarMenu>
              {views.length > 0 && (
                <NavigationBranch
                  label="Dashboard"
                  icon={LayoutDashboard}
                  active={activeSection === "dashboard"}
                  open={!!groups.Dashboard}
                  onOpenChange={(open) => changeGroup("Dashboard", open)}
                  collapsed={!isMobile && state === "collapsed"}
                  flyoutOpen={flyout === "Dashboard"}
                  onFlyoutChange={(open) => {
                    if (open) changeGroup("Dashboard", true);
                    setFlyout(open ? "Dashboard" : null);
                  }}
                >
                  <SidebarMenuSub>
                    {views.map((view) => (
                      <SidebarMenuSubItem key={view.id}>
                        <Link
                          href={
                            preview
                              ? view.id === "executive"
                                ? "/preview/dashboard"
                                : `/preview/dashboard?view=${view.id}`
                              : view.id === "executive"
                                ? "/"
                                : `/?view=${view.id}`
                          }
                          aria-current={
                            activeSection === "dashboard" && activeView === view.id
                              ? "page"
                              : undefined
                          }
                          onClick={closeNavigation}
                          className="ev-sidebar-sub-link"
                        >
                          {view.label}
                        </Link>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </NavigationBranch>
              )}
              {modules.map((module) => {
                const Icon = moduleIcons[module.label] ?? Boxes;
                return (
                  <NavigationBranch
                    key={module.label}
                    label={module.label}
                    icon={Icon}
                    active={moduleLabel === module.label}
                    open={!!groups[module.label]}
                    onOpenChange={(open) => changeGroup(module.label, open)}
                    collapsed={!isMobile && state === "collapsed"}
                    flyoutOpen={flyout === module.label}
                    onFlyoutChange={(open) => {
                      if (open) changeGroup(module.label, true);
                      setFlyout(open ? module.label : null);
                    }}
                  >
                    <SidebarMenuSub>
                      {module.items.map((item) => {
                        if (
                          module.label === "Setting" &&
                          !hasCompanyPermission(principal, settingPermissions[item] ?? "")
                        )
                          return null;
                        const operational =
                          item === "Pesanan Pelanggan"
                            ? [
                                ["Sales Order", "orders", "sales_order.read"],
                                ["Proforma", "proformas", "proforma.read"],
                                ["Backorder & Sisa Pesanan", "backorders", "sales_backorder.read"],
                              ]
                            : item === "Barang Keluar"
                              ? [
                                  [
                                    "Backorder & Alokasi Stok",
                                    "warehouse-backorders",
                                    "warehouse_allocation.read",
                                  ],
                                  ["Pick Slip", "pick-slips", "outbound_picking.read"],
                                  [
                                    "Checking / Packing",
                                    "warehouse?stage=checking",
                                    "outbound_checking.read",
                                  ],
                                  [
                                    "Pengiriman",
                                    "warehouse?stage=shipping",
                                    "outbound_shipping.read",
                                  ],
                                  ["POD", "warehouse?stage=pod", "delivery_receipt.read"],
                                  ["Retur", "returns", "customer_return.receive"],
                                ]
                              : item === "Piutang (AR)"
                                ? []
                                : item === "Kas & Bank"
                                  ? [
                                      [
                                        "Rekonsiliasi",
                                        "reconciliation",
                                        "bank_reconciliation.read",
                                      ],
                                      ["Mutasi", "bank-statements", "bank_statement.import"],
                                    ]
                                  : item === "Akuntansi"
                                    ? [
                                        ["Akun", "accounts", "account.read"],
                                        [
                                          "Pengaturan Jurnal Otomatis",
                                          "accounting",
                                          "posting_profile.read",
                                        ],
                                      ]
                                    : item === "Pajak"
                                      ? [
                                          ["Daftar & Aturan Pajak", "tax-rules", "tax_master.read"],
                                          ["Faktur Keluaran", "tax-documents", "tax_output.read"],
                                          ["Faktur Masukan", "tax-input", "tax_input.read"],
                                        ]
                                      : [];
                        if (module.label === "Finance" && item === "Piutang (AR)")
                          return (
                            <SidebarMenuSubItem key={item}>
                              <Collapsible
                                open={!!groups[`${module.label}/${item}`]}
                                onOpenChange={(open) =>
                                  changeGroup(`${module.label}/${item}`, open)
                                }
                              >
                                <CollapsibleTrigger className="ev-sidebar-sub-link flex w-full items-center justify-between">
                                  {item}
                                  <ChevronDown className="size-3" aria-hidden="true" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <SidebarMenuSub>
                                    <SidebarMenuSubItem>
                                      {hasCompanyPermission(principal, "sales_invoice.read") ? (
                                        <Link
                                          href={`${preview ? "/preview" : ""}/operations/invoices`}
                                          className="ev-sidebar-sub-link"
                                          aria-current={
                                            pathname?.startsWith(
                                              `${preview ? "/preview" : ""}/operations/invoices`,
                                            )
                                              ? "page"
                                              : undefined
                                          }
                                          onClick={closeNavigation}
                                        >
                                          Invoice
                                        </Link>
                                      ) : null}
                                    </SidebarMenuSubItem>
                                  </SidebarMenuSub>
                                </CollapsibleContent>
                              </Collapsible>
                            </SidebarMenuSubItem>
                          );
                        if (operational.length && (!preview || item === "Pesanan Pelanggan"))
                          return (
                            <SidebarMenuSubItem key={item}>
                              <Collapsible
                                open={!!groups[`${module.label}/${item}`]}
                                onOpenChange={(open) =>
                                  changeGroup(`${module.label}/${item}`, open)
                                }
                              >
                                <CollapsibleTrigger className="ev-sidebar-sub-link flex w-full items-center justify-between">
                                  {item}
                                  <ChevronDown className="size-3" aria-hidden="true" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <SidebarMenuSub>
                                    {operational
                                      .filter(([, , permission]) =>
                                        preview
                                          ? permission === "sales_order.read" &&
                                            item === "Pesanan Pelanggan"
                                          : permission !== undefined &&
                                            hasCompanyPermission(principal, permission),
                                      )
                                      .filter(([, route]) => !preview || route === "orders")
                                      .map(([label, route]) => {
                                        const routeValue = route ?? "";
                                        const [routePath, routeQuery] = routeValue.split("?");
                                        const href = `${preview ? "/preview" : ""}/operations/${routePath}${routeQuery ? `?${routeQuery}` : ""}`;
                                        return (
                                          <SidebarMenuSubItem key={routeValue}>
                                            <Link
                                              href={href}
                                              className="ev-sidebar-sub-link"
                                              aria-current={
                                                pathname?.startsWith(
                                                  `${preview ? "/preview" : ""}/operations/${routePath}`,
                                                ) &&
                                                (!routeQuery ||
                                                  routeQuery === `stage=${outboundStage}`)
                                                  ? "page"
                                                  : undefined
                                              }
                                              onClick={closeNavigation}
                                            >
                                              {label}
                                            </Link>
                                          </SidebarMenuSubItem>
                                        );
                                      })}
                                  </SidebarMenuSub>
                                </CollapsibleContent>
                              </Collapsible>
                            </SidebarMenuSubItem>
                          );
                        if (module.label === "Sales & Marketing" && item === "CRM") {
                          if (
                            !["crm_prospect", "crm_contact", "crm_opportunity"].some((resource) =>
                              hasCompanyPermission(principal, `${resource}.read`),
                            )
                          )
                            return null;
                          return (
                            <SidebarMenuSubItem key={item}>
                              <Collapsible
                                open={!!groups[`${module.label}/${item}`]}
                                onOpenChange={(open) =>
                                  changeGroup(`${module.label}/${item}`, open)
                                }
                              >
                                <CollapsibleTrigger className="ev-sidebar-sub-link flex w-full items-center justify-between">
                                  CRM
                                  <ChevronDown className="size-3" aria-hidden="true" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <SidebarMenuSub>
                                    {[
                                      ["Prospek", "prospects"],
                                      ["Peluang", "opportunities"],
                                      ["Kontak", "contacts"],
                                    ]
                                      .filter(([, key]) =>
                                        hasCompanyPermission(
                                          principal,
                                          `${key === "opportunities" ? "crm_opportunity" : key === "contacts" ? "crm_contact" : "crm_prospect"}.read`,
                                        ),
                                      )
                                      .map(([label, key]) => {
                                        const href = preview
                                          ? `/preview/crm/${key}`
                                          : `/crm/${key}`;
                                        return (
                                          <SidebarMenuSubItem key={key}>
                                            <Link
                                              href={href}
                                              className="ev-sidebar-sub-link"
                                              aria-current={
                                                pathname?.startsWith(href) ? "page" : undefined
                                              }
                                              onClick={closeNavigation}
                                            >
                                              {label}
                                            </Link>
                                          </SidebarMenuSubItem>
                                        );
                                      })}
                                  </SidebarMenuSub>
                                </CollapsibleContent>
                              </Collapsible>
                            </SidebarMenuSubItem>
                          );
                        }
                        const master =
                          module.label === "Master Data" ? masterDataRoutes[item] : undefined;
                        if (
                          module.label === "Master Data" &&
                          masterDataPermissions[item] &&
                          !hasCompanyPermission(principal, `${masterDataPermissions[item]}.read`)
                        )
                          return null;
                        const controlPermission = (
                          {
                            "Kredit & TOP Pelanggan": "customer.payment_policy.manage",
                            "Pengaturan Persetujuan": "transaction_approval.manage",
                            "Kredit & Exposure": "customer.payment_policy.manage",
                            Persediaan: "inventory.quality.decide",
                          } as Record<string, string>
                        )[item];
                        const controlAllowed =
                          controlPermission && hasCompanyPermission(principal, controlPermission);
                        const settingHref =
                          module.label === "Setting"
                            ? menuRoutes.Setting![item]
                            : controlAllowed && !preview
                              ? "/operations/controls"
                              : module.label === "Master Data" && item === "Pelanggan" && preview
                                ? "/preview/crm/customers"
                                : master;
                        // CFG-10: a submenu without a working screen is not shown at all.
                        if (!settingHref) return null;
                        return (
                          <SidebarMenuSubItem
                            key={item}
                            className="text-muted-foreground px-2 py-1.5 text-xs"
                          >
                            {
                              <Link
                                href={settingHref}
                                onClick={closeNavigation}
                                aria-current={
                                  settingHref === "/setting/roles"
                                    ? pathname?.startsWith("/setting/roles") ||
                                      pathname?.startsWith("/setting/matrix")
                                      ? "page"
                                      : undefined
                                    : pathname === settingHref ||
                                        ((settingHref === "/setting/users" ||
                                          settingHref.startsWith("/master-data/")) &&
                                          pathname?.startsWith(`${settingHref}/`))
                                      ? "page"
                                      : undefined
                                }
                                className="ev-sidebar-sub-link"
                              >
                                {item}
                              </Link>
                            }
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </NavigationBranch>
                );
              })}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="ev-sidebar-footer">
        <button
          type="button"
          className="ev-sidebar-help"
          aria-label="Pusat bantuan"
          onClick={() =>
            toast.info("Hubungi administrator perusahaan untuk bantuan akses dan penggunaan.")
          }
        >
          <Info aria-hidden="true" />
          <span>Pusat bantuan</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
