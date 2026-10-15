import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { City } from "@showbuzz/db/models/City";
import { Show } from "@showbuzz/db/models/Show";
import { SubscriptionInvoice } from "@showbuzz/db/models/SubscriptionInvoice";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { Venue } from "@showbuzz/db/models/Venue";
import { Types } from "@showbuzz/db/mongoose";
import type { DashboardRange } from "@showbuzz/schemas/dashboard";
import type { AdminDashboard, SalesSlice } from "@showbuzz/schemas/types/dashboard";
import { SOLD_STATUSES, dashboardWindow, fillTrend } from "../dashboard-period";
import { cached } from "../ttl-cache";

/**
 * Super-admin dashboard figures, aggregated from the money split frozen on each booking. A booking counts in the
 * period it was paid for (`confirmedAt`, IST), matched on the `{ status, confirmedAt }` index:
 *
 * - gross sales: order totals (incl. fees and GST, after discounts) of vendor bookings sold, including ones cancelled
 *   later; refunds are shown beside it;
 * - tickets: of bookings still confirmed;
 * - platform revenue: convenience fees (without their GST) and commission on bookings still confirmed, cancellation
 *   fees kept on online cancellations, and subscription invoices paid in the period (by `paidAt`).
 *
 * Gift card purchases are platform sales without a vendor: reported on their own, not in ticket sales.
 * Cached per range for 2 minutes per server instance.
 */

const CACHE_MS = 2 * 60_000;
const TOP = 5;
const RECENT = 8;

const KIND_LABELS: Record<string, string> = {
  movie: "Movies",
  event: "Events & concerts",
  play: "Plays",
  sport: "Sports",
  activity: "Activities",
};

const confirmed = { $eq: ["$status", "confirmed"] };
const cancelled = { $eq: ["$status", "cancelled"] };
const refund = { $ifNull: ["$refundPaise", 0] };
const totalsGroup = {
  _id: null,
  bookings: { $sum: 1 },
  tickets: { $sum: { $cond: [confirmed, "$ticketCount", 0] } },
  grossPaise: { $sum: "$amounts.totalPaise" },
  refundsPaise: { $sum: { $cond: [cancelled, refund, 0] } },
  convenienceFeePaise: {
    $sum: {
      $cond: [
        confirmed,
        { $ifNull: ["$settlement.convenienceFeePaise", { $ifNull: ["$amounts.convenienceFeePaise", 0] }] },
        0,
      ],
    },
  },
  commissionPaise: { $sum: { $cond: [confirmed, { $ifNull: ["$settlement.commissionPaise", 0] }, 0] } },
  // Online cancellations: the platform keeps the fee; at the counter the vendor does.
  cancellationFeesPaise: {
    $sum: {
      $cond: [
        { $and: [cancelled, { $ne: ["$channel", "counter"] }] },
        { $max: [0, { $subtract: ["$amounts.totalPaise", refund] }] },
        0,
      ],
    },
  },
};

interface Totals {
  bookings: number;
  tickets: number;
  grossPaise: number;
  refundsPaise: number;
  convenienceFeePaise: number;
  commissionPaise: number;
  cancellationFeesPaise: number;
}

const EMPTY_TOTALS: Totals = {
  bookings: 0,
  tickets: 0,
  grossPaise: 0,
  refundsPaise: 0,
  convenienceFeePaise: 0,
  commissionPaise: 0,
  cancellationFeesPaise: 0,
};

interface Slice {
  _id: unknown;
  salesPaise: number;
  tickets: number;
}

const sliceGroup = (id: unknown) => ({
  _id: id,
  salesPaise: { $sum: "$amounts.totalPaise" },
  tickets: { $sum: { $cond: [confirmed, "$ticketCount", 0] } },
});

const soldIn = (from: Date, to: Date) => ({ status: { $in: SOLD_STATUSES }, confirmedAt: { $gte: from, $lt: to } });
const VENDOR_SALE = { kind: { $ne: "gift-card" as const } };

async function subscriptionsPaid(from: Date, to: Date): Promise<number> {
  const [row] = await SubscriptionInvoice.aggregate<{ total: number }>([
    { $match: { status: "paid", paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: "$amountPaise" } } },
  ]);
  return row?.total ?? 0;
}

