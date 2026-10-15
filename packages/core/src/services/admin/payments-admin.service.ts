import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { Payment } from "@showbuzz/db/models/Payment";
import { Refund } from "@showbuzz/db/models/Refund";
import type { Types } from "@showbuzz/db/mongoose";
import type { AdminPaymentRow, AdminRefundRow } from "@showbuzz/schemas/types/admin-marketplace";
import { addDaysToKey, istDateTime } from "@showbuzz/utils/dates";
import { type AdminListQuery, optionalId, searchPattern, sortSpec, vendorNames } from "./shared";

/**
 * Platform-wide payment and refund records (read-only). Online payments go through the gateway named by
 * PAYMENT_PROVIDER (`razorpay`, or `simulated` where no money moves); counter sales and their refunds are
 * recorded with provider `counter`. Older records keep whichever provider was live when they were taken.
 */

export const PAYMENT_SORT_FIELDS = ["createdAt", "amountPaise"] as const;

/** Values the provider filter accepts; anything else is ignored rather than returning nothing. */
const PAYMENT_PROVIDERS = ["simulated", "razorpay", "counter"];

export interface PaymentListQuery extends AdminListQuery {
  vendorId?: string;
  status?: string;
  provider?: string;
  fromDate?: string;
  toDate?: string;
}

function dateFilter(fromDate?: string, toDate?: string): Record<string, Date> | undefined {
  const range: Record<string, Date> = {};
  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) range.$gte = istDateTime(fromDate, "00:00");
  if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) range.$lt = istDateTime(addDaysToKey(toDate, 1), "00:00");
  return Object.keys(range).length ? range : undefined;
}

/** Booking ids matching a search: a booking code ("SB-123456"), customer name or phone. */
async function bookingIdsMatching(q: string): Promise<Types.ObjectId[]> {
  const pattern = searchPattern(q);
  const docs = await Booking.find(
    { $or: [{ code: pattern }, { "contact.name": pattern }, { "contact.phone": pattern }] },
    { _id: 1 },
  )
    .limit(500)
    .lean();
  return docs.map((d) => d._id);
}

async function bookingInfo(ids: Types.ObjectId[]) {
  const docs = await Booking.find(
    { _id: { $in: ids } },
    { code: 1, title: 1, contact: 1, amounts: 1, cancelledBy: 1, cancelReason: 1 },
  ).lean();
  return new Map(docs.map((d) => [d._id.toString(), d]));
}

async function baseFilter(query: PaymentListQuery, statuses: readonly string[]) {
  const filter: Record<string, unknown> = {};
  const vendorId = optionalId(query.vendorId);
  if (vendorId) filter.vendorId = vendorId;
  if (query.status && statuses.includes(query.status)) filter.status = query.status;
  if (query.provider && PAYMENT_PROVIDERS.includes(query.provider)) filter.provider = query.provider;
  const createdAt = dateFilter(query.fromDate, query.toDate);
  if (createdAt) filter.createdAt = createdAt;
  if (query.q.trim()) {
    const ids = await bookingIdsMatching(query.q);
    filter.$or = [{ bookingId: { $in: ids } }, { providerRef: searchPattern(query.q) }];
  }
  return filter;
}

export async function listPayments(
  query: PaymentListQuery,
): Promise<{ rows: AdminPaymentRow[]; total: number; succeededPaise: number }> {
  await connect();
  const filter = await baseFilter(query, ["created", "succeeded", "failed"]);
  const [docs, total, sum] = await Promise.all([
    Payment.find(filter)
      .sort(sortSpec(query, PAYMENT_SORT_FIELDS, "createdAt"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate<{ total: number }>([
      { $match: { ...filter, status: "succeeded" } },
      { $group: { _id: null, total: { $sum: "$amountPaise" } } },
    ]),
  ]);
  const [bookings, names] = await Promise.all([
    bookingInfo(docs.map((d) => d.bookingId)),
    vendorNames(docs.map((d) => d.vendorId)),
  ]);
  return {
    total,
    succeededPaise: sum[0]?.total ?? 0,
    rows: docs.map((p) => {
      const b = bookings.get(p.bookingId.toString());
      return {
        id: p._id.toString(),
        bookingCode: b?.code ?? "—",
        customerName: b?.contact.name || "Walk-in",
        title: b?.title ?? "",
        vendorName: p.vendorId ? (names.get(p.vendorId.toString()) ?? "Removed vendor") : "ShowBuzz (gift card)",
        amountPaise: p.amountPaise,
        method: p.method,
        provider: p.provider,
        providerRef: p.providerRef,
        ...(p.reference ? { reference: p.reference } : {}),
        status: p.status,
        ...(p.failureReason ? { failureReason: p.failureReason } : {}),
        createdAt: p.createdAt.toISOString(),
      };
    }),
  };
}

export async function listRefunds(
  query: PaymentListQuery,
): Promise<{ rows: AdminRefundRow[]; total: number; refundedPaise: number }> {
  await connect();
  const filter = await baseFilter(query, ["processing", "processed"]);
  const [docs, total, sum] = await Promise.all([
    Refund.find(filter)
      .sort(sortSpec(query, PAYMENT_SORT_FIELDS, "createdAt"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Refund.countDocuments(filter),
    Refund.aggregate<{ total: number }>([
      { $match: filter },
      { $group: { _id: null, total: { $sum: { $add: ["$amountPaise", { $ifNull: ["$giftCardPaise", 0] }] } } } },
    ]),
  ]);
  const [bookings, names] = await Promise.all([
    bookingInfo(docs.map((d) => d.bookingId)),
    vendorNames(docs.map((d) => d.vendorId)),
  ]);
  return {
    total,
    refundedPaise: sum[0]?.total ?? 0,
    rows: docs.map((r) => {
      const b = bookings.get(r.bookingId.toString());
      return {
        id: r._id.toString(),
        bookingCode: b?.code ?? "—",
        customerName: b?.contact.name || "Walk-in",
        vendorName: r.vendorId ? (names.get(r.vendorId.toString()) ?? "Removed vendor") : "ShowBuzz (gift card)",
        originalPaise: b?.amounts.totalPaise ?? 0,
        amountPaise: r.amountPaise,
        giftCardPaise: r.giftCardPaise ?? 0,
        feePaise: r.feePaise,
        reason: r.reason,
        ...(b?.cancelledBy ? { cancelledBy: b.cancelledBy } : {}),
        ...(b?.cancelReason ? { cancelReason: b.cancelReason } : {}),
        provider: r.provider,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        ...(r.processedAt ? { processedAt: r.processedAt.toISOString() } : {}),
      };
    }),
  };
}
