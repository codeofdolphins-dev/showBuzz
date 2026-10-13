"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Gift } from "lucide-react";
import { formatINR } from "@showbuzz/utils/money";
import { giftCardCodeSchema } from "@showbuzz/schemas/gift-card";
import type { OrderQuote } from "@showbuzz/schemas/types/booking";
import { useAuthStore } from "@/stores/auth";
import { useBookingCart } from "@/stores/booking-cart";
import { toast, useUiStore } from "@/stores/ui";

/**
 * "Apply Gift Card" on checkout. The code goes into the cart; the server checks it on every quote (status,
 * expiry, balance, rate limits) and applies min(balance, total). The balance is only spent when the payment
 * is confirmed. Signed-in customers only.
 */
export function GiftCardApply({ quote }: { quote: OrderQuote }) {
  const authStatus = useAuthStore((s) => s.status);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const giftCardCode = useBookingCart((s) => s.giftCardCode);
  const setGiftCard = useBookingCart((s) => s.setGiftCard);
  const [input, setInput] = useState("");

  // Server-side rejections are shown once, then the code is dropped from the cart (like coupons).
  const error = quote.giftCardError;
  useEffect(() => {
    if (!error) return;
    toast(error, "error");
    setGiftCard(undefined);
  }, [error, setGiftCard]);

  const apply = () => {
    if (authStatus !== "authenticated") {
      openAuthModal("/booking/checkout");
      return;
    }
    const parsed = giftCardCodeSchema.safeParse(input);
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? "Enter a valid gift card code", "error");
      return;
    }
    setGiftCard(parsed.data);
  };

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-extrabold text-slate-900 sm:text-sm">
        <Gift className="h-4 w-4 text-purple-500" /> Apply Gift Card
      </h3>
      {quote.giftCard ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
          <span className="flex items-center gap-2 text-xs font-bold text-emerald-800">
            <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Gift card ••••{quote.giftCard.last4}: {formatINR(quote.giftCard.appliedPaise, { exact: true })} applied
              <span className="block text-[10px] font-semibold text-emerald-700">
                Balance {formatINR(quote.giftCard.balancePaise, { exact: true })}; deducted when you pay
              </span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setGiftCard(undefined);
              setInput("");
              toast("Gift card removed.", "info");
            }}
            className="tap-active text-xs font-bold text-rose-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            aria-label="Gift card code"
            autoComplete="off"
            className="w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs font-bold tracking-wider text-slate-800 uppercase focus:border-rose-500 focus:bg-white focus:outline-none"
          />
          <button
            type="button"
            onClick={apply}
            disabled={!!giftCardCode}
            className="tap-active rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-purple-700 disabled:opacity-60"
          >
            Apply
          </button>
        </div>
      )}
    </section>
  );
}