const revenueOf = (t: Totals, subscriptions: number) =>
  t.convenienceFeePaise + t.commissionPaise + t.cancellationFeesPaise + subscriptions;

export function getAdminDashboard(range: DashboardRange, now: Date): Promise<AdminDashboard> {
  return cached(`admin-dashboard:${range}`, CACHE_MS, () => buildAdminDashboard(range, now));
}

async function buildAdminDashboard(range: DashboardRange, now: Date): Promise<AdminDashboard> {
  const w = dashboardWindow(range, now);
  await connect();

  const [facets] = await Booking.aggregate<{
    totals: Totals[];
    giftCards: { salesPaise: number; count: number }[];
    trend: { _id: string; salesPaise: number; tickets: number }[];
    categories: Slice[];
    vendors: Slice[];
    titles: Slice[];
    shows: Slice[];
  }>([
    { $match: soldIn(w.from, w.to) },
    {
      $facet: {
        totals: [{ $match: VENDOR_SALE }, { $group: totalsGroup }],
        giftCards: [
          { $match: { kind: "gift-card", status: "confirmed" } },
          { $group: { _id: null, salesPaise: { $sum: "$amounts.totalPaise" }, count: { $sum: 1 } } },
        ],
        trend: [
          { $match: VENDOR_SALE },
          {
            $group: sliceGroup({
              $dateToString: { format: w.bucketFormat, date: "$confirmedAt", timezone: "Asia/Kolkata" },
            }),
          },
        ],
        categories: [{ $match: VENDOR_SALE }, { $group: sliceGroup("$kind") }, { $sort: { salesPaise: -1 } }],
        vendors: [
          { $match: VENDOR_SALE },
          { $group: sliceGroup("$vendorId") },
          { $sort: { salesPaise: -1 } },
          { $limit: TOP },
        ],
        titles: [
          { $match: VENDOR_SALE },
          { $group: sliceGroup({ kind: "$kind", title: "$title" }) },
          { $sort: { salesPaise: -1 } },
          { $limit: TOP },
        ],
        // Cities come from show → venue; grouping by show first keeps the lookups to the shows actually sold.
        shows: [{ $match: { ...VENDOR_SALE, showId: { $exists: true } } }, { $group: sliceGroup("$showId") }],
      },
    },
  ]);

  const [previous] = await Booking.aggregate<Totals>([
    { $match: { ...soldIn(w.previousFrom, w.from), ...VENDOR_SALE } },
    { $group: totalsGroup },
  ]);
  const [subscriptions, previousSubscriptions, activeVendors, newVendors, previousNewVendors, recentDocs] =
    await Promise.all([
      subscriptionsPaid(w.from, w.to),
      subscriptionsPaid(w.previousFrom, w.from),
      Vendor.countDocuments({ status: "active", onboardingStatus: "complete" }),
      Vendor.countDocuments({ createdAt: { $gte: w.from, $lt: w.to } }),
      Vendor.countDocuments({ createdAt: { $gte: w.previousFrom, $lt: w.from } }),
      Booking.find({ status: { $in: SOLD_STATUSES }, ...VENDOR_SALE })
        .sort({ confirmedAt: -1 })
        .limit(RECENT)
        .select({
          code: 1,
          contact: 1,
          channel: 1,
          title: 1,
          venueName: 1,
          vendorId: 1,
          scheduleLabel: 1,
          amounts: 1,
          status: 1,
          checkedInAt: 1,
          confirmedAt: 1,
          createdAt: 1,
        })
        .lean(),
    ]);

  const totals = facets?.totals[0] ?? EMPTY_TOTALS;
  const prev = previous ?? EMPTY_TOTALS;

  const vendorIds = [
    ...new Set([
      ...(facets?.vendors ?? []).map((v) => String(v._id)),
      ...recentDocs.flatMap((b) => (b.vendorId ? [b.vendorId.toString()] : [])),
    ]),
  ];
  const vendorNames = new Map(
    (await Vendor.find({ _id: { $in: vendorIds } }, { businessName: 1 }).lean()).map((v) => [
      v._id.toString(),
      v.businessName,
    ]),
  );

  return {
    range,
    fromKey: w.fromKey,
    toKey: w.toKey,
    generatedAt: now.toISOString(),
    kpis: {
      grossSalesPaise: totals.grossPaise,
      previousGrossSalesPaise: prev.grossPaise,
      refundsPaise: totals.refundsPaise,
      bookings: totals.bookings,
      tickets: totals.tickets,
      previousTickets: prev.tickets,
      platformRevenuePaise: revenueOf(totals, subscriptions),
      previousPlatformRevenuePaise: revenueOf(prev, previousSubscriptions),
      revenue: {
        convenienceFeePaise: totals.convenienceFeePaise,
        commissionPaise: totals.commissionPaise,
        cancellationFeesPaise: totals.cancellationFeesPaise,
        subscriptionPaise: subscriptions,
      },
      activeVendors,
      newVendors,
      previousNewVendors,
      giftCardSalesPaise: facets?.giftCards[0]?.salesPaise ?? 0,
      giftCardsSold: facets?.giftCards[0]?.count ?? 0,
    },
    trend: fillTrend(w, facets?.trend ?? []),
    categories: (facets?.categories ?? []).map((c) => ({
      key: String(c._id),
      label: KIND_LABELS[String(c._id)] ?? String(c._id),
      salesPaise: c.salesPaise,
      tickets: c.tickets,
    })),
    topVendors: (facets?.vendors ?? []).map((v) => ({
      key: String(v._id),
      label: vendorNames.get(String(v._id)) ?? "Unknown vendor",
      salesPaise: v.salesPaise,
      tickets: v.tickets,
    })),
    topTitles: (facets?.titles ?? []).map((t) => {
      const id = t._id as { kind: string; title: string };
      return {
        key: `${id.kind}:${id.title}`,
        label: id.title,
        detail: KIND_LABELS[id.kind] ?? id.kind,
        salesPaise: t.salesPaise,
        tickets: t.tickets,
      };
    }),
    cities: await salesByCity(facets?.shows ?? []),
    recent: recentDocs.map((b) => ({
      code: b.code,
      customer: b.contact?.name || (b.channel === "counter" ? "Walk-in" : "Customer"),
      title: b.title,
      venueName: b.venueName,
      vendorName: (b.vendorId && vendorNames.get(b.vendorId.toString())) || "",
      scheduleLabel: b.scheduleLabel,
      totalPaise: b.amounts.totalPaise,
      status: b.status,
      channel: b.channel ?? "online",
      checkedIn: Boolean(b.checkedInAt),
      bookedAt: (b.confirmedAt ?? b.createdAt).toISOString(),
    })),
  };
}

