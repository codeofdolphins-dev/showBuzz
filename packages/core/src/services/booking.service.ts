import "server-only";
import { randomInt } from "node:crypto";
import { connect } from "@showbuzz/db/connect";
import { Booking, type BookingAttrs, toBookingRecord } from "@showbuzz/db/models/Booking";
import { Payment } from "@showbuzz/db/models/Payment";
import { Refund } from "@showbuzz/db/models/Refund";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { Show } from "@showbuzz/db/models/Show";
import { Types } from "@showbuzz/db/mongoose";
import { log } from "@showbuzz/runtime/log";
import { placeOrderSchema, type PlaceOrderInput } from "@showbuzz/schemas/booking";
import type { BookingRecord, BookingStatus, BookingView } from "@showbuzz/schemas/types/booking";
import type { CustomerSnapshot } from "@showbuzz/schemas/user";
import { AppError } from "../http/app-error";
import { getPaymentGateway, type SimulatedOutcome } from "../payments/gateway";
import { quoteOrder } from "./pricing.service";
import { getSettings } from "./settings.service";
import { findPassShow, getShowDetails } from "./show.service";

/**
 * Orders, payment confirmation and cancellation (MongoDB).
 *
 * placeOrder:     re-prices on the server, links this browser's seat holds (or reserves tier passes with one
 *                 conditional $inc), creates a `pending_payment` booking and a gateway payment.
 * confirmPayment: asks the gateway (never the client) whether the payment succeeded, then in one transaction
 *                 confirms the booking, turns holds into sold seats (or counts passes sold) and marks the payment.
 * cancelBooking:  until the Settings cutoff; one transaction frees the inventory and records the Refund.
 *
 * Every state change is conditional on the current status, so repeating a call (double click, retry, two tabs)
 * changes nothing the second time. Another customer's booking answers exactly like a missing one (NOT_FOUND).
 */

type LeanBooking = BookingAttrs & { _id: Types.ObjectId };

const MAX_CODE_ATTEMPTS = 5;
const HOLD_EXPIRED_MESSAGE =
  "Your seat hold expired before payment, so no money was charged. Please pick your seats again.";

function isDuplicateKey(err: unknown, field: string): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  return e.code === 11000 && !!e.keyPattern && field in e.keyPattern;
}

function canCancel(record: BookingRecord, now: Date, cutoffMinutes: number): boolean {
  if (record.status !== "confirmed" || !record.cancellable || !record.startsAt) return false;
  const cutoff = new Date(record.startsAt).getTime() - cutoffMinutes * 60_000;
  return now.getTime() < cutoff;
}

/** The record without its owner id, which never leaves the server. */
function withoutOwner(record: BookingRecord): Omit<BookingRecord, "userId"> {
  const copy: Partial<BookingRecord> = { ...record };
  delete copy.userId;
  return copy as Omit<BookingRecord, "userId">;
}

function toView(doc: LeanBooking, now: Date, cutoffMinutes: number): BookingView {
  const record = toBookingRecord(doc);
  const past = record.startsAt ? new Date(record.startsAt) <= now : false;
  return {
    ...withoutOwner(record),
    phase: record.status === "cancelled" ? "cancelled" : past ? "past" : "upcoming",
    canCancel: canCancel(record, now, cutoffMinutes),
  };
}

async function findOwned(code: string, userId: string): Promise<LeanBooking | undefined> {
  if (!Types.ObjectId.isValid(userId)) return undefined;
  await connect();
  return (await Booking.findOne({ code, userId }).lean()) ?? undefined;
}

/**
 * Ends an unpaid order (`payment_failed` or `expired`) and gives its inventory back. Conditional on the order
 * still being pending, so only one caller ever releases it. Seat holds are deleted only when asked: a superseded
 * or lapsed order may share seats the browser has since re-held for a newer order.
 */
