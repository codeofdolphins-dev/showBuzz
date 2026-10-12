"use client";

import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useStoresHydrated } from "@/stores/hydration";
import { useUiStore } from "@/stores/ui";

/**
 * UI-only gate until customer sessions exist. The real boundary will be proxy.ts plus
 * server-side session checks on every account route and action.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const hydrated = useStoresHydrated();
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useUiStore((s) => s.openAuthModal);

  if (!hydrated) return <div className="skeleton h-64" />;
  if (user) return <>{children}</>;

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xs sm:p-12">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <UserRound className="h-5 w-5" />
      </span>
      <h2 className="text-base font-bold text-slate-900">Sign in to view your account</h2>
      <p className="mt-1 text-xs text-slate-500">Your bookings, wishlist and profile are available after signing in.</p>
      <button
        type="button"
        onClick={openAuthModal}
        className="gradient-btn tap-active mt-4 rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-md"
      >
        Sign In / Register
      </button>
    </div>
  );
}
