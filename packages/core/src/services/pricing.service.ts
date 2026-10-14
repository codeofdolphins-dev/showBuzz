import "server-only";
import { formatDateLong, formatTime, istWeekday } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { describeSchedule } from "@showbuzz/utils/schedule";
import type { OrderDraft } from "@showbuzz/schemas/booking";
import type { Coupon } from "@showbuzz/schemas/offer";
import { computeSettlement } from "@showbuzz/schemas/settlement";
import type { BookingKind, OrderQuote, QuoteFoodLine } from "@showbuzz/schemas/types/booking";
import type { BookingSettlement } from "@showbuzz/schemas/types/vendor";
import type { CancellationPolicy } from "@showbuzz/schemas/vendor";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { Coupon as CouponModel } from "@showbuzz/db/models/Coupon";
import type { Types } from "@showbuzz/db/mongoose";
import { AppError } from "../http/app-error";
import { getCouponByCode, getEventById, listFoodItemsFor, listGiftCardDesigns } from "./catalog.service";
import { lookupGiftCard } from "./gift-card.service";
import { loadSeatPlan, priceSeats } from "./seat-map.service";
import { getSettings } from "./settings.service";
import { getSeatState } from "./seat-hold.service";
import { findPassShow, getShowDetails } from "./show.service";
import { getSellerTerms } from "./vendor.service";

/**
 * All prices are computed here; anything the client shows is display-only. Fees use the selling vendor's rates
 * (the show's vendor), and every vendor order carries the settlement (money split) frozen at this quote.
 */

const GIFT_CARD_IMAGE = "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80";

export function percentOf(amountPaise: number, bps: number): number {
  return Math.round((amountPaise * bps) / 10_000);
}