async function closeOrder(
  booking: LeanBooking,
  status: Extract<BookingStatus, "payment_failed" | "expired">,
  reason: string,
  { releaseSeats }: { releaseSeats: boolean },
): Promise<void> {
  const mongoose = await connect();
  await mongoose.connection.transaction(async (session) => {
    const closed = await Booking.updateOne(
      { _id: booking._id, status: "pending_payment" },
      { $set: { status, failureReason: reason } },
      { session },
    );
    if (closed.modifiedCount !== 1) return;
    if (releaseSeats) await SeatHold.deleteMany({ bookingId: booking._id, status: "held" }, { session });
    if (booking.showId && booking.tierId && booking.quantity) {
      await Show.updateOne(
        { _id: booking.showId, "inventory.tierId": booking.tierId },
        { $inc: { "inventory.$.remaining": booking.quantity } },
        { session },
      );
    }
  });
}

/** Gives back tier passes held by orders whose payment window lapsed (run before reading or reserving them). */
export async function releaseLapsedOrders(showId: Types.ObjectId | string, now: Date): Promise<void> {
  await connect();
  const lapsed = await Booking.find({ showId, status: "pending_payment", holdExpiresAt: { $lte: now } })
    .limit(50)
    .lean();
  for (const booking of lapsed) {
    await closeOrder(booking, "expired", "The payment window expired.", { releaseSeats: false });
  }
}

async function insertWithUniqueCode(
  doc: Omit<BookingAttrs, "code" | "createdAt" | "updatedAt"> & { _id: Types.ObjectId },
) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = `SB-${randomInt(100_000, 1_000_000)}`;
    try {
      await Booking.create({ ...doc, code });
      return code;
    } catch (err) {
      if (!isDuplicateKey(err, "code")) throw err;
    }
  }
  throw new AppError("INTERNAL", "We couldn't create your booking. Please try again.", 500);
}

/**
 * Places an order for the signed-in customer and opens a payment for it. Seats must be held by this browser
 * (`holderKey`) and still valid; tier passes are reserved here. The ticket contact uses the account's phone and
 * email (verified when added) and falls back to the form only for details the account lacks.
 */
