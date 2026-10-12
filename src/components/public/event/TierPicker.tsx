"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Armchair, Minus, Plus } from "lucide-react";
import { MAX_TICKETS_PER_ORDER } from "@/config/constants";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/money";
import type { TicketTier } from "@/schemas/event";
import { useBookingCart } from "@/stores/booking-cart";

const ACCENTS = {
  rose: { selected: "border-rose-500 bg-rose-50/20", price: "text-rose-600", button: "gradient-btn shadow-rose-500/20" },
  amber: { selected: "border-amber-500 bg-amber-50/30", price: "text-amber-600", button: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20" },
  emerald: { selected: "border-emerald-500 bg-emerald-50/30", price: "text-emerald-600", button: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" },
  pink: { selected: "border-pink-500 bg-pink-50/30", price: "text-pink-600", button: "bg-pink-600 hover:bg-pink-700 shadow-pink-500/20" },
} as const;

interface TierPickerProps {
  eventId: string;
  tiers: TicketTier[];
  accent: keyof typeof ACCENTS;
  layout: "stack" | "grid";
  /** Stadium matches continue to the seat map instead of straight to checkout. */
  seatMapShowId?: string;
}

export function TierPicker({ eventId, tiers, accent, layout, seatMapShowId }: TierPickerProps) {
  const router = useRouter();
  const startTickets = useBookingCart((s) => s.startTickets);
  const [tierIndex, setTierIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const a = ACCENTS[accent];
  const tier = tiers[tierIndex] ?? tiers[0];
  if (!tier) return null;

  const maxQty = Math.min(MAX_TICKETS_PER_ORDER, tier.available);

  const proceed = () => {
    if (seatMapShowId) {
      router.push(`/booking/${seatMapShowId}/seats?stand=${tierIndex}`);
      return;
    }
    startTickets({ kind: "event", eventId, tierId: tier.id, quantity: qty });
    router.push("/booking/checkout");
  };

  return (
    <div className="space-y-4">
      <div className={cn("gap-3", layout === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-3" : "space-y-3")}>
        {tiers.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTierIndex(i);
              setQty((q) => Math.min(q, Math.min(MAX_TICKETS_PER_ORDER, t.available)));
            }}
            aria-pressed={i === tierIndex}
            disabled={t.available === 0}
            className={cn(
              "w-full rounded-2xl border p-4 text-left transition-all disabled:opacity-50",
              i === tierIndex ? a.selected : "border-slate-200 bg-slate-50 hover:border-slate-300",
            )}
          >
            <div className={cn(layout === "stack" && "flex items-start justify-between gap-3")}>
              <div>
                <h4 className="text-xs font-black text-slate-900 sm:text-sm">{t.name}</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">{t.description}</p>
                {t.available <= 20 && <p className="mt-1 text-[10px] font-bold text-amber-600">Only {t.available} left</p>}
              </div>
              <span className={cn("font-black", layout === "grid" ? cn("mt-2 block text-lg", a.price) : "text-sm text-slate-900")}>
                {formatINR(t.pricePaise)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {!seatMapShowId && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-700">Quantity of Passes:</span>
          <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Fewer passes"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-700 hover:bg-slate-200"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="px-1 text-xs font-black" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              aria-label="More passes"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-700 hover:bg-slate-200"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:flex-row">
        <div className="self-start sm:self-auto">
          <span className="block text-xs font-medium text-slate-400">{seatMapShowId ? "Selected stand base price" : "Total Price"}</span>
          <span className={cn("text-2xl font-black", seatMapShowId ? "text-slate-900" : a.price)}>
            {formatINR(tier.pricePaise * (seatMapShowId ? 1 : qty))}
          </span>
        </div>
        <button
          type="button"
          onClick={proceed}
          className={cn(
            "tap-active flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-xs font-black text-white shadow-lg sm:w-auto",
            a.button,
          )}
        >
          {seatMapShowId ? (
            <>
              <Armchair className="h-4 w-4" /> Select Stadium Seats
            </>
          ) : (
            <>
              Proceed to Checkout <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
