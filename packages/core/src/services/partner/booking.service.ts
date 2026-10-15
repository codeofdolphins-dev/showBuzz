import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking, type BookingAttrs } from "@showbuzz/db/models/Booking";
import { Payment } from "@showbuzz/db/models/Payment";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { VendorUser } from "@showbuzz/db/models/VendorUser";
import { Types } from "@showbuzz/db/mongoose";
import { bookingCodeSchema } from "@showbuzz/schemas/booking";
import {
  OVERRIDE_REASON_MIN,
  type BookingListStatus,
  vendorCancelBookingSchema,
} from "@showbuzz/schemas/partner-box-office";
import type { SharedContact, VendorBookingDetail, VendorBookingRow } from "@showbuzz/schemas/types/partner-box-office";
import { addDaysToKey, istDateTime } from "@showbuzz/utils/dates";
import { escapeRegex } from "@showbuzz/utils/text";
import { renderTicketQrSvg } from "../../booking/ticket-qr";
import { AppError } from "../../http/app-error";
import {
  type LeanBooking,
  canCancel,
  cancelConfirmedBooking,
  policyFallback,
  policyOf,
} from "../booking-cancel.service";

/**
 * The vendor's bookings (online and counter sales), scoped to the session's vendor id: another vendor's booking
 * answers 404 exactly like a missing one. Only confirmed and cancelled bookings are shown (unpaid orders are not
 * sales yet).
 *
 * Customer contact details (name, phone, email of online customers) are included only when the super-admin turned on
 * `shareCustomerContact` for this vendor, read fresh on every call. A counter sale's walk-in name/phone was typed by
 * the vendor itself, so it is always shown.
 */

export const BOOKING_SORT_FIELDS = ["bookedAt", "startsAt", "total"] as const;

const SORT_PATHS: Record<(typeof BOOKING_SORT_FIELDS)[number], string> = {
  bookedAt: "createdAt",
  startsAt: "startsAt",
  total: "amounts.totalPaise",
};

export interface BookingListQuery {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
  status?: BookingListStatus;
  channel?: "online" | "counter";
  /** IST date of the show. */
  dateKey?: string;
  showId?: string;
}

const NOT_FOUND = () => new AppError("NOT_FOUND", "Booking not found.", 404);

function vendorObjectId(vendorId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(vendorId)) throw NOT_FOUND();
  return new Types.ObjectId(vendorId);
}

export async function sharesContact(vendorId: string): Promise<boolean> {
  const vendor = await Vendor.findById(vendorId, { shareCustomerContact: 1 }).lean();
  return vendor?.shareCustomerContact === true;
}

export function contactOf(doc: BookingAttrs, share: boolean): SharedContact | undefined {
  if (doc.channel === "counter") {
    const walkIn = {
      ...(doc.contact.name ? { name: doc.contact.name } : {}),
      ...(doc.contact.phone ? { phone: doc.contact.phone } : {}),
    };
    return Object.keys(walkIn).length > 0 ? walkIn : undefined;
  }
  if (!share) return undefined;
  return {
    ...(doc.contact.name ? { name: doc.contact.name } : {}),
    ...(doc.contact.phone ? { phone: doc.contact.phone } : {}),
    ...(doc.contact.email ? { email: doc.contact.email } : {}),
  };
}

function toRow(doc: LeanBooking, share: boolean): VendorBookingRow {
  const contact = contactOf(doc, share);
  return {
    code: doc.code,
    status: doc.status,
    kind: doc.kind,
    channel: doc.channel ?? "online",
    title: doc.title,
    venueName: doc.venueName,
    ...(doc.screenName ? { screenName: doc.screenName } : {}),
    ...(doc.startsAt ? { startsAt: doc.startsAt.toISOString() } : {}),
    scheduleLabel: doc.scheduleLabel,
    seatLabels: [...doc.seatLabels],
    ticketCount: doc.ticketCount,
    totalPaise: doc.amounts.totalPaise,
    paymentMethod: doc.paymentMethod,
    bookedAt: (doc.confirmedAt ?? doc.createdAt).toISOString(),
    ...(doc.checkedInAt ? { checkedInAt: doc.checkedInAt.toISOString() } : {}),
    ...(contact ? { contact } : {}),
  };
}

