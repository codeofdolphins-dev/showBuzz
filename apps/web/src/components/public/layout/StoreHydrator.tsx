"use client";

import { useEffect } from "react";
import { rehydratePersistedStores } from "@/stores/hydration";

/** Loads persisted client state after the first render so server and client HTML match. */
export function StoreHydrator() {
  useEffect(() => {
    void rehydratePersistedStores();
  }, []);
  return null;
}
