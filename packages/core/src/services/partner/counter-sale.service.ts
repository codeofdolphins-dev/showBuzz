import "server-only";
import { randomBytes } from "node:crypto";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { ACTIVE_EVENT_FILTER, Event, toEvent } from "@showbuzz/db/models/Event";
import { Movie } from "@showbuzz/db/models/Movie";
import { Payment } from "@showbuzz/db/models/Payment";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { LIVE_SHOW_FILTER, Show } from "@showbuzz/db/models/Show";
import { Venue } from "@showbuzz/db/models/Venue";
import { Types } from "@showbuzz/db/mongoose";
import { counterSaleSchema } from "@showbuzz/schemas/partner-box-office";
import { computeSettlement } from "@showbuzz/schemas/settlement";
import type {
  CounterPassListing,
  CounterSaleResult,
  CounterShowOption,
} from "@showbuzz/schemas/types/partner-box-office";
import type { BookingKind } from "@showbuzz/schemas/types/booking";
import { addDaysToKey, formatDateLong, formatTime, istDateTime } from "@showbuzz/utils/dates";
import { describeSchedule } from "@showbuzz/utils/schedule";
import { MAX_CODE_ATTEMPTS, isDuplicateKeyOn, newBookingCode } from "../../booking/booking-code";
import { renderTicketQrSvg } from "../../booking/ticket-qr";
import { AppError } from "../../http/app-error";
import { releaseLapsedOrders } from "../order-release.service";
import { getSellerTerms } from "../vendor.service";
import { getShowSeatBoard, listVendorShowOptions } from "./seat-management.service";

/**
 * Box-office sales (partner POS): the vendor sells seats of its own shows, or passes of its own listings, at the
 * counter and takes cash or UPI there. Nothing goes through the gateway: the payment is recorded (provider
 * `counter`) and the booking is confirmed at once with the normal signed QR ticket.
 *
 * Prices are the show's seat-category prices (or the tier price); no convenience fee or GST is charged at the
 * counter (agreed 2026-10-14), so the platform's share is only the commission of commission vendors. Seats become
 * `sold` seat holds inside the same transaction as the booking, so the unique `{ showId, seatId }` index still makes
 * double selling impossible (a seat in someone's online checkout can't be sold here either).
 */

const COUNTER_HOLDER = (vendorUserId: string) => `counter:${vendorUserId}`;

const NOT_FOUND = () => new AppError("NOT_FOUND", "This show doesn't exist or isn't yours.", 404);

class SaleConflict extends Error {
  constructor(readonly appError: AppError) {
    super(appError.message);
  }
}

/** The vendor's seated shows and pass listings on sale for one IST date (passes: listings on or around it). */
export async function listCounterOptions(
  vendorId: string,
  dateKey: string,
  now: Date,
): Promise<{ seated: CounterShowOption[]; passes: CounterShowOption[] }> {
  const seated = (await listVendorShowOptions(vendorId, { dateKey })).filter((s) => !!s);
  const dayStart = istDateTime(dateKey, "00:00");
  const dayEnd = istDateTime(addDaysToKey(dateKey, 1), "00:00");
  await connect();
  const passShows = await Show.find(
    { vendorId: new Types.ObjectId(vendorId), "inventory.0": { $exists: true }, ...LIVE_SHOW_FILTER },
    { eventId: 1, startsAt: 1 },
  ).lean();
  const eventIds = passShows.flatMap((s) => (s.eventId ? [s.eventId] : []));
  const events = await Event.find({ _id: { $in: eventIds }, ...ACTIVE_EVENT_FILTER }, { title: 1, schedule: 1 }).lean();
  const passes = events
    .filter((e) => {
      // Daily activities sell every day; one-off listings on their own date (and only before they start).
      if (e.schedule.type === "daily") return true;
      const start = e.schedule.startsAt;
      return !!start && start >= dayStart && start < dayEnd && start > now;
    })
    .map((e) => ({ id: e._id.toString(), label: e.title, kind: "passes" as const }));
  return {
    seated: seated.map((s) => ({ id: s.id, label: s.label, kind: "seats" as const })),
    passes,
  };
}

