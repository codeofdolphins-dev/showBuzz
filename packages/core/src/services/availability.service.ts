import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Show } from "@showbuzz/db/models/Show";
import type { EventListing } from "@showbuzz/schemas/event";
import { releaseLapsedOrders } from "./booking.service";
import { getShowIdForEvent } from "./catalog.service";
import { getSeatState } from "./seat-hold.service";
import { loadSeatPlan } from "./seat-map.service";
import { findPassShow } from "./show.service";

/**
 * Live "how many are left" per ticket tier for a listing page (uncached: changes with every sale). Pass tiers
 * read the pass show's inventory; stadium stands count the free seats of the matching zone.
 */
export async function getTierAvailability(event: EventListing, now: Date): Promise<Record<string, number>> {
  if (event.kind === "sport") {
    const showId = await getShowIdForEvent(event.id);
    const plan = showId ? await loadSeatPlan(showId) : undefined;
    if (!showId || !plan) return {};
    const { unavailable } = await getSeatState(showId, undefined, now);
    const free: Record<string, number> = {};
    plan.zones.forEach(({ layout }, i) => {
      const tier = event.ticketTiers[i];
      if (!tier) return;
      const seatIds = layout.rows.flatMap((r) => Array.from({ length: r.count }, (_, n) => `${r.row}${n + 1}`));
      free[tier.id] = seatIds.filter((id) => !unavailable.has(id)).length;
    });
    return free;
  }

  const passShow = await findPassShow(event.id);
  if (!passShow) return {};
  await releaseLapsedOrders(passShow._id, now);
  await connect();
  const fresh = await Show.findById(passShow._id, { inventory: 1 }).lean();
  return Object.fromEntries((fresh?.inventory ?? []).map((t) => [t.tierId, t.remaining]));
}
