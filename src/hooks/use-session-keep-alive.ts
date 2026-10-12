"use client";

import { useEffect } from "react";
import type { CustomerSnapshot } from "@/schemas/user";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

/** Refresh this long before the access token expires, so requests never race its expiry. */
const REFRESH_LEAD_MS = 60_000;

export type RefreshOutcome = "authenticated" | "anonymous" | "error";

let inFlight: Promise<RefreshOutcome> | null = null;

/**
 * Renews the session through POST /api/v1/auth/refresh (the refresh cookie only reaches /api/v1/auth).
 * Single-flight: concurrent callers share one request, so tabs' timers, focus events and retries never
 * rotate the token twice at once. 401 → signed out; network errors leave the store as it is.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  inFlight ??= (async (): Promise<RefreshOutcome> => {
    try {
      const response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.ok) {
        const { data } = (await response.json()) as { data: { user: CustomerSnapshot; accessExpiresAt: string } };
        useAuthStore.getState().setSession(data.user, data.accessExpiresAt);
        return "authenticated";
      }
      if (response.status === 401) {
        useAuthStore.getState().clearSession();
        return "anonymous";
      }
      return "error";
    } catch {
      return "error";
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

type ActionLike = { success: true } | { success: false; error: { code: string } };

/**
 * For client code calling auth-required Server Actions: on UNAUTHENTICATED, refresh once and retry;
 * if the session can't be renewed, open the sign-in modal and return the original failure.
 */
export async function withAuthRetry<R extends ActionLike>(fn: () => Promise<R>): Promise<R> {
  const first = await fn();
  if (first.success || first.error.code !== "UNAUTHENTICATED") return first;
  if ((await refreshSession()) === "authenticated") return fn();
  useUiStore.getState().openAuthModal();
  return first;
}

/**
 * Keeps a signed-in tab's access token fresh: refreshes shortly before it expires, and when the tab
 * becomes visible or focused again after the token ran out (background tabs throttle timers).
 */
export function useSessionKeepAlive() {
  const status = useAuthStore((s) => s.status);
  const accessExpiresAt = useAuthStore((s) => s.accessExpiresAt);

  useEffect(() => {
    if (status !== "authenticated" || !accessExpiresAt) return;
    const delay = Math.max(0, Date.parse(accessExpiresAt) - Date.now() - REFRESH_LEAD_MS);
    const timer = setTimeout(() => void refreshSession(), delay);
    return () => clearTimeout(timer);
  }, [status, accessExpiresAt]);

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      const { status: current, accessExpiresAt: expiresAt } = useAuthStore.getState();
      if (current === "authenticated" && expiresAt && Date.parse(expiresAt) - Date.now() < REFRESH_LEAD_MS) {
        void refreshSession();
      }
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, []);
}
