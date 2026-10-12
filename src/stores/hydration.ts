"use client";

import { create } from "zustand";
import { useBookingCart } from "./booking-cart";
import { useCityStore } from "./city";
import { useWishlistStore } from "./wishlist";

/**
 * Persisted stores skip automatic hydration so the first client render matches the server
 * HTML. StoreHydrator rehydrates them after mount; anything that must read persisted state
 * (e.g. checkout reading the cart) waits for `hydrated`.
 */
interface HydrationState {
  hydrated: boolean;
}

export const useHydrationStore = create<HydrationState>()(() => ({ hydrated: false }));

let started = false;

export async function rehydratePersistedStores() {
  if (started) return;
  started = true;
  await Promise.all([
    useCityStore.persist.rehydrate(),
    useWishlistStore.persist.rehydrate(),
    useBookingCart.persist.rehydrate(),
  ]);
  useHydrationStore.setState({ hydrated: true });
}

export function useStoresHydrated() {
  return useHydrationStore((s) => s.hydrated);
}
