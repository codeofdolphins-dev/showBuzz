"use client";

import { useEffect } from "react";
import { refreshSession, useSessionKeepAlive } from "@/hooks/use-session-keep-alive";
import type { CurrentSession } from "@/types/auth";
import { useAuthStore } from "@/stores/auth";

/**
 * Puts the server's view of the session into the auth store (no /me request on page load) and keeps it
 * alive. Rendered by SessionBootstrap; re-runs when router.refresh() brings a new server answer.
 */
export function SessionInitializer({ customer, mightRefresh }: CurrentSession) {
  useEffect(() => {
    const { setSession, clearSession } = useAuthStore.getState();
    if (customer) {
      setSession(customer.user, customer.accessExpiresAt);
      return;
    }
    if (!mightRefresh) {
      clearSession();
      return;
    }
    // Access token expired while the tab was away: renew silently instead of showing "Sign In".
    void refreshSession().then((outcome) => {
      if (outcome === "error") useAuthStore.getState().clearSession();
    });
  }, [customer, mightRefresh]);

  useSessionKeepAlive();
  return null;
}
