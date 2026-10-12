"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { quoteOrderAction } from "@/app/(public)/_actions/booking";
import { useBookingCart } from "@/stores/booking-cart";
import { useStoresHydrated } from "@/stores/hydration";
import type { OrderQuote } from "@/types/booking";

type QuoteState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; quote: OrderQuote }
  | { status: "error"; message: string };

/**
 * Asks the server to price the cart whenever it changes. The returned amounts are the only
 * numbers the booking pages show; nothing is totalled on the client. While a re-quote is in
 * flight the previous quote stays on screen to avoid flashing a skeleton on every tap.
 */
export function useOrderQuote(): QuoteState {
  const hydrated = useStoresHydrated();
  const { tickets, food, couponCode } = useBookingCart(
    useShallow((s) => ({ tickets: s.tickets, food: s.food, couponCode: s.couponCode })),
  );
  const [latest, setLatest] = useState<QuoteState>();

  // The cart store only replaces these values when they change, so they are safe effect deps.
  useEffect(() => {
    if (!hydrated || !tickets) return;
    let cancelled = false;
    quoteOrderAction({ tickets, food, couponCode }).then((result) => {
      if (cancelled) return;
      setLatest(
        result.success ? { status: "ready", quote: result.data } : { status: "error", message: result.error.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, tickets, food, couponCode]);

  if (!hydrated) return { status: "loading" };
  if (!tickets) return { status: "empty" };
  return latest ?? { status: "loading" };
}
