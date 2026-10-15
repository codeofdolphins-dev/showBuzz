import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { GiftCard } from "@showbuzz/db/models/GiftCard";
import { Payment } from "@showbuzz/db/models/Payment";
import { Refund } from "@showbuzz/db/models/Refund";
import { Settlement } from "@showbuzz/db/models/Settlement";
import { Staff } from "@showbuzz/db/models/Staff";
import { Types } from "@showbuzz/db/mongoose";
import { adminCancelBookingSchema } from "@showbuzz/schemas/admin-platform";
import { bookingCodeSchema } from "@showbuzz/schemas/booking";
import type { AdminBookingDetail, AdminBookingRow } from "@showbuzz/schemas/types/admin-platform";
import { addDaysToKey, istDateTime } from "@showbuzz/utils/dates";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import {
  type LeanBooking,
  canCancel,
  cancelConfirmedBooking,
  policyFallback,
  policyOf,
} from "../booking-cancel.service";
import { type AdminListQuery, optionalId, vendorNames } from "./shared";

/**
 * Bookings oversight (prompt 7): every vendor's bookings, online and counter, plus gift card purchases. Staff see the
 * customer's contact (platform support). Staff may cancel and refund a confirmed booking until the show starts, even
 * outside the vendor's policy, always with a reason (logged on the booking and in the activity log); the vendor's
 * fee applies unless waived. Cancellation goes through the shared cancelConfirmedBooking, so inventory, coupons,
 * gift cards, refunds and payout clawbacks behave exactly as for customer and vendor cancellations.
 */

export const ADMIN_BOOKING_SORT_FIELDS = ["bookedAt", "startsAt", "total"] as const;
const SORT_PATHS: Record<(typeof ADMIN_BOOKING_SORT_FIELDS)[number], string> = {
  bookedAt: "createdAt",
  startsAt: "startsAt",
  total: "amounts.totalPaise",
};

export interface AdminBookingListQuery extends AdminListQuery {
  status?: "confirmed" | "checked_in" | "cancelled" | "pending_payment" | "payment_failed" | "expired";
  vendorId?: string;
  channel?: "online" | "counter";
  type?: "movie" | "event" | "gift_card";
  /** Filter dates apply to the show date (`show`) or the booking date (`booked`); IST, inclusive. */
  dateField?: "show" | "booked";
  fromDate?: string;
  toDate?: string;
  customerId?: string;
}

const NOT_FOUND = () => new AppError("NOT_FOUND", "Booking not found.", 404);

function toRow(doc: LeanBooking, vendors: Map<string, string>): AdminBookingRow {
  const vendorName = doc.vendorId ? vendors.get(doc.vendorId.toString()) : undefined;
  return {
    code: doc.code,
    status: doc.status,
    kind: doc.kind,
    channel: doc.channel ?? "online",
    title: doc.title,
    venueName: doc.venueName,
    ...(vendorName ? { vendorName } : {}),
    ...(doc.startsAt ? { startsAt: doc.startsAt.toISOString() } : {}),
    scheduleLabel: doc.scheduleLabel,
    seatLabels: [...doc.seatLabels],
    ticketCount: doc.ticketCount,
    totalPaise: doc.amounts.totalPaise,
    paymentMethod: doc.paymentMethod,
    ...(doc.contact.name ? { customerName: doc.contact.name } : {}),
    ...(doc.contact.phone ? { customerPhone: doc.contact.phone } : {}),
    ...(doc.contact.email ? { customerEmail: doc.contact.email } : {}),
    ...(doc.userId ? { customerId: doc.userId.toString() } : {}),
    bookedAt: (doc.confirmedAt ?? doc.createdAt).toISOString(),
    ...(doc.checkedInAt ? { checkedInAt: doc.checkedInAt.toISOString() } : {}),
  };
}

