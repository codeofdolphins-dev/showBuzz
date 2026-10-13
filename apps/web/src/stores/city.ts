"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_CITY } from "@showbuzz/schemas/constants";

export interface SelectedCity {
  id: string;
  name: string;
  state?: string;
}

interface CityState {
  city: SelectedCity;
  setCity: (city: SelectedCity) => void;
}

/** Last chosen city is a UI preference, so localStorage is fine here. */
export const useCityStore = create<CityState>()(
  persist(
    (set) => ({
      city: { ...DEFAULT_CITY },
      setCity: (city) => set({ city }),
    }),
    { name: "showbuzz-city", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
