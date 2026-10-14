import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { Plan } from "@showbuzz/db/models/Plan";
import { Settlement } from "@showbuzz/db/models/Settlement";
import { SubscriptionInvoice } from "@showbuzz/db/models/SubscriptionInvoice";
import { Vendor } from "@showbuzz/db/models/Vendor";
import type { EarningsGrouping } from "@showbuzz/schemas/partner-box-office";
import type { EarningsPeriodRow, EarningsTotals, VendorEarnings } from "@showbuzz/schemas/types/partner-box-office";
import { addDaysToKey, formatDateShort, istDateTime } from "@showbuzz/utils/dates";
import { AppError } from "../../http/app-error";
import { toObjectId } from "./ids";

/**
 * The vendor's earnings, read-only, from the money split frozen on each booking (`bookings.settlement`), grouped by
 * IST day, ISO week or month of purchase:
 *
 * - sales / discounts: every booking sold in the period (online and counter), including ones cancelled later;
 * - commission / vendor share: bookings still confirmed (a cancelled booking earns nothing);
 * - refunds: what cancelled bookings gave back; cancellation fees: what they kept (who keeps the fee is settled with
 *   payouts, admin prompt 6).
 *
 * Payouts (settlements) and subscription invoices are created by the super-admin; this only lists them.
 */

/** Longest range one report covers (keeps the aggregation bounded). */
export const EARNINGS_MAX_DAYS = 366;

const GROUP_FORMAT: Record<EarningsGrouping, string> = { day: "%Y-%m-%d", week: "%G-W%V", month: "%Y-%m" };

interface Bucket {
  _id: string;
  bookings: number;
  tickets: number;
  salesPaise: number;
  discountPaise: number;
  commissionPaise: number;
  vendorSharePaise: number;
  refundsPaise: number;
  cancellationFeesPaise: number;
}

function periodLabel(key: string, grouping: EarningsGrouping): string {
  if (grouping === "day") return formatDateShort(istDateTime(key, "12:00"));
  if (grouping === "month") {
    const [y, m] = key.split("-");
    return new Date(Date.UTC(Number(y), Number(m) - 1, 15)).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }
  return `Week ${key.split("-W")[1] ?? ""}, ${key.split("-W")[0] ?? ""}`;
}