function listFilter(query: AdminBookingListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.status === "checked_in") Object.assign(filter, { status: "confirmed", checkedInAt: { $exists: true } });
  else if (query.status === "confirmed") Object.assign(filter, { status: "confirmed", checkedInAt: { $exists: false } });
  else if (query.status) filter.status = query.status;
  const vendorId = optionalId(query.vendorId);
  if (vendorId) filter.vendorId = vendorId;
  const customerId = optionalId(query.customerId);
  if (customerId) filter.userId = customerId;
  if (query.channel === "counter") filter.channel = "counter";
  if (query.channel === "online") filter.channel = { $ne: "counter" };
  if (query.type === "movie") filter.kind = "movie";
  if (query.type === "gift_card") filter.kind = "gift-card";
  if (query.type === "event") filter.kind = { $in: ["event", "play", "sport", "activity"] };
  const range: Record<string, Date> = {};
  if (query.fromDate) range.$gte = istDateTime(query.fromDate, "00:00");
  if (query.toDate) range.$lt = istDateTime(addDaysToKey(query.toDate, 1), "00:00");
  if (Object.keys(range).length > 0) filter[query.dateField === "show" ? "startsAt" : "createdAt"] = range;
  const q = query.q.trim();
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    const digits = q.replace(/\D/g, "");
    filter.$or = [
      { code: pattern },
      { title: pattern },
      { "contact.email": pattern },
      { "contact.name": pattern },
      ...(digits.length >= 4 ? [{ "contact.phone": new RegExp(escapeRegex(digits)) }] : []),
    ];
  }
  return filter;
}

