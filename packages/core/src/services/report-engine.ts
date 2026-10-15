import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { City } from "@showbuzz/db/models/City";
import { Settlement } from "@showbuzz/db/models/Settlement";
import { SubscriptionInvoice } from "@showbuzz/db/models/SubscriptionInvoice";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { Venue } from "@showbuzz/db/models/Venue";
import { type PipelineStage, Types } from "@showbuzz/db/mongoose";
import {
  REPORT_MAX_DAYS,
  reportFiltersSchema,
  type ReportColumn,
  type ReportFilters,
  type ReportRow,
} from "@showbuzz/schemas/report";
import { addDaysToKey, istDateKey, istDateTime } from "@showbuzz/utils/dates";
import { AppError } from "../http/app-error";

/**
 * Building blocks of the admin and partner reports. Callers (services/admin/report.service.ts and
 * services/partner/report.service.ts) decide the scope: the partner one always passes the session's vendor id.
 *
 * Rows come from MongoDB cursors, so a CSV export streams them as they are read instead of loading the whole report.
 * Sales count bookings sold in the period by the IST day they were paid for (`confirmedAt`), like Earnings and the
 * dashboards: money and refunds of cancelled bookings are included, shares and fees only for bookings still confirmed.
 */

export interface ReportDefinition {
  title: string;
  columns: ReportColumn[];
  rows: () => AsyncIterable<ReportRow>;
}

export function resolveReportFilters(input: unknown, now: Date): ReportFilters {
  const parsed = reportFiltersSchema.parse(input ?? {});
  const today = istDateKey(now);
  const toKey = parsed.to ?? today;
  const fromKey = parsed.from ?? addDaysToKey(toKey, -29);
  const from = istDateTime(fromKey, "00:00");
  const to = istDateTime(addDaysToKey(toKey, 1), "00:00");
  if (to <= from || to.getTime() - from.getTime() > REPORT_MAX_DAYS * 86_400_000) {
    throw new AppError("VALIDATION_FAILED", `Choose a range of up to ${REPORT_MAX_DAYS} days.`, 422);
  }
  return {
    fromKey,
    toKey,
    ...(parsed.city ? { cityId: parsed.city } : {}),
    ...(parsed.vendor ? { vendorId: parsed.vendor } : {}),
  };
}

const window = (f: ReportFilters) => ({
  from: istDateTime(f.fromKey, "00:00"),
  to: istDateTime(addDaysToKey(f.toKey, 1), "00:00"),
});

async function cityNameMap(): Promise<Map<string, string>> {
  const docs = await City.find({}, { slug: 1, name: 1 }).lean();
  return new Map(docs.map((c) => [c.slug, c.name]));
}

// ---------------------------------------------------------------------------------------------------------------
// Sales

export type SalesDimension = "vendor" | "venue" | "title";

const confirmed = { $eq: ["$status", "confirmed"] };
const cancelled = { $eq: ["$status", "cancelled"] };
const ifConfirmed = (value: unknown) => ({ $cond: [confirmed, value, 0] });
const subtotal = {
  $ifNull: ["$settlement.subtotalPaise", { $add: ["$amounts.ticketsPaise", { $ifNull: ["$amounts.foodPaise", 0] }] }],
};
const discount = { $ifNull: ["$settlement.discountPaise", { $ifNull: ["$amounts.discountPaise", 0] }] };

/** Sums per show first (the lookups then run once per show, not per booking). */
const SUM_FIELDS = {
  bookings: { $sum: 1 },
  tickets: { $sum: ifConfirmed("$ticketCount") },
  grossPaise: { $sum: "$amounts.totalPaise" },
  salesPaise: { $sum: subtotal },
  discountPaise: { $sum: discount },
  feePaise: {
    $sum: ifConfirmed({
      $ifNull: ["$settlement.convenienceFeePaise", { $ifNull: ["$amounts.convenienceFeePaise", 0] }],
    }),
  },
  commissionPaise: { $sum: ifConfirmed({ $ifNull: ["$settlement.commissionPaise", 0] }) },
  sharePaise: {
    $sum: ifConfirmed({ $ifNull: ["$settlement.vendorSharePaise", { $subtract: [subtotal, discount] }] }),
  },
  refundsPaise: { $sum: { $cond: [cancelled, { $ifNull: ["$refundPaise", 0] }, 0] } },
};
const RESUM = Object.fromEntries(Object.keys(SUM_FIELDS).map((k) => [k, { $sum: `$${k}` }]));

