import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking, toBookingRecord } from "@showbuzz/db/models/Booking";
import { Coupon } from "@showbuzz/db/models/Coupon";
import { GiftCard } from "@showbuzz/db/models/GiftCard";
import { Payment } from "@showbuzz/db/models/Payment";
import { Refund } from "@showbuzz/db/models/Refund";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { Show } from "@showbuzz/db/models/Show";
import { Types } from "@showbuzz/db/mongoose";
import { log } from "@showbuzz/runtime/log";
import { placeOrderSchema, type PlaceOrderInput } from "@showbuzz/schemas/booking";
import type { BookingRecord, BookingStatus, BookingView } from "@showbuzz/schemas/types/booking";
import type { CustomerSnapshot } from "@showbuzz/schemas/user";
import { insertWithUniqueCode } from "../booking/booking-code";
import { AppError } from "../http/app-error";
import { getPaymentGateway, type SimulatedOutcome } from "../payments/gateway";
import {
  type LeanBooking,
  type PolicyFallback,
  canCancel,
  cancelConfirmedBooking,
  payableOf,
  policyFallback,
  policyOf,
} from "./booking-cancel.service";
import { generateGiftCardCode, getIssuedGiftCards, giftCardExpiry } from "./gift-card.service";
import { priceOrder } from "./pricing.service";
import { closeOrder, releaseLapsedOrders } from "./order-release.service";
import { getSettings } from "./settings.service";
import { findPassShow, getShowDetails } from "./show.service";

/**
 * Orders, payment confirmation and cancellation (MongoDB).
 *
 * placeOrder:     re-prices on the server (coupon, gift card), links this browser's seat holds (or reserves tier
 *                 passes with one conditional $inc), creates a `pending_payment` booking and a gateway payment for
 *                 the part a gift card doesn't cover.
 * confirmPayment: asks the gateway (never the client) whether the payment succeeded, then in one transaction
 *                 confirms the booking, turns holds into sold seats (or counts passes sold), spends the gift card
 *                 share (conditional $inc), issues a purchased gift card and marks the payment.
 * cancelBooking:  until the cutoff of the vendor policy frozen on the booking (Settings for older bookings); one
 *                 transaction frees the inventory, returns the gift card share and records the Refund.
 *
 * Every vendor order stores its seller (`vendorId`), the money split (`settlement`) and the cancellation policy
 * at purchase; gift card purchases are platform sales and have none of them.
 *
 * Every state change is conditional on the current status, so repeating a call (double click, retry, two tabs)
 * changes nothing the second time. Another customer's booking answers exactly like a missing one (NOT_FOUND).
 */

const HOLD_EXPIRED_MESSAGE =
  "Your seat hold expired before payment, so no money was charged. Please pick your seats again.";

/** The record without its owner id, which never leaves the server. */
function withoutOwner(record: BookingRecord): Omit<BookingRecord, "userId"> {
  const copy: Partial<BookingRecord> = { ...record };
  delete copy.userId;
  return copy as Omit<BookingRecord, "userId">;
}

function toView(doc: LeanBooking, now: Date, fallback: PolicyFallback): BookingView {
  const record = toBookingRecord(doc);
  const past = record.startsAt ? new Date(record.startsAt) <= now : false;
  return {
    ...withoutOwner(record),
    phase: record.status === "cancelled" ? "cancelled" : past ? "past" : "upcoming",
    canCancel: canCancel(record, now, fallback),
  };
}

async function findOwned(code: string, userId: string): Promise<LeanBooking | undefined> {
  if (!Types.ObjectId.isValid(userId)) return undefined;
  await connect();
  return (await Booking.findOne({ code, userId }).lean()) ?? undefined;
}

/**
 * Places an order for the signed-in customer and opens a payment for it. Seats must be held by this browser
 * (`holderKey`) and still valid; tier passes are reserved here. The ticket contact uses the account's phone and
 * email (verified when added) and falls back to the form only for details the account lacks.
 */
