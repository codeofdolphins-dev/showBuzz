import "server-only";
import type { Seat, SeatMap, SeatTier, ShowDetails } from "@showbuzz/schemas/types/catalog";
import type { SeatZone, ShowZone } from "@showbuzz/schemas/venue";
import { AppError } from "../http/app-error";
import { getScreen } from "./catalog.service";
import type { SeatState } from "./seat-hold.service";
import { findShow } from "./show.service";

/**
 * Seat maps: the layout comes from the venue's screen, zone names and prices from the show, and seat
 * availability from `seatHolds` (sold, held by others, or held by this browser).
 */

/** A show's priced zones joined with the screen's rows. */
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

const NO_HOLDS: SeatState = { unavailable: new Set(), mine: [] };

export function buildSeatMap(show: ShowDetails, plan: SeatPlan, state: SeatState = NO_HOLDS): SeatMap {
  const status = (id: string, accessible: boolean): Seat["status"] =>
    state.unavailable.has(id) ? "sold" : accessible ? "accessible" : "available";

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
        return { id, number: i + 1, status: status(id, r.accessibleSeats.includes(i + 1)) };
      }),
      aisleAfter: r.aisleAfter,
    })),
  }));

  return {
    layout: plan.layoutType,
    tiers,
    ...(state.mine.length > 0 && state.myExpiresAt
      ? { ownHold: { seatIds: state.mine, expiresAt: state.myExpiresAt.toISOString() } }
      : {}),
  };
}

export interface PricedSeat {
  id: string;
  tierName: string;
  pricePaise: number;
}

/** Prices the requested seats; rejects seats that don't exist, are sold or are held by someone else. */
export function priceSeats(
  show: ShowDetails,
  plan: SeatPlan,
  seatIds: string[],
  state: SeatState = NO_HOLDS,
): PricedSeat[] {
  const map = buildSeatMap(show, plan, state);
  return seatIds.map((id) => {
    for (const tier of map.tiers) {
      const seat = tier.rows.flatMap((r) => r.seats).find((s) => s.id === id);
      if (!seat) continue;
      if (seat.status === "sold") {
        throw new AppError("SEAT_UNAVAILABLE", `Seat ${id} has just been taken. Please pick another seat.`, 409, {
          seats: [id],
        });
      }
      return { id, tierName: tier.name, pricePaise: tier.pricePaise };
    }
    throw new AppError("SEAT_UNAVAILABLE", `Seat ${id} does not exist for this show.`, 422);
  });
}
