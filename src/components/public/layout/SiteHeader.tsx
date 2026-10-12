"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  CircleX,
  Heart,
  LogOut,
  MapPin,
  Menu,
  Search,
  Tags,
  Ticket,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useSignOut } from "@/hooks/use-sign-out";
import { useAuthStore } from "@/stores/auth";
import { useCityStore } from "@/stores/city";
import { toast, useUiStore } from "@/stores/ui";
import { useWishlistStore } from "@/stores/wishlist";
import type { SearchEntry } from "@/types/catalog";
import { BrandLogo, BrandMark } from "./BrandLogo";
import { MobileDrawer } from "./MobileDrawer";
import { CATEGORY_NAV, SERVICE_NAV, isActivePath } from "./nav";
import { SearchResults, filterSearchEntries } from "./SearchResults";

interface SiteHeaderProps {
  searchIndex: SearchEntry[];
}

export function SiteHeader({ searchIndex }: SiteHeaderProps) {
  const pathname = usePathname();
  const city = useCityStore((s) => s.city);
  const user = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const signOut = useSignOut();
  const wishlistCount = useWishlistStore((s) => s.ids.length);
  const openCityModal = useUiStore((s) => s.openCityModal);
  const openAuthModal = useUiStore((s) => s.openAuthModal);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Transient menus close whenever the route changes (including back/forward).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setUserMenuOpen(false);
    setDrawerOpen(false);
    setQuery("");
  }

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!searchBoxRef.current?.contains(target)) setSearchOpen(false);
      if (!userMenuRef.current?.contains(target)) setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const results = filterSearchEntries(searchIndex, query);
  const closeSearch = () => {
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setQuery("");
  };

  const handleSignOut = () => {
    setUserMenuOpen(false);
    void signOut();
  };

  return (
    <>
      <div className="hidden items-center justify-center gap-2 bg-gradient-to-r from-rose-600 via-purple-600 to-blue-600 px-4 py-1.5 text-center text-xs font-medium text-white lg:flex">
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase">
          Flash Offer
        </span>
        <span>
          Use promo code <strong className="tracking-wide underline">SHOW50</strong> for 50% Off on your first ticket
          booking!
        </span>
        <Link href="/offers" className="ml-2 font-bold underline hover:text-rose-200">
          View All Offers &rarr;
        </Link>
      </div>

      <header className="glass-header sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex h-14 items-center justify-between gap-3 sm:h-16 lg:h-20">
            <div className="flex items-center gap-3 sm:gap-6">
              <BrandLogo withTagline className="hidden sm:flex" />

              <div className="flex items-center gap-2 sm:hidden">
                <Link href="/" aria-label="ShowBuzz home">
                  <BrandMark />
                </Link>
                <button type="button" onClick={openCityModal} className="tap-active flex flex-col text-left">
                  <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Location <ChevronDown className="h-2.5 w-2.5" />
                  </span>
                  <span className="flex items-center gap-1 text-xs font-black text-slate-900">
                    <MapPin className="h-3 w-3 text-rose-500" />
                    {city.name}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={openCityModal}
                className="group tap-active hidden items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-100/80 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200/80 md:flex"
              >
                <MapPin className="h-3.5 w-3.5 text-rose-500" />
                <span className="max-w-[100px] truncate">{city.name}</span>
                <ChevronDown className="h-3 w-3 text-slate-400 transition-transform group-hover:translate-y-0.5" />
              </button>
            </div>

            <div ref={searchBoxRef} className="relative hidden max-w-xl flex-1 md:block">
              <div className="relative">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search movies, events, plays, sports and activities..."
                  aria-label="Search"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 py-2.5 pr-10 pl-11 text-xs text-slate-800 shadow-inner transition-all placeholder:text-slate-400 hover:bg-slate-100 focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/10 focus:outline-none sm:text-sm [&::-webkit-search-cancel-button]:hidden"
                />
                <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {query && (
                  <button
                    type="button"
                    onClick={closeSearch}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <CircleX className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchOpen && query.trim() && (
                <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[480px] overflow-hidden overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl">
                  <SearchResults query={query} results={results} onNavigate={closeSearch} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                className="tap-active flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 md:hidden"
              >
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span>Search</span>
              </button>

              <button
                type="button"
                onClick={() => toast("New offers are live. Use SHOW50 for 50% off your first booking!", "info", "Special Offer")}
                className="tap-active relative flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100/80 text-slate-600 transition-colors hover:bg-slate-200/80 sm:h-10 sm:w-10"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              </button>

              <Link
                href="/account/profile"
                className="tap-active relative hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-100/80 text-slate-700 transition-colors hover:bg-slate-200/80 sm:flex"
                aria-label="My wishlist"
              >
                <Heart className="h-4 w-4" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {authStatus === "unknown" ? (
                // Session not known yet: hold the space without implying either state.
                <span
                  aria-hidden
                  className="skeleton h-9 w-20 rounded-xl sm:h-10 sm:w-28"
                />
              ) : user ? (
                <div ref={userMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    aria-expanded={userMenuOpen}
                    className="tap-active flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-100/80 py-1.5 pr-2.5 pl-1.5 text-xs font-semibold text-slate-800 transition-all hover:bg-slate-200/80 sm:pr-3 sm:pl-2 sm:text-sm"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-rose-500 to-purple-600 text-xs font-bold text-white sm:h-7 sm:w-7">
                      {user.name.charAt(0)}
                    </span>
                    <span className="hidden max-w-[80px] truncate sm:inline">{user.name}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  {userMenuOpen && (
                    <div className="animate-fade-in absolute top-full right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-100 bg-white py-2 shadow-xl">
                      <div className="border-b border-slate-100 px-4 py-2.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Signed in as</p>
                        <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{user.email ?? user.phone}</p>
                      </div>
                      {[
                        { href: "/account/profile", label: "My Profile", icon: User },
                        { href: "/account/bookings", label: "Booking History", icon: Ticket },
                        { href: "/account/profile", label: "Saved Wishlist", icon: Heart },
                        { href: "/offers", label: "Offers & Coupons", icon: Tags },
                      ].map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <item.icon className="h-4 w-4 text-slate-400" /> {item.label}
                        </Link>
                      ))}
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4 text-rose-500" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal()}
                  className="gradient-btn tap-active flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-md sm:px-5 sm:py-2.5 sm:text-sm"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                className="tap-active flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 sm:h-10 sm:w-10 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav className="hidden items-center justify-between border-t border-slate-100 py-2.5 text-xs font-semibold text-slate-600 lg:flex">
            <div className="flex items-center gap-7">
              {CATEGORY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1 transition-colors hover:text-rose-600",
                    isActivePath(pathname, item.href) && "font-bold text-rose-600",
                  )}
                >
                  {item.label}
                  {item.badge && (
                    <span className="rounded bg-blue-100 px-1 text-[9px] font-extrabold text-blue-600 uppercase">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-5 text-slate-500">
              {SERVICE_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "transition-colors hover:text-slate-800",
                    isActivePath(pathname, item.href) && "font-bold text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[999] flex flex-col bg-white p-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close search"
              className="tap-active p-2 text-slate-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies, events, plays..."
                aria-label="Search"
                autoFocus
                className="w-full rounded-xl bg-slate-100 py-2.5 pr-8 pl-9 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none sm:text-sm"
              />
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-3">
            {query.trim() && <SearchResults query={query} results={results} onNavigate={closeSearch} />}
          </div>
        </div>
      )}
    </>
  );
}