export async function placeOrder(
  input: PlaceOrderInput,
  customer: CustomerSnapshot,
  holderKey: string | undefined,
  now: Date,
): Promise<{ code: string; holdExpiresAt: string }> {
  const order = placeOrderSchema.parse(input);
  await connect();
  const settings = await getSettings();

  // One open order per customer: a new attempt replaces any unpaid one (its passes go back on sale first).
  const open = await Booking.find({ userId: customer.id, status: "pending_payment" }).lean();
  for (const booking of open)
    await closeOrder(booking, "expired", "Replaced by a newer order.", { releaseSeats: false });

  const quote = await quoteOrder(order, now, { strictCoupon: true, holderKey });
  const { tickets } = order;
  const bookingId = new Types.ObjectId();
  let holdExpiresAt = new Date(now.getTime() + settings.seatHoldMinutes * 60_000);
  let showId: Types.ObjectId | undefined;
  let cancellable = quote.kind !== "gift-card";
  let releaseReservation = async () => {};

  if (tickets.kind === "show") {
    const show = await getShowDetails(tickets.showId, now);
    if (!show) throw new AppError("NOT_FOUND", "This show is no longer available for booking.", 404);
    if (!holderKey) throw new AppError("HOLD_EXPIRED", HOLD_EXPIRED_MESSAGE, 409);
    // Claim this browser's valid holds for the order; anything short of all of them means the hold lapsed.
    const linked = await SeatHold.updateMany(
      { showId: tickets.showId, seatId: { $in: tickets.seatIds }, holderKey, status: "held", expiresAt: { $gt: now } },
      { $set: { bookingId } },
    );
    if (linked.matchedCount !== tickets.seatIds.length) throw new AppError("HOLD_EXPIRED", HOLD_EXPIRED_MESSAGE, 409);
    const earliest = await SeatHold.findOne({ bookingId }, { expiresAt: 1 }).sort({ expiresAt: 1 }).lean();
    holdExpiresAt = earliest?.expiresAt ?? holdExpiresAt;
    showId = new Types.ObjectId(tickets.showId);
    cancellable = show.cancellationAllowed;
  } else if (tickets.kind === "event") {
    const passShow = await findPassShow(tickets.eventId);
    if (!passShow) throw new AppError("NOT_FOUND", "This ticket option is no longer available.", 404);
    await releaseLapsedOrders(passShow._id, now);
    // One conditional update: it only applies while enough passes remain, so a tier can't be oversold.
    const reserved = await Show.updateOne(
      {
        _id: passShow._id,
        inventory: { $elemMatch: { tierId: tickets.tierId, remaining: { $gte: tickets.quantity } } },
      },
      { $inc: { "inventory.$.remaining": -tickets.quantity } },
    );
    if (reserved.modifiedCount !== 1) {
      throw new AppError(
        "SEAT_UNAVAILABLE",
        "Those passes have just sold out. Please choose fewer passes or another tier.",
        409,
      );
    }
    showId = passShow._id;
    releaseReservation = async () => {
      await Show.updateOne(
        { _id: passShow._id, "inventory.tierId": tickets.tierId },
        { $inc: { "inventory.$.remaining": tickets.quantity } },
      );
    };
  }

  let code: string;
  try {
    code = await insertWithUniqueCode({
      _id: bookingId,
      userId: new Types.ObjectId(customer.id),
      status: "pending_payment",
      kind: quote.kind,
      showId,
      seatIds: tickets.kind === "show" ? tickets.seatIds : [],
      ...(tickets.kind === "event"
        ? { eventId: new Types.ObjectId(tickets.eventId), tierId: tickets.tierId, quantity: tickets.quantity }
        : {}),
      ...(tickets.kind === "gift-card" ? { giftCard: tickets.giftCard } : {}),
      title: quote.title,
      poster: quote.poster,
      certificate: quote.certificate,
      format: quote.format,
      language: quote.language,
      venueName: quote.venueName,
      screenName: quote.screenName,
      startsAt: quote.startsAt ? new Date(quote.startsAt) : undefined,
      scheduleLabel: quote.scheduleLabel,
      ticketLabel: quote.ticketLabel,
      seatLabels: quote.seatLabels,
      ticketCount: quote.ticketCount,
      food: quote.food,
      amounts: quote.amounts,
      couponCode: quote.coupon?.code,
      paymentMethod: order.paymentMethod,
      contact: {
        name: order.contact.name,
        phone: customer.phone ?? order.contact.phone,
        email: customer.email ?? order.contact.email,
      },
      holdExpiresAt,
      cancellable,
    });
  } catch (err) {
    await releaseReservation();
    throw err;
  }

  const gateway = getPaymentGateway();
  const { providerRef } = await gateway.createPayment({
    bookingCode: code,
    amountPaise: quote.amounts.totalPaise,
    method: order.paymentMethod,
  });
  await Payment.create({
    bookingId,
    userId: customer.id,
    provider: gateway.provider,
    providerRef,
    amountPaise: quote.amounts.totalPaise,
    method: order.paymentMethod,
    status: "created",
  });
  return { code, holdExpiresAt: holdExpiresAt.toISOString() };
}

export type PaymentResult = { status: "confirmed"; code: string } | { status: "failed"; code: string; reason: string };

class SeatsLostError extends Error {}

/**
 * Confirms the order's payment with the gateway and, if it succeeded, issues the ticket in one transaction.
 * Idempotent: a confirmed order is returned as is. `simulate` is only read by the simulated gateway.
 */
