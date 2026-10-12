"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { Accessibility, ArrowLeft, ArrowRight, Armchair, Clock, Crown, Sofa, TicketCheck, Tv, Users } from "lucide-react";
import { MAX_TICKETS_PER_ORDER, SEAT_HOLD_MINUTES } from "@/config/constants";
import { cn } from "@/lib/cn";
import { formatDateLong, formatTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { useBookingCart } from "@/stores/booking-cart";
import { toast } from "@/stores/ui";
import type { Seat, SeatMap, SeatTier, ShowDetails } from "@/types/catalog";
import { StadiumMap } from "./StadiumMap";

const ACCENT_BADGE: Record<SeatTier["accent"], string> = {
  rose: "text-rose-600 bg-rose-50 border-rose-100",
  amber: "text-amber-600 bg-amber-50 border-amber-100",
  blue: "text-blue-600 bg-blue-50 border-blue-100",
};

function tierIcon(show: ShowDetails, index: number) {
  if (show.kind === "sport") return [Crown, TicketCheck, Users][index] ?? Users;
  return [Sofa, Crown, Armchair][index] ?? Armchair;
}

interface SeatSelectorProps {
  show: ShowDetails;
  seatMap: SeatMap;
  /** Tier to highlight on arrival (sports details page passes the chosen stand). */
  focusTier?: number;
}

export function SeatSelector({ show, seatMap, focusTier }: SeatSelectorProps) {
  const router = useRouter();
  const startTickets = useBookingCart((s) => s.startTickets);
  const [selected, setSelected] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(SEAT_HOLD_MINUTES * 60);
  const [highlight, setHighlight] = useState<number | undefined>(focusTier);
  const tierRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft > 0) return;
    toast("Your seat session timed out. Please pick your seats again.", "warning");
    router.push(show.backHref);
  }, [secondsLeft, router, show.backHref]);

  useEffect(() => {
    if (focusTier === undefined) return;
    tierRefs.current[focusTier]?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlight(undefined), 1800);
    return () => clearTimeout(t);
  }, [focusTier]);

  const seatIndex = new Map<string, { seat: Seat; tier: SeatTier }>();
  seatMap.tiers.forEach((tier) => tier.rows.forEach((r) => r.seats.forEach((seat) => seatIndex.set(seat.id, { seat, tier }))));

  // Display only: the server re-prices these seats at checkout.
  const totalPaise = selected.reduce((sum, id) => sum + (seatIndex.get(id)?.tier.pricePaise ?? 0), 0);

  const toggleSeat = (id: string) => {
    if (selected.includes(id)) {
      setSelected((s) => s.filter((x) => x !== id));
      return;
    }
    if (selected.length >= MAX_TICKETS_PER_ORDER) {
      toast(`Maximum ${MAX_TICKETS_PER_ORDER} seats allowed per booking.`, "warning");
      return;
    }
    setSelected((s) => [...s, id]);
  };

  const jumpToTier = (index: number) => {
    tierRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(index);
    setTimeout(() => setHighlight(undefined), 1800);
  };

  const proceed = () => {
    startTickets({ kind: "show", showId: show.id, seatIds: selected });
    router.push(show.kind === "movie" ? "/booking/food" : "/booking/checkout");
  };

  const start = new Date(show.startsAt);
  const timer = `${Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-xs backdrop-blur-md sm:px-6 lg:px-8 xl:px-12">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <Link
              href={show.backHref}
              aria-label="Go back"
              className="tap-active flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-black text-slate-900 sm:text-base">{show.title}</h1>
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase sm:inline-block",
                    show.kind === "sport" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600",
                  )}
                >
                  {show.kind === "sport" ? `${show.category ?? "Stadium"} Match` : show.format}
                </span>
              </div>
              <p className="truncate text-xs font-medium text-slate-500">
                {show.venueName} &bull; {formatDateLong(start)} &bull; {formatTime(start)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-1.5 shadow-xs">
            <Clock className="h-3.5 w-3.5 animate-pulse text-rose-500" />
            <div className="flex flex-col text-right leading-none">
              <span className="text-[9px] font-bold tracking-wider text-rose-400 uppercase">Time Left</span>
              <span className="font-mono text-xs font-black text-rose-600" role="timer">
                {timer}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 py-6 pb-36 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-slate-200/80 bg-white/90 px-6 py-3 text-xs font-bold shadow-xs backdrop-blur-md sm:gap-10">
          <span className="flex items-center gap-2.5">
            <span className="seat seat-available pointer-events-none h-5! w-5!" /> <span className="text-emerald-700">Available</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="seat seat-selected pointer-events-none h-5! w-5!" /> <span className="text-rose-600">Selected</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="seat seat-sold pointer-events-none h-5! w-5!" /> <span className="font-semibold text-slate-400">Sold</span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="seat seat-accessible pointer-events-none h-5! w-5!">
              <Accessibility className="h-2.5 w-2.5" />
            </span>
            <span className="text-blue-600">Wheelchair</span>
          </span>
        </div>

        <div className="mb-6 flex w-full justify-center">
          {seatMap.layout === "stadium" ? (
            <StadiumMap onSelectTier={jumpToTier} />
          ) : (
            <div className="mx-auto w-full max-w-[520px] px-4 text-center">
              <div className="cinema-screen-arc" />
              <div className="cinema-screen-glow" />
              <p className="mt-2 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                <Tv className="h-3 w-3" /> All Eyes This Way &bull; Screen
              </p>
            </div>
          )}
        </div>

        <div className="no-scrollbar flex w-full flex-col items-center gap-6 overflow-x-auto py-2">
          {seatMap.tiers.map((tier, index) => {
            const Icon = tierIcon(show, index);
            return (
              <div
                key={tier.id}
                ref={(el) => {
                  tierRefs.current[index] = el;
                }}
                className={cn(
                  "mx-auto w-full max-w-2xl rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md sm:p-6",
                  highlight === index && "ring-4 ring-emerald-500/40",
                )}
              >
                <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100/90 px-1 pb-3.5">
                  <span
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3.5 py-1 text-xs font-black tracking-wider uppercase",
                      ACCENT_BADGE[tier.accent],
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-1">{show.kind === "sport" ? `${tier.name} • ${tier.description}` : tier.description}</span>
                  </span>
                  <span className="shrink-0 rounded-xl bg-slate-100/80 px-3.5 py-1 text-xs font-black text-slate-900 sm:text-sm">
                    {formatINR(tier.pricePaise)} <span className="text-[10px] font-normal text-slate-400">/seat</span>
                  </span>
                </div>
                <div className="flex w-full flex-col items-center gap-3">
                  {tier.rows.map((row) => (
                    <div key={row.row} className="flex w-full items-center justify-center gap-2.5 sm:gap-3.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">
                        {row.row}
                      </span>
                      <div className="flex items-center gap-1.5 sm:gap-2.5">
                        {row.seats.map((seat) => {
                          const isSelected = selected.includes(seat.id);
                          return (
                            <Fragment key={seat.id}>
                              <button
                                type="button"
                                disabled={seat.status === "sold"}
                                onClick={() => toggleSeat(seat.id)}
                                aria-pressed={isSelected}
                                aria-label={`Seat ${seat.id}, ${tier.name}, ${formatINR(tier.pricePaise)}${seat.status === "sold" ? ", sold" : ""}`}
                                title={`Seat ${seat.id} (${tier.name} - ${formatINR(tier.pricePaise)})`}
                                className={cn(
                                  "seat tap-active shrink-0",
                                  tier.recliner && "seat-recliner",
                                  seat.status === "sold"
                                    ? "seat-sold"
                                    : isSelected
                                      ? "seat-selected"
                                      : seat.status === "accessible"
                                        ? "seat-accessible"
                                        : "seat-available",
                                )}
                              >
                                {seat.status === "accessible" && !isSelected ? <Accessibility className="h-2.5 w-2.5" /> : seat.number}
                              </button>
                              {row.aisleAfter === seat.number && <span className="w-3 shrink-0 sm:w-5" />}
                            </Fragment>
                          );
                        })}
                      </div>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">
                        {row.row}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <div className="pointer-events-none fixed right-0 bottom-0 left-0 z-50 p-4">
        <div className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
              <TicketCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5">
                {selected.length === 0 ? (
                  <span className="text-xs font-medium text-slate-500">No seats selected yet</span>
                ) : (
                  selected.map((id) => (
                    <span
                      key={id}
                      className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-black text-rose-600"
                    >
                      {id}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-lg font-black text-slate-900 sm:text-xl">{formatINR(totalPaise)}</span>
                <span className="text-xs font-medium text-slate-500">({selected.length} seats)</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={proceed}
            disabled={selected.length === 0}
            className="gradient-btn tap-active flex shrink-0 items-center gap-2 rounded-xl px-6 py-3 text-xs font-black text-white shadow-lg shadow-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-2xl sm:px-8 sm:text-sm"
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