interface SalesBucket {
  _id: unknown;
  shows: number;
  bookings: number;
  tickets: number;
  grossPaise: number;
  salesPaise: number;
  discountPaise: number;
  feePaise: number;
  commissionPaise: number;
  sharePaise: number;
  refundsPaise: number;
  name?: string;
  cityId?: string;
  vendorName?: string;
}

export async function* salesRows(dimension: SalesDimension, f: ReportFilters): AsyncGenerator<ReportRow> {
  await connect();
  const { from, to } = window(f);
  const pipeline: PipelineStage[] = [
    {
      $match: {
        status: { $in: ["confirmed", "cancelled"] },
        confirmedAt: { $gte: from, $lt: to },
        kind: { $ne: "gift-card" },
        ...(f.vendorId ? { vendorId: new Types.ObjectId(f.vendorId) } : {}),
      },
    },
    { $group: { _id: { showId: "$showId", vendorId: "$vendorId", kind: "$kind", title: "$title" }, ...SUM_FIELDS } },
  ];
  if (dimension === "venue" || f.cityId) {
    pipeline.push(
      {
        $lookup: {
          from: "shows",
          localField: "_id.showId",
          foreignField: "_id",
          as: "show",
          pipeline: [{ $project: { venueId: 1 } }],
        },
      },
      { $set: { venueId: { $first: "$show.venueId" } } },
    );
  }
  if (f.cityId) {
    const venueIds = await Venue.find(
      { cityId: f.cityId, ...(f.vendorId ? { vendorId: new Types.ObjectId(f.vendorId) } : {}) },
      { _id: 1 },
    ).lean();
    pipeline.push({ $match: { venueId: { $in: venueIds.map((v) => v._id) } } });
  }
  const key =
    dimension === "vendor"
      ? "$_id.vendorId"
      : dimension === "venue"
        ? "$venueId"
        : { kind: "$_id.kind", title: "$_id.title" };
  pipeline.push({ $group: { _id: key, shows: { $sum: 1 }, ...RESUM } }, { $sort: { grossPaise: -1, _id: 1 } });
  if (dimension === "vendor") {
    pipeline.push(
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "v",
          pipeline: [{ $project: { businessName: 1, "address.cityId": 1 } }],
        },
      },
      { $set: { name: { $first: "$v.businessName" }, cityId: { $first: "$v.address.cityId" } } },
      { $project: { v: 0 } },
    );
  }
  if (dimension === "venue") {
    pipeline.push(
      {
        $lookup: {
          from: "venues",
          localField: "_id",
          foreignField: "_id",
          as: "v",
          pipeline: [{ $project: { name: 1, cityId: 1, vendorId: 1 } }],
        },
      },
      { $set: { name: { $first: "$v.name" }, cityId: { $first: "$v.cityId" }, vendorId: { $first: "$v.vendorId" } } },
      {
        $lookup: {
          from: "vendors",
          localField: "vendorId",
          foreignField: "_id",
          as: "o",
          pipeline: [{ $project: { businessName: 1 } }],
        },
      },
      { $set: { vendorName: { $first: "$o.businessName" } } },
      { $project: { v: 0, o: 0 } },
    );
  }

  const cities = await cityNameMap();
  const cursor = Booking.aggregate<SalesBucket>(pipeline).allowDiskUse(true).cursor();
  for await (const raw of cursor) {
    const b = raw as SalesBucket;
    const label =
      dimension === "title"
        ? { name: (b._id as { title: string }).title, kind: KIND_LABELS[(b._id as { kind: string }).kind] ?? "" }
        : {
            name: b.name ?? "Unknown",
            city: b.cityId ? (cities.get(b.cityId) ?? b.cityId) : "",
            vendor: b.vendorName ?? "",
          };
    yield {
      ...label,
      shows: b.shows,
      bookings: b.bookings,
      tickets: b.tickets,
      grossPaise: b.grossPaise,
      salesPaise: b.salesPaise,
      discountPaise: b.discountPaise,
      feePaise: b.feePaise,
      commissionPaise: b.commissionPaise,
      sharePaise: b.sharePaise,
      refundsPaise: b.refundsPaise,
    };
  }
}

const KIND_LABELS: Record<string, string> = {
  movie: "Movie",
  event: "Event",
  play: "Play",
  sport: "Sport",
  activity: "Activity",
};

