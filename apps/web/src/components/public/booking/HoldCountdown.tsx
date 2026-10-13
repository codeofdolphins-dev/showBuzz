"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Clock } from "lucide-react";
import { formatCountdown, useCountdown } from "@/hooks/use-countdown";
import { useBookingCart } from "@/stores/booking-cart";
import { toast } from "@/stores/ui";

/**
 * The seat hold's real expiry, shown on food → checkout → payment. When it runs out the seats are released on
 * the server, so the customer goes back to seat selection.
 */
export function HoldCountdown() {
  const router = useRouter();
  const hold = useBookingCart((s) => s.hold);
  const isSeated = useBookingCart((s) => s.tickets?.kind === "show");
  const secondsLeft = useCountdown(isSeated ? hold?.expiresAt : undefined);

  useEffect(() => {
    if (secondsLeft !== 0 || !hold) return;
    toast("Your seat hold expired. Please pick your seats again.", "warning");
    router.replace(hold.seatsHref);
  }, [secondsLeft, hold, router]);

  if (!isSeated || !hold || secondsLeft === null) return null;
  return (
    <div
      className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-1.5 shadow-xs"
      role="timer"
      aria-live="off"
    >
      <Clock className="h-3.5 w-3.5 animate-pulse text-rose-500" />
      <span className="text-[10px] font-bold tracking-wider text-rose-400 uppercase">Seats held for</span>
      <span className="font-mono text-xs font-black text-rose-600">{formatCountdown(secondsLeft)}</span>
    </div>
  );
}
