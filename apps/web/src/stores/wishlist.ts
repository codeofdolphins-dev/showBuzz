"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface WishlistState {
  ids: string[];
  /** Returns true when the item was added. */
  toggle: (id: string) => boolean;
}

/** Device-local until the wishlist API exists; then it syncs to the customer's account. */
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const added = !get().ids.includes(id);
        set((s) => ({ ids: added ? [...s.ids, id] : s.ids.filter((x) => x !== id) }));
        return added;
      },
    }),
    { name: "showbuzz-wishlist", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
