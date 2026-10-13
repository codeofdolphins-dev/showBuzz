"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ContactDetailsInput, FoodLine, TicketSelection } from "@showbuzz/schemas/booking";

/**
 * The order being built across seats → food → checkout → payment. It holds only ids and
 * quantities; every price is re-computed by the server from these.
 */
/** The real seat hold behind a seated cart: when it expires the customer is sent back to `seatsHref`. */
export interface CartSeatHold {
  expiresAt: string;
  seatsHref: string;
}

interface BookingCartState {
  tickets: TicketSelection | null;
  food: FoodLine[];
  couponCode?: string;
  contact?: ContactDetailsInput;
  hold?: CartSeatHold;
  startTickets: (tickets: TicketSelection, hold?: CartSeatHold) => void;
  setFoodQuantity: (foodItemId: string, quantity: number) => void;
  setCoupon: (code: string | undefined) => void;
  setContact: (contact: ContactDetailsInput) => void;
  clear: () => void;
}

export const useBookingCart = create<BookingCartState>()(
  persist(
    (set) => ({
      tickets: null,
      food: [],
      startTickets: (tickets, hold) => set({ tickets, hold, food: [], couponCode: undefined }),
      setFoodQuantity: (foodItemId, quantity) =>
        set((s) => {
          // Unchanged quantities keep the same array so the order quote isn't re-requested.
          if ((s.food.find((f) => f.foodItemId === foodItemId)?.quantity ?? 0) === quantity) return s;
          const others = s.food.filter((f) => f.foodItemId !== foodItemId);
          return { food: quantity > 0 ? [...others, { foodItemId, quantity }] : others };
        }),
      setCoupon: (couponCode) => set({ couponCode }),
      setContact: (contact) => set({ contact }),
      clear: () => set({ tickets: null, hold: undefined, food: [], couponCode: undefined }),
    }),
    {
      name: "showbuzz-cart",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      // v1: catalogue ids became MongoDB ObjectIds (shows, events, food, gift card designs). A cart saved
      // with the old ids can't be priced any more, so it is dropped instead of failing at checkout.
      version: 1,
      migrate: () => ({ tickets: null, food: [] }),
    },
  ),
);
