"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LayoutDashboard, LogOut, Menu, Search, Ticket, UserRound, X } from "lucide-react";
import type { StaffSnapshot } from "@showbuzz/schemas/staff";
import { cn } from "@showbuzz/utils/cn";
import { flattenNav, type NavGroup, type NavItem } from "@/lib/nav";
import { CommandPalette } from "./CommandPalette";
import { NAV_ICONS } from "./icons";

interface ConsoleShellProps {
  staff: StaffSnapshot;
  /** Already filtered to what this staff member may open. */
  nav: NavGroup[];
  children: ReactNode;
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Console chrome from the prototype (admin/assets/js/app.js): top bar with brand, search (Ctrl+K), notifications
 * and profile menu; a second row of dropdown menus on desktop; a drawer and bottom tab bar on mobile.
 */
export function ConsoleShell({ staff, nav, children }: ConsoleShellProps) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Open state remembers the path it was opened on, so navigating closes it without an effect.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawerOpen = drawerPath === pathname;
  const pages = flattenNav(nav);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen flex-col pb-16 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-admin-border bg-white/95 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4 lg:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-admin-indigo text-white shadow-sm sm:h-9 sm:w-9">
              <Ticket className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-black tracking-tight text-admin-dark sm:text-base">ShowBuzz</span>
              <span className="mt-0.5 text-[9px] font-bold tracking-wider whitespace-nowrap text-admin-coral uppercase sm:text-[10px]">
                Admin Console
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="mx-4 hidden max-w-md flex-1 items-center gap-2 rounded-xl border border-admin-border bg-slate-50 px-3 py-2 text-left text-xs text-admin-subtle hover:border-slate-300 md:flex"
          >
            <Search className="h-4 w-4" aria-hidden />
            <span className="flex-1">Search pages…</span>
            <kbd className="rounded border border-admin-border bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-admin-muted">
              Ctrl K
            </kbd>
          </button>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="rounded-xl p-2 text-admin-muted hover:bg-slate-100 hover:text-admin-dark md:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              href="/notifications"
              className="relative rounded-xl p-2 text-admin-muted hover:bg-slate-100 hover:text-admin-dark"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Link>
            <ProfileMenu staff={staff} />
            <button
              type="button"
              onClick={() => setDrawerPath(pathname)}
              className="rounded-xl p-2 text-admin-muted hover:bg-slate-100 hover:text-admin-dark lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav aria-label="Main" className="hidden border-t border-slate-100 px-4 lg:block lg:px-8">
          <ul className="flex items-center gap-1 py-1.5">
            {nav.map((group) => (
              <li key={group.id}>
                <TopNavGroup group={group} pathname={pathname} />
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="w-full flex-1 space-y-5 overflow-x-hidden p-3.5 sm:space-y-6 sm:p-6 lg:p-8">{children}</main>

      <footer className="hidden border-t border-admin-border bg-white px-8 py-4 text-[11px] text-admin-subtle lg:block">
        ShowBuzz Admin · Staff-only console
      </footer>

      <MobileTabBar pages={pages} pathname={pathname} onMenu={() => setDrawerPath(pathname)} />
      <MobileDrawer open={drawerOpen} nav={nav} pathname={pathname} onClose={() => setDrawerPath(null)} />
      <CommandPalette open={paletteOpen} pages={pages} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function TopNavGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (value: boolean | ((current: boolean) => boolean)) =>
    setOpenPath((current) => ((typeof value === "function" ? value(current === pathname) : value) ? pathname : null));
  const ref = useRef<HTMLDivElement>(null);
  const Icon = NAV_ICONS[group.icon];
  const linkClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold whitespace-nowrap text-admin-muted transition-colors hover:bg-slate-50 hover:text-admin-indigo",
      active && "bg-admin-active text-admin-indigo",
    );

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!group.children) {
    return (
      <Link href={group.href ?? "/dashboard"} className={linkClass(isActive(pathname, group.href ?? ""))}>
        <Icon className="h-4 w-4" aria-hidden />
        <span>{group.label}</span>
      </Link>
    );
  }

  const active = group.children.some((item) => isActive(pathname, item.href));
  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
    >
      <button type="button" className={linkClass(active)} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon className="h-4 w-4" aria-hidden />
        <span>{group.label}</span>
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-50 pt-1">
          <ul className="min-w-60 rounded-xl border border-admin-border bg-white p-1.5 shadow-dropdown">
            {group.children.map((item) => (
              <li key={item.id}>
                <DropdownLink item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DropdownLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-admin-text hover:bg-admin-active hover:font-semibold hover:text-admin-indigo",
        active && "bg-admin-active font-semibold text-admin-indigo",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", active ? "text-admin-indigo" : "text-admin-muted")} aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}

function ProfileMenu({ staff }: { staff: StaffSnapshot }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = staff.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    // Only this route can revoke the session (the refresh cookie never reaches pages or actions).
    await fetch("/api/v1/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/login");
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2.5 rounded-xl p-1 hover:bg-slate-50 lg:border-l lg:border-admin-border lg:pl-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-admin-active text-xs font-black text-admin-indigo">
          {initials}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block text-xs leading-tight font-bold text-admin-dark">{staff.name}</span>
          <span className="block text-[10px] text-admin-subtle">{staff.role.name}</span>
        </span>
        <ChevronDown className="hidden h-3 w-3 text-admin-subtle lg:block" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-admin-border bg-white p-1.5 text-xs shadow-dropdown">
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="truncate font-bold text-admin-dark">{staff.name}</div>
            <div className="truncate text-[11px] text-admin-subtle">{staff.email}</div>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-admin-text hover:bg-admin-active hover:text-admin-indigo"
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden /> My Profile
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-admin-danger hover:bg-red-50 disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden /> {signingOut ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Prototype bottom tabs: Dashboard, Movies, Bookings, Shows (those the role can open) + Menu. */
const TAB_IDS = ["movies", "bookings", "shows"];

function MobileTabBar({ pages, pathname, onMenu }: { pages: NavItem[]; pathname: string; onMenu: () => void }) {
  const tabs = TAB_IDS.flatMap((id) => pages.filter((page) => page.id === id));
  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-admin-muted",
      active && "font-bold text-admin-indigo",
    );
  return (
    <nav
      aria-label="Quick"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-admin-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <Link href="/dashboard" className={tabClass(isActive(pathname, "/dashboard"))}>
        <LayoutDashboard className="h-5 w-5" aria-hidden />
        Home
      </Link>
      {tabs.map((tab) => {
        const Icon = NAV_ICONS[tab.icon];
        return (
          <Link key={tab.id} href={tab.href} className={tabClass(isActive(pathname, tab.href))}>
            <Icon className="h-5 w-5" aria-hidden />
            {tab.label.split(" ")[0]}
          </Link>
        );
      })}
      <button type="button" onClick={onMenu} className={tabClass(false)}>
        <Menu className="h-5 w-5" aria-hidden />
        Menu
      </button>
    </nav>
  );
}

function MobileDrawer({
  open,
  nav,
  pathname,
  onClose,
}: {
  open: boolean;
  nav: NavGroup[];
  pathname: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close menu" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-white shadow-modal">
        <div className="flex items-center justify-between border-b border-admin-border p-4">
          <span className="text-sm font-black text-admin-dark">Menu</span>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-admin-muted hover:bg-slate-100">
            <X className="h-5 w-5" aria-label="Close menu" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {nav.map((group) => {
            const Icon = NAV_ICONS[group.icon];
            if (!group.children) {
              const href = group.href ?? "/dashboard";
              return (
                <Link
                  key={group.id}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold",
                    isActive(pathname, href) ? "bg-admin-indigo text-white" : "text-admin-dark hover:bg-slate-100",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {group.label}
                </Link>
              );
            }
            return (
              <div key={group.id} className="space-y-2">
                <div className="px-2 text-[10px] font-bold tracking-wider text-admin-subtle uppercase">{group.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  {group.children.map((item) => {
                    const ItemIcon = NAV_ICONS[item.icon];
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border p-2 text-[11px] font-medium",
                          active
                            ? "border-indigo-200 bg-admin-active font-bold text-admin-indigo"
                            : "border-slate-100 bg-slate-50 text-admin-text hover:bg-slate-100",
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
