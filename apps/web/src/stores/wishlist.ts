"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { setWishlistItemAction } from "@/app/(public)/_actions/engagement";
import { withAuthRetry } from "@/hooks/use-session-keep-alive";
import { toast } from "./ui";

/**
 * Signed out, the wishlist lives on this device (localStorage, `localIds`). Signed in, it lives in the account
 * (`mode: "server"`); WishlistSync merges the device list into the account once at sign-in and clears it.
 * Components read `ids`, which is always the list currently in use.
 */
interface WishlistState {
  mode: "local" | "server";
  /** The list in use: the device list when signed out, the account list when signed in. */
  ids: string[];
  /** Device list (persisted). Emptied once it has been merged into an account. */
  localIds: string[];
  /** Returns true when the item was added. Signed in, it updates at once and reverts if the server refuses. */
  toggle: (id: string) => boolean;
  /** Switches to the account list (after load or merge). */
  adoptServerList: (ids: string[], options?: { clearLocal?: boolean }) => void;
  /** Back to the device list (signed out). */
  adoptLocalList: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      mode: "local",
      ids: [],
      localIds: [],
      toggle: (id) => {
        const { mode, ids } = get();
        const added = !ids.includes(id);
        const next = added ? [id, ...ids] : ids.filter((x) => x !== id);
        if (mode === "local") {
          set({ ids: next, localIds: next });
          return added;
        }
        set({ ids: next });
        void withAuthRetry(() => setWishlistItemAction({ itemId: id, saved: added })).then((result) => {
          if (result.success) return;
          // Undo just this item, keeping any other changes made meanwhile.
          set((s) => ({ ids: added ? s.ids.filter((x) => x !== id) : [id, ...s.ids.filter((x) => x !== id)] }));
          if (result.error.code !== "UNAUTHENTICATED") toast(result.error.message, "error");
        });
        return added;
      },
      adoptServerList: (ids, options) =>
        set((s) => ({ mode: "server", ids, localIds: options?.clearLocal ? [] : s.localIds })),
      adoptLocalList: () => set((s) => ({ mode: "local", ids: s.localIds })),
    }),
    {
      name: "showbuzz-wishlist",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Only the device list is stored; the account list is always loaded from the server.
      partialize: (s) => ({ localIds: s.localIds }),
      merge: (persisted, current) => {
        const localIds = (persisted as { localIds?: string[] } | undefined)?.localIds ?? [];
        return { ...current, localIds, ids: current.mode === "local" ? localIds : current.ids };
      },
      // v1: the stored field was renamed from `ids` to `localIds`; earlier saves are kept.
      version: 1,
      migrate: (persisted) => ({ localIds: (persisted as { ids?: string[] } | undefined)?.ids ?? [] }),
    },
  ),
);