export async function getVendorEarnings(
  vendorId: string,
  range: { fromKey: string; toKey: string; grouping: EarningsGrouping },
  now: Date,
): Promise<VendorEarnings> {
  const vendor = toObjectId(vendorId);
  if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found.", 404);
  const from = istDateTime(range.fromKey, "00:00");
  const to = istDateTime(addDaysToKey(range.toKey, 1), "00:00");
  if (to <= from || to.getTime() - from.getTime() > EARNINGS_MAX_DAYS * 86_400_000) {
    throw new AppError("VALIDATION_FAILED", `Choose a range of up to ${EARNINGS_MAX_DAYS} days.`, 422);
  }
  await connect();

  const confirmed = { $eq: ["$status", "confirmed"] };
  const cancelled = { $eq: ["$status", "cancelled"] };
  const subtotal = {
    $ifNull: ["$settlement.subtotalPaise", { $add: ["$amounts.ticketsPaise", { $ifNull: ["$amounts.foodPaise", 0] }] }],
  };
  const discount = { $ifNull: ["$settlement.discountPaise", { $ifNull: ["$amounts.discountPaise", 0] }] };
  const share = { $ifNull: ["$settlement.vendorSharePaise", { $subtract: [subtotal, discount] }] };
  const refund = { $ifNull: ["$refundPaise", 0] };

  const [buckets, vendorDoc, payouts, invoices] = await Promise.all([
    Booking.aggregate<Bucket>([
      {
        $match: {
          vendorId: vendor,
          status: { $in: ["confirmed", "cancelled"] },
          confirmedAt: { $gte: from, $lt: to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: GROUP_FORMAT[range.grouping], date: "$confirmedAt", timezone: "Asia/Kolkata" },
          },
          bookings: { $sum: 1 },
          tickets: { $sum: "$ticketCount" },
          salesPaise: { $sum: subtotal },
          discountPaise: { $sum: discount },
          commissionPaise: { $sum: { $cond: [confirmed, { $ifNull: ["$settlement.commissionPaise", 0] }, 0] } },
          vendorSharePaise: { $sum: { $cond: [confirmed, share, 0] } },
          refundsPaise: { $sum: { $cond: [cancelled, refund, 0] } },
          cancellationFeesPaise: {
            $sum: { $cond: [cancelled, { $max: [0, { $subtract: ["$amounts.totalPaise", refund] }] }, 0] },
          },
        },
      },
      { $sort: { _id: -1 } },
    ]),
    Vendor.findById(vendor, { billingModel: 1, commissionBps: 1, planId: 1 }).lean(),
    Settlement.find({ vendorId: vendor, status: { $in: ["pending", "paid"] } })
      .sort({ periodTo: -1 })
      .limit(24)
      .lean(),
    SubscriptionInvoice.find({ vendorId: vendor }).sort({ month: -1 }).limit(24).lean(),
  ]);
  if (!vendorDoc) throw new AppError("NOT_FOUND", "Vendor not found.", 404);
  const plan = vendorDoc.planId ? await Plan.findById(vendorDoc.planId, { name: 1, monthlyFeePaise: 1 }).lean() : null;

  const rows: EarningsPeriodRow[] = buckets.map((b) => ({
    key: b._id,
    label: periodLabel(b._id, range.grouping),
    bookings: b.bookings,
    tickets: b.tickets,
    salesPaise: b.salesPaise,
    discountPaise: b.discountPaise,
    commissionPaise: b.commissionPaise,
    vendorSharePaise: b.vendorSharePaise,
    refundsPaise: b.refundsPaise,
    cancellationFeesPaise: b.cancellationFeesPaise,
  }));
  const totals = rows.reduce<EarningsTotals>(
    (sum, r) => ({
      bookings: sum.bookings + r.bookings,
      tickets: sum.tickets + r.tickets,
      salesPaise: sum.salesPaise + r.salesPaise,
      discountPaise: sum.discountPaise + r.discountPaise,
      commissionPaise: sum.commissionPaise + r.commissionPaise,
      vendorSharePaise: sum.vendorSharePaise + r.vendorSharePaise,
      refundsPaise: sum.refundsPaise + r.refundsPaise,
      cancellationFeesPaise: sum.cancellationFeesPaise + r.cancellationFeesPaise,
    }),
    {
      bookings: 0,
      tickets: 0,
      salesPaise: 0,
      discountPaise: 0,
      commissionPaise: 0,
      vendorSharePaise: 0,
      refundsPaise: 0,
      cancellationFeesPaise: 0,
    },
  );

  return {
    billingModel: vendorDoc.billingModel,
    commissionBps: vendorDoc.billingModel === "commission" ? vendorDoc.commissionBps : 0,
    ...(plan ? { planName: plan.name, planFeePaise: plan.monthlyFeePaise } : {}),
    from: range.fromKey,
    to: range.toKey,
    rows,
    totals,
    payouts: payouts.map((p) => ({
      id: p._id.toString(),
      code: p.code,
      periodFrom: p.periodFrom.toISOString(),
      // Stored as the exclusive end (midnight after the last day).
      periodTo: new Date(p.periodTo.getTime() - 1).toISOString(),
      grossSalesPaise: p.grossSalesPaise,
      commissionPaise: p.commissionPaise,
      counterCollectedPaise: p.counterCollectedPaise ?? 0,
      refundsPaise: p.refundsPaise,
      netPayoutPaise: p.netPayoutPaise,
      status: p.status === "paid" ? "paid" : "pending",
      ...(p.reference ? { reference: p.reference } : {}),
      ...(p.paidAt ? { paidAt: p.paidAt.toISOString() } : {}),
    })),
    invoices: invoices.map((i) => ({
      id: i._id.toString(),
      code: i.code,
      month: i.month,
      planName: i.planName,
      amountPaise: i.amountPaise,
      status: i.status,
      dueAt: i.dueAt.toISOString(),
      ...(i.paidAt ? { paidAt: i.paidAt.toISOString() } : {}),
      ...(i.reference ? { reference: i.reference } : {}),
      overdue: i.status === "issued" && i.dueAt < now,
    })),
  };
}