/** Columns naming the row, per dimension. */
export function salesKeyColumns(dimension: SalesDimension, withVendor: boolean): ReportColumn[] {
  if (dimension === "vendor") {
    return [
      { key: "name", label: "Vendor", type: "text" },
      { key: "city", label: "Vendor city", type: "text" },
    ];
  }
  if (dimension === "venue") {
    return [
      { key: "name", label: "Venue", type: "text" },
      { key: "city", label: "City", type: "text" },
      ...(withVendor ? [{ key: "vendor", label: "Vendor", type: "text" as const }] : []),
    ];
  }
  return [
    { key: "name", label: "Movie / event", type: "text" },
    { key: "kind", label: "Type", type: "text" },
  ];
}

export const STAFF_SALES_COLUMNS: ReportColumn[] = [
  { key: "shows", label: "Shows sold", type: "int", total: true },
  { key: "bookings", label: "Bookings", type: "int", total: true },
  { key: "tickets", label: "Tickets (confirmed)", type: "int", total: true },
  { key: "grossPaise", label: "Gross paid", type: "money", total: true },
  { key: "discountPaise", label: "Discounts", type: "money", total: true },
  { key: "feePaise", label: "Convenience fees", type: "money", total: true },
  { key: "commissionPaise", label: "Commission", type: "money", total: true },
  { key: "sharePaise", label: "Vendor share", type: "money", total: true },
  { key: "refundsPaise", label: "Refunds", type: "money", total: true },
];

export const VENDOR_SALES_COLUMNS: ReportColumn[] = [
  { key: "shows", label: "Shows sold", type: "int", total: true },
  { key: "bookings", label: "Bookings", type: "int", total: true },
  { key: "tickets", label: "Tickets (confirmed)", type: "int", total: true },
  { key: "salesPaise", label: "Sales (tickets + food)", type: "money", total: true },
  { key: "discountPaise", label: "Discounts", type: "money", total: true },
  { key: "commissionPaise", label: "ShowBuzz commission", type: "money", total: true },
  { key: "sharePaise", label: "Your share", type: "money", total: true },
  { key: "refundsPaise", label: "Refunds", type: "money", total: true },
];

// ---------------------------------------------------------------------------------------------------------------
// Payouts and invoices

/** Vendor ids for a city filter (by the vendor's business address). */
async function vendorScope(f: ReportFilters): Promise<Record<string, unknown>> {
  if (!f.cityId) return f.vendorId ? { vendorId: new Types.ObjectId(f.vendorId) } : {};
  const vendors = await Vendor.find(
    { "address.cityId": f.cityId, ...(f.vendorId ? { _id: new Types.ObjectId(f.vendorId) } : {}) },
    { _id: 1 },
  ).lean();
  return { vendorId: { $in: vendors.map((v) => v._id) } };
}

const vendorNameStages: PipelineStage[] = [
  {
    $lookup: {
      from: "vendors",
      localField: "vendorId",
      foreignField: "_id",
      as: "v",
      pipeline: [{ $project: { businessName: 1 } }],
    },
  },
  { $set: { vendorName: { $first: "$v.businessName" } } },
  { $project: { v: 0 } },
];

export const PAYOUT_COLUMNS = (withVendor: boolean): ReportColumn[] => [
  { key: "code", label: "Payout", type: "text" },
  ...(withVendor ? [{ key: "vendor", label: "Vendor", type: "text" as const }] : []),
  { key: "periodFrom", label: "Period from", type: "date" },
  { key: "periodTo", label: "Period to", type: "date" },
  { key: "bookings", label: "Bookings", type: "int", total: true },
  { key: "grossPaise", label: "Gross (vendor share)", type: "money", total: true },
  { key: "commissionPaise", label: "Commission", type: "money", total: true },
  { key: "counterPaise", label: "Collected at counter", type: "money", total: true },
  { key: "adjustmentsPaise", label: "Cancellations clawed back", type: "money", total: true },
  { key: "netPaise", label: "Net payout", type: "money", total: true },
  { key: "status", label: "Status", type: "text" },
  { key: "createdAt", label: "Created", type: "date" },
  { key: "paidAt", label: "Paid on", type: "date" },
  { key: "reference", label: "Reference", type: "text" },
];

