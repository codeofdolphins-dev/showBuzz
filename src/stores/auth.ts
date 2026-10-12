"use client";

import { create } from "zustand";
import type { CustomerSnapshot } from "@/schemas/user";

/** "unknown" until the server's answer (or a silent refresh) arrives; the header shows a placeholder. */
export type AuthStatus = "unknown" | "authenticated" | "anonymous";

interface AuthState {
  status: AuthStatus;
  user: CustomerSnapshot | null;
  /** ISO time the current access token expires; drives the keep-alive refresh. */
  accessExpiresAt: string | null;
  setSession: (user: CustomerSnapshot, accessExpiresAt: string) => void;
  clearSession: () => void;
}

/**
 * Display snapshot of the signed-in customer. It grants nothing: the httpOnly session cookies are the
 * credentials, and the server re-checks them on every request. Filled from the server on page load
 * (SessionInitializer), then by sign-in, refresh and sign-out. Not persisted.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: "unknown",
  user: null,
  accessExpiresAt: null,
  setSession: (user, accessExpiresAt) => set({ status: "authenticated", user, accessExpiresAt }),
  clearSession: () => set({ status: "anonymous", user: null, accessExpiresAt: null }),
}));
