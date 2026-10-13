import "server-only";
import { formatDateLong, formatTime, istWeekday } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { describeSchedule } from "@showbuzz/utils/schedule";
import type { OrderDraft } from "@showbuzz/schemas/booking";
import type { Coupon } from "@showbuzz/schemas/offer";
import type { BookingKind, OrderQuote, QuoteFoodLine } from "@showbuzz/schemas/types/booking";
import { AppError } from "../http/app-error";
import { getCouponByCode, getEventById, listFoodItems, listGiftCardDesigns } from "./catalog.service";
import { loadSeatPlan, priceSeats } from "./seat-map.service";
import { getSettings } from "./settings.service";
import { getShowDetails } from "./show.service";

/** All prices are computed here; anything the client shows is display-only. */

const GIFT_CARD_IMAGE = "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80";

export function percentOf(amountPaise: number, bps: number): number {
  return Math.round((amountPaise * bps) / 10_000);
}

export interface TicketPricing {
  kind: BookingKind;
  title: string;
  poster: string;
  certificate?: string;
  format?: string;
  language?: string;
  venueName: string;
  screenName?: string;
  startsAt?: string;
  scheduleLabel: string;
  ticketLabel: string;
  seatLabels: string[];
  ticketCount: number;
  /** Individual ticket prices, used by buy-one-get-one coupons. */
  unitPrices: number[];
  ticketsPaise: number;
  feesApply: boolean;
  foodAllowed: boolean;
}

function assertTicketLimit(count: number, maxTicketsPerOrder: number) {
  if (count > maxTicketsPerOrder) {
    throw new AppError("VALIDATION_FAILED", `Maximum ${maxTicketsPerOrder} tickets per booking.`, 422);
  }
}

async function priceTickets(tickets: OrderDraft["tickets"], now: Date): Promise<TicketPricing> {
  const { maxTicketsPerOrder } = await getSettings();
  if (tickets.kind === "show") {
    assertTicketLimit(tickets.seatIds.length, maxTicketsPerOrder);
    const show = await getShowDetails(tickets.showId, now);
    const plan = show && (await loadSeatPlan(show.id));
    if (!show || !plan) throw new AppError("NOT_FOUND", "This show is no longer available for booking.", 404);
    const seats = priceSeats(show, plan, tickets.seatIds);
    const start = new Date(show.startsAt);
    return {
      kind: show.kind,
      title: show.title,
      poster: show.poster,
      certificate: show.certificate,
      format: show.format,
      language: show.language,
      venueName: show.venueName,
      screenName: show.screenName,
      startsAt: show.startsAt,
      scheduleLabel: `${formatDateLong(start)} • ${formatTime(start)}`,
      ticketLabel: [...new Set(seats.map((s) => s.tierName))].join(", "),
      seatLabels: seats.map((s) => s.id),
      ticketCount: seats.length,
      unitPrices: seats.map((s) => s.pricePaise),
      ticketsPaise: seats.reduce((sum, s) => sum + s.pricePaise, 0),
      feesApply: true,
      foodAllowed: show.kind === "movie",
    };
  }

  if (tickets.kind === "event") {
    assertTicketLimit(tickets.quantity, maxTicketsPerOrder);
    const event = await getEventById(tickets.eventId);
    const tier = event?.ticketTiers.find((t) => t.id === tickets.tierId);
    if (!event || !tier) throw new AppError("NOT_FOUND", "This ticket option is no longer available.", 404);
    if (event.schedule.type === "once" && new Date(event.schedule.startsAt) <= now) {
      throw new AppError("NOT_FOUND", "Bookings for this listing have closed.", 410);
    }
    if (tickets.quantity > tier.available) {
      throw new AppError("SEAT_UNAVAILABLE", `Only ${tier.available} passes left in ${tier.name}.`, 409);
    }
    const when = describeSchedule(event.schedule);
    return {
      kind: event.kind,
      title: event.title,
      poster: event.poster,
      language: event.language,
      venueName: event.venueName,
      screenName: tier.name,
      startsAt: event.schedule.type === "once" ? new Date(event.schedule.startsAt).toISOString() : undefined,
      scheduleLabel: `${when.date} • ${when.time}`,
      ticketLabel: tier.name,
      seatLabels: [`${tickets.quantity} × ${tier.name}`],
      ticketCount: tickets.quantity,
      unitPrices: Array.from({ length: tickets.quantity }, () => tier.pricePaise),
      ticketsPaise: tier.pricePaise * tickets.quantity,
      feesApply: true,
      foodAllowed: false,
    };
  }

  const { giftCard } = tickets;
  if (!(await listGiftCardDesigns()).some((d) => d.id === giftCard.designId)) {
    throw new AppError("NOT_FOUND", "Gift card design not found.", 404);
  }
  return {
    kind: "gift-card",
    title: `ShowBuzz E-Gift Card (${formatINR(giftCard.amountPaise)})`,
    poster: GIFT_CARD_IMAGE,
    venueName: `Digital delivery to ${giftCard.recipientName}`,
    scheduleLabel: "Instant digital delivery • Valid 365 days",
    ticketLabel: "E-Gift Card",
    seatLabels: ["E-Voucher"],
    ticketCount: 1,
    unitPrices: [giftCard.amountPaise],
    ticketsPaise: giftCard.amountPaise,
    feesApply: false,
    foodAllowed: false,
  };
}