export async function listVendorBookings(
  vendorId: string,
  query: BookingListQuery,
): Promise<{ rows: VendorBookingRow[]; total: number; sharesContact: boolean }> {
  const vendor = vendorObjectId(vendorId);
  await connect();
  const filter: Record<string, unknown> = { vendorId: vendor, status: { $in: ["confirmed", "cancelled"] } };
  if (query.status === "cancelled") filter.status = "cancelled";
  if (query.status === "confirmed") Object.assign(filter, { status: "confirmed", checkedInAt: { $exists: false } });
  if (query.status === "checked_in") Object.assign(filter, { status: "confirmed", checkedInAt: { $exists: true } });
  if (query.channel === "counter") filter.channel = "counter";
  if (query.channel === "online") filter.channel = { $ne: "counter" };
  if (query.dateKey) {
    filter.startsAt = {
      $gte: istDateTime(query.dateKey, "00:00"),
      $lt: istDateTime(addDaysToKey(query.dateKey, 1), "00:00"),
    };
  }
  if (query.showId && Types.ObjectId.isValid(query.showId)) filter.showId = new Types.ObjectId(query.showId);
  const q = query.q.trim();
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ code: pattern }, { title: pattern }, { seatLabels: pattern }];
  }
  const field = SORT_PATHS[query.sort.field as keyof typeof SORT_PATHS] ?? "createdAt";
  const [docs, total, share] = await Promise.all([
    Booking.find(filter)
      .sort({ [field]: query.sort.direction === "asc" ? 1 : -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Booking.countDocuments(filter),
    sharesContact(vendorId),
  ]);
  return { rows: docs.map((d) => toRow(d, share)), total, sharesContact: share };
}

/** A booking of this vendor by code (any status), or null. */
async function findVendorBooking(vendorId: string, code: string): Promise<LeanBooking | null> {
  const parsed = bookingCodeSchema.safeParse(code);
  if (!parsed.success) return null;
  await connect();
  return Booking.findOne({ code: parsed.data, vendorId: vendorObjectId(vendorId) }).lean();
}

async function vendorUserNames(ids: (Types.ObjectId | undefined)[]): Promise<Map<string, string>> {
  const wanted = ids.filter((id): id is Types.ObjectId => !!id);
  if (wanted.length === 0) return new Map();
  const users = await VendorUser.find({ _id: { $in: wanted } }, { name: 1 }).lean();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

export async function getVendorBooking(vendorId: string, code: string, now: Date): Promise<VendorBookingDetail | null> {
  const doc = await findVendorBooking(vendorId, code);
  if (!doc || (doc.status !== "confirmed" && doc.status !== "cancelled")) return null;
  const [share, fallback, names, payment] = await Promise.all([
    sharesContact(vendorId),
    policyFallback(),
    vendorUserNames([doc.checkedInBy, doc.soldByVendorUserId]),
    doc.channel === "counter" ? Payment.findOne({ bookingId: doc._id }, { reference: 1 }).lean() : null,
  ]);
  const record = {
    status: doc.status,
    cancellable: doc.cancellable,
    ...(doc.startsAt ? { startsAt: doc.startsAt.toISOString() } : {}),
    ...(doc.cancellationPolicy ? { cancellationPolicy: doc.cancellationPolicy } : {}),
  };
  const policy = policyOf(record, fallback);
  const started = doc.startsAt ? doc.startsAt <= now : false;
  return {
    ...toRow(doc, share),
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
    ...(doc.settlement ? { settlement: { ...doc.settlement } } : {}),
    policy: { allowed: doc.cancellable, cutoffMinutes: policy.cutoffMinutes, feePaise: policy.feePaise },
    withinPolicy: canCancel(record, now, fallback),
    vendorCanCancel: doc.status === "confirmed" && !started,
    ...(doc.cancelledAt ? { cancelledAt: doc.cancelledAt.toISOString() } : {}),
    ...(doc.cancelledBy ? { cancelledBy: doc.cancelledBy } : {}),
    ...(doc.cancelReason ? { cancelReason: doc.cancelReason } : {}),
    ...(doc.refundPaise !== undefined ? { refundPaise: doc.refundPaise } : {}),
    ...(doc.checkedInBy && names.get(doc.checkedInBy.toString())
      ? { checkedInByName: names.get(doc.checkedInBy.toString()) }
      : {}),
    ...(doc.soldByVendorUserId && names.get(doc.soldByVendorUserId.toString())
      ? { soldByName: names.get(doc.soldByVendorUserId.toString()) }
      : {}),
    ...(payment?.reference ? { paymentReference: payment.reference } : {}),
    ...(doc.status === "confirmed"
      ? {
          qrSvg: await renderTicketQrSvg({
            code: doc.code,
            ...(doc.showId ? { showId: doc.showId.toString() } : {}),
            seatLabels: doc.seatLabels,
            bookedAt: (doc.confirmedAt ?? doc.createdAt).toISOString(),
          }),
        }
      : {}),
  };
}

/**
 * The vendor cancels one of its bookings. Inside its own policy the refund is the amount paid minus the policy fee;
 * outside it (after the cutoff, or a booking sold as non-cancellable) a reason is required. Either way the vendor may
 * waive the fee (full refund). Not after the show has started.
 */
export async function cancelVendorBooking(
  vendorId: string,
  raw: unknown,
  now: Date,
): Promise<{ code: string; refundPaise: number; outsidePolicy: boolean; waived: boolean }> {
  const { code, reason, waiveFee } = vendorCancelBookingSchema.parse(raw);
  const doc = await findVendorBooking(vendorId, code);
  if (!doc || (doc.status !== "confirmed" && doc.status !== "cancelled")) throw NOT_FOUND();
  if (doc.status === "cancelled") {
    return { code, refundPaise: doc.refundPaise ?? 0, outsidePolicy: false, waived: false };
  }
  if (doc.startsAt && doc.startsAt <= now) {
    throw new AppError(
      "BOOKING_NOT_CANCELLABLE",
      "This show has already started, so the booking can't be cancelled.",
      409,
    );
  }
  if (doc.checkedInAt) {
    throw new AppError("BOOKING_NOT_CANCELLABLE", "This ticket was already checked in at the gate.", 409);
  }
  const fallback = await policyFallback();
  const record = {
    status: doc.status,
    cancellable: doc.cancellable,
    ...(doc.startsAt ? { startsAt: doc.startsAt.toISOString() } : {}),
    ...(doc.cancellationPolicy ? { cancellationPolicy: doc.cancellationPolicy } : {}),
  };
  // Day-long activity passes have no start time: always "outside policy", so a reason is recorded.
  const outsidePolicy = !canCancel(record, now, fallback);
  if (outsidePolicy && reason.length < OVERRIDE_REASON_MIN) {
    throw new AppError("VALIDATION_FAILED", "Give a reason: this booking is outside your cancellation policy.", 422, {
      fieldErrors: { reason: ["Give a reason (at least 5 characters)."] },
    });
  }
  const feePaise = waiveFee ? 0 : policyOf(record, fallback).feePaise;
  const { refundPaise } = await cancelConfirmedBooking(doc, {
    feePaise,
    by: "vendor",
    ...(reason ? { reason } : {}),
    now,
  });
  return { code, refundPaise, outsidePolicy, waived: waiveFee };
}
