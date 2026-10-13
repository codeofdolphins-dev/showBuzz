import "server-only";
import type { Seat, SeatMap, SeatTier, ShowDetails } from "@showbuzz/schemas/types/catalog";
import type { SeatZone, ShowZone } from "@showbuzz/schemas/venue";
import { AppError } from "../http/app-error";
import { getScreen } from "./catalog.service";
import { findShow } from "./show.service";

/**
 * Seat layouts come from the venue's screen (MongoDB); zone names and prices come from the show. Sold
 * seats are still the prototype's static set plus seats sold through demo bookings (in memory). In the
 * booking batch this becomes seatHolds/bookings, where a unique index prevents double-booking.
 */

const PROTOTYPE_SOLD = new Set(["A3", "A4", "B7", "C5", "C6", "C7", "D10", "D11", "E4", "E5", "F8", "F9", "G10"]);

const globalStore = globalThis as unknown as { __showbuzzSoldSeats?: Map<string, Set<string>> };
const soldSeats = (globalStore.__showbuzzSoldSeats ??= new Map<string, Set<string>>());

/** A show's priced zones joined with the screen's rows. Load it before any synchronous claim step. */
export interface SeatPlan {
  layoutType: "screen" | "stadium";
  zones: { layout: SeatZone; pricing: ShowZone }[];
}

export async function loadSeatPlan(showId: string): Promise<SeatPlan | undefined> {
  const show = await findShow(showId);
  if (!show) return undefined;
  const screen = await getScreen(show.venueId.toString(), show.screenId);
  if (!screen) return undefined;
  const zones = show.zones.flatMap((pricing) => {
    const layout = screen.zones.find((z) => z.id === pricing.zoneId);
    return layout ? [{ layout, pricing }] : [];
  });
  return { layoutType: screen.layoutType, zones };
}

function seatStatus(showId: string, id: string, accessible: boolean): Seat["status"] {
  if (PROTOTYPE_SOLD.has(id) || soldSeats.get(showId)?.has(id)) return "sold";
  return accessible ? "accessible" : "available";
}

export function buildSeatMap(show: ShowDetails, plan: SeatPlan): SeatMap {
  const tiers: SeatTier[] = plan.zones.map(({ layout, pricing }) => ({
    id: layout.id,
    name: pricing.name,
    description: pricing.description,
    pricePaise: pricing.pricePaise,
    accent: layout.accent,
    recliner: layout.recliner && show.kind === "movie",
    rows: layout.rows.map((r) => ({
      row: r.row,
      seats: Array.from({ length: r.count }, (_, i) => {
        const id = `${r.row}${i + 1}`;
        return { id, number: i + 1, status: seatStatus(show.id, id, r.accessibleSeats.includes(i + 1)) };
      }),
      aisleAfter: r.aisleAfter,
    })),
  }));
  return { layout: plan.layoutType, tiers };
}

export interface PricedSeat {
  id: string;
  tierName: string;
  pricePaise: number;
}

/** Prices the requested seats and rejects any that do not exist or are already sold. Synchronous on purpose. */
export function priceSeats(show: ShowDetails, plan: SeatPlan, seatIds: string[]): PricedSeat[] {
  const map = buildSeatMap(show, plan);
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
