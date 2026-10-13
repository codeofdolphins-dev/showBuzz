"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOrderQuote } from "@/hooks/use-order-quote";
import { cn } from "@showbuzz/utils/cn";
import { formatINR } from "@showbuzz/utils/money";
import type { FoodCategory, FoodItem } from "@showbuzz/schemas/food";
import { useBookingCart } from "@/stores/booking-cart";
import { PriceBreakdown } from "./PriceBreakdown";
import { QuoteFallback } from "./QuoteFallback";

const TABS: { value: FoodCategory | "All"; label: string }[] = [
  { value: "All", label: "All Items" },
  { value: "Popcorn", label: "Popcorn" },
  { value: "Combo Meals", label: "Combos" },
  { value: "Beverages", label: "Beverages" },
  { value: "Snacks", label: "Snacks" },
];

export function FoodSelector({ items }: { items: FoodItem[] }) {
  const router = useRouter();
  const quoteState = useOrderQuote();
  const cartFood = useBookingCart((s) => s.food);
  const setQty = useBookingCart((s) => s.setFoodQuantity);
  const [tab, setTab] = useState<FoodCategory | "All">("All");
  const [vegOnly, setVegOnly] = useState(false);

  if (quoteState.status !== "ready") return <QuoteFallback state={quoteState} />;
  const { quote } = quoteState;

  if (!quote.foodAllowed) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Food pre-orders aren&apos;t available for this booking</h3>
        <Link href="/booking/checkout" className="gradient-btn mt-4 inline-block rounded-xl px-5 py-2.5 text-xs font-bold text-white">
          Continue to Checkout &rarr;
        </Link>
      </div>
    );
  }

  const qtyOf = (id: string) => cartFood.find((f) => f.foodItemId === id)?.quantity ?? 0;
  const visible = items.filter((f) => (tab === "All" || f.category === tab) && (!vegOnly || f.isVeg));

  return (
    <>
      <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 p-5 text-white shadow-xl sm:flex-row sm:p-7">
        <div>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[9px] font-extrabold tracking-wider uppercase sm:text-[10px]">
            Concession Counter
          </span>
          <h1 className="mt-1 text-xl font-black sm:text-3xl">Pre-Order Movie Snacks</h1>
          <p className="text-xs text-amber-100">Skip counter queues and get snacks delivered directly!</p>
        </div>
        <Link
          href="/booking/checkout"
          className="tap-active w-full rounded-xl border border-white/30 bg-white/20 px-5 py-2.5 text-center text-xs font-bold whitespace-nowrap hover:bg-white/30 sm:w-auto"
        >
          Skip Snacks & Checkout &rarr;
        </Link>
      </div>

      <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs sm:flex-row sm:p-4">
        <div className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto sm:w-auto sm:gap-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "tap-active rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap sm:px-4 sm:py-2",
                tab === t.value ? "bg-rose-500 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700 select-none">
          <input
            type="checkbox"
            checked={vegOnly}
            onChange={(e) => setVegOnly(e.target.checked)}
            className="h-4 w-4 rounded accent-emerald-600"
          />
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          </span>
          Veg Only
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3 xl:grid-cols-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:col-span-2 xl:col-span-3 xl:grid-cols-4">
          {visible.length === 0 && (
            <p className="col-span-full rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-xs text-slate-500 shadow-xs">
              Nothing matches these filters. Try another category or turn off Veg Only.
            </p>
          )}
          {visible.map((food) => {
            const qty = qtyOf(food.id);
            return (
              <div
                key={food.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all hover:border-slate-300 sm:p-5"
              >
                <div>
                  <div className="relative mb-2 aspect-[16/11] overflow-hidden rounded-2xl bg-slate-100 sm:mb-3">
                    <Image src={food.image} alt={food.name} fill sizes="(min-width: 1280px) 18vw, 45vw" className="object-cover" />
                    <span
                      className={cn(
                        "absolute top-1.5 left-1.5 rounded-full px-1.5 text-[8px] font-bold text-white",
                        food.isVeg ? "bg-emerald-600" : "bg-rose-600",
                      )}
                    >
                      {food.isVeg ? "VEG" : "NON-VEG"}
                    </span>
                  </div>
                  <h4 className="line-clamp-1 text-xs leading-snug font-bold text-slate-900 sm:text-sm">{food.name}</h4>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 sm:text-[11px]">{food.description}</p>
                  <span className="mt-1 block text-[9px] font-semibold text-slate-400">{food.size}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 sm:pt-3">
                  <span className="text-xs font-black text-slate-900 sm:text-sm">{formatINR(food.pricePaise)}</span>
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => setQty(food.id, 1)}
                      className="tap-active rounded-xl bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-600 transition-colors hover:bg-rose-100 sm:px-4 sm:text-xs"
                    >
                      + ADD
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-2 py-1 text-xs font-bold text-white">
                      <button type="button" aria-label={`Remove one ${food.name}`} onClick={() => setQty(food.id, qty - 1)} className="tap-active px-1">
                        -
                      </button>
                      <span>{qty}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${food.name}`}
                        onClick={() => setQty(food.id, Math.min(20, qty + 1))}
                        className="tap-active px-1"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
            <h3 className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm font-extrabold text-slate-900 sm:text-base">
              <span>Order Summary</span>
              <span className="text-xs font-medium text-slate-400">
                {quote.ticketCount} {quote.ticketCount === 1 ? "Ticket" : "Tickets"}
              </span>
            </h3>
            <div className="flex items-center gap-3 border-b border-slate-100 py-3">
              <Image src={quote.poster} alt="" width={40} height={56} className="h-14 w-10 rounded-lg object-cover shadow-sm" />
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-xs font-bold text-slate-900">{quote.title}</h4>
                <p className="text-[11px] font-semibold text-slate-500">Seats: {quote.seatLabels.join(", ")}</p>
                <p className="text-[11px] font-bold text-slate-700">Tickets: {formatINR(quote.amounts.ticketsPaise)}</p>
              </div>
            </div>
            <div className="min-h-[60px] space-y-1 py-3">
              {quote.food.length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-400 italic">No snacks added yet.</p>
              ) : (
                quote.food.map((f) => (
                  <div key={f.foodItemId} className="flex items-center justify-between border-b border-slate-50 py-1 text-xs">
                    <span className="max-w-[150px] truncate font-medium text-slate-700">
                      {f.name} &times; {f.quantity}
                    </span>
                    <span className="font-bold text-slate-900">{formatINR(f.totalPaise)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 pt-3">
              <PriceBreakdown quote={quote} />
              <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-base font-black text-slate-900">
                <span>Total Payable</span>
                <span className="text-emerald-600">{formatINR(quote.amounts.payablePaise, { exact: true })}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/booking/checkout")}
              className="gradient-btn tap-active mt-5 w-full rounded-2xl py-3 text-xs font-black text-white shadow-lg shadow-rose-500/20"
            >
              Proceed to Checkout &rarr;
            </button>
            <Link
              href="/booking/checkout"
              className="mt-2 block text-center text-xs font-bold text-slate-400 transition-colors hover:text-slate-600"
            >
              Skip Snacks
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
