import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { City } from "@showbuzz/db/models/City";
import { Event, type EventAttrs } from "@showbuzz/db/models/Event";
import { Show } from "@showbuzz/db/models/Show";
import { Staff } from "@showbuzz/db/models/Staff";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { Types } from "@showbuzz/db/mongoose";
import {
  LISTING_SECTIONS,
  takedownSchema,
  type ListingAdminStatus,
  type ListingKind,
} from "@showbuzz/schemas/admin-catalog";
import type { AdminListingDetail, AdminListingRow } from "@showbuzz/schemas/types/admin-catalog";
import { webAppOrigin } from "@showbuzz/runtime/web-app-env";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { notify } from "../notification.service";
import { releaseLapsedOrders } from "../order-release.service";
import { listingTicketCounts, whenLabel } from "../partner/listing.service";

/**
 * Platform-wide oversight of vendor listings (events, plays, sports, activities). Vendors own and edit them; staff can
 * only look, and take a listing down (hidden publicly and unbookable, whatever its vendor sets) or restore it.
 */

type LeanEvent = EventAttrs & { _id: Types.ObjectId; createdAt?: Date };

export const LISTING_SORT_FIELDS = ["title", "startsAt", "createdAt"] as const;
const SORT_PATHS: Record<(typeof LISTING_SORT_FIELDS)[number], string> = {
  title: "title",
  startsAt: "schedule.startsAt",
  createdAt: "createdAt",
};

export interface ListingAdminQuery {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
  vendorId?: string;
  cityId?: string;
  status?: ListingAdminStatus;
  when?: "upcoming" | "past";
}

const NOT_FOUND = () => new AppError("NOT_FOUND", "Listing not found.", 404);

function idOf(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw NOT_FOUND();
  return new Types.ObjectId(value);
}

const isPast = (doc: Pick<LeanEvent, "schedule">, now: Date) =>
  doc.schedule.type === "once" && (doc.schedule.endsAt ?? doc.schedule.startsAt ?? now) < now;

async function namesFor(docs: LeanEvent[]) {
  const [vendors, cities] = await Promise.all([
    Vendor.find({ _id: { $in: [...new Set(docs.map((d) => d.vendorId.toString()))] } }, { businessName: 1 }).lean(),
    City.find({ slug: { $in: [...new Set(docs.map((d) => d.cityId))] } }, { slug: 1, name: 1 }).lean(),
  ]);
  return {
    vendor: new Map(vendors.map((v) => [v._id.toString(), v.businessName])),
    city: new Map(cities.map((c) => [c.slug, c.name])),
  };
}

function toRow(
  doc: LeanEvent,
  names: Awaited<ReturnType<typeof namesFor>>,
  counts: Map<string, { sold: number; capacity: number }>,
  now: Date,
): AdminListingRow {
  const count = counts.get(doc._id.toString()) ?? { sold: 0, capacity: 0 };
  return {
    id: doc._id.toString(),
    kind: doc.kind as ListingKind,
    slug: doc.slug,
    title: doc.title,
    category: doc.category,
    poster: doc.poster,
    vendorId: doc.vendorId.toString(),
    vendorName: names.vendor.get(doc.vendorId.toString()) ?? "Unknown vendor",
    venueName: doc.venueName,
    cityName: names.city.get(doc.cityId) ?? doc.cityId,
    when: whenLabel(doc),
    past: isPast(doc, now),
    sold: count.sold,
    capacity: count.capacity,
    status: doc.status ?? "active",
    takenDown: Boolean(doc.takenDownAt),
  };
}

