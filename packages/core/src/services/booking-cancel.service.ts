import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking, type BookingAttrs } from "@showbuzz/db/models/Booking";
import { Coupon } from "@showbuzz/db/models/Coupon";
import { GiftCard } from "@showbuzz/db/models/GiftCard";
import { Payment } from "@showbuzz/db/models/Payment";
import { Refund } from "@showbuzz/db/models/Refund";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { Show } from "@showbuzz/db/models/Show";
import type { Types } from "@showbuzz/db/mongoose";
import type { BookingRecord } from "@showbuzz/schemas/types/booking";
import type { CancellationPolicy } from "@showbuzz/schemas/vendor";
import { AppError } from "../http/app-error";
import { getPaymentGateway } from "../payments/gateway";
import { formatINR } from "@showbuzz/utils/money";
import { notify } from "./notification.service";
import { getSettings } from "./settings.service";

/**
 * Cancelling a confirmed booking: the rules the customer (My Bookings), the vendor (partner Bookings) and staff
 * (admin bookings oversight) go through. Split from booking.service (like order-release.service) so the partner portal, which must not import the
 * cached catalogue reads, can use it.
 *
 * One transaction frees the inventory (seats deleted or passes returned), gives a counted coupon use back, returns
 * the gift card share and records the Refund (unique per booking, so a booking is refunded at most once). Then the
 * gateway refunds its part; counter sales are refunded at the counter and only recorded.
 */

export type LeanBooking = BookingAttrs & { _id: Types.ObjectId };

export type PolicyFallback = Pick<CancellationPolicy, "cutoffMinutes" | "feePaise">;

/** The policy the booking was sold under; bookings from before the marketplace change use Settings. */
export function policyOf(record: Pick<BookingRecord, "cancellationPolicy">, fallback: PolicyFallback): PolicyFallback {
  return record.cancellationPolicy ?? fallback;
}

/** Inside the policy: confirmed, cancellable when sold, and before the cutoff. */
export function canCancel(
  record: Pick<BookingRecord, "status" | "cancellable" | "startsAt" | "cancellationPolicy">,
  now: Date,
  fallback: PolicyFallback,
): boolean {
  if (record.status !== "confirmed" || !record.cancellable || !record.startsAt) return false;
  const cutoff = new Date(record.startsAt).getTime() - policyOf(record, fallback).cutoffMinutes * 60_000;
  return now.getTime() < cutoff;
}

export async function policyFallback(): Promise<PolicyFallback> {
  const { cancellationCutoffMinutes, cancellationFeePaise } = await getSettings();
  return { cutoffMinutes: cancellationCutoffMinutes, feePaise: cancellationFeePaise };
}

/** What the gateway (or the counter) took for this order (older bookings have no gift card fields). */
export function payableOf(booking: Pick<LeanBooking, "amounts">): number {
  return booking.amounts.payablePaise ?? booking.amounts.totalPaise - (booking.amounts.giftCardPaise ?? 0);
}

/**
 * How a refund splits for a fee: the fee comes out of the gateway part first, so the gift card gets back as much
 * as possible (agreed 2026-10-13). Never negative.
 */
export function splitRefund(booking: Pick<LeanBooking, "amounts">, feePaise: number) {
  const gatewayPart = payableOf(booking);
  const giftPart = booking.amounts.giftCardPaise ?? 0;
  const gatewayRefundPaise = Math.max(0, gatewayPart - feePaise);
  const giftCardReturnPaise = Math.max(0, giftPart - Math.max(0, feePaise - gatewayPart));
  return {
    gatewayPart,
    gatewayRefundPaise,
    giftCardReturnPaise,
    refundPaise: gatewayRefundPaise + giftCardReturnPaise,
  };
}

export interface CancelOptions {
  /** Cancellation fee kept (the policy's, or 0 when the vendor waives it). */
  feePaise: number;
  by: "customer" | "vendor" | "staff";
  /** Vendor and staff cancellations: why (required by the caller outside the policy; always for staff). */
  reason?: string;
  /** Staff cancellations: the staff member. */
  staffId?: string;
  now: Date;
}

/**
 * Cancels a confirmed booking and refunds it (callers check who may cancel and when). Cancelling one that is
 * already cancelled returns the same refund and changes nothing.
 */
