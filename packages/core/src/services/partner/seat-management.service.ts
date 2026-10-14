import "server-only";
import { connect } from "@showbuzz/db/connect";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { LIVE_SHOW_FILTER, Show } from "@showbuzz/db/models/Show";
import { Venue, toScreen } from "@showbuzz/db/models/Venue";
import { Types } from "@showbuzz/db/mongoose";
import { showSeatSelectionSchema } from "@showbuzz/schemas/partner-venue";
import type { SeatBoardState, SeatBoardZone, ShowOption, ShowSeatBoard } from "@showbuzz/schemas/types/partner-venue";
import { addDaysToKey, istDateTime } from "@showbuzz/utils/dates";
import { AppError } from "../../http/app-error";
import { describeShows, showLabel } from "./venue.service";

/**
 * Live seat management for one of the vendor's shows: who has which seat (sold, in checkout, blocked) and the
 * vendor's per-show blocks. A block is a `seatHolds` document with status `blocked`, so the unique
 * `{ showId, seatId }` index keeps a blocked seat from being held or sold, exactly like a customer's hold.
 * Shows are always looked up together with the session's vendor id: another vendor's show answers 404.
 */

const vendorHolderKey = (vendorId: string) => `vendor:${vendorId}`;

const SHOW_NOT_FOUND = () => new AppError("NOT_FOUND", "This show doesn't exist or isn't yours.", 404);

function toObjectId(id: string): Types.ObjectId | null {
  return /^[0-9a-f]{24}$/.test(id) ? new Types.ObjectId(id) : null;
}

/** The vendor's seat-map shows (not pass shows) on one IST date, optionally at one venue. */
export async function listVendorShowOptions(
  vendorId: string,
  { dateKey, venueId }: { dateKey: string; venueId?: string },
): Promise<ShowOption[]> {
  await connect();
  const filter: Record<string, unknown> = {
    vendorId: new Types.ObjectId(vendorId),
    startsAt: { $gte: istDateTime(dateKey, "00:00"), $lt: istDateTime(addDaysToKey(dateKey, 1), "00:00") },
    $or: [{ inventory: { $exists: false } }, { inventory: { $size: 0 } }],
    ...LIVE_SHOW_FILTER,
  };
  const venueObjectId = venueId ? toObjectId(venueId) : null;
  if (venueObjectId) filter.venueId = venueObjectId;
  const shows = await Show.find(filter, { movieId: 1, eventId: 1, startsAt: 1, screenName: 1 })
    .sort({ startsAt: 1 })
    .limit(300)
    .lean();
  const described = await describeShows(shows);
  return shows.map((s) => {
    const info = described.get(s._id.toString());
    return { id: s._id.toString(), label: `${showLabel(info?.title ?? "Show", info?.startsAt)} · ${s.screenName}` };
  });
}

async function findOwnSeatShow(vendorId: string, showId: string) {
  const _id = toObjectId(showId);
  if (!_id) return null;
  await connect();
  const show = await Show.findOne({ _id, vendorId: new Types.ObjectId(vendorId) }).lean();
  if (!show || (show.inventory ?? []).length > 0) return null;
  return show;
}

export async function getShowSeatBoard(vendorId: string, showId: string, now: Date): Promise<ShowSeatBoard | null> {
  const show = await findOwnSeatShow(vendorId, showId);
  if (!show) return null;
  const venue = await Venue.findOne({ _id: show.venueId, vendorId: show.vendorId }, { name: 1, screens: 1 }).lean();
  const stored = venue?.screens.find((s) => s.id === show.screenId);
  if (!venue || !stored) return null;
  const screen = toScreen(stored);

  const holds = await SeatHold.find({ showId: show._id }, { seatId: 1, status: 1, expiresAt: 1, bookingId: 1 }).lean();
  const live = new Map<string, SeatBoardState>();
  for (const hold of holds) {
    if (hold.status === "sold") live.set(hold.seatId, "sold");
    else if (hold.status === "blocked") live.set(hold.seatId, "blocked");
    else if (hold.expiresAt && hold.expiresAt > now) live.set(hold.seatId, hold.bookingId ? "pending" : "held");
  }

  const counts: Record<SeatBoardState, number> = { free: 0, sold: 0, pending: 0, held: 0, blocked: 0, unavailable: 0 };
  const zones: SeatBoardZone[] = screen.zones.map((zone) => {
    const pricing = show.zones.find((z) => z.zoneId === zone.id);
    return {
      id: zone.id,
      name: pricing?.name ?? zone.name,
      accent: zone.accent,
      pricePaise: pricing?.pricePaise ?? zone.defaultPricePaise,
      rows: zone.rows.map((row) => ({
        row: row.row,
        aislesAfter: row.aislesAfter,
        seats: Array.from({ length: row.count }, (_, i) => {
          const id = `${row.row}${i + 1}`;
          const state: SeatBoardState = row.blockedSeats.includes(i + 1) ? "unavailable" : (live.get(id) ?? "free");
          counts[state] += 1;
          return { id, number: i + 1, state, accessible: row.accessibleSeats.includes(i + 1) };
        }),
      })),
    };
  });

  const described = await describeShows([show]);
  const info = described.get(show._id.toString());
  return {
    show: {
      id: show._id.toString(),
      title: info?.title ?? "Show",
      venueName: venue.name,
      screenName: show.screenName,
      ...(show.startsAt ? { startsAt: show.startsAt.toISOString() } : {}),
      started: !show.startsAt || show.startsAt <= now,
    },
    layoutType: screen.layoutType,
    zones,
    counts,
  };
}

