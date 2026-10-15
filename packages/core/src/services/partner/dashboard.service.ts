import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { Event } from "@showbuzz/db/models/Event";
import { Movie } from "@showbuzz/db/models/Movie";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { LIVE_SHOW_FILTER, Show, type ShowAttrs } from "@showbuzz/db/models/Show";
import { Venue, type VenueAttrs, toScreen } from "@showbuzz/db/models/Venue";
import type { Types } from "@showbuzz/db/mongoose";
import type { DashboardRange } from "@showbuzz/schemas/dashboard";
import type { PartnerDashboard, ShowOccupancy } from "@showbuzz/schemas/types/dashboard";
import { screenCapacity } from "@showbuzz/schemas/venue";
import { AppError } from "../../http/app-error";
import { SOLD_STATUSES, dashboardWindow, fillTrend } from "../dashboard-period";
import { cached } from "../ttl-cache";
import { toObjectId } from "./ids";

/**
 * The vendor's dashboard. Every query is filtered by the session's vendor id (the caller passes it from
 * requireVendorPage, never from the request). Money uses the same rules as Earnings: sales = tickets + food of
 * bookings sold in the period (by `confirmedAt`, IST), the vendor's share = of bookings still confirmed.
 *
 * Occupancy per show: seated shows = seats sold ÷ seats on sale in the screen layout; pass shows = passes sold ÷
 * capacity. Cached for one minute per vendor and range.
 */

const CACHE_MS = 60_000;
const UPCOMING_DAYS = 7;
const LIST = 8;
/** Bounds the occupancy average for a very busy vendor (30 days of shows). */
const MAX_SHOWS = 2_000;

type LeanShow = ShowAttrs & { _id: Types.ObjectId };

const confirmed = { $eq: ["$status", "confirmed"] };
const cancelled = { $eq: ["$status", "cancelled"] };
const subtotal = {
  $ifNull: ["$settlement.subtotalPaise", { $add: ["$amounts.ticketsPaise", { $ifNull: ["$amounts.foodPaise", 0] }] }],
};
const discount = { $ifNull: ["$settlement.discountPaise", { $ifNull: ["$amounts.discountPaise", 0] }] };
const share = { $ifNull: ["$settlement.vendorSharePaise", { $subtract: [subtotal, discount] }] };

const totalsGroup = {
  _id: null,
  bookings: { $sum: 1 },
  tickets: { $sum: { $cond: [confirmed, "$ticketCount", 0] } },
  salesPaise: { $sum: subtotal },
  vendorSharePaise: { $sum: { $cond: [confirmed, share, 0] } },
  refundsPaise: { $sum: { $cond: [cancelled, { $ifNull: ["$refundPaise", 0] }, 0] } },
  counterBookings: { $sum: { $cond: [{ $eq: ["$channel", "counter"] }, 1, 0] } },
  checkedIn: { $sum: { $cond: [{ $gt: ["$checkedInAt", null] }, 1, 0] } },
};

interface Totals {
  bookings: number;
  tickets: number;
  salesPaise: number;
  vendorSharePaise: number;
  refundsPaise: number;
  counterBookings: number;
  checkedIn: number;
}

const EMPTY: Totals = {
  bookings: 0,
  tickets: 0,
  salesPaise: 0,
  vendorSharePaise: 0,
  refundsPaise: 0,
  counterBookings: 0,
  checkedIn: 0,
};

export function getPartnerDashboard(vendorId: string, range: DashboardRange, now: Date): Promise<PartnerDashboard> {
  return cached(`partner-dashboard:${vendorId}:${range}`, CACHE_MS, () => build(vendorId, range, now));
}

