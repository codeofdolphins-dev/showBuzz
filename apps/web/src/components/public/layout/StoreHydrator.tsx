"use client";

import { useEffect } from "react";
import { type SelectedCity, useCityStore } from "@/stores/city";
import { rehydratePersistedStores } from "@/stores/hydration";

const CITY_STORAGE_KEY = "showbuzz-city";

function hasSavedCity(): boolean {
  try {
    return localStorage.getItem(CITY_STORAGE_KEY) !== null;
  } catch {
    // Storage blocked: keep whatever the store holds.
    return true;
  }
}

/**
 * Loads persisted client state after the first render so server and client HTML match. A visitor who never picked a
 * city starts on the default city from Platform Settings (prompt 7).
 */
export function StoreHydrator({ defaultCity }: { defaultCity?: SelectedCity }) {
  useEffect(() => {
    const saved = hasSavedCity();
    void rehydratePersistedStores().then(() => {
      if (!saved && defaultCity) useCityStore.getState().setCity(defaultCity);
    });
  }, [defaultCity]);
  return null;
}