export async function listListingsAdmin(
  kind: ListingKind,
  query: ListingAdminQuery,
  now: Date,
): Promise<{ rows: AdminListingRow[]; total: number }> {
  await connect();
  const and: Record<string, unknown>[] = [{ kind }];
  if (query.vendorId && Types.ObjectId.isValid(query.vendorId)) {
    and.push({ vendorId: new Types.ObjectId(query.vendorId) });
  }
  if (query.cityId) and.push({ cityId: query.cityId });
  if (query.status === "taken_down") and.push({ takenDownAt: { $exists: true } });
  if (query.status === "inactive") and.push({ status: "inactive" });
  if (query.status === "active") and.push({ status: { $ne: "inactive" }, takenDownAt: { $exists: false } });
  if (query.when === "upcoming") {
    and.push({ $or: [{ "schedule.type": "daily" }, { "schedule.startsAt": { $gte: now } }] });
  }
  if (query.when === "past") and.push({ "schedule.type": "once", "schedule.startsAt": { $lt: now } });
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    and.push({ $or: [{ title: pattern }, { category: pattern }, { venueName: pattern }, { slug: pattern }] });
  }
  const filter = { $and: and };
  const field = (LISTING_SORT_FIELDS as readonly string[]).includes(query.sort.field)
    ? SORT_PATHS[query.sort.field as (typeof LISTING_SORT_FIELDS)[number]]
    : "schedule.startsAt";
  const [docs, total] = await Promise.all([
    Event.find(filter, { about: 0, artists: 0 })
      .sort({ [field]: query.sort.direction === "desc" ? -1 : 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanEvent[]>(),
    Event.countDocuments(filter),
  ]);
  const [names, counts] = await Promise.all([namesFor(docs), listingTicketCounts(docs)]);
  return { total, rows: docs.map((doc) => toRow(doc, names, counts, now)) };
}

export async function getListingAdmin(kind: ListingKind, id: string, now: Date): Promise<AdminListingDetail | null> {
  await connect();
  const doc = await Event.findOne({ _id: idOf(id), kind }).lean<LeanEvent>();
  if (!doc) return null;

  const shows = await Show.find({ eventId: doc._id }, { _id: 1, inventory: 1 }).lean();
  const pass = shows.find((s) => (s.inventory ?? []).length > 0);
  if (pass) await releaseLapsedOrders(pass._id, now);
  const [names, counts, freshPass, bookings, staff] = await Promise.all([
    namesFor([doc]),
    listingTicketCounts([doc]),
    pass ? Show.findById(pass._id, { inventory: 1 }).lean() : null,
    Booking.find({
      vendorId: doc.vendorId,
      status: { $in: ["confirmed", "cancelled"] },
      $or: [{ eventId: doc._id }, { showId: { $in: shows.map((s) => s._id) } }],
    })
      .sort({ confirmedAt: -1 })
      .limit(10)
      .lean(),
    doc.takenDownBy ? Staff.findById(doc.takenDownBy, { name: 1 }).lean() : null,
  ]);
  const inventory = new Map((freshPass?.inventory ?? []).map((t) => [t.tierId, t]));
  const section = LISTING_SECTIONS[doc.kind as ListingKind];

  return {
    ...toRow(doc, names, counts, now),
    about: doc.about,
    ...(doc.language ? { language: doc.language } : {}),
    ...(doc.ageLimit ? { ageLimit: doc.ageLimit } : {}),
    ...(doc.durationLabel ? { durationLabel: doc.durationLabel } : {}),
    publicUrl: `${webAppOrigin}${section.publicPath}/${doc.slug}`,
    tiers: doc.ticketTiers.map((t) => {
      const inv = inventory.get(t.id);
      return {
        id: t.id,
        name: t.name,
        pricePaise: t.pricePaise,
        capacity: inv?.capacity ?? t.available,
        sold: inv?.sold ?? 0,
        reserved: inv ? Math.max(0, inv.capacity - inv.remaining - inv.sold) : 0,
      };
    }),
    ...(doc.takenDownAt
      ? {
          takedown: {
            at: doc.takenDownAt.toISOString(),
            reason: doc.takedownReason ?? "",
            byName: staff?.name ?? "ShowBuzz staff",
          },
        }
      : {}),
    bookings: bookings.map((b) => ({
      code: b.code,
      customer: b.contact?.name || (b.channel === "counter" ? "Walk-in" : "Customer"),
      tickets: b.seatLabels.length > 0 ? b.seatLabels.join(", ") : b.ticketLabel,
      ticketCount: b.ticketCount,
      totalPaise: b.amounts.totalPaise,
      status: b.status,
      channel: b.channel ?? "online",
      bookedAt: (b.confirmedAt ?? b.createdAt).toISOString(),
    })),
    createdAt: (doc.createdAt ?? doc._id.getTimestamp()).toISOString(),
  };
}

/** Hides a listing from showbuzz.com and stops new sales; tickets already sold stay valid. The vendor is told why. */
export async function takeDownListing(
  kind: ListingKind,
  id: string,
  input: unknown,
  staffId: string,
  now: Date,
): Promise<{ title: string; vendorId: string }> {
  const { reason } = takedownSchema.parse(input);
  await connect();
  const doc = await Event.findOneAndUpdate(
    { _id: idOf(id), kind, takenDownAt: { $exists: false } },
    { $set: { takenDownAt: now, takedownReason: reason, takenDownBy: new Types.ObjectId(staffId) } },
    { projection: { title: 1, vendorId: 1 } },
  ).lean();
  if (!doc) {
    if (await Event.exists({ _id: idOf(id), kind })) {
      throw new AppError("CONFLICT", "This listing is already taken down.", 409);
    }
    throw NOT_FOUND();
  }
  const section = LISTING_SECTIONS[kind];
  await notify({
    audience: "vendor",
    vendorId: doc.vendorId.toString(),
    type: "listing_takedown",
    title: `${section.one} taken down: ${doc.title}`,
    body: `ShowBuzz hid this listing from the site. Reason: ${reason}. Tickets already sold stay valid.`,
    link: `/events/${doc._id.toString()}/edit`,
  });
  return { title: doc.title, vendorId: doc.vendorId.toString() };
}

export async function restoreListing(kind: ListingKind, id: string): Promise<{ title: string; vendorId: string }> {
  await connect();
  const doc = await Event.findOneAndUpdate(
    { _id: idOf(id), kind, takenDownAt: { $exists: true } },
    { $unset: { takenDownAt: 1, takedownReason: 1, takenDownBy: 1 } },
    { projection: { title: 1, vendorId: 1 } },
  ).lean();
  if (!doc) {
    if (await Event.exists({ _id: idOf(id), kind })) {
      throw new AppError("CONFLICT", "This listing isn't taken down.", 409);
    }
    throw NOT_FOUND();
  }
  await notify({
    audience: "vendor",
    vendorId: doc.vendorId.toString(),
    type: "listing_restored",
    title: `Listing restored: ${doc.title}`,
    body: "ShowBuzz restored this listing. It is visible again unless you switched it off.",
    link: `/events/${doc._id.toString()}/edit`,
  });
  return { title: doc.title, vendorId: doc.vendorId.toString() };
}