/** One of the vendor's pass listings with live tier counts (lapsed online orders released first). */
export async function getCounterPassListing(
  vendorId: string,
  eventId: string,
  now: Date,
): Promise<CounterPassListing | null> {
  if (!Types.ObjectId.isValid(eventId) || !Types.ObjectId.isValid(vendorId)) return null;
  await connect();
  const vendor = new Types.ObjectId(vendorId);
  const [event, passShow] = await Promise.all([
    Event.findOne({ _id: new Types.ObjectId(eventId), vendorId: vendor, ...ACTIVE_EVENT_FILTER }).lean(),
    Show.findOne({
      eventId: new Types.ObjectId(eventId),
      vendorId: vendor,
      "inventory.0": { $exists: true },
      ...LIVE_SHOW_FILTER,
    }).lean(),
  ]);
  if (!event || !passShow) return null;
  await releaseLapsedOrders(passShow._id, now);
  const fresh = await Show.findById(passShow._id, { inventory: 1 }).lean();
  const listing = toEvent(event);
  const when = describeSchedule(listing.schedule);
  return {
    eventId,
    title: listing.title,
    venueName: listing.venueName,
    scheduleLabel: `${when.date} • ${when.time}`,
    tiers: listing.ticketTiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      pricePaise: tier.pricePaise,
      remaining: fresh?.inventory.find((i) => i.tierId === tier.id)?.remaining ?? 0,
    })),
  };
}

interface PricedSale {
  kind: BookingKind;
  showId: Types.ObjectId;
  eventId?: Types.ObjectId;
  tierId?: string;
  quantity?: number;
  seatIds: string[];
  title: string;
  poster: string;
  certificate?: string;
  format?: string;
  language?: string;
  venueName: string;
  screenName?: string;
  startsAt?: Date;
  scheduleLabel: string;
  ticketLabel: string;
  seatLabels: string[];
  ticketCount: number;
  ticketsPaise: number;
  venueAllowsCancellation: boolean;
}

async function priceSeats(vendorId: string, showId: string, seatIds: string[], now: Date): Promise<PricedSale> {
  const board = await getShowSeatBoard(vendorId, showId, now);
  if (!board) throw NOT_FOUND();
  if (board.show.started || !board.show.startsAt) {
    throw new AppError("CONFLICT", "This show has already started, so it can't be sold any more.", 409);
  }
  const show = await Show.findById(showId).lean();
  if (!show || show.status === "cancelled") throw NOT_FOUND();

  const seats = seatIds.map((id) => {
    for (const zone of board.zones) {
      for (const row of zone.rows) {
        const seat = row.seats.find((s) => s.id === id);
        if (!seat) continue;
        if (seat.state !== "free") {
          throw new AppError("SEAT_UNAVAILABLE", `Seat ${id} isn't free any more. Pick another seat.`, 409, {
            seats: [id],
          });
        }
        return { id, zoneName: zone.name, pricePaise: zone.pricePaise };
      }
    }
    throw new AppError("SEAT_UNAVAILABLE", `Seat ${id} doesn't exist on this screen.`, 422, { seats: [id] });
  });

  const [movie, event, venue] = await Promise.all([
    show.movieId ? Movie.findById(show.movieId, { title: 1, poster: 1, certificate: 1 }).lean() : null,
    show.eventId ? Event.findById(show.eventId, { title: 1, poster: 1, kind: 1 }).lean() : null,
    Venue.findById(show.venueId, { cancellation: 1 }).lean(),
  ]);
  const start = new Date(board.show.startsAt);
  return {
    kind: show.movieId ? "movie" : "sport",
    showId: show._id,
    seatIds,
    title: board.show.title,
    poster: movie?.poster ?? event?.poster ?? "",
    ...(movie?.certificate ? { certificate: movie.certificate } : {}),
    ...(show.format ? { format: show.format } : {}),
    ...(show.language ? { language: show.language } : {}),
    venueName: board.show.venueName,
    screenName: board.show.screenName,
    startsAt: start,
    scheduleLabel: `${formatDateLong(start)} • ${formatTime(start)}`,
    ticketLabel: [...new Set(seats.map((s) => s.zoneName))].join(", "),
    seatLabels: seats.map((s) => s.id),
    ticketCount: seats.length,
    ticketsPaise: seats.reduce((sum, s) => sum + s.pricePaise, 0),
    venueAllowsCancellation: venue?.cancellation?.allowed ?? true,
  };
}

