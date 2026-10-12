import "server-only";
import type { Seat, SeatMap, SeatRow, SeatTier, ShowDetails } from "@/types/catalog";
import { events } from "@/server/data/seed-catalog";
import { AppError } from "@/server/http/app-error";
import { getShowBasePrice } from "./show.service";

/**
 * Seat layouts mirror the prototype's fixed auditorium (rows A-G). Sold seats are the
 * prototype's static set plus seats sold through demo bookings. In the backend phase this is
 * replaced by seatLayouts + seatHolds/bookings, where a unique index prevents double-booking.
 */

const PROTOTYPE_SOLD = new Set(["A3", "A4", "B7", "C5", "C6", "C7", "D10", "D11", "E4", "E5", "F8", "F9", "G10"]);

const globalStore = globalThis as unknown as { __showbuzzSoldSeats?: Map<string, Set<string>> };
const soldSeats = (globalStore.__showbuzzSoldSeats ??= new Map<string, Set<string>>());

const ROW_PLAN: { tierIndex: 0 | 1 | 2; row: string; count: number }[] = [
  { tierIndex: 0, row: "A", count: 8 },
  { tierIndex: 0, row: "B", count: 8 },
  { tierIndex: 1, row: "C", count: 12 },
  { tierIndex: 1, row: "D", count: 12 },
  { tierIndex: 1, row: "E", count: 12 },
  { tierIndex: 2, row: "F", count: 12 },
  { tierIndex: 2, row: "G", count: 12 },
];

const ACCENTS: SeatTier["accent"][] = ["rose", "amber", "blue"];

interface TierSpec {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
}

function movieTiers(basePaise: number): TierSpec[] {
  return [
    { id: "recliner", name: "Royal Recliner", description: "Recliner Section", pricePaise: basePaise },
    { id: "prime", name: "Prime Gold", description: "Prime Gold", pricePaise: Math.max(18_000, basePaise - 18_000) },
    {
      id: "classic",
      name: "Classic Silver",
      description: "Classic Silver",
      pricePaise: Math.max(15_000, basePaise - 30_000),
    },
  ];
}

const STADIUM_BLOCKS = [
  "Purple Outer & Teal Blocks • G1/F1/D1/C1/K1/H/L",
  "Hot Pink Pavilion • Block C/K & Club House",
  "Gray Stand Blocks • G/F/D/B/H1/L1/B1",
];

function sportTiers(eventId: string): TierSpec[] {
  const event = events.find((e) => e.id === eventId);
  if (!event) return [];
  return event.ticketTiers.slice(0, 3).map((t, i) => ({
    id: t.id,
    name: t.name,
    description: STADIUM_BLOCKS[i] ?? t.description,
    pricePaise: t.pricePaise,
  }));
}

function tierSpecs(show: ShowDetails): TierSpec[] {
  if (show.kind === "sport") return sportTiers(show.id.replace(/^sport_/, ""));
  const base = getShowBasePrice(show.id);
  return base === undefined ? [] : movieTiers(base);
}

function seatStatus(showId: string, row: string, n: number, count: number): Seat["status"] {
  const id = `${row}${n}`;
  if (PROTOTYPE_SOLD.has(id) || soldSeats.get(showId)?.has(id)) return "sold";
  if (row === "C" && (n === 1 || n === count)) return "accessible";
  return "available";
}

export function buildSeatMap(show: ShowDetails): SeatMap {
  const specs = tierSpecs(show);
  const tiers: SeatTier[] = specs.map((spec, i) => ({
    ...spec,
    accent: ACCENTS[i] ?? "blue",
    recliner: i === 0 && show.kind === "movie",
    rows: [],
  }));

  for (const plan of ROW_PLAN) {
    const tier = tiers[plan.tierIndex];
    if (!tier) continue;
    const row: SeatRow = {
      row: plan.row,
      seats: Array.from({ length: plan.count }, (_, i) => ({
        id: `${plan.row}${i + 1}`,
        number: i + 1,
        status: seatStatus(show.id, plan.row, i + 1, plan.count),
      })),
      aisleAfter: plan.count > 8 ? plan.count / 2 : undefined,
    };
    tier.rows.push(row);
  }

  return { layout: show.kind === "sport" ? "stadium" : "screen", tiers };
}

export interface PricedSeat {
  id: string;
  tierName: string;
  pricePaise: number;
}

/** Prices the requested seats and rejects any that do not exist or are already sold. */
export function priceSeats(show: ShowDetails, seatIds: string[]): PricedSeat[] {
  const map = buildSeatMap(show);
  return seatIds.map((id) => {
    for (const tier of map.tiers) {
      const seat = tier.rows.flatMap((r) => r.seats).find((s) => s.id === id);
      if (!seat) continue;
      if (seat.status === "sold") {
        throw new AppError("SEAT_UNAVAILABLE", `Seat ${id} has just been booked. Please pick another seat.`, 409);
      }
      return { id, tierName: tier.name, pricePaise: tier.pricePaise };
    }
    throw new AppError("SEAT_UNAVAILABLE", `Seat ${id} does not exist for this show.`, 422);
  });
}

/**
 * Marks seats sold for demo bookings. Callers must validate with priceSeats in the same
 * synchronous step; the real implementation relies on a unique index, not check-then-insert.
 */
export function markSeatsSold(showId: string, seatIds: string[]) {
  const set = soldSeats.get(showId) ?? new Set<string>();
  seatIds.forEach((id) => set.add(id));
  soldSeats.set(showId, set);
}

export function releaseSeats(showId: string, seatIds: string[]) {
  const set = soldSeats.get(showId);
  seatIds.forEach((id) => set?.delete(id));
}
