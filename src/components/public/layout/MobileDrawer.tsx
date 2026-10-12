"use client";

import Link from "next/link";
import { Ticket, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { toast, useUiStore } from "@/stores/ui";
import { BrandMark, BrandWordmark } from "./BrandLogo";
import { DRAWER_EXPLORE, DRAWER_SERVICES, type NavItem } from "./nav";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

function DrawerLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className="tap-active flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      <item.icon className={`h-4 w-5 ${item.color}`} /> {item.label}
    </Link>
  );
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const openAuthModal = useUiStore((s) => s.openAuthModal);

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm lg:hidden"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="fixed inset-y-0 right-0 flex w-full max-w-xs flex-col justify-between overflow-y-auto bg-white p-6 shadow-2xl">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <BrandMark />
              <BrandWordmark className="text-lg" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="tap-active flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="space-y-1 py-4">
            <p className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Explore Categories</p>
            {DRAWER_EXPLORE.map((item) => (
              <DrawerLink key={item.href} item={item} onClose={onClose} />
            ))}
            <div className="my-2 border-t border-slate-100 pt-4" />
            <p className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Rewards & Services</p>
            {DRAWER_SERVICES.map((item) => (
              <DrawerLink key={item.href} item={item} onClose={onClose} />
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-100 pt-4">
          {user ? (
            <>
              <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500 font-bold text-white">
                  {user.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email ?? user.phone}</p>
                </div>
              </div>
              <Link
                href="/account/bookings"
                onClick={onClose}
                className="tap-active mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-200"
              >
                <Ticket className="h-3.5 w-3.5 text-rose-500" /> View My Bookings
              </Link>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  onClose();
                  toast("Signed out successfully.", "info");
                }}
                className="tap-active flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                openAuthModal();
              }}
              className="gradient-btn tap-active w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
