import "server-only";
import { randomInt } from "node:crypto";
import { isDemoMode } from "@showbuzz/runtime/env";
import { placeOrderSchema, type PlaceOrderInput } from "@showbuzz/schemas/booking";
import type { CustomerSnapshot } from "@showbuzz/schemas/user";
import type { BookingRecord, BookingView } from "@showbuzz/schemas/types/booking";
import { AppError } from "../http/app-error";
import { quoteOrder } from "./pricing.service";
import { loadSeatPlan, markSeatsSold, priceSeats, releaseSeats } from "./seat-map.service";
import { getSettings } from "./settings.service";
import { getShowDetails } from "./show.service";

/**
 * Demo booking store (in memory, per server instance) until the bookings collection and payment gateway
 * land. Every booking belongs to the signed-in customer who placed it; another customer's booking answers
 * exactly like a missing one (NOT_FOUND), so codes can't be probed. Payment success here is simulated and
 * therefore refused in production.
 */

const globalStore = globalThis as unknown as { __showbuzzBookings?: Map<string, BookingRecord> };
const bookings = (globalStore.__showbuzzBookings ??= new Map<string, BookingRecord>());

function newBookingCode(): string {
  for (;;) {
    const code = `SB-${randomInt(100_000, 1_000_000)}`;
    if (!bookings.has(code)) return code;
  }
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

function toView(record: BookingRecord, now: Date, cutoffMinutes: number): BookingView {
  const past = record.startsAt ? new Date(record.startsAt) <= now : false;
  return {
    ...withoutOwner(record),
    phase: record.status === "cancelled" ? "cancelled" : past ? "past" : "upcoming",
    canCancel: canCancel(record, now, cutoffMinutes),
  };
}

/** The customer's own booking, or NOT_FOUND (also for other customers' codes). */
function ownedRecord(code: string, userId: string): BookingRecord {
  const record = bookings.get(code);
  if (!record || record.userId !== userId) throw new AppError("NOT_FOUND", "Booking not found.", 404);
  return record;
}

/**
 * Places an order for the signed-in customer. The ticket contact uses the account's phone and email
 * (verified when they were added) and falls back to the form only for details the account lacks.
 */
export async function placeDemoOrder(
  input: PlaceOrderInput,
  customer: CustomerSnapshot,
  now: Date,
): Promise<{ code: string }> {
  if (!isDemoMode) {
    throw new AppError("NOT_CONFIGURED", "Online payments are not live yet. Please try again later.", 503);
  }
  const order = placeOrderSchema.parse(input);
  const quote = await quoteOrder(order, now, { strictCoupon: true });

  const show = order.tickets.kind === "show" ? await getShowDetails(order.tickets.showId, now) : undefined;
  if (order.tickets.kind === "show") {
    const plan = show && (await loadSeatPlan(show.id));
    if (!show || !plan) throw new AppError("NOT_FOUND", "This show is no longer available for booking.", 404);
    // Re-check and claim in one synchronous step (no await in between) so two concurrent orders cannot both win.
    priceSeats(show, plan, order.tickets.seatIds);
    markSeatsSold(order.tickets.showId, order.tickets.seatIds);
  }

  const record: BookingRecord = {
    code: newBookingCode(),
    userId: customer.id,
    status: "confirmed",
    kind: quote.kind,
    showId: order.tickets.kind === "show" ? order.tickets.showId : undefined,
    title: quote.title,
    poster: quote.poster,
    certificate: quote.certificate,
    format: quote.format,
    language: quote.language,
    venueName: quote.venueName,
    screenName: quote.screenName,
    startsAt: quote.startsAt,
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
    bookedAt: now.toISOString(),
    cancellable: quote.kind !== "gift-card" && (show?.cancellationAllowed ?? true),
  };
  bookings.set(record.code, record);
  return { code: record.code };
}

/** The customer's booking, or undefined when it doesn't exist or belongs to someone else. */
export async function getBooking(code: string, userId: string, now: Date): Promise<BookingView | undefined> {
  const record = bookings.get(code);
  if (!record || record.userId !== userId) return undefined;
  const { cancellationCutoffMinutes } = await getSettings();
  return toView(record, now, cancellationCutoffMinutes);
}

/** The signed-in customer's bookings, newest first. */
export async function listBookings(userId: string, now: Date): Promise<BookingView[]> {
  const { cancellationCutoffMinutes } = await getSettings();
  return [...bookings.values()]
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
    .map((b) => toView(b, now, cancellationCutoffMinutes));
}

export async function cancelBooking(code: string, userId: string, now: Date): Promise<{ refundPaise: number }> {
  const record = ownedRecord(code, userId);
  const { cancellationCutoffMinutes, cancellationFeePaise } = await getSettings();
  if (!canCancel(record, now, cancellationCutoffMinutes)) {
    throw new AppError(
      "BOOKING_NOT_CANCELLABLE",
      `This booking can no longer be cancelled (cut-off is ${cancellationCutoffMinutes} minutes before the show).`,
      409,
    );
  }

  const refundPaise = Math.max(0, record.amounts.totalPaise - cancellationFeePaise);
  record.status = "cancelled";
  record.cancelledAt = now.toISOString();
  record.refundPaise = refundPaise;
  if (record.showId) releaseSeats(record.showId, record.seatLabels);
  return { refundPaise };
}
