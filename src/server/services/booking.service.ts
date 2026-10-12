import "server-only";
import { randomInt } from "node:crypto";
import { CANCELLATION_CUTOFF_MINUTES, PRICING_DEFAULTS } from "@/config/constants";
import { isDemoMode } from "@/config/env";
import { placeOrderSchema, type PlaceOrderInput } from "@/schemas/booking";
import type { BookingRecord, BookingView } from "@/types/booking";
import { AppError } from "@/server/http/app-error";
import { quoteOrder } from "./pricing.service";
import { markSeatsSold, priceSeats, releaseSeats } from "./seat-map.service";
import { getShowDetails } from "./show.service";

/**
 * Demo booking store (in memory, per server instance). It exists so the public UI can be
 * exercised end to end before MongoDB, auth and the payment gateway are in place.
 * Payment success here is simulated and therefore refused in production.
 */

const SEED_BOOKING: BookingRecord = {
  code: "SB-883921",
  status: "confirmed",
  kind: "movie",
  title: "Chrono Nexus: Origins",
  poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
  certificate: "UA 13+",
  format: "IMAX 3D",
  language: "English",
  venueName: "PVR INOX: Quest Mall, Park Circus",
  screenName: "Audi 02 (IMAX Laser)",
  startsAt: "2026-08-23T12:45:00.000Z",
  scheduleLabel: "Sun, 23 Aug 2026 • 06:15 PM",
  ticketLabel: "Royal Recliner",
  seatLabels: ["F8", "F9"],
  ticketCount: 2,
  food: [
    {
      foodItemId: "fb-1",
      name: "Classic Salted & Golden Caramel Duo Popcorn",
      quantity: 1,
      unitPricePaise: 26_000,
      totalPaise: 26_000,
    },
    {
      foodItemId: "fb-7",
      name: "Ice Cold Pepsi Fountain Drink",
      quantity: 2,
      unitPricePaise: 13_000,
      totalPaise: 26_000,
    },
  ],
  amounts: {
    ticketsPaise: 96_000,
    foodPaise: 52_000,
    convenienceFeePaise: 7_840,
    gstPaise: 1_410,
    discountPaise: 15_000,
    totalPaise: 142_250,
  },
  couponCode: "SHOW50",
  paymentMethod: "upi",
  contact: { name: "Aarav Roy", phone: "+919876543210", email: "aarav.roy@example.com" },
  bookedAt: "2026-08-20T14:30:00.000Z",
  cancellable: true,
};

const globalStore = globalThis as unknown as { __showbuzzBookings?: Map<string, BookingRecord> };
const bookings = (globalStore.__showbuzzBookings ??= new Map([[SEED_BOOKING.code, SEED_BOOKING]]));

function newBookingCode(): string {
  for (;;) {
    const code = `SB-${randomInt(100_000, 1_000_000)}`;
    if (!bookings.has(code)) return code;
  }
}

function canCancel(record: BookingRecord, now: Date): boolean {
  if (record.status !== "confirmed" || !record.cancellable || !record.startsAt) return false;
  const cutoff = new Date(record.startsAt).getTime() - CANCELLATION_CUTOFF_MINUTES * 60_000;
  return now.getTime() < cutoff;
}

function toView(record: BookingRecord, now: Date): BookingView {
  const past = record.startsAt ? new Date(record.startsAt) <= now : false;
  return {
    ...record,
    phase: record.status === "cancelled" ? "cancelled" : past ? "past" : "upcoming",
    canCancel: canCancel(record, now),
  };
}

export async function placeDemoOrder(input: PlaceOrderInput, now: Date): Promise<{ code: string }> {
  if (!isDemoMode) {
    throw new AppError("NOT_CONFIGURED", "Online payments are not live yet. Please try again later.", 503);
  }
  const order = placeOrderSchema.parse(input);
  const quote = await quoteOrder(order, now, { strictCoupon: true });

  const show = order.tickets.kind === "show" ? await getShowDetails(order.tickets.showId, now) : undefined;
  if (order.tickets.kind === "show") {
    if (!show) throw new AppError("NOT_FOUND", "This show is no longer available for booking.", 404);
    // Re-check and claim in one synchronous step so two concurrent orders cannot both win.
    priceSeats(show, order.tickets.seatIds);
    markSeatsSold(order.tickets.showId, order.tickets.seatIds);
  }

  const record: BookingRecord = {
    code: newBookingCode(),
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
    contact: order.contact,
    bookedAt: now.toISOString(),
    cancellable: quote.kind !== "gift-card" && (show?.cancellationAllowed ?? true),
  };
  bookings.set(record.code, record);
  return { code: record.code };
}

export async function getBooking(code: string, now: Date): Promise<BookingView | undefined> {
  const record = bookings.get(code);
  return record ? toView(record, now) : undefined;
}

/** Until customer auth lands, every demo booking is listed. Will be scoped to the signed-in user. */
export async function listBookings(now: Date): Promise<BookingView[]> {
  return [...bookings.values()].sort((a, b) => b.bookedAt.localeCompare(a.bookedAt)).map((b) => toView(b, now));
}

export async function cancelBooking(code: string, now: Date): Promise<{ refundPaise: number }> {
  const record = bookings.get(code);
  if (!record) throw new AppError("NOT_FOUND", "Booking not found.", 404);
  if (!canCancel(record, now)) {
    throw new AppError(
      "BOOKING_NOT_CANCELLABLE",
      `This booking can no longer be cancelled (cut-off is ${CANCELLATION_CUTOFF_MINUTES} minutes before the show).`,
      409,
    );
  }

  const refundPaise = Math.max(0, record.amounts.totalPaise - PRICING_DEFAULTS.cancellationFeePaise);
  record.status = "cancelled";
  record.cancelledAt = now.toISOString();
  record.refundPaise = refundPaise;
  if (record.showId) releaseSeats(record.showId, record.seatLabels);
  return { refundPaise };
}
