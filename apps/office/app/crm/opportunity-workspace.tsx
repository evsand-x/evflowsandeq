"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { DashboardSidebar } from "../dashboard-sidebar";
import { ExecutiveTopbar } from "../dashboard-executive";
import { useSession } from "../session-provider";
import { DataTable } from "./crm-common";
import "./crm.css";

type Opportunity = {
  id: string;
  code: string;
  period: string;
  state: string;
  prospect_id: string | null;
  notes: string | null;
  customer: { id: string; code: string; name: string };
};

export function OpportunityWorkspace() {
  const { principal, state } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const can = (permission: string) => !!principal && hasCompanyPermission(principal, permission);
  useEffect(() => {
    if (state === "anonymous") router.replace("/login?session=ended");
  }, [state, router]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useQuery({
    queryKey: [
      "crm-opportunity-list",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      query,
      page,
    ],
    enabled: can("crm_opportunity.read"),
    queryFn: ({ signal }) =>
      apiRequest<{ data: Opportunity[]; total: number }>(
        `/crm/workspace/opportunities?q=${encodeURIComponent(query)}&page=${page}`,
        { signal },
      ),
  });
  const columns: ColumnDef<Opportunity>[] = [
    { accessorKey: "code", header: "Kode peluang" },
    {
      id: "customer",
      header: "Pelanggan",
      cell: ({ row: { original: row } }) =>
        can("master_customer.read") ? (
          <Link className="crm-record-link" href={`/master-data/customers/${row.customer.id}`}>
            {row.customer.name}
          </Link>
        ) : (
          row.customer.name
        ),
    },
    { accessorKey: "period", header: "Periode" },
    {
      accessorKey: "state",
      header: "Status",
      cell: ({ row }) =>
        ({
          DRAFT: "Draf",
          ACTIVE: "Aktif",
          WON: "Menang",
          LOST: "Kalah",
          EXPIRED: "Kedaluwarsa",
          CLOSED: "Ditutup",
        })[row.original.state] ?? row.original.state,
    },
    { accessorKey: "notes", header: "Catatan", cell: ({ row }) => row.original.notes || "—" },
    {
      id: "source",
      header: "Prospek sumber",
      cell: ({ row: { original: row } }) =>
        row.prospect_id && can("crm_prospect.read") ? (
          <Link
            className="crm-record-link"
            href={`/crm/prospects/${row.prospect_id}/opportunities`}
          >
            Buka prospek
          </Link>
        ) : (
          "—"
        ),
    },
  ];
  if (!principal)
    return (
      <main role={state === "error" ? "alert" : "status"}>
        {state === "error" ? "Sesi belum dapat dimuat." : "Memuat sesi…"}
      </main>
    );
  return (
    <SidebarProvider
      className="executive-shell"
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <a className="sr-only focus:not-sr-only" href="#opportunity-main">
        Lewati navigasi
      </a>
      <DashboardSidebar principal={principal} activeView="executive" activeSection="sales" />
      <SidebarInset className="min-w-0">
        <ExecutiveTopbar companyName={principal.company_name} />
        <main id="opportunity-main" className="executive-content crm-content">
          <header className="executive-heading">
            <div>
              <nav className="executive-breadcrumb" aria-label="Breadcrumb">
                Sales &amp; Marketing / CRM / <span aria-current="page">Peluang</span>
              </nav>
              <h1>Peluang</h1>
            </div>
          </header>
          <nav className="crm-section-nav" aria-label="Bagian CRM">
            {can("crm_prospect.read") && <Link href="/crm/prospects">Prospek</Link>}
            <Link href="/crm/opportunities" aria-current="page">
              Peluang
            </Link>
            {can("crm_contact.read") && <Link href="/crm/contacts">Kontak</Link>}
          </nav>
          {!can("crm_opportunity.read") ? (
            <p role="alert">Anda tidak memiliki izin melihat Peluang.</p>
          ) : (
            <>
              {list.isError && (
                <p role="alert">
                  {list.error.message}{" "}
                  <Button variant="outline" onClick={() => void list.refetch()}>
                    Coba lagi
                  </Button>
                </p>
              )}
              <DataTable
                data={list.data?.data ?? []}
                columns={columns}
                total={list.data?.total ?? 0}
                page={page}
                onPage={setPage}
                busy={list.isFetching}
                label="peluang"
                toolbar={
                  <Input
                    aria-label="Cari peluang"
                    placeholder="Cari kode peluang atau pelanggan…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                }
              />
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