async function build(vendorId: string, range: DashboardRange, now: Date): Promise<PartnerDashboard> {
  const vendor = toObjectId(vendorId);
  if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found.", 404);
  const w = dashboardWindow(range, now);
  await connect();

  const sold = (from: Date, to: Date) => ({
    vendorId: vendor,
    status: { $in: SOLD_STATUSES },
    confirmedAt: { $gte: from, $lt: to },
  });
  const pastEnd = now < w.to ? now : w.to;

  const [[facets], [previous], recentDocs, pastShows, upcomingShows, venues] = await Promise.all([
    Booking.aggregate<{
      totals: Totals[];
      trend: { _id: string; salesPaise: number; tickets: number }[];
      titles: { _id: { kind: string; title: string }; salesPaise: number; tickets: number }[];
    }>([
      { $match: sold(w.from, w.to) },
      {
        $facet: {
          totals: [{ $group: totalsGroup }],
          trend: [
            {
              $group: {
                _id: { $dateToString: { format: w.bucketFormat, date: "$confirmedAt", timezone: "Asia/Kolkata" } },
                salesPaise: { $sum: subtotal },
                tickets: { $sum: { $cond: [confirmed, "$ticketCount", 0] } },
              },
            },
          ],
          titles: [
            {
              $group: {
                _id: { kind: "$kind", title: "$title" },
                salesPaise: { $sum: subtotal },
                tickets: { $sum: { $cond: [confirmed, "$ticketCount", 0] } },
              },
            },
            { $sort: { salesPaise: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ]),
    Booking.aggregate<Totals>([{ $match: sold(w.previousFrom, w.from) }, { $group: totalsGroup }]),
    Booking.find({ vendorId: vendor, status: { $in: SOLD_STATUSES } })
      .sort({ confirmedAt: -1 })
      .limit(LIST)
      .lean(),
    Show.find({ vendorId: vendor, ...LIVE_SHOW_FILTER, startsAt: { $gte: w.from, $lt: pastEnd } })
      .sort({ startsAt: -1 })
      .limit(MAX_SHOWS)
      .lean(),
    Show.find({
      vendorId: vendor,
      ...LIVE_SHOW_FILTER,
      startsAt: { $gte: now, $lt: new Date(now.getTime() + UPCOMING_DAYS * 86_400_000) },
    })
      .sort({ startsAt: 1 })
      .limit(LIST)
      .lean(),
    Venue.find({ vendorId: vendor }, { name: 1, screens: 1 }).lean(),
  ]);

  const occupancy = await occupancyOf([...pastShows, ...upcomingShows], venues);
  const pastRows = pastShows.map((s) => occupancy.get(s._id.toString())).filter((r) => r !== undefined);
  const withCapacity = pastRows.filter((r) => r.capacity > 0);
  const soldSum = withCapacity.reduce((sum, r) => sum + r.sold, 0);
  const capacitySum = withCapacity.reduce((sum, r) => sum + r.capacity, 0);

  const totals = facets?.totals[0] ?? EMPTY;
  const prev = previous ?? EMPTY;
  return {
    range,
    fromKey: w.fromKey,
    toKey: w.toKey,
    generatedAt: now.toISOString(),
    kpis: {
      salesPaise: totals.salesPaise,
      previousSalesPaise: prev.salesPaise,
      vendorSharePaise: totals.vendorSharePaise,
      bookings: totals.bookings,
      tickets: totals.tickets,
      previousTickets: prev.tickets,
      counterBookings: totals.counterBookings,
      checkedIn: totals.checkedIn,
      refundsPaise: totals.refundsPaise,
      occupancyBps: capacitySum > 0 ? Math.round((soldSum / capacitySum) * 10_000) : null,
      showsRun: pastShows.length,
    },
    trend: fillTrend(w, facets?.trend ?? []),
    topTitles: (facets?.titles ?? []).map((t) => ({
      key: `${t._id.kind}:${t._id.title}`,
      label: t._id.title,
      detail: t._id.kind === "movie" ? "Movie" : t._id.kind.charAt(0).toUpperCase() + t._id.kind.slice(1),
      salesPaise: t.salesPaise,
      tickets: t.tickets,
    })),
    upcoming: upcomingShows.flatMap((s) => occupancy.get(s._id.toString()) ?? []),
    pastShows: pastRows.slice(0, LIST),
    recent: recentDocs.map((b) => ({
      code: b.code,
      kind: b.kind,
      title: b.title,
      venueName: b.venueName,
      scheduleLabel: b.scheduleLabel,
      seats: b.seatLabels.length > 0 ? b.seatLabels.join(", ") : b.ticketLabel,
      ticketCount: b.ticketCount,
      totalPaise: b.amounts.totalPaise,
      status: b.status,
      channel: b.channel ?? "online",
      checkedIn: Boolean(b.checkedInAt),
      bookedAt: (b.confirmedAt ?? b.createdAt).toISOString(),
    })),
  };
}

async function occupancyOf(
  shows: LeanShow[],
  venues: { _id: Types.ObjectId; name: string; screens: VenueAttrs["screens"] }[],
): Promise<Map<string, ShowOccupancy>> {
  const result = new Map<string, ShowOccupancy>();
  if (shows.length === 0) return result;
  const seated = shows.filter((s) => (s.inventory ?? []).length === 0);
  const movieIds = [...new Set(shows.flatMap((s) => (s.movieId ? [s.movieId.toString()] : [])))];
  const eventIds = [...new Set(shows.flatMap((s) => (s.eventId ? [s.eventId.toString()] : [])))];
  const [soldRows, movies, events] = await Promise.all([
    seated.length
      ? SeatHold.aggregate<{ _id: Types.ObjectId; n: number }>([
          { $match: { showId: { $in: seated.map((s) => s._id) }, status: "sold" } },
          { $group: { _id: "$showId", n: { $sum: 1 } } },
        ])
      : [],
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }, { title: 1 }).lean() : [],
    eventIds.length ? Event.find({ _id: { $in: eventIds } }, { title: 1 }).lean() : [],
  ]);
  const soldByShow = new Map(soldRows.map((r) => [r._id.toString(), r.n]));
  const titles = new Map<string, string>([
    ...movies.map((m) => [m._id.toString(), m.title] as const),
    ...events.map((e) => [e._id.toString(), e.title] as const),
  ]);
  const venueById = new Map(venues.map((v) => [v._id.toString(), v]));

  for (const show of shows) {
    const id = show._id.toString();
    const venue = venueById.get(show.venueId.toString());
    const title = titles.get((show.movieId ?? show.eventId)?.toString() ?? "") ?? "Show";
    const base = {
      id,
      title,
      venueName: venue?.name ?? "",
      screenName: show.screenName,
      ...(show.startsAt ? { startsAt: show.startsAt.toISOString() } : {}),
    };
    if ((show.inventory ?? []).length > 0) {
      result.set(id, {
        ...base,
        kind: "passes",
        sold: show.inventory.reduce((sum, t) => sum + t.sold, 0),
        capacity: show.inventory.reduce((sum, t) => sum + t.capacity, 0),
      });
      continue;
    }
    const stored = venue?.screens.find((s) => s.id === show.screenId);
    result.set(id, {
      ...base,
      kind: "seated",
      sold: soldByShow.get(id) ?? 0,
      capacity: stored ? screenCapacity(toScreen(stored)) : 0,
    });
  }
  return result;
}
