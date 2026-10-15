import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import type { Types } from "@showbuzz/db/mongoose";
import { ANALYTICS_RANGE_DAYS, type AnalyticsRange } from "@showbuzz/schemas/admin-catalog";
import type { AudienceAnalytics } from "@showbuzz/schemas/types/admin-catalog";
import { addDaysToKey, istDateKey, istDateTime } from "@showbuzz/utils/dates";
import { SOLD_STATUSES } from "../dashboard-period";
import { cached } from "../ttl-cache";

/**
 * Audience analytics (prototype analytics.html): when people book (IST hour and weekday of payment), on which
 * device (recorded on online orders since admin batch 9; older ones are "Unknown"), how far ahead of the show,
 * online vs box office, and new vs returning customers. Ticket bookings only (gift cards excluded), by payment time.
 * Cached 5 minutes per range.
 */

const CACHE_MS = 5 * 60_000;
const TZ = "Asia/Kolkata";

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Mobile web",
  tablet: "Tablet",
  desktop: "Desktop web",
  counter: "Box office (counter)",
  unknown: "Unknown (older orders)",
};
const LEAD_LABELS: Record<string, string> = {
  same: "Within 24 hours",
  days3: "1–3 days ahead",
  week: "3–7 days ahead",
  later: "More than a week ahead",
  open: "No fixed start (day passes)",
};

export function getAudienceAnalytics(range: AnalyticsRange, now: Date): Promise<AudienceAnalytics> {
  return cached(`audience-analytics:${range}`, CACHE_MS, () => build(range, now));
}

async function build(range: AnalyticsRange, now: Date): Promise<AudienceAnalytics> {
  const toKey = istDateKey(now);
  const fromKey = addDaysToKey(toKey, -(ANALYTICS_RANGE_DAYS[range] - 1));
  const from = istDateTime(fromKey, "00:00");
  const to = istDateTime(addDaysToKey(toKey, 1), "00:00");
  await connect();

  const hoursAhead = { $divide: [{ $subtract: ["$startsAt", "$confirmedAt"] }, 3_600_000] };
  const [facets] = await Booking.aggregate<{
    slots: { _id: { d: number; h: number }; n: number }[];
    devices: { _id: string; n: number }[];
    lead: { _id: string; n: number }[];
    channels: { _id: string; n: number }[];
    totals: { bookings: number; confirmed: number; cancelled: number; tickets: number }[];
    customers: { _id: Types.ObjectId }[];
  }>([
    {
      $match: {
        status: { $in: SOLD_STATUSES },
        confirmedAt: { $gte: from, $lt: to },
        kind: { $ne: "gift-card" },
      },
    },
    {
      $facet: {
        slots: [
          {
            $group: {
              _id: {
                d: { $isoDayOfWeek: { date: "$confirmedAt", timezone: TZ } },
                h: { $hour: { date: "$confirmedAt", timezone: TZ } },
              },
              n: { $sum: 1 },
            },
          },
        ],
        devices: [
          {
            $group: {
              _id: { $cond: [{ $eq: ["$channel", "counter"] }, "counter", { $ifNull: ["$device", "unknown"] }] },
              n: { $sum: 1 },
            },
          },
          { $sort: { n: -1 } },
        ],
        lead: [
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    { case: { $not: ["$startsAt"] }, then: "open" },
                    { case: { $lt: [hoursAhead, 24] }, then: "same" },
                    { case: { $lt: [hoursAhead, 72] }, then: "days3" },
                    { case: { $lt: [hoursAhead, 168] }, then: "week" },
                  ],
                  default: "later",
                },
              },
              n: { $sum: 1 },
            },
          },
        ],
        channels: [{ $group: { _id: { $ifNull: ["$channel", "online"] }, n: { $sum: 1 } } }],
        totals: [
          {
            $group: {
              _id: null,
              bookings: { $sum: 1 },
              confirmed: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
              tickets: { $sum: "$ticketCount" },
            },
          },
        ],
        customers: [{ $match: { userId: { $exists: true } } }, { $group: { _id: "$userId" } }],
      },
    },
  ]);

  const byHour = Array.from({ length: 24 }, () => 0);
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const s of facets?.slots ?? []) {
    byHour[s._id.h] = (byHour[s._id.h] ?? 0) + s.n;
    const row = heatmap[s._id.d - 1];
    if (row) row[s._id.h] = s.n;
  }

  const customerIds = (facets?.customers ?? []).map((c) => c._id);
  const returning = customerIds.length
    ? (
        await Booking.distinct("userId", {
          userId: { $in: customerIds },
          status: { $in: SOLD_STATUSES },
          confirmedAt: { $lt: from },
        })
      ).length
    : 0;

  const totals = facets?.totals[0] ?? { bookings: 0, confirmed: 0, cancelled: 0, tickets: 0 };
  const leadOrder = ["same", "days3", "week", "later", "open"];
  const leadCounts = new Map((facets?.lead ?? []).map((l) => [l._id, l.n]));

  return {
    range,
    fromKey,
    toKey,
    generatedAt: now.toISOString(),
    bookings: totals.bookings,
    byHour,
    heatmap,
    devices: (facets?.devices ?? []).map((d) => ({ key: d._id, label: DEVICE_LABELS[d._id] ?? d._id, bookings: d.n })),
    leadTime: leadOrder.map((key) => ({ key, label: LEAD_LABELS[key] ?? key, bookings: leadCounts.get(key) ?? 0 })),
    channels: (facets?.channels ?? []).map((c) => ({
      key: c._id,
      label: c._id === "counter" ? "Box office (counter)" : "Online",
      bookings: c.n,
    })),
    customers: { total: customerIds.length, returning, new: customerIds.length - returning },
    avgTicketsPerOrder: totals.bookings ? totals.tickets / totals.bookings : 0,
    cancellationRateBps: totals.bookings ? Math.round((totals.cancelled / totals.bookings) * 10_000) : 0,
  };
}
