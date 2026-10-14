import { formatINR } from "@showbuzz/utils/money";
import type { SeatAccent } from "@showbuzz/schemas/venue";

/** Seat-category colours in the console (prototype seat-layout legend: Regular indigo, Premium blue, ...). */
export const ACCENT_SEAT: Record<SeatAccent, string> = {
  indigo: "border-indigo-300 bg-indigo-50 text-indigo-700",
  blue: "border-blue-300 bg-blue-50 text-blue-700",
  teal: "border-teal-300 bg-teal-50 text-teal-700",
  amber: "border-amber-300 bg-amber-50 text-amber-800",
  purple: "border-purple-300 bg-purple-50 text-purple-700",
  green: "border-emerald-300 bg-emerald-50 text-emerald-700",
  rose: "border-rose-300 bg-rose-50 text-rose-700",
  slate: "border-slate-300 bg-slate-50 text-slate-700",
};

export const ACCENT_SWATCH: Record<SeatAccent, string> = {
  indigo: "bg-indigo-500",
  blue: "bg-blue-500",
  teal: "bg-teal-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  green: "bg-emerald-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

export const ACCENT_LABELS: Record<SeatAccent, string> = {
  indigo: "Indigo",
  blue: "Blue",
  teal: "Teal",
  amber: "Amber",
  purple: "Purple",
  green: "Green",
  rose: "Rose",
  slate: "Slate",
};

/** One seat cell (both grids share the size so a layout looks the same in the designer and the live map). */
export const SEAT_CELL =
  "flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-md border text-[10px] font-bold transition-transform";

/** "₹180 – ₹650" over a screen's categories (default prices). */
export function priceRange(categories: { defaultPricePaise: number }[]): string {
  const prices = categories.map((c) => c.defaultPricePaise);
  if (prices.length === 0) return "—";
  const [min, max] = [Math.min(...prices), Math.max(...prices)];
  return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
}