export async function placeOrder(
  input: PlaceOrderInput,
  customer: CustomerSnapshot,
  context: { holderKey?: string; ip: string },
  now: Date,
): Promise<{ code: string; holdExpiresAt: string }> {
  const { holderKey, ip } = context;
  const order = placeOrderSchema.parse(input);
  await connect();
  const settings = await getSettings();

  // One open order per customer: a new attempt replaces any unpaid one (its passes go back on sale first).
  const open = await Booking.find({ userId: customer.id, status: "pending_payment" }).lean();
  for (const booking of open)
    await closeOrder(booking, "expired", "Replaced by a newer order.", { releaseSeats: false });

  const { quote, giftCardId, seller } = await priceOrder(order, now, {
    strictCoupon: true,
    holderKey,
    giftCardContext: { userId: customer.id, ip },
  });
  const { tickets } = order;
  const bookingId = new Types.ObjectId();
  let holdExpiresAt = new Date(now.getTime() + settings.seatHoldMinutes * 60_000);
  let showId: Types.ObjectId | undefined;
  // Cancellable only when the vendor's policy allows it (and, for cinemas, the venue too; see below).
  let cancellable = seller?.cancellationPolicy.allowed ?? false;
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
    cancellable = cancellable && show.cancellationAllowed;
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
      ...(seller
        ? { vendorId: seller.vendorId, settlement: seller.settlement, cancellationPolicy: seller.cancellationPolicy }
        : {}),
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
      ...(giftCardId ? { giftCardId } : {}),
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

  // Only the part not covered by a gift card goes through the gateway.
  const payablePaise = quote.amounts.payablePaise;
  if (payablePaise === 0) return { code, holdExpiresAt: holdExpiresAt.toISOString() };
  const gateway = getPaymentGateway();
  const { providerRef } = await gateway.createPayment({
    bookingCode: code,
    amountPaise: payablePaise,
    method: order.paymentMethod,
  });
  await Payment.create({
    bookingId,
    userId: customer.id,
    ...(seller ? { vendorId: seller.vendorId } : {}),
    provider: gateway.provider,
    providerRef,
    amountPaise: payablePaise,
    method: order.paymentMethod,
    status: "created",
  });
  return { code, holdExpiresAt: holdExpiresAt.toISOString() };
}

export type PaymentResult = { status: "confirmed"; code: string } | { status: "failed"; code: string; reason: string };

/** Thrown inside the confirm transaction to abort it; the reason is shown to the customer. */
class ConfirmAborted extends Error {
  constructor(
    readonly kind: "seats_lost" | "gift_card_spent" | "coupon_used_up",
    readonly reason: string,
  ) {
    super(kind);
  }
}

