"use client";

import { create } from "zustand";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  title?: string;
}

interface UiState {
  cityModalOpen: boolean;
  authModalOpen: boolean;
  /** Where to go after signing in, when the modal was opened for a protected page (?auth=signin&next=). */
  authNext: string | null;
  toasts: Toast[];
  openCityModal: () => void;
  closeCityModal: () => void;
  openAuthModal: (next?: string) => void;
  closeAuthModal: () => void;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

let nextToastId = 1;

export const useUiStore = create<UiState>()((set) => ({
  cityModalOpen: false,
  authModalOpen: false,
  authNext: null,
  toasts: [],
  openCityModal: () => set({ cityModalOpen: true }),
  closeCityModal: () => set({ cityModalOpen: false }),
  openAuthModal: (next) => set({ authModalOpen: true, authNext: next ?? null }),
  closeAuthModal: () => set({ authModalOpen: false, authNext: null }),
  pushToast: (toast) => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Shorthand for components that only need to raise a toast. */
export function toast(message: string, tone: ToastTone = "info", title?: string) {
  useUiStore.getState().pushToast({ message, tone, title });
}