export interface TicketPricing {
  kind: BookingKind;
  /** Seller and venue (absent for gift cards, which the platform sells). */
  vendorId?: string;
  venueId?: string;
  /** What is being sold (vendor coupons may be limited to some films or listings). */
  movieId?: string;
  eventId?: string;
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

async function priceTickets(tickets: OrderDraft["tickets"], now: Date, holderKey?: string): Promise<TicketPricing> {
  const { maxTicketsPerOrder } = await getSettings();
  if (tickets.kind === "show") {
    assertTicketLimit(tickets.seatIds.length, maxTicketsPerOrder);
    const show = await getShowDetails(tickets.showId, now);
    const plan = show && (await loadSeatPlan(show.id));
    if (!show || !plan) throw new AppError("NOT_FOUND", "This show is no longer available for booking.", 404);
    // Seats held by this browser are fine; sold seats and other browsers' holds are not.
    const seats = priceSeats(show, plan, tickets.seatIds, await getSeatState(show.id, holderKey, now));
    const start = new Date(show.startsAt);
    return {
      kind: show.kind,
      vendorId: show.vendorId,
      venueId: show.venueId,
      ...(show.movieId ? { movieId: show.movieId } : {}),
      ...(show.eventId ? { eventId: show.eventId } : {}),
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
    const passShow = await findPassShow(event.id);
    const remaining = (passShow?.inventory ?? []).find((t) => t.tierId === tier.id)?.remaining ?? 0;
    if (tickets.quantity > remaining) {
      const left = remaining === 0 ? `${tier.name} is sold out.` : `Only ${remaining} passes left in ${tier.name}.`;
      throw new AppError("SEAT_UNAVAILABLE", left, 409);
    }
    const when = describeSchedule(event.schedule);
    return {
      kind: event.kind,
      vendorId: passShow?.vendorId?.toString(),
      venueId: passShow?.venueId.toString(),
      eventId: event.id,
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

/** Only the menu of the show's vendor and venue can be ordered with it. */
async function priceFood(lines: OrderDraft["food"], tickets: TicketPricing): Promise<QuoteFoodLine[]> {
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.foodItemId, (merged.get(line.foodItemId) ?? 0) + line.quantity);
  if (merged.size === 0) return [];

  const foodItems = await listFoodItemsFor(tickets.vendorId ?? "", tickets.venueId ?? "");
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
  if (coupon.status === "inactive") return { error: `Coupon "${coupon.code}" is invalid.` };
  if (coupon.validFrom && new Date(coupon.validFrom) > now) return { error: `${coupon.code} isn't valid yet.` };
  if (new Date(coupon.validUntil) < now) return { error: `${coupon.code} has expired.` };
  if (tickets.kind === "gift-card") return { error: "Coupons cannot be applied to gift cards." };
  // Vendor coupons only on that vendor's shows; platform coupons (no vendorId) everywhere.
  if (coupon.vendorId && coupon.vendorId !== tickets.vendorId) {
    return { error: `${coupon.code} isn't valid for this show.` };
  }
  // A vendor coupon limited to some venues / films / listings (each list empty or missing = all).
  const outside = (list: string[] | undefined, id: string | undefined) =>
    !!list && list.length > 0 && (!id || !list.includes(id));
  if (
    outside(coupon.venueIds, tickets.venueId) ||
    outside(coupon.movieIds, tickets.movieId) ||
    outside(coupon.eventIds, tickets.eventId)
  ) {
    return { error: `${coupon.code} isn't valid for this show.` };
  }
  if (coupon.usageLimit !== undefined && (coupon.usedCount ?? 0) >= coupon.usageLimit) {
    return { error: `${coupon.code} has been fully redeemed.` };
  }

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

/**
 * Usage limits read fresh (the catalogue copy of a coupon is cached, so its `usedCount` may be behind). The total
 * limit is enforced again atomically when the payment is confirmed; the per-customer limit counts this account's
 * confirmed bookings with the code.
 */
async function couponUsageError(coupon: Coupon, userId: string | undefined): Promise<string | undefined> {
  if (coupon.usageLimit === undefined && coupon.perCustomerLimit === undefined) return undefined;
  await connect();
  if (coupon.usageLimit !== undefined) {
    const fresh = await CouponModel.findOne({ code: coupon.code }, { usedCount: 1 }).lean();
    if ((fresh?.usedCount ?? 0) >= coupon.usageLimit) return `${coupon.code} has been fully redeemed.`;
  }
  if (coupon.perCustomerLimit !== undefined) {
    if (!userId) return `Sign in to use ${coupon.code}.`;
    const used = await Booking.countDocuments({ userId, couponCode: coupon.code, status: "confirmed" });
    if (used >= coupon.perCustomerLimit) {
      return coupon.perCustomerLimit === 1
        ? `You've already used ${coupon.code}.`
        : `You've already used ${coupon.code} ${coupon.perCustomerLimit} times.`;
    }
  }
  return undefined;
}

export interface QuoteOptions {
  /** Throw on an inapplicable coupon instead of returning `couponError` (used when placing orders). */
  strictCoupon?: boolean;
  /** This browser's seat-hold key, so its own held seats count as available. */
  holderKey?: string;
  /** Who is asking, for gift card lookups (sign-in required, rate-limited per user and IP). */
  giftCardContext?: { userId?: string; ip: string };
}

/** The customer-facing quote plus server-only details (which gift card pays, the seller's split and policy). */
export interface PricedOrder {
  quote: OrderQuote;
  giftCardId?: Types.ObjectId;
  /** Absent for gift card purchases (platform sales). */
  seller?: { vendorId: Types.ObjectId; settlement: BookingSettlement; cancellationPolicy: CancellationPolicy };
}

export async function quoteOrder(draft: OrderDraft, now: Date, options: QuoteOptions = {}): Promise<OrderQuote> {
  return (await priceOrder(draft, now, options)).quote;
}

/** Applies a gift card to what is left after coupon and fees. Throws instead of returning errors when `strict`. */
async function applyGiftCard(
  draft: OrderDraft,
  kind: BookingKind,
  totalPaise: number,
  now: Date,
  options: QuoteOptions,
): Promise<{ giftCard?: OrderQuote["giftCard"]; giftCardId?: Types.ObjectId; giftCardError?: string }> {
  if (!draft.giftCardCode) return {};
  const fail = (message: string) => {
    if (options.strictCoupon) throw new AppError("VALIDATION_FAILED", message, 422);
    return { giftCardError: message };
  };
  if (kind === "gift-card") return fail("Gift cards can't be used to buy gift cards.");
  if (!options.giftCardContext) return fail("Sign in to pay with a gift card.");

  const found = await lookupGiftCard(draft.giftCardCode, { ...options.giftCardContext, now });
  if (!found.ok) return fail(found.error);
  const appliedPaise = Math.min(found.card.balancePaise, totalPaise);
  return {
    giftCard: { last4: found.card.last4, appliedPaise, balancePaise: found.card.balancePaise },
    giftCardId: found.card.id,
  };
}

export async function priceOrder(draft: OrderDraft, now: Date, options: QuoteOptions = {}): Promise<PricedOrder> {
  const tickets = await priceTickets(draft.tickets, now, options.holderKey);
  if (draft.food.length > 0 && !tickets.foodAllowed) {
    throw new AppError("VALIDATION_FAILED", "Food pre-orders are only available for cinema shows.", 422);
  }
  // Gift cards are sold by the platform with no fees; everything else by the show's vendor at its rates.
  const seller = tickets.kind === "gift-card" ? undefined : await getSellerTerms(tickets.vendorId);
  const rates = seller
    ? { convenienceFeeBps: seller.convenienceFeeBps, gstBps: seller.gstBps }
    : { convenienceFeeBps: 0, gstBps: 0 };
  const food = await priceFood(draft.food, tickets);
  const foodPaise = food.reduce((sum, f) => sum + f.totalPaise, 0);

  const convenienceFeePaise = tickets.feesApply ? percentOf(tickets.ticketsPaise, rates.convenienceFeeBps) : 0;
  const gstPaise = percentOf(convenienceFeePaise, rates.gstBps);

  let discountPaise = 0;
  let coupon: OrderQuote["coupon"];
  let couponError: string | undefined;

  if (draft.couponCode) {
    const found = await getCouponByCode(draft.couponCode);
    let result = found
      ? evaluateCoupon(found, { tickets, foodPaise, now })
      : { error: `Coupon "${draft.couponCode}" is invalid.` };
    if (found && !("error" in result)) {
      const usageError = await couponUsageError(found, options.giftCardContext?.userId);
      if (usageError) result = { error: usageError };
    }
    if ("error" in result) {
      if (options.strictCoupon) throw new AppError("COUPON_INVALID", result.error, 422);
      couponError = result.error;
    } else if (found) {
      discountPaise = result.discountPaise;
      coupon = { code: found.code, title: found.title };
    }
  }

  const totalPaise = Math.max(0, tickets.ticketsPaise + foodPaise + convenienceFeePaise + gstPaise - discountPaise);
  const { giftCard, giftCardId, giftCardError } = await applyGiftCard(draft, tickets.kind, totalPaise, now, options);
  const giftCardPaise = giftCard?.appliedPaise ?? 0;

  const quote: OrderQuote = {
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
      giftCardPaise,
      payablePaise: totalPaise - giftCardPaise,
    },
    rates,
    coupon,
    couponError,
    ...(giftCard ? { giftCard } : {}),
    ...(giftCardError ? { giftCardError } : {}),
  };
  const settlement =
    seller &&
    computeSettlement({
      billingModel: seller.billingModel,
      commissionBps: seller.commissionBps,
      convenienceFeeBps: seller.convenienceFeeBps,
      gstBps: seller.gstBps,
      ticketsPaise: tickets.ticketsPaise,
      foodPaise,
      discountPaise,
      convenienceFeePaise,
      gstPaise,
      totalPaise,
    });
  return {
    quote,
    ...(giftCardId ? { giftCardId } : {}),
    ...(seller && settlement
      ? { seller: { vendorId: seller.vendorId, settlement, cancellationPolicy: seller.cancellation } }
      : {}),
  };
}
