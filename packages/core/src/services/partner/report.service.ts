import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking, type BookingAttrs } from "@showbuzz/db/models/Booking";
import { City } from "@showbuzz/db/models/City";
import { Venue } from "@showbuzz/db/models/Venue";
import { type PipelineStage, Types } from "@showbuzz/db/mongoose";
import {
  REPORT_LABELS,
  type PartnerReport,
  type ReportColumn,
  type ReportFilters,
  type ReportRow,
} from "@showbuzz/schemas/report";
import { addDaysToKey, istDateTime } from "@showbuzz/utils/dates";
import {
  PAYOUT_COLUMNS,
  type ReportDefinition,
  VENDOR_SALES_COLUMNS,
  payoutRows,
  salesKeyColumns,
  salesRows,
} from "../report-engine";
import { contactOf, sharesContact } from "./booking.service";

/**
 * The vendor's own reports. The vendor id always comes from the session (callers pass `vendor.id` from
 * requireVendor / requireVendorPage) and overrides any vendor filter in the request.
 *
 * The bookings export carries the customer's name, phone and email only when the super-admin turned on
 * `shareCustomerContact` for this vendor (read fresh); a counter sale's walk-in details were typed by the vendor and
 * are always included, as on the Bookings screen.
 */

const PAYMENT_LABELS: Record<string, string> = {
  online: "Online",
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet",
  counter_cash: "Counter cash",
  counter_upi: "Counter UPI",
};

export async function partnerReport(
  vendorId: string,
  report: PartnerReport,
  requested: ReportFilters,
): Promise<ReportDefinition> {
  const filters: ReportFilters = { ...requested, vendorId };
  const title = REPORT_LABELS[report];
  switch (report) {
    case "sales-by-venue":
      return {
        title,
        columns: [...salesKeyColumns("venue", false), ...VENDOR_SALES_COLUMNS],
        rows: () => salesRows("venue", filters),
      };
    case "sales-by-title":
      return {
        title,
        columns: [...salesKeyColumns("title", false), ...VENDOR_SALES_COLUMNS],
        rows: () => salesRows("title", filters),
      };
    case "payouts":
      return { title, columns: PAYOUT_COLUMNS(false), rows: () => payoutRows(filters, false) };
    case "bookings": {
      await connect();
      const share = await sharesContact(vendorId);
      return { title, columns: bookingColumns(share), rows: () => bookingRows(vendorId, filters, share) };
    }
  }
}

function bookingColumns(share: boolean): ReportColumn[] {
  return [
    { key: "code", label: "Booking", type: "text" },
    { key: "bookedAt", label: "Booked at", type: "datetime" },
    { key: "title", label: "Movie / event", type: "text" },
    { key: "venue", label: "Venue", type: "text" },
    { key: "screen", label: "Screen", type: "text" },
    { key: "startsAt", label: "Show time", type: "datetime" },
    { key: "seats", label: "Seats / tickets", type: "text" },
    { key: "tickets", label: "Tickets", type: "int", total: true },
    { key: "channel", label: "Channel", type: "text" },
    { key: "payment", label: "Payment", type: "text" },
    { key: "status", label: "Status", type: "text" },
    { key: "checkedInAt", label: "Checked in", type: "datetime" },
    { key: "salesPaise", label: "Sales (tickets + food)", type: "money", total: true },
    { key: "discountPaise", label: "Discount", type: "money", total: true },
    { key: "totalPaise", label: "Customer paid", type: "money", total: true },
    { key: "commissionPaise", label: "ShowBuzz commission", type: "money", total: true },
    { key: "sharePaise", label: "Your share", type: "money", total: true },
    { key: "refundPaise", label: "Refund", type: "money", total: true },
    { key: "customerName", label: "Customer name", type: "text" },
    { key: "customerPhone", label: "Customer phone", type: "text" },
    ...(share ? [{ key: "customerEmail", label: "Customer email", type: "text" as const }] : []),
  ];
}

async function* bookingRows(vendorId: string, f: ReportFilters, share: boolean): AsyncGenerator<ReportRow> {
  const vendor = new Types.ObjectId(vendorId);
  const pipeline: PipelineStage[] = [
    {
      $match: {
        vendorId: vendor,
        status: { $in: ["confirmed", "cancelled"] },
        confirmedAt: { $gte: istDateTime(f.fromKey, "00:00"), $lt: istDateTime(addDaysToKey(f.toKey, 1), "00:00") },
      },
    },
    { $sort: { confirmedAt: -1 } },
  ];
  if (f.cityId) {
    const venues = await Venue.find({ vendorId: vendor, cityId: f.cityId }, { _id: 1 }).lean();
    pipeline.push(
      {
        $lookup: {
          from: "shows",
          localField: "showId",
          foreignField: "_id",
          as: "show",
          pipeline: [{ $project: { venueId: 1 } }],
        },
      },
      { $match: { "show.venueId": { $in: venues.map((v) => v._id) } } },
      { $project: { show: 0 } },
    );
  }
  const cursor = Booking.aggregate<BookingAttrs>(pipeline).cursor();
  for await (const raw of cursor) {
    const b = raw as BookingAttrs;
    const contact = contactOf(b, share);
    const sales = b.settlement?.subtotalPaise ?? b.amounts.ticketsPaise + (b.amounts.foodPaise ?? 0);
    const discount = b.settlement?.discountPaise ?? b.amounts.discountPaise ?? 0;
    const isConfirmed = b.status === "confirmed";
    yield {
      code: b.code,
      bookedAt: (b.confirmedAt ?? b.createdAt).toISOString(),
      title: b.title,
      venue: b.venueName,
      screen: b.screenName ?? "",
      startsAt: b.startsAt?.toISOString() ?? null,
      seats: b.seatLabels.length > 0 ? b.seatLabels.join(" ") : b.ticketLabel,
      tickets: b.ticketCount,
      channel: b.channel === "counter" ? "Counter" : "Online",
      payment: PAYMENT_LABELS[b.paymentMethod] ?? b.paymentMethod,
      status: b.status === "cancelled" ? "Cancelled" : b.checkedInAt ? "Checked in" : "Confirmed",
      checkedInAt: b.checkedInAt?.toISOString() ?? null,
      salesPaise: sales,
      discountPaise: discount,
      totalPaise: b.amounts.totalPaise,
      commissionPaise: isConfirmed ? (b.settlement?.commissionPaise ?? 0) : 0,
      sharePaise: isConfirmed ? (b.settlement?.vendorSharePaise ?? sales - discount) : 0,
      refundPaise: b.status === "cancelled" ? (b.refundPaise ?? 0) : 0,
      customerName: contact?.name ?? "",
      customerPhone: contact?.phone ?? "",
      ...(share ? { customerEmail: contact?.email ?? "" } : {}),
    };
  }
}

/** Cities where this vendor has venues (the report's city filter). */
export async function listVendorReportCities(vendorId: string): Promise<{ value: string; label: string }[]> {
  await connect();
  const cityIds = await Venue.distinct("cityId", { vendorId: new Types.ObjectId(vendorId) });
  const cities = await City.find({ slug: { $in: cityIds } }, { slug: 1, name: 1 })
    .sort({ name: 1 })
    .lean();
  return cities.map((c) => ({ value: c.slug, label: c.name }));
}