export async function listBookingsAdmin(
  query: AdminBookingListQuery,
): Promise<{ rows: AdminBookingRow[]; total: number }> {
  await connect();
  const filter = listFilter(query);
  const field = SORT_PATHS[query.sort.field as keyof typeof SORT_PATHS] ?? "createdAt";
  const [docs, total] = await Promise.all([
    Booking.find(filter)
      .sort({ [field]: query.sort.direction === "asc" ? 1 : -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  const vendors = await vendorNames(docs.map((d) => d.vendorId));
  return { rows: docs.map((d) => toRow(d, vendors)), total };
}

async function findByCode(rawCode: string): Promise<LeanBooking | null> {
  const parsed = bookingCodeSchema.safeParse(rawCode);
  if (!parsed.success) return null;
  await connect();
  return Booking.findOne({ code: parsed.data }).lean();
}

function cancelRecord(doc: LeanBooking) {
  return {
    status: doc.status,
    cancellable: doc.cancellable,
    ...(doc.startsAt ? { startsAt: doc.startsAt.toISOString() } : {}),
    ...(doc.cancellationPolicy ? { cancellationPolicy: doc.cancellationPolicy } : {}),
  };
}

/** Why staff can't cancel this booking now, or null when they can. */
function staffCancelBlocker(doc: LeanBooking, now: Date): string | null {
  if (doc.status !== "confirmed") return "Only confirmed bookings can be cancelled.";
  if (doc.kind === "gift-card") return "This is a gift card purchase: cancel the card from Gift cards instead.";
  if (doc.startsAt && doc.startsAt <= now) return "The show has already started.";
  if (doc.checkedInAt) return "This ticket was already checked in at the gate.";
  return null;
}

export async function getBookingAdmin(rawCode: string, now: Date): Promise<AdminBookingDetail | null> {
  const doc = await findByCode(rawCode);
  if (!doc) return null;
  const [vendors, fallback, payment, refund, payout, giftCard, cancelledBy] = await Promise.all([
    vendorNames([doc.vendorId]),
    policyFallback(),
    Payment.findOne({ bookingId: doc._id }).sort({ createdAt: -1 }).lean(),
    Refund.findOne({ bookingId: doc._id }).lean(),
    doc.settlementId ? Settlement.findById(doc.settlementId, { code: 1 }).lean() : null,
    doc.giftCardId ? GiftCard.findById(doc.giftCardId, { code: 1 }).lean() : null,
    doc.cancelledByStaffId ? Staff.findById(doc.cancelledByStaffId, { name: 1 }).lean() : null,
  ]);
  const record = cancelRecord(doc);
  const policy = policyOf(record, fallback);
  return {
    ...toRow(doc, vendors),
    ...(doc.vendorId ? { vendorId: doc.vendorId.toString() } : {}),
    ...(doc.screenName ? { screenName: doc.screenName } : {}),
    ticketLabel: doc.ticketLabel,
    ...(doc.format ? { format: doc.format } : {}),
    ...(doc.language ? { language: doc.language } : {}),
    food: doc.food.map((f) => ({ ...f })),
    amounts: {
      ...doc.amounts,
      giftCardPaise: doc.amounts.giftCardPaise ?? 0,
      payablePaise: doc.amounts.payablePaise ?? doc.amounts.totalPaise - (doc.amounts.giftCardPaise ?? 0),
    },
    ...(doc.couponCode ? { couponCode: doc.couponCode } : {}),
    ...(giftCard ? { giftCardLast4: giftCard.code.slice(-4) } : {}),
    ...(doc.settlement ? { settlement: { ...doc.settlement } } : {}),
    ...(doc.kind !== "gift-card"
      ? { policy: { allowed: doc.cancellable, cutoffMinutes: policy.cutoffMinutes, feePaise: policy.feePaise } }
      : {}),
    withinPolicy: canCancel(record, now, fallback),
    staffCanCancel: staffCancelBlocker(doc, now) === null,
    ...(doc.cancelledAt ? { cancelledAt: doc.cancelledAt.toISOString() } : {}),
    ...(doc.cancelledBy ? { cancelledBy: doc.cancelledBy } : {}),
    ...(cancelledBy ? { cancelledByName: cancelledBy.name } : {}),
    ...(doc.cancelReason ? { cancelReason: doc.cancelReason } : {}),
    ...(doc.refundPaise !== undefined ? { refundPaise: doc.refundPaise } : {}),
    ...(refund
      ? {
          refund: {
            status: refund.status,
            provider: refund.provider,
            amountPaise: refund.amountPaise,
            giftCardPaise: refund.giftCardPaise,
            feePaise: refund.feePaise,
          },
        }
      : {}),
    ...(payment
      ? {
          payment: {
            provider: payment.provider,
            status: payment.status,
            amountPaise: payment.amountPaise,
            ...(payment.reference ? { reference: payment.reference } : {}),
          },
        }
      : {}),
    ...(payout ? { payoutCode: payout.code } : {}),
    ...(doc.failureReason ? { failureReason: doc.failureReason } : {}),
  };
}

/**
 * Staff cancel and refund. Allowed for any confirmed ticket booking until the show starts and before check-in, also
 * outside the vendor's policy; a reason is always required. The policy fee is kept unless waived.
 */
export async function cancelBookingByStaff(
  staffId: string,
  rawCode: string,
  input: unknown,
  now: Date,
): Promise<{ code: string; refundPaise: number; vendorId?: string; outsidePolicy: boolean; waived: boolean }> {
  const { reason, waiveFee } = adminCancelBookingSchema.parse(input);
  const doc = await findByCode(rawCode);
  if (!doc) throw NOT_FOUND();
  const vendorId = doc.vendorId?.toString();
  if (doc.status === "cancelled") {
    return { code: doc.code, refundPaise: doc.refundPaise ?? 0, ...(vendorId ? { vendorId } : {}), outsidePolicy: false, waived: false };
  }
  const blocker = staffCancelBlocker(doc, now);
  if (blocker) throw new AppError("BOOKING_NOT_CANCELLABLE", blocker, 409);
  const fallback = await policyFallback();
  const record = cancelRecord(doc);
  const feePaise = waiveFee ? 0 : policyOf(record, fallback).feePaise;
  const { refundPaise } = await cancelConfirmedBooking(doc, {
    feePaise,
    by: "staff",
    reason,
    staffId: new Types.ObjectId(staffId).toString(),
    now,
  });
  return {
    code: doc.code,
    refundPaise,
    ...(vendorId ? { vendorId } : {}),
    outsidePolicy: !canCancel(record, now, fallback),
    waived: waiveFee,
  };
}