async function pricePasses(
  vendorId: string,
  eventId: string,
  tierId: string,
  quantity: number,
  now: Date,
): Promise<PricedSale> {
  const listing = await getCounterPassListing(vendorId, eventId, now);
  if (!listing) throw NOT_FOUND();
  const event = await Event.findById(eventId).lean();
  const passShow = await Show.findOne({
    eventId: new Types.ObjectId(eventId),
    vendorId: new Types.ObjectId(vendorId),
    "inventory.0": { $exists: true },
    ...LIVE_SHOW_FILTER,
  }).lean();
  if (!event || !passShow) throw NOT_FOUND();
  if (event.schedule.type === "once" && event.schedule.startsAt && event.schedule.startsAt <= now) {
    throw new AppError("CONFLICT", "This listing has already started, so it can't be sold any more.", 409);
  }
  const tier = listing.tiers.find((t) => t.id === tierId);
  if (!tier) throw new AppError("NOT_FOUND", "This ticket tier doesn't exist.", 404);
  if (tier.remaining < quantity) {
    throw new AppError(
      "SEAT_UNAVAILABLE",
      tier.remaining === 0 ? `${tier.name} is sold out.` : `Only ${tier.remaining} passes left in ${tier.name}.`,
      409,
    );
  }
  return {
    kind: event.kind,
    showId: passShow._id,
    eventId: event._id,
    tierId,
    quantity,
    seatIds: [],
    title: event.title,
    poster: event.poster,
    ...(event.language ? { language: event.language } : {}),
    venueName: event.venueName,
    screenName: tier.name,
    ...(event.schedule.type === "once" && event.schedule.startsAt ? { startsAt: event.schedule.startsAt } : {}),
    scheduleLabel: listing.scheduleLabel,
    ticketLabel: tier.name,
    seatLabels: [`${quantity} × ${tier.name}`],
    ticketCount: quantity,
    ticketsPaise: tier.pricePaise * quantity,
    venueAllowsCancellation: true,
  };
}