async function salesByCity(shows: Slice[]): Promise<SalesSlice[]> {
  if (shows.length === 0) return [];
  const showDocs = await Show.find({ _id: { $in: shows.map((s) => s._id as Types.ObjectId) } }, { venueId: 1 }).lean();
  const venueOfShow = new Map(showDocs.map((s) => [s._id.toString(), s.venueId.toString()]));
  const venues = await Venue.find(
    { _id: { $in: [...new Set(venueOfShow.values())].map((id) => new Types.ObjectId(id)) } },
    { cityId: 1 },
  ).lean();
  const cityOfVenue = new Map(venues.map((v) => [v._id.toString(), v.cityId]));

  const byCity = new Map<string, { salesPaise: number; tickets: number }>();
  for (const s of shows) {
    const venueId = venueOfShow.get(String(s._id));
    const cityId = (venueId && cityOfVenue.get(venueId)) || "unknown";
    const entry = byCity.get(cityId) ?? { salesPaise: 0, tickets: 0 };
    entry.salesPaise += s.salesPaise;
    entry.tickets += s.tickets;
    byCity.set(cityId, entry);
  }
  const cities = await City.find({ slug: { $in: [...byCity.keys()] } }, { slug: 1, name: 1 }).lean();
  const names = new Map(cities.map((c) => [c.slug, c.name]));
  return [...byCity.entries()]
    .map(([cityId, v]) => ({ key: cityId, label: names.get(cityId) ?? "Other", ...v }))
    .sort((a, b) => b.salesPaise - a.salesPaise)
    .slice(0, 8);
}
