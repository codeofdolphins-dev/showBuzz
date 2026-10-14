"use client";

import Link from "next/link";
import { useState } from "react";
import { Building, CircleCheck, Search } from "lucide-react";
import { EmptyState } from "@/components/public/common/EmptyState";
import { cn } from "@showbuzz/utils/cn";
import { formatTime, istHour } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import type { Cinema } from "@showbuzz/schemas/venue";
import { useCityStore } from "@/stores/city";
import type { Show } from "@showbuzz/schemas/types/catalog";

interface CinemaShowtimes {
  cinema: Cinema;
  shows: Show[];
}

const PRICE_BANDS = {
  all: [0, Infinity],
  low: [0, 25_000],
  mid: [25_100, 45_000],
  high: [45_100, Infinity],
} as const;

const TIME_BANDS = {
  all: [0, 24],
  morning: [0, 12],
  afternoon: [12, 16],
  evening: [16, 20],
  night: [20, 24],
} as const;

const AVAILABILITY_STYLES: Record<Show["availability"], string> = {
  "almost-full": "border-rose-300 bg-rose-50/40 hover:bg-rose-500",
  "fast-filling": "border-amber-300 bg-amber-50/40 hover:bg-amber-500",
  available: "border-emerald-300 bg-white hover:bg-emerald-500",
};

interface ShowtimeBrowserProps {
  showtimes: CinemaShowtimes[];
  /** When set, only this cinema is listed (e.g. linked from "Popular Cinemas"); `allHref` lifts the filter. */
  cinemaFilter?: { slug: string; allHref: string };
}

export function ShowtimeBrowser({ showtimes, cinemaFilter }: ShowtimeBrowserProps) {
  const cinemaSlug = cinemaFilter?.slug;
  const cityId = useCityStore((s) => s.city.id);
  const cityName = useCityStore((s) => s.city.name);
  const [format, setFormat] = useState("all");
  const [price, setPrice] = useState<keyof typeof PRICE_BANDS>("all");
  const [time, setTime] = useState<keyof typeof TIME_BANDS>("all");
  const [query, setQuery] = useState("");

  const q = query.toLowerCase().trim();
  const [minPrice, maxPrice] = PRICE_BANDS[price];
  const [fromHour, toHour] = TIME_BANDS[time];

  const listed = showtimes
    .filter(({ cinema }) => (cinemaSlug ? cinema.slug === cinemaSlug : cinema.cityId === cityId))
    .filter(({ cinema }) => !q || `${cinema.name} ${cinema.address}`.toLowerCase().includes(q))
    .map(({ cinema, shows }) => ({
      cinema,
      shows: shows.filter((s) => {
        const hour = istHour(new Date(s.startsAt));
        return (
          (format === "all" || s.format === format) &&
          s.pricePaise >= minPrice &&
          s.pricePaise <= maxPrice &&
          hour >= fromHour &&
          hour < toHour
        );
      }),
    }));

  const selectClass =
    "rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:border-rose-500 focus:outline-none";

  const viewAllLink = cinemaFilter && (
    <Link
      href={cinemaFilter.allHref}
      replace
      scroll={false}
      className="tap-active inline-block rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100"
    >
      View all cinemas in {cityName} &rarr;
    </Link>
  );

  return (
    <>
      {cinemaFilter && listed.length > 0 && <div className="mb-3 flex justify-end">{viewAllLink}</div>}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format" className={selectClass}>
            <option value="all">Formats (All)</option>
            {["IMAX 3D", "4DX", "3D", "2D"].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={price}
            onChange={(e) => setPrice(e.target.value as keyof typeof PRICE_BANDS)}
            aria-label="Price"
            className={selectClass}
          >
            <option value="all">Price (All)</option>
            <option value="low">₹0 - ₹250</option>
            <option value="mid">₹251 - ₹450</option>
            <option value="high">₹451+</option>
          </select>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value as keyof typeof TIME_BANDS)}
            aria-label="Show timing"
            className={selectClass}
          >
            <option value="all">Timing (All)</option>
            <option value="morning">Morning (&lt;12 PM)</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="night">Night (&gt;8 PM)</option>
          </select>
        </div>
        <div className="relative w-full sm:w-56">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cinema..."
            aria-label="Search cinema"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none"
          />
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {listed.length === 0 ? (
        <EmptyState
          icon={Building}
          title={cinemaSlug ? "This cinema isn't showing this movie" : `No cinemas found in ${cityName}`}
          description="Try another date, clear your search, or switch city from the location picker."
          action={viewAllLink}
        />
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {listed.map(({ cinema, shows }) => (
            <div
              key={cinema.id}
              className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:border-slate-300 sm:p-6"
            >
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 sm:text-base">{cinema.name}</h3>
                {cinema.operatorName && (
                  <p className="text-[10px] font-semibold text-slate-400">by {cinema.operatorName}</p>
                )}
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {cinema.address} &bull; <span className="font-semibold text-blue-600">{cinema.distanceLabel}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold sm:text-[10px]",
                      cinema.cancellation.allowed ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {cinema.cancellation.allowed && <CircleCheck className="h-2.5 w-2.5" />} {cinema.cancellation.label}
                  </span>
                  {cinema.amenities.slice(0, 3).map((a) => (
                    <span key={a} className="rounded bg-slate-100 px-1.5 text-[9px] font-medium text-slate-600">
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                {shows.length === 0 && (
                  <p className="text-xs text-slate-400">No more shows match your filters for this date.</p>
                )}
                {shows.map((show) => (
                  <Link
                    key={show.id}
                    href={`/booking/${show.id}/seats`}
                    className={cn(
                      "group tap-active relative flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all hover:text-white sm:p-3",
                      AVAILABILITY_STYLES[show.availability],
                    )}
                  >
                    <span className="text-xs font-black">{formatTime(new Date(show.startsAt))}</span>
                    <span className="mt-0.5 rounded bg-slate-100 px-1 text-[8px] font-bold text-slate-700 uppercase group-hover:bg-white/20 group-hover:text-white sm:text-[9px]">
                      {show.format} &bull; {show.language}
                    </span>
                    <span className="mt-1 text-[10px] font-bold text-slate-900 group-hover:text-white">
                      {formatINR(show.pricePaise)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Fast Filling
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Almost Full
        </span>
      </div>
    </>
  );
}
