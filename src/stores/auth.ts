"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CustomerProfile {
  name: string;
  email?: string;
  phone?: string;
  joinedAt: string;
}

interface AuthState {
  user: CustomerProfile | null;
  signIn: (user: CustomerProfile) => void;
  updateProfile: (patch: Partial<Omit<CustomerProfile, "joinedAt">>) => void;
  signOut: () => void;
}

/**
 * Display snapshot of the signed-in customer. It grants no access: once sessions exist this is
 * filled from GET /api/v1/auth/me and httpOnly cookies carry the real credentials.
 * sessionStorage keeps the snapshot out of long-lived storage.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (user) => set({ user }),
      updateProfile: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
      signOut: () => set({ user: null }),
    }),
    { name: "showbuzz-auth", storage: createJSONStorage(() => sessionStorage), skipHydration: true },
  ),
);