/** Payouts created in the period (pending and paid; voided payouts are left out, as in Earnings). */
export async function* payoutRows(f: ReportFilters, withVendor: boolean): AsyncGenerator<ReportRow> {
  await connect();
  const { from, to } = window(f);
  const cursor = Settlement.aggregate<Record<string, unknown>>([
    { $match: { createdAt: { $gte: from, $lt: to }, status: { $ne: "void" }, ...(await vendorScope(f)) } },
    { $sort: { createdAt: -1 } },
    { $set: { bookingCount: { $size: { $ifNull: ["$bookingIds", []] } } } },
    { $project: { bookingIds: 0, clawbackBookingIds: 0, voidedBookingIds: 0, voidedClawbackBookingIds: 0 } },
    ...(withVendor ? vendorNameStages : []),
  ]).cursor();
  for await (const raw of cursor) {
    const p = raw as {
      code: string;
      vendorName?: string;
      periodFrom: Date;
      periodTo: Date;
      bookingCount: number;
      grossSalesPaise: number;
      commissionPaise: number;
      counterCollectedPaise?: number;
      refundsPaise: number;
      netPayoutPaise: number;
      status: string;
      createdAt: Date;
      paidAt?: Date;
      reference?: string;
    };
    yield {
      code: p.code,
      ...(withVendor ? { vendor: p.vendorName ?? "" } : {}),
      periodFrom: p.periodFrom.toISOString(),
      // Stored as the exclusive end (midnight after the last day).
      periodTo: new Date(p.periodTo.getTime() - 1).toISOString(),
      bookings: p.bookingCount,
      grossPaise: p.grossSalesPaise,
      commissionPaise: p.commissionPaise,
      counterPaise: p.counterCollectedPaise ?? 0,
      adjustmentsPaise: p.refundsPaise,
      netPaise: p.netPayoutPaise,
      status: p.status === "paid" ? "Paid" : "Pending",
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
      reference: p.reference ?? "",
    };
  }
}

export const INVOICE_COLUMNS: ReportColumn[] = [
  { key: "code", label: "Invoice", type: "text" },
  { key: "vendor", label: "Vendor", type: "text" },
  { key: "month", label: "Month", type: "text" },
  { key: "plan", label: "Plan", type: "text" },
  { key: "amountPaise", label: "Amount", type: "money", total: true },
  { key: "status", label: "Status", type: "text" },
  { key: "dueAt", label: "Due", type: "date" },
  { key: "paidAt", label: "Paid on", type: "date" },
  { key: "reference", label: "Reference", type: "text" },
];

/** Invoices for the months the period touches. */
export async function* invoiceRows(f: ReportFilters, now: Date): AsyncGenerator<ReportRow> {
  await connect();
  const cursor = SubscriptionInvoice.aggregate<Record<string, unknown>>([
    { $match: { month: { $gte: f.fromKey.slice(0, 7), $lte: f.toKey.slice(0, 7) }, ...(await vendorScope(f)) } },
    { $sort: { month: -1, code: 1 } },
    ...vendorNameStages,
  ]).cursor();
  for await (const raw of cursor) {
    const i = raw as {
      code: string;
      vendorName?: string;
      month: string;
      planName: string;
      amountPaise: number;
      status: string;
      dueAt: Date;
      paidAt?: Date;
      reference?: string;
    };
    const status = i.status === "paid" ? "Paid" : i.status === "void" ? "Void" : i.dueAt < now ? "Overdue" : "Issued";
    yield {
      code: i.code,
      vendor: i.vendorName ?? "",
      month: i.month,
      plan: i.planName,
      amountPaise: i.status === "void" ? 0 : i.amountPaise,
      status,
      dueAt: i.dueAt.toISOString(),
      paidAt: i.paidAt?.toISOString() ?? null,
      reference: i.reference ?? "",
    };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// On-screen preview

export interface ReportPreview {
  rows: ReportRow[];
  /** Sums of the columns marked `total`, over every row read. */
  totals: Record<string, number>;
  /** Rows read (all of them unless `complete` is false). */
  count: number;
  /** False when the report has more rows than the page reads (the CSV has them all). */
  complete: boolean;
}

/** The first `show` rows for the page and totals over up to `scan` rows. */
export async function previewReport(def: ReportDefinition, show = 200, scan = 10_000): Promise<ReportPreview> {
  const rows: ReportRow[] = [];
  const totals: Record<string, number> = {};
  const summed = def.columns.filter((c) => c.total);
  let count = 0;
  for await (const row of def.rows()) {
    if (count >= scan) return { rows, totals, count, complete: false };
    count++;
    if (rows.length < show) rows.push(row);
    for (const c of summed) {
      const value = row[c.key];
      if (typeof value === "number") totals[c.key] = (totals[c.key] ?? 0) + value;
    }
  }
  return { rows, totals, count, complete: true };
}