export async function cancelConfirmedBooking(
  booking: LeanBooking,
  { feePaise, by, reason, staffId, now }: CancelOptions,
): Promise<{ refundPaise: number }> {
  if (booking.status === "cancelled") return { refundPaise: booking.refundPaise ?? 0 };
  if (booking.status !== "confirmed")
    throw new AppError("BOOKING_NOT_CANCELLABLE", "This booking can't be cancelled.", 409);

  const { gatewayPart, gatewayRefundPaise, giftCardReturnPaise, refundPaise } = splitRefund(booking, feePaise);
  const payment =
    gatewayPart > 0 ? await Payment.findOne({ bookingId: booking._id, status: "succeeded" }).lean() : null;
  if (gatewayPart > 0 && !payment) {
    throw new AppError("INTERNAL", "We couldn't find the payment for this booking.", 500);
  }
  // Counter sales are paid back in cash/UPI at the counter: recorded, never sent to the gateway.
  const atCounter = payment?.provider === "counter";
  const gateway = getPaymentGateway();
  const provider = atCounter ? "counter" : gateway.provider;

  const mongoose = await connect();
  const state = { cancelled: false };
  await mongoose.connection.transaction(async (session) => {
    state.cancelled = false;
    const cancelled = await Booking.updateOne(
      { _id: booking._id, status: "confirmed" },
      {
        $set: {
          status: "cancelled",
          cancelledAt: now,
          refundPaise,
          cancelledBy: by,
          ...(reason ? { cancelReason: reason } : {}),
          ...(staffId ? { cancelledByStaffId: staffId } : {}),
        },
      },
      { session },
    );
    if (cancelled.modifiedCount !== 1) return;
    if (booking.seatIds.length > 0) await SeatHold.deleteMany({ bookingId: booking._id }, { session });
    if (booking.showId && booking.tierId && booking.quantity) {
      await Show.updateOne(
        { _id: booking.showId, "inventory.tierId": booking.tierId },
        { $inc: { "inventory.$.remaining": booking.quantity, "inventory.$.sold": -booking.quantity } },
        { session },
      );
    }
    if (booking.couponCode && booking.couponUseCounted) {
      await Coupon.updateOne(
        { code: booking.couponCode, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
        { session },
      );
    }
    if (booking.giftCardId && giftCardReturnPaise > 0) {
      await GiftCard.updateOne(
        { _id: booking.giftCardId },
        {
          $inc: { balancePaise: giftCardReturnPaise },
          $push: {
            transactions: { type: "refund", amountPaise: giftCardReturnPaise, bookingId: booking._id, at: now },
          },
        },
        { session },
      );
      // A card emptied by this booking becomes usable again (an expired card keeps the money but stays expired).
      await GiftCard.updateOne(
        { _id: booking.giftCardId, status: "redeemed", balancePaise: { $gt: 0 } },
        { $set: { status: "active" } },
        { session },
      );
    }
    // Recorded before the gateway is called; the unique bookingId means a booking is only ever refunded once.
    const settledNow = gatewayRefundPaise === 0 || atCounter;
    await Refund.create(
      [
        {
          bookingId: booking._id,
          ...(payment ? { paymentId: payment._id } : {}),
          ...(booking.userId ? { userId: booking.userId } : {}),
          ...(booking.vendorId ? { vendorId: booking.vendorId } : {}),
          provider,
          providerRef: gatewayRefundPaise === 0 ? "none" : atCounter ? "counter" : "pending",
          amountPaise: gatewayRefundPaise,
          giftCardPaise: giftCardReturnPaise,
          feePaise: booking.amounts.totalPaise - refundPaise,
          reason: "cancelled",
          status: settledNow ? "processed" : "processing",
          ...(settledNow ? { processedAt: now } : {}),
        },
      ],
      { session },
    );
    state.cancelled = true;
  });

  if (!state.cancelled) {
    const fresh = await Booking.findById(booking._id, { refundPaise: 1 }).lean();
    return { refundPaise: fresh?.refundPaise ?? 0 };
  }
  await notifyRefund(
    booking.code,
    refundPaise,
    atCounter ? `cancelled by the ${by} (refund paid at the counter)` : `cancelled by the ${by}`,
  );

  if (!payment || gatewayRefundPaise === 0 || atCounter) return { refundPaise };
  // Razorpay refunds a payment, not the order created up front, so the id captured at confirmation wins.
  const refund = await gateway.refund({
    paymentRef: payment.gatewayPaymentRef ?? payment.providerRef,
    amountPaise: gatewayRefundPaise,
  });
  await Refund.updateOne(
    { bookingId: booking._id },
    {
      $set: {
        providerRef: refund.providerRef,
        status: refund.status,
        ...(refund.status === "processed" ? { processedAt: now } : {}),
      },
    },
  );
  return { refundPaise };
}

/** Tells finance staff a refund was recorded (cancellation or a paid order that couldn't be completed). */
export async function notifyRefund(code: string, refundPaise: number, how: string): Promise<void> {
  await notify({
    audience: "staff",
    permission: "refunds:read",
    type: "refund_created",
    title: `Refund of ${formatINR(refundPaise, { exact: true })} for ${code}`,
    body: `Booking ${code} was ${how}.`,
    link: `/refunds?q=${encodeURIComponent(code)}`,
  });
}