async function priceFood(lines: OrderDraft["food"]): Promise<QuoteFoodLine[]> {
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.foodItemId, (merged.get(line.foodItemId) ?? 0) + line.quantity);
  if (merged.size === 0) return [];

  const foodItems = await listFoodItems();
  return [...merged].map(([foodItemId, quantity]) => {
    const item = foodItems.find((f) => f.id === foodItemId);
    if (!item) throw new AppError("NOT_FOUND", "A snack in your order is no longer available.", 404);
    return {
      foodItemId,
      name: item.name,
      quantity,
      unitPricePaise: item.pricePaise,
      totalPaise: item.pricePaise * quantity,
    };
  });
}

/** Returns the discount in paise, or a customer-facing reason the coupon does not apply. */
export function evaluateCoupon(
  coupon: Coupon,
  ctx: { tickets: TicketPricing; foodPaise: number; now: Date },
): { discountPaise: number } | { error: string } {
  const { tickets, foodPaise, now } = ctx;
  if (new Date(coupon.validUntil) < now) return { error: `${coupon.code} has expired.` };
  if (tickets.kind === "gift-card") return { error: "Coupons cannot be applied to gift cards." };

  const base = coupon.appliesTo === "food" ? foodPaise : tickets.ticketsPaise;
  if (base < coupon.minOrderPaise) {
    const what = coupon.appliesTo === "food" ? "food order" : "ticket value";
    return { error: `${coupon.code} needs a minimum ${what} of ${formatINR(coupon.minOrderPaise)}.` };
  }
  if (coupon.eligibleFormats && !coupon.eligibleFormats.includes(tickets.format ?? "")) {
    return { error: `${coupon.code} is valid only on ${coupon.eligibleFormats.join(", ")} shows.` };
  }
  if (coupon.minTickets && tickets.ticketCount < coupon.minTickets) {
    return { error: `${coupon.code} needs at least ${coupon.minTickets} tickets.` };
  }
  if (coupon.weekendOnly) {
    const day = tickets.startsAt ? istWeekday(new Date(tickets.startsAt)) : -1;
    if (![0, 5, 6].includes(day)) return { error: `${coupon.code} is valid on Friday to Sunday shows only.` };
  }

  let discount = 0;
  if (coupon.kind === "percent") discount = percentOf(base, coupon.percentBps ?? 0);
  if (coupon.kind === "flat") discount = coupon.flatPaise ?? 0;
  if (coupon.kind === "bogo") discount = Math.min(...tickets.unitPrices);
  if (coupon.maxDiscountPaise !== undefined) discount = Math.min(discount, coupon.maxDiscountPaise);
  return { discountPaise: Math.min(discount, base) };
}

export interface QuoteOptions {
  /** Throw on an inapplicable coupon instead of returning `couponError` (used when placing orders). */
  strictCoupon?: boolean;
}

export async function quoteOrder(draft: OrderDraft, now: Date, options: QuoteOptions = {}): Promise<OrderQuote> {
  const tickets = await priceTickets(draft.tickets, now);
  if (draft.food.length > 0 && !tickets.foodAllowed) {
    throw new AppError("VALIDATION_FAILED", "Food pre-orders are only available for cinema shows.", 422);
  }
  const [food, settings] = await Promise.all([priceFood(draft.food), getSettings()]);
  const foodPaise = food.reduce((sum, f) => sum + f.totalPaise, 0);

  const convenienceFeePaise = tickets.feesApply ? percentOf(tickets.ticketsPaise, settings.convenienceFeeBps) : 0;
  const gstPaise = percentOf(convenienceFeePaise, settings.gstBps);

  let discountPaise = 0;
  let coupon: OrderQuote["coupon"];
  let couponError: string | undefined;

  if (draft.couponCode) {
    const found = await getCouponByCode(draft.couponCode);
    const result = found
      ? evaluateCoupon(found, { tickets, foodPaise, now })
      : { error: `Coupon "${draft.couponCode}" is invalid.` };
    if ("error" in result) {
      if (options.strictCoupon) throw new AppError("COUPON_INVALID", result.error, 422);
      couponError = result.error;
    } else if (found) {
      discountPaise = result.discountPaise;
      coupon = { code: found.code, title: found.title };
    }
  }

  const totalPaise = Math.max(0, tickets.ticketsPaise + foodPaise + convenienceFeePaise + gstPaise - discountPaise);

  return {
    kind: tickets.kind,
    title: tickets.title,
    poster: tickets.poster,
    certificate: tickets.certificate,
    format: tickets.format,
    language: tickets.language,
    venueName: tickets.venueName,
    screenName: tickets.screenName,
    startsAt: tickets.startsAt,
    scheduleLabel: tickets.scheduleLabel,
    ticketLabel: tickets.ticketLabel,
    seatLabels: tickets.seatLabels,
    ticketCount: tickets.ticketCount,
    food,
    foodAllowed: tickets.foodAllowed,
    amounts: {
      ticketsPaise: tickets.ticketsPaise,
      foodPaise,
      convenienceFeePaise,
      gstPaise,
      discountPaise,
      totalPaise,
    },
    coupon,
    couponError,
  };
}