/** Sells at the counter and returns the confirmed ticket (with its QR) to print or show. */
export async function sellAtCounter(
  vendorId: string,
  vendorUserId: string,
  raw: unknown,
  now: Date,
): Promise<CounterSaleResult> {
  const sale = counterSaleSchema.parse(raw);
  if (!Types.ObjectId.isValid(vendorId) || !Types.ObjectId.isValid(vendorUserId)) throw NOT_FOUND();
  const seller = await getSellerTerms(vendorId);
  const { tickets } = sale;

  if (tickets.kind === "seats") {
    // An expired checkout hold the TTL monitor hasn't removed yet must not block the sale.
    await connect();
    await SeatHold.deleteMany({
      showId: new Types.ObjectId(tickets.showId),
      seatId: { $in: tickets.seatIds },
      status: "held",
      expiresAt: { $lte: now },
    });
  }
  const priced =
    tickets.kind === "seats"
      ? await priceSeats(vendorId, tickets.showId, tickets.seatIds, now)
      : await pricePasses(vendorId, tickets.eventId, tickets.tierId, tickets.quantity, now);

  const totalPaise = priced.ticketsPaise;
  const amounts = {
    ticketsPaise: priced.ticketsPaise,
    foodPaise: 0,
    convenienceFeePaise: 0,
    gstPaise: 0,
    discountPaise: 0,
    totalPaise,
    giftCardPaise: 0,
    payablePaise: totalPaise,
  };
  const settlement = computeSettlement({
    billingModel: seller.billingModel,
    commissionBps: seller.commissionBps,
    convenienceFeeBps: 0,
    gstBps: 0,
    ticketsPaise: priced.ticketsPaise,
    foodPaise: 0,
    discountPaise: 0,
    convenienceFeePaise: 0,
    gstPaise: 0,
    totalPaise,
  });
  const contact = {
    ...(sale.customer.name ? { name: sale.customer.name } : {}),
    ...(sale.customer.phone ? { phone: sale.customer.phone } : {}),
  };

  const mongoose = await connect();
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = newBookingCode();
    const bookingId = new Types.ObjectId();
    try {
      await mongoose.connection.transaction(async (session) => {
        if (priced.seatIds.length > 0) {
          try {
            await SeatHold.insertMany(
              priced.seatIds.map((seatId) => ({
                showId: priced.showId,
                seatId,
                status: "sold",
                holderKey: COUNTER_HOLDER(vendorUserId),
                bookingId,
              })),
              { session },
            );
          } catch (err) {
            if ((err as { code?: number }).code === 11000 || isDuplicateKeyOn(err, "seatId")) {
              throw new SaleConflict(
                new AppError("SEAT_UNAVAILABLE", "A seat was just taken online. Refresh the map and pick again.", 409),
              );
            }
            throw err;
          }
        }
        if (priced.tierId && priced.quantity) {
          const reserved = await Show.updateOne(
            {
              _id: priced.showId,
              inventory: { $elemMatch: { tierId: priced.tierId, remaining: { $gte: priced.quantity } } },
            },
            { $inc: { "inventory.$.remaining": -priced.quantity, "inventory.$.sold": priced.quantity } },
            { session },
          );
          if (reserved.modifiedCount !== 1) {
            throw new SaleConflict(
              new AppError("SEAT_UNAVAILABLE", "Those passes have just sold out. Sell fewer or another tier.", 409),
            );
          }
        }
        await Booking.create(
          [
            {
              _id: bookingId,
              code,
              channel: "counter",
              soldByVendorUserId: new Types.ObjectId(vendorUserId),
              vendorId: seller.vendorId,
              settlement,
              cancellationPolicy: seller.cancellation,
              status: "confirmed",
              kind: priced.kind,
              showId: priced.showId,
              seatIds: priced.seatIds,
              ...(priced.eventId ? { eventId: priced.eventId, tierId: priced.tierId, quantity: priced.quantity } : {}),
              title: priced.title,
              poster: priced.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400",
              certificate: priced.certificate,
              format: priced.format,
              language: priced.language,
              venueName: priced.venueName,
              screenName: priced.screenName,
              startsAt: priced.startsAt,
              scheduleLabel: priced.scheduleLabel,
              ticketLabel: priced.ticketLabel,
              seatLabels: priced.seatLabels,
              ticketCount: priced.ticketCount,
              food: [],
              amounts,
              paymentMethod: sale.paymentMethod,
              contact,
              holdExpiresAt: now,
              cancellable: seller.cancellation.allowed && priced.venueAllowsCancellation,
              confirmedAt: now,
            },
          ],
          { session },
        );
        await Payment.create(
          [
            {
              bookingId,
              vendorId: seller.vendorId,
              provider: "counter",
              providerRef: `ctr_${randomBytes(12).toString("base64url")}`,
              amountPaise: totalPaise,
              method: sale.paymentMethod,
              status: "succeeded",
              ...(sale.paymentReference ? { reference: sale.paymentReference } : {}),
              succeededAt: now,
            },
          ],
          { session },
        );
      });
    } catch (err) {
      if (err instanceof SaleConflict) throw err.appError;
      if (isDuplicateKeyOn(err, "code")) continue;
      throw err;
    }

    const qrSvg = await renderTicketQrSvg({
      code,
      showId: priced.showId.toString(),
      seatLabels: priced.seatLabels,
      bookedAt: now.toISOString(),
    });
    return {
      code,
      title: priced.title,
      venueName: priced.venueName,
      ...(priced.screenName ? { screenName: priced.screenName } : {}),
      scheduleLabel: priced.scheduleLabel,
      seatLabels: priced.seatLabels,
      ticketCount: priced.ticketCount,
      totalPaise,
      paymentMethod: sale.paymentMethod,
      ...(sale.customer.name ? { customerName: sale.customer.name } : {}),
      qrSvg,
    };
  }
  throw new AppError("INTERNAL", "We couldn't create the booking. Please try again.", 500);
}
