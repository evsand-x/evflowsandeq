"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ActionQueueData } from "@evflow/contracts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/api";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "@/app/session-provider";
import { IconBell, IconChevronDown, IconLogOut, IconUser } from "./icons";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

// Notifikasi diturunkan dari Tugas & Persetujuan; tanpa izin itu tidak ada angka yang ditampilkan.
export function NotificationsMenu({ preview = false }: { preview?: boolean }) {
  const { principal } = useSession();
  const allowed = !!principal && hasCompanyPermission(principal, "dashboard_actions.read");
  const month = new Date().toISOString().slice(0, 7);
  const tasks = useQuery({
    queryKey: ["topbar-notifications", principal?.company_id, principal?.user_id, principal?.permissions, month],
    queryFn: () =>
      apiRequest<{ data: ActionQueueData }>(
        `/dashboard/actions?month=${month}&tab=followups&limit=5`,
      ).then((r) => r.data),
    enabled: allowed && !preview,
    staleTime: 60_000,
  });
  const overdue = tasks.data?.metrics.overdue;
  const count = overdue?.freshness === "fresh" ? (overdue.value ?? 0) : 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ev-topbar-button"
          aria-label={count ? `Notifikasi, ${count} tugas lewat waktu` : "Notifikasi"}
        >
          <IconBell size={20} />
          {count > 0 && <span className="ev-topbar-count">{count > 99 ? "99+" : count}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="ev-topbar-popover ev-notifications">
        <div className="ev-notifications-head">
          <strong>Notifikasi</strong>
          {allowed && (
            <Link href={preview ? "/preview/dashboard?view=actions" : "/?view=actions"}>
              Buka Tugas &amp; Persetujuan
            </Link>
          )}
        </div>
        {!allowed ? (
          <p className="ev-notifications-empty">
            Notifikasi tugas memerlukan izin Tugas &amp; Persetujuan.
          </p>
        ) : preview ? (
          <p className="ev-notifications-empty">Pratinjau tidak memuat tugas dari server.</p>
        ) : tasks.isPending ? (
          <p className="ev-notifications-empty" role="status">
            Memuat tugas…
          </p>
        ) : tasks.isError ? (
          <p className="ev-notifications-empty" role="alert">
            Tugas tidak termuat. {tasks.error.message}
          </p>
        ) : tasks.data.status === "unavailable" ? (
          <p className="ev-notifications-empty">{tasks.data.reason}</p>
        ) : tasks.data.items.length === 0 ? (
          <p className="ev-notifications-empty">Tidak ada tindak lanjut yang menunggu bulan ini.</p>
        ) : (
          <ul className="ev-notifications-list">
            {tasks.data.items.map((item) => {
              const body = (
                <>
                  <span className="ev-notification-dot" data-status={item.status} aria-hidden="true" />
                  <span>
                    <strong>{item.title}</strong>
                    <span>
                      {item.party} ·{" "}
                      {item.status === "overdue" ? "lewat waktu" : "akan datang"}{" "}
                      {new Date(item.due_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {item.destination ? (
                    <Link className="ev-notification" href={item.destination}>
                      {body}
                    </Link>
                  ) : (
                    <div className="ev-notification">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function AccountMenu({ preview = false }: { preview?: boolean }) {
  const { principal, logout } = useSession();
  const [loggingOut, setLoggingOut] = useState(false),
    pending = useRef(false);
  if (!principal) return null;
  const roles = principal.roles.map((role) => role.name).join(", ");
  async function handleLogout(confirmed = false) {
    if (pending.current) return;
    // Layar dengan perubahan belum tersimpan dapat menahan logout lewat event ini.
    if (
      !confirmed &&
      !window.dispatchEvent(
        new CustomEvent("evflow:before-logout", {
          cancelable: true,
          detail: { proceed: () => void handleLogout(true) },
        }),
      )
    )
      return;
    if (preview) {
      toast.info("Pratinjau memakai data simulasi. Keluar tersedia pada sesi aplikasi yang sebenarnya.");
      return;
    }
    pending.current = true;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      toast.error("Keluar belum berhasil. Periksa koneksi lalu coba lagi.");
    } finally {
      pending.current = false;
      setLoggingOut(false);
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ev-topbar-button ev-topbar-account"
          aria-label={loggingOut ? "Keluar…" : `Menu akun ${principal.display_name}`}
          disabled={loggingOut}
        >
          <span className="ev-topbar-avatar" aria-hidden="true">
            {initials(principal.display_name)}
          </span>
          <span className="ev-topbar-identity">
            <strong>{loggingOut ? "Keluar…" : principal.display_name}</strong>
            <span title={roles}>{roles}</span>
          </span>
          <IconChevronDown size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="ev-account-menu">
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="ev-account-profile"
            aria-label="Buka profil saya"
            title="Buka profil saya"
            onSelect={() => toast.info("Halaman Profil Saya belum tersedia.")}
          >
            <span className="ev-topbar-avatar ev-topbar-avatar-lg" aria-hidden="true">
              {initials(principal.display_name)}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toast.info("Halaman Profil Saya belum tersedia.")}>
            <IconUser />
            Profil saya
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="ev-account-logout"
            disabled={loggingOut}
            onSelect={() => void handleLogout()}
          >
            <IconLogOut />
            {loggingOut ? "Keluar…" : "Keluar"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