async function requireOpenShow(vendorId: string, showId: string, now: Date) {
  const show = await findOwnSeatShow(vendorId, showId);
  if (!show) throw SHOW_NOT_FOUND();
  if (!show.startsAt || show.startsAt <= now) {
    throw new AppError("CONFLICT", "This show has already started, so its seats can't be changed.", 409);
  }
  return show;
}

/** Seats of the show's layout that can be sold (exist and aren't blocked in the layout). */
async function sellableSeatIds(show: { venueId: Types.ObjectId; vendorId: Types.ObjectId; screenId: string }) {
  const venue = await Venue.findOne({ _id: show.venueId, vendorId: show.vendorId }, { screens: 1 }).lean();
  const stored = venue?.screens.find((s) => s.id === show.screenId);
  const ids = new Set<string>();
  if (!stored) return ids;
  for (const zone of toScreen(stored).zones) {
    for (const row of zone.rows) {
      for (let n = 1; n <= row.count; n += 1) if (!row.blockedSeats.includes(n)) ids.add(`${row.row}${n}`);
    }
  }
  return ids;
}

export interface SeatActionResult {
  showId: string;
  changed: string[];
  /** Seats left as they were (taken, or not in the requested state). */
  skipped: string[];
}

/** Takes free seats off sale for this show. Seats sold or in a checkout are skipped and reported. */
export async function blockShowSeats(vendorId: string, raw: unknown, now: Date): Promise<SeatActionResult> {
  const { showId, seatIds } = showSeatSelectionSchema.parse(raw);
  const show = await requireOpenShow(vendorId, showId, now);
  const sellable = await sellableSeatIds(show);
  const requested = [...new Set(seatIds)].filter((id) => sellable.has(id));

  // An expired hold the TTL monitor hasn't removed yet must not stop the block.
  await SeatHold.deleteMany({ showId: show._id, seatId: { $in: requested }, status: "held", expiresAt: { $lte: now } });
  const existing = await SeatHold.find({ showId: show._id, seatId: { $in: requested } }, { seatId: 1 }).lean();
  const taken = new Set(existing.map((h) => h.seatId));
  const toBlock = requested.filter((id) => !taken.has(id));
  if (toBlock.length > 0) {
    try {
      await SeatHold.insertMany(
        toBlock.map((seatId) => ({
          showId: show._id,
          seatId,
          status: "blocked",
          holderKey: vendorHolderKey(vendorId),
        })),
        { ordered: false },
      );
    } catch (err) {
      const e = err as { code?: number; writeErrors?: { code?: number }[] };
      const onlyDuplicates = e.code === 11000 || (e.writeErrors?.every((w) => w.code === 11000) ?? false);
      if (!onlyDuplicates) throw err;
    }
  }
  const nowBlocked = await SeatHold.find(
    { showId: show._id, seatId: { $in: toBlock }, status: "blocked" },
    { seatId: 1 },
  ).lean();
  const changed = nowBlocked.map((h) => h.seatId).sort();
  const changedSet = new Set(changed);
  return { showId, changed, skipped: [...new Set(seatIds)].filter((id) => !changedSet.has(id)).sort() };
}

/** Puts seats this vendor blocked for the show back on sale. */
export async function unblockShowSeats(vendorId: string, raw: unknown, now: Date): Promise<SeatActionResult> {
  const { showId, seatIds } = showSeatSelectionSchema.parse(raw);
  const show = await requireOpenShow(vendorId, showId, now);
  const blocked = await SeatHold.find(
    { showId: show._id, seatId: { $in: seatIds }, status: "blocked" },
    { seatId: 1 },
  ).lean();
  const changed = blocked.map((h) => h.seatId).sort();
  await SeatHold.deleteMany({ showId: show._id, seatId: { $in: changed }, status: "blocked" });
  const changedSet = new Set(changed);
  return { showId, changed, skipped: [...new Set(seatIds)].filter((id) => !changedSet.has(id)).sort() };
}

/**
 * Releases stuck checkout holds (never sold seats). A hold that belongs to an order waiting for payment makes that
 * payment fail safely: confirmation needs every seat still held, otherwise the order fails and is refunded in full.
 */
export async function releaseHeldSeats(
  vendorId: string,
  raw: unknown,
  now: Date,
): Promise<SeatActionResult & { pendingOrders: number }> {
  const { showId, seatIds } = showSeatSelectionSchema.parse(raw);
  const show = await requireOpenShow(vendorId, showId, now);
  const held = await SeatHold.find(
    { showId: show._id, seatId: { $in: seatIds }, status: "held" },
    { seatId: 1, bookingId: 1 },
  ).lean();
  const changed = held.map((h) => h.seatId).sort();
  await SeatHold.deleteMany({ showId: show._id, seatId: { $in: changed }, status: "held" });
  const pendingOrders = new Set(held.flatMap((h) => (h.bookingId ? [h.bookingId.toString()] : []))).size;
  const changedSet = new Set(changed);
  return {
    showId,
    changed,
    skipped: [...new Set(seatIds)].filter((id) => !changedSet.has(id)).sort(),
    pendingOrders,
  };
}