/**
 * Confirms the order's payment with the gateway and, if it succeeded, issues the ticket in one transaction.
 * A gift card's share is deducted here (conditional on enough balance), and a gift card purchase creates its
 * card here. Idempotent: a confirmed order is returned as is. `simulate` is only read by the simulated gateway.
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

  const gateway = getPaymentGateway();
  // A gift card covering the whole order means nothing goes through the gateway.
  const payment =
    payableOf(booking) > 0
      ? await Payment.findOne({ bookingId: booking._id, status: "created" }).sort({ createdAt: -1 }).lean()
      : null;
  if (payableOf(booking) > 0) {
    if (!payment) {
      const reason = "The payment could not be started. Please try again.";
      await closeOrder(booking, "payment_failed", reason, { releaseSeats: true });
      return { status: "failed", code, reason };
    }
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
  }

  const mongoose = await connect();
  const state: { result: "confirmed" | "not_pending" | ConfirmAborted } = { result: "not_pending" };
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
        if (sold.modifiedCount !== booking.seatIds.length) {
          throw new ConfirmAborted(
            "seats_lost",
            "Your seats were released before the payment completed. Any amount charged will be refunded.",
          );
        }
      }
      if (booking.showId && booking.tierId && booking.quantity) {
        await Show.updateOne(
          { _id: booking.showId, "inventory.tierId": booking.tierId },
          { $inc: { "inventory.$.sold": booking.quantity } },
          { session },
        );
      }
      if (booking.couponCode) {
        // One conditional update: a coupon's usage limit can't be exceeded by checkouts confirming at once.
        const used = await Coupon.updateOne(
          {
            code: booking.couponCode,
            $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, { $ifNull: ["$usageLimit", Number.MAX_SAFE_INTEGER] }] },
          },
          { $inc: { usedCount: 1 } },
          { session },
        );
        if (used.matchedCount === 1) {
          await Booking.updateOne({ _id: booking._id }, { $set: { couponUseCounted: true } }, { session });
        } else if (await Coupon.exists({ code: booking.couponCode }).session(session)) {
          throw new ConfirmAborted(
            "coupon_used_up",
            `${booking.couponCode} reached its usage limit before the payment completed. Any amount charged will be refunded.`,
          );
        }
      }
      const giftCardPaise = booking.amounts.giftCardPaise ?? 0;
      if (booking.giftCardId && giftCardPaise > 0) {
        // One conditional update: it only applies while the card is usable and has enough balance, so two
        // orders can never spend the same money.
        const spent = await GiftCard.updateOne(
          {
            _id: booking.giftCardId,
            status: "active",
            expiresAt: { $gt: now },
            balancePaise: { $gte: giftCardPaise },
          },
          {
            $inc: { balancePaise: -giftCardPaise },
            $push: { transactions: { type: "redeem", amountPaise: giftCardPaise, bookingId: booking._id, at: now } },
          },
          { session },
        );
        if (spent.modifiedCount !== 1) {
          throw new ConfirmAborted(
            "gift_card_spent",
            "Your gift card balance changed before the payment completed, so it wasn't used. Any amount charged will be refunded.",
          );
        }
        await GiftCard.updateOne(
          { _id: booking.giftCardId, status: "active", balancePaise: 0 },
          { $set: { status: "redeemed" } },
          { session },
        );
      }
      if (booking.kind === "gift-card" && booking.giftCard) {
        await GiftCard.create(
          [
            {
              code: generateGiftCardCode(),
              designId: booking.giftCard.designId,
              amountPaise: booking.giftCard.amountPaise,
              balancePaise: booking.giftCard.amountPaise,
              purchaserUserId: booking.userId,
              purchaseBookingId: booking._id,
              recipientName: booking.giftCard.recipientName,
              recipientContact: booking.giftCard.recipientContact,
              ...(booking.giftCard.message ? { message: booking.giftCard.message } : {}),
              status: "active",
              expiresAt: giftCardExpiry(now),
              transactions: [
                { type: "purchase", amountPaise: booking.giftCard.amountPaise, bookingId: booking._id, at: now },
              ],
            },
          ],
          { session },
        );
      }
      if (payment) {
        await Payment.updateOne({ _id: payment._id }, { $set: { status: "succeeded", succeededAt: now } }, { session });
      }
      state.result = "confirmed";
    });
  } catch (err) {
    if (!(err instanceof ConfirmAborted)) throw err;
    state.result = err;
  }

  if (state.result === "confirmed") return { status: "confirmed", code };

  if (state.result instanceof ConfirmAborted) {
    // The order can't be completed after the gateway took the money: fail it and refund the gateway part in full.
    const { reason, kind } = state.result;
    await closeOrder(booking, "payment_failed", reason, { releaseSeats: true });
    if (payment) {
      await Payment.updateOne({ _id: payment._id }, { $set: { status: "succeeded", succeededAt: now } });
      const refund = await gateway.refund({ paymentRef: payment.providerRef, amountPaise: payment.amountPaise });
      await Refund.updateOne(
        { bookingId: booking._id },
        {
          $setOnInsert: {
            paymentId: payment._id,
            userId: booking.userId,
            ...(booking.vendorId ? { vendorId: booking.vendorId } : {}),
            provider: gateway.provider,
            providerRef: refund.providerRef,
            amountPaise: payment.amountPaise,
            giftCardPaise: 0,
            feePaise: 0,
            reason: "booking_failed",
            status: refund.status,
            ...(refund.status === "processed" ? { processedAt: now } : {}),
          },
        },
        { upsert: true },
      );
    }
    log.warn("booking.confirm_aborted", { code, kind });
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
  const [view] = await withIssuedGiftCards([booking], now, await policyFallback());
  return view;
}

/** Views, with the card a gift card purchase issued attached (shown to its buyer instead of a QR). */
async function withIssuedGiftCards(docs: LeanBooking[], now: Date, fallback: PolicyFallback): Promise<BookingView[]> {
  const purchases = docs.filter((b) => b.kind === "gift-card" && b.status === "confirmed").map((b) => b._id);
  const issued = await getIssuedGiftCards(purchases, now);
  return docs.map((b) => {
    const view = toView(b, now, fallback);
    const card = issued.get(b._id.toString());
    return card ? { ...view, issuedGiftCard: card } : view;
  });
}

/** The signed-in customer's tickets (confirmed and cancelled), newest first. */
export async function listBookings(userId: string, now: Date): Promise<BookingView[]> {
  if (!Types.ObjectId.isValid(userId)) return [];
  await connect();
  const [docs, fallback] = await Promise.all([
    Booking.find({ userId, status: { $in: ["confirmed", "cancelled"] } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    policyFallback(),
  ]);
  return withIssuedGiftCards(docs, now, fallback);
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
 * Cancels a confirmed booking before its policy's cutoff and refunds the amount paid minus the cancellation fee
 * (never negative): the gift card part goes back to the card, the rest through the gateway. Cancelling an
 * already-cancelled booking returns the same refund and changes nothing.
 */
export async function cancelBooking(code: string, userId: string, now: Date): Promise<{ refundPaise: number }> {
  const booking = await findOwned(code, userId);
  if (!booking) throw new AppError("NOT_FOUND", "Booking not found.", 404);
  if (booking.status === "cancelled") return { refundPaise: booking.refundPaise ?? 0 };

  const record = toBookingRecord(booking);
  const fallback = await policyFallback();
  const { cutoffMinutes, feePaise } = policyOf(record, fallback);
  if (!canCancel(record, now, fallback)) {
    throw new AppError(
      "BOOKING_NOT_CANCELLABLE",
      record.cancellable
        ? `This booking can no longer be cancelled (cut-off is ${cutoffMinutes} minutes before the show).`
        : "This booking can't be cancelled.",
      409,
    );
  }
  return cancelConfirmedBooking(booking, { feePaise, by: "customer", now });
}