export async function confirmPayment(
  code: string,
  userId: string,
  simulate: SimulatedOutcome,
  now: Date,
): Promise<PaymentResult> {
  const booking = await findOwned(code, userId);
  if (!booking) throw new AppError("NOT_FOUND", "Booking not found.", 404);
  if (booking.status === "confirmed" || booking.status === "cancelled") return { status: "confirmed", code };
  if (booking.status !== "pending_payment") {
    return { status: "failed", code, reason: booking.failureReason ?? "This order was not completed." };
  }
  // Checked before the gateway is asked, so an expired hold never takes money.
  if (booking.holdExpiresAt <= now) {
    await closeOrder(booking, "expired", HOLD_EXPIRED_MESSAGE, { releaseSeats: true });
    return { status: "failed", code, reason: HOLD_EXPIRED_MESSAGE };
  }

  const payment = await Payment.findOne({ bookingId: booking._id, status: "created" }).sort({ createdAt: -1 }).lean();
  if (!payment) {
    const reason = "The payment could not be started. Please try again.";
    await closeOrder(booking, "payment_failed", reason, { releaseSeats: true });
    return { status: "failed", code, reason };
  }

  const gateway = getPaymentGateway();
  const outcome = await gateway.confirmPayment({
    providerRef: payment.providerRef,
    amountPaise: payment.amountPaise,
    simulate,
  });
  if (outcome.status === "failed") {
    await Payment.updateOne(
      { _id: payment._id, status: "created" },
      { $set: { status: "failed", failureReason: outcome.reason } },
    );
    await closeOrder(booking, "payment_failed", outcome.reason, { releaseSeats: true });
    return { status: "failed", code, reason: outcome.reason };
  }

  const mongoose = await connect();
  const state: { result: "confirmed" | "seats_lost" | "not_pending" } = { result: "not_pending" };
  try {
    await mongoose.connection.transaction(async (session) => {
      state.result = "not_pending";
      const confirmed = await Booking.updateOne(
        { _id: booking._id, status: "pending_payment" },
        { $set: { status: "confirmed", confirmedAt: now }, $unset: { failureReason: 1 } },
        { session },
      );
      if (confirmed.modifiedCount !== 1) return;
      if (booking.seatIds.length > 0) {
        const sold = await SeatHold.updateMany(
          { bookingId: booking._id, status: "held", expiresAt: { $gt: now } },
          { $set: { status: "sold" }, $unset: { expiresAt: 1 } },
          { session },
        );
        // Aborts the whole transaction: the booking stays pending and nothing is marked sold.
        if (sold.modifiedCount !== booking.seatIds.length) throw new SeatsLostError();
      }
      if (booking.showId && booking.tierId && booking.quantity) {
        await Show.updateOne(
          { _id: booking.showId, "inventory.tierId": booking.tierId },
          { $inc: { "inventory.$.sold": booking.quantity } },
          { session },
        );
      }
      await Payment.updateOne({ _id: payment._id }, { $set: { status: "succeeded", succeededAt: now } }, { session });
      state.result = "confirmed";
    });
  } catch (err) {
    if (!(err instanceof SeatsLostError)) throw err;
    state.result = "seats_lost";
  }

  if (state.result === "confirmed") return { status: "confirmed", code };

  if (state.result === "seats_lost") {
    // The gateway took the money but the seats were released meanwhile: fail the order and refund in full.
    const reason = "Your seats were released before the payment completed. The full amount will be refunded.";
    await Payment.updateOne({ _id: payment._id }, { $set: { status: "succeeded", succeededAt: now } });
    await closeOrder(booking, "payment_failed", reason, { releaseSeats: true });
    const refund = await gateway.refund({ paymentRef: payment.providerRef, amountPaise: payment.amountPaise });
    await Refund.updateOne(
      { bookingId: booking._id },
      {
        $setOnInsert: {
          paymentId: payment._id,
          userId: booking.userId,
          provider: gateway.provider,
          providerRef: refund.providerRef,
          amountPaise: payment.amountPaise,
          feePaise: 0,
          reason: "booking_failed",
          status: refund.status,
          ...(refund.status === "processed" ? { processedAt: now } : {}),
        },
      },
      { upsert: true },
    );
    log.warn("booking.seats_lost_after_payment", { code });
    return { status: "failed", code, reason };
  }

  // Someone else closed or confirmed the order in the meantime (another tab): report what it is now.
  const fresh = await Booking.findById(booking._id, { status: 1, failureReason: 1 }).lean();
  if (fresh?.status === "confirmed") return { status: "confirmed", code };
  log.warn("booking.payment_after_close", { code, status: fresh?.status });
  return {
    status: "failed",
    code,
    reason: fresh?.failureReason ?? "This order was closed before the payment completed.",
  };
}

