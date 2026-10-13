"use client";

import { useEffect } from "react";
import { getWishlistAction, mergeWishlistAction } from "@/app/(public)/_actions/engagement";
import { useAuthStore } from "@/stores/auth";
import { useStoresHydrated } from "@/stores/hydration";
import { useWishlistStore } from "@/stores/wishlist";

/**
 * Keeps the wishlist store on the right list. Signed in: the device's saved items are merged into the account
 * once (then cleared from the device) and the account list is used. Signed out: back to the device list.
 */
export function WishlistSync() {
  const hydrated = useStoresHydrated();
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!hydrated) return;
    const store = useWishlistStore.getState();
    if (status === "anonymous") {
      store.adoptLocalList();
      return;
    }
    if (status !== "authenticated" || !userId) return;

    let cancelled = false;
    const localIds = store.localIds;
    const load = localIds.length > 0 ? mergeWishlistAction(localIds) : getWishlistAction();
    void load.then((result) => {
      if (cancelled || !result.success) return;
      useWishlistStore.getState().adoptServerList(result.data, { clearLocal: localIds.length > 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, status, userId]);

  return null;
}
