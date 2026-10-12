"use client";

import { type ReactNode, useEffect } from "react";
import { UserRound } from "lucide-react";
import type { CustomerSnapshot } from "@/schemas/user";
import { useAuthStore } from "@/stores/auth";
import { useStoresHydrated } from "@/stores/hydration";
import { useUiStore } from "@/stores/ui";

interface AccountGateProps {
  children: ReactNode;
  /** The customer the server verified for this request (requireCustomerPage). */
  customer?: CustomerSnapshot;
}

/**
 * Client-side gate for the account pages (removed in batch 1.6, when the auth store is fed from the
 * server). The real checks are proxy.ts and requireCustomerPage(). When the server has already verified
 * the customer but this tab's store is empty (e.g. a new tab), the store is filled from that snapshot.
 */
export function AccountGate({ children, customer }: AccountGateProps) {
  const hydrated = useStoresHydrated();
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const seeding = hydrated && !user && !!customer;

  useEffect(() => {
    if (seeding && customer) signIn(customer);
  }, [seeding, customer, signIn]);

  if (!hydrated || seeding) return <div className="skeleton h-64" />;
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