/** The customer's ticket (confirmed or cancelled booking), or undefined when it doesn't exist or isn't theirs. */
export async function getBooking(code: string, userId: string, now: Date): Promise<BookingView | undefined> {
  const booking = await findOwned(code, userId);
  if (!booking || (booking.status !== "confirmed" && booking.status !== "cancelled")) return undefined;
  const { cancellationCutoffMinutes } = await getSettings();
  return toView(booking, now, cancellationCutoffMinutes);
}

/** The signed-in customer's tickets (confirmed and cancelled), newest first. */
export async function listBookings(userId: string, now: Date): Promise<BookingView[]> {
  if (!Types.ObjectId.isValid(userId)) return [];
  await connect();
  const [docs, { cancellationCutoffMinutes }] = await Promise.all([
    Booking.find({ userId, status: { $in: ["confirmed", "cancelled"] } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    getSettings(),
  ]);
  return docs.map((b) => toView(b, now, cancellationCutoffMinutes));
}

export interface OrderOutcome {
  status: BookingStatus;
  reason?: string;
  /** Seated orders go back to seat selection (their holds were released); others retry payment. */
  retryHref: string;
}

/** What happened to an order, for the payment failure page (owner only). */
export async function getOrderOutcome(code: string, userId: string): Promise<OrderOutcome | undefined> {
  const booking = await findOwned(code, userId);
  if (!booking) return undefined;
  return {
    status: booking.status,
    ...(booking.failureReason ? { reason: booking.failureReason } : {}),
    retryHref:
      booking.seatIds.length > 0 && booking.showId ? `/booking/${booking.showId.toString()}/seats` : "/booking/payment",
  };
}

/**
 * Cancels a confirmed booking before the Settings cutoff and refunds the amount paid minus the cancellation fee
 * (never negative). Cancelling an already-cancelled booking returns the same refund and changes nothing.
 */
export async function cancelBooking(code: string, userId: string, now: Date): Promise<{ refundPaise: number }> {
  const booking = await findOwned(code, userId);
  if (!booking) throw new AppError("NOT_FOUND", "Booking not found.", 404);
  if (booking.status === "cancelled") return { refundPaise: booking.refundPaise ?? 0 };

  const { cancellationCutoffMinutes, cancellationFeePaise } = await getSettings();
  if (!canCancel(toBookingRecord(booking), now, cancellationCutoffMinutes)) {
    throw new AppError(
      "BOOKING_NOT_CANCELLABLE",
      `This booking can no longer be cancelled (cut-off is ${cancellationCutoffMinutes} minutes before the show).`,
      409,
    );
  }

  const payment = await Payment.findOne({ bookingId: booking._id, status: "succeeded" }).lean();
  if (!payment) throw new AppError("INTERNAL", "We couldn't find the payment for this booking.", 500);

  const refundPaise = Math.max(0, booking.amounts.totalPaise - cancellationFeePaise);
  const gateway = getPaymentGateway();
  const mongoose = await connect();
  const state = { cancelled: false };
  await mongoose.connection.transaction(async (session) => {
    state.cancelled = false;
    const cancelled = await Booking.updateOne(
      { _id: booking._id, status: "confirmed" },
      { $set: { status: "cancelled", cancelledAt: now, refundPaise } },
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
    // Recorded before the gateway is called; the unique bookingId means a booking is only ever refunded once.
    await Refund.create(
      [
        {
          bookingId: booking._id,
          paymentId: payment._id,
          userId: booking.userId,
          provider: gateway.provider,
          providerRef: "pending",
          amountPaise: refundPaise,
          feePaise: booking.amounts.totalPaise - refundPaise,
          reason: "cancelled",
          status: "processing",
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

  const refund = await gateway.refund({ paymentRef: payment.providerRef, amountPaise: refundPaise });
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
