"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ContactDetailsInput, FoodLine, TicketSelection } from "@/schemas/booking";

/**
 * The order being built across seats → food → checkout → payment. It holds only ids and
 * quantities; every price is re-computed by the server from these.
 */
interface BookingCartState {
  tickets: TicketSelection | null;
  food: FoodLine[];
  couponCode?: string;
  contact?: ContactDetailsInput;
  startTickets: (tickets: TicketSelection) => void;
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
      startTickets: (tickets) => set({ tickets, food: [], couponCode: undefined }),
      setFoodQuantity: (foodItemId, quantity) =>
        set((s) => {
          // Unchanged quantities keep the same array so the order quote isn't re-requested.
          if ((s.food.find((f) => f.foodItemId === foodItemId)?.quantity ?? 0) === quantity) return s;
          const others = s.food.filter((f) => f.foodItemId !== foodItemId);
          return { food: quantity > 0 ? [...others, { foodItemId, quantity }] : others };
        }),
      setCoupon: (couponCode) => set({ couponCode }),
      setContact: (contact) => set({ contact }),
      clear: () => set({ tickets: null, food: [], couponCode: undefined }),
    }),
    { name: "showbuzz-cart", storage: createJSONStorage(() => sessionStorage), skipHydration: true },
  ),
);
