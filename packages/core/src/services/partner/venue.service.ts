import "server-only";
import { connect } from "@showbuzz/db/connect";
import { City } from "@showbuzz/db/models/City";
import { Event } from "@showbuzz/db/models/Event";
import { Movie } from "@showbuzz/db/models/Movie";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { Show } from "@showbuzz/db/models/Show";
import { type StoredScreen, Venue, type VenueAttrs, screenIdFor, toScreen } from "@showbuzz/db/models/Venue";
import { Types } from "@showbuzz/db/mongoose";
import {
  SEAT_CATEGORY_PRESETS,
  type ScreenInput,
  type SeatLayoutZoneInput,
  type VenueInput,
  screenInputSchema,
  seatLayoutInputSchema,
  venueInputSchema,
} from "@showbuzz/schemas/partner-venue";
import type {
  LayoutConflictShow,
  LockedSeat,
  SeatLayoutView,
  VendorLayoutRow,
  VendorScreenSummary,
  VendorVenueDetail,
  VendorVenueRow,
} from "@showbuzz/schemas/types/partner-venue";
import type { Screen, SeatZone, VenueKind, VenueStatus } from "@showbuzz/schemas/venue";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { escapeRegex, slugify } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";

/**
 * A vendor's venues, their screens and seat layouts (embedded in the venue). Every function takes the vendor id from
 * the caller's session and filters by it, so another vendor's venue answers exactly like a missing one (404).
 * Seat layouts protect what has been sold: an upcoming show's sold or held seat can't be removed, moved to another
 * category or blocked.
 */

type LeanVenue = VenueAttrs & { _id: Types.ObjectId };

const NOT_FOUND = () => new AppError("NOT_FOUND", "This venue doesn't exist or isn't yours.", 404);
const SCREEN_NOT_FOUND = () => new AppError("NOT_FOUND", "This screen doesn't exist or isn't yours.", 404);

function toObjectId(id: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(id) && /^[0-9a-f]{24}$/.test(id) ? new Types.ObjectId(id) : null;
}

async function findOwnVenue(vendorId: string, venueId: string): Promise<LeanVenue | null> {
  const _id = toObjectId(venueId);
  if (!_id) return null;
  await connect();
  return Venue.findOne({ _id, vendorId: new Types.ObjectId(vendorId) }).lean();
}

async function requireOwnVenue(vendorId: string, venueId: string): Promise<LeanVenue> {
  const venue = await findOwnVenue(vendorId, venueId);
  if (!venue) throw NOT_FOUND();
  return venue;
}

// ---------------------------------------------------------------------------------------------------------------
// Shows on a venue / screen

/** Shows that haven't started (pass shows without a start time count as upcoming). */
export function upcomingShowFilter(now: Date) {
  return { $or: [{ startsAt: { $gt: now } }, { startsAt: { $exists: false } }] };
}

interface ShowRef {
  _id: Types.ObjectId;
  movieId?: Types.ObjectId;
  eventId?: Types.ObjectId;
  startsAt?: Date;
  screenName: string;
}

/** "Chrono Nexus · 14 Oct, 06:15 PM" for each show (titles from movies/events). */
export async function describeShows(shows: ShowRef[]): Promise<Map<string, { title: string; startsAt?: string }>> {
  const movieIds = [...new Set(shows.flatMap((s) => (s.movieId ? [s.movieId.toString()] : [])))];
  const eventIds = [...new Set(shows.flatMap((s) => (s.eventId ? [s.eventId.toString()] : [])))];
  const [movies, events] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }, { title: 1 }).lean() : [],
    eventIds.length ? Event.find({ _id: { $in: eventIds } }, { title: 1 }).lean() : [],
  ]);
  const titles = new Map<string, string>([
    ...movies.map((m) => [m._id.toString(), m.title] as const),
    ...events.map((e) => [e._id.toString(), e.title] as const),
  ]);
  return new Map(
    shows.map((s) => {
      const title = titles.get((s.movieId ?? s.eventId)?.toString() ?? "") ?? "Show";
      return [s._id.toString(), { title, ...(s.startsAt ? { startsAt: s.startsAt.toISOString() } : {}) }];
    }),
  );
}

export function showLabel(title: string, startsAt?: string): string {
  if (!startsAt) return title;
  const at = new Date(startsAt);
  return `${title} · ${formatDateShort(at)}, ${formatTime(at)}`;
}

/** Shows with seats sold on them (or pass tickets sold), for the "can't do this while…" messages. */
async function showsWithSales(filter: Record<string, unknown>): Promise<LayoutConflictShow[]> {
  const shows = await Show.find(filter, { movieId: 1, eventId: 1, startsAt: 1, screenName: 1, inventory: 1 }).lean();
  if (shows.length === 0) return [];
  const sold = await SeatHold.aggregate<{ _id: Types.ObjectId; seats: string[] }>([
    { $match: { showId: { $in: shows.map((s) => s._id) }, status: "sold" } },
    { $group: { _id: "$showId", seats: { $push: "$seatId" } } },
  ]);
  const seatsByShow = new Map(sold.map((s) => [s._id.toString(), s.seats]));
  const withSales = shows.filter(
    (s) => seatsByShow.has(s._id.toString()) || (s.inventory ?? []).some((t) => t.sold > 0),
  );
  const described = await describeShows(withSales);
  return withSales.map((s) => {
    const info = described.get(s._id.toString());
    return {
      id: s._id.toString(),
      title: info?.title ?? "Show",
      ...(info?.startsAt ? { startsAt: info.startsAt } : {}),
      seats: seatsByShow.get(s._id.toString()) ?? [],
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Summaries

function screenStats(screen: Screen) {
  let capacity = 0;
  let blocked = 0;
  let accessible = 0;
  let rows = 0;
  const categories = screen.zones.map((zone) => {
    let seats = 0;
    for (const row of zone.rows) {
      const rowBlocked = new Set(row.blockedSeats).size;
      seats += row.count - rowBlocked;
      blocked += rowBlocked;
      accessible += row.accessibleSeats.length;
      rows += 1;
    }
    capacity += seats;
    return { name: zone.name, accent: zone.accent, seats, defaultPricePaise: zone.defaultPricePaise };
  });
  return { capacity, blocked, accessible, rows, categories };
}

function toScreenSummary(stored: StoredScreen, upcomingShows: number): VendorScreenSummary {
  const screen = toScreen(stored);
  const stats = screenStats(screen);
  return {
    id: screen.id,
    name: screen.name,
    layoutType: screen.layoutType,
    formats: screen.formats,
    soundSystem: screen.soundSystem ?? "",
    rows: stats.rows,
    capacity: stats.capacity,
    blockedSeats: stats.blocked,
    accessibleSeats: stats.accessible,
    categories: stats.categories,
    upcomingShows,
  };
}

async function cityNames(): Promise<Map<string, string>> {
  const cities = await City.find({}, { slug: 1, name: 1 }).lean();
  return new Map(cities.map((c) => [c.slug, c.name]));
}

async function upcomingShowCounts(venueIds: Types.ObjectId[], now: Date): Promise<Map<string, number>> {
  if (venueIds.length === 0) return new Map();
  const counts = await Show.aggregate<{ _id: { venueId: Types.ObjectId; screenId: string }; n: number }>([
    { $match: { venueId: { $in: venueIds }, ...upcomingShowFilter(now) } },
    { $group: { _id: { venueId: "$venueId", screenId: "$screenId" }, n: { $sum: 1 } } },
  ]);
  return new Map(counts.map((c) => [`${c._id.venueId.toString()}:${c._id.screenId}`, c.n]));
}

// ---------------------------------------------------------------------------------------------------------------
// Venues

export interface VenueListQuery {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
  kind?: VenueKind;
  cityId?: string;
  status?: VenueStatus;
}

export const VENUE_SORT_FIELDS = ["name", "kind", "cityId", "updatedAt"] as const;

export async function listVendorVenues(
  vendorId: string,
  query: VenueListQuery,
): Promise<{ rows: VendorVenueRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = { vendorId: new Types.ObjectId(vendorId) };
  if (query.kind) filter.kind = query.kind;
  if (query.cityId) filter.cityId = query.cityId;
  if (query.status === "inactive") filter.status = "inactive";
  if (query.status === "active") filter.status = { $ne: "inactive" };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: pattern }, { address: pattern }, { slug: pattern }];
  }
  const field = (VENUE_SORT_FIELDS as readonly string[]).includes(query.sort.field) ? query.sort.field : "name";
  const [docs, total, cities] = await Promise.all([
    Venue.find(filter, { showTemplates: 0 })
      .sort({ [field]: query.sort.direction === "desc" ? -1 : 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Venue.countDocuments(filter),
    cityNames(),
  ]);
  return {
    total,
    rows: docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      slug: doc.slug,
      kind: doc.kind,
      cityName: cities.get(doc.cityId) ?? doc.cityId,
      address: doc.address,
      status: doc.status ?? "active",
      screens: doc.screens.length,
      capacity: doc.screens.reduce((sum, s) => sum + screenStats(toScreen(s)).capacity, 0),
      updatedAt: (doc.updatedAt ?? new Date(0)).toISOString(),
    })),
  };
}

export async function getVendorVenue(vendorId: string, venueId: string, now: Date): Promise<VendorVenueDetail | null> {
  const doc = await findOwnVenue(vendorId, venueId);
  if (!doc) return null;
  const [cities, counts] = await Promise.all([cityNames(), upcomingShowCounts([doc._id], now)]);
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    kind: doc.kind,
    cityId: doc.cityId,
    cityName: cities.get(doc.cityId) ?? doc.cityId,
    address: doc.address,
    phone: doc.phone ?? "",
    amenities: [...doc.amenities],
    cancellationAllowed: doc.cancellation.allowed,
    status: doc.status ?? "active",
    updatedAt: (doc.updatedAt ?? new Date(0)).toISOString(),
    screens: doc.screens.map((s) => toScreenSummary(s, counts.get(`${doc._id.toString()}:${s.id}`) ?? 0)),
  };
}

/** Every screen of the vendor's venues (Seat Layouts list), optionally for one venue. */
export async function listVendorLayouts(vendorId: string, now: Date, venueId?: string): Promise<VendorLayoutRow[]> {
  await connect();
  const filter: Record<string, unknown> = { vendorId: new Types.ObjectId(vendorId) };
  const venueObjectId = venueId ? toObjectId(venueId) : null;
  if (venueObjectId) filter._id = venueObjectId;
  const venues = await Venue.find(filter, { name: 1, screens: 1 }).sort({ name: 1 }).lean();
  const counts = await upcomingShowCounts(
    venues.map((v) => v._id),
    now,
  );
  return venues.flatMap((venue) =>
    venue.screens.map((s) => ({
      ...toScreenSummary(s, counts.get(`${venue._id.toString()}:${s.id}`) ?? 0),
      venueId: venue._id.toString(),
      venueName: venue.name,
    })),
  );
}

/** The vendor's venues as select options (seat manager, later the show forms). */
export async function listVendorVenueOptions(vendorId: string): Promise<{ value: string; label: string }[]> {
  await connect();
  const venues = await Venue.find({ vendorId: new Types.ObjectId(vendorId) }, { name: 1 })
    .sort({ name: 1 })
    .lean();
  return venues.map((v) => ({ value: v._id.toString(), label: v.name }));
}

async function assertCity(cityId: string): Promise<void> {
  if (!(await City.exists({ slug: cityId }))) {
    throw new AppError("VALIDATION_FAILED", "Choose a city from the list.", 422, {
      fieldErrors: { cityId: ["Choose a city from the list"] },
    });
  }
}

async function assertSlugFree(slug: string, exceptId?: Types.ObjectId): Promise<void> {
  const taken = await Venue.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) throw slugTaken();
}

const slugTaken = () =>
  new AppError("CONFLICT", "That URL name is already used by another venue.", 409, {
    fieldErrors: { slug: ["Already used by another venue on ShowBuzz: pick another"] },
  });

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number }).code === 11000;
}

function venueFields(input: VenueInput) {
  return {
    kind: input.kind,
    name: input.name,
    slug: input.slug,
    cityId: input.cityId,
    address: input.address,
    phone: input.phone,
    amenities: [...new Set(input.amenities)],
    status: input.status,
    "cancellation.allowed": input.cancellationAllowed,
  };
}

export async function createVenue(vendorId: string, raw: unknown): Promise<{ id: string; changedFields: string[] }> {
  const input = venueInputSchema.parse(raw);
  await connect();
  await Promise.all([assertCity(input.cityId), assertSlugFree(input.slug)]);
  const last = await Venue.findOne({}, { sortOrder: 1 }).sort({ sortOrder: -1 }).lean();
  try {
    const doc = await Venue.create({
      vendorId: new Types.ObjectId(vendorId),
      kind: input.kind,
      name: input.name,
      slug: input.slug,
      cityId: input.cityId,
      address: input.address,
      phone: input.phone,
      amenities: [...new Set(input.amenities)],
      status: input.status,
      cancellation: {
        allowed: input.cancellationAllowed,
        label: input.cancellationAllowed ? "Cancellation Available" : "Non-cancellable",
      },
      showTemplates: [],
      screens: [],
      sortOrder: (last?.sortOrder ?? 0) + 1,
    });
    return { id: doc._id.toString(), changedFields: Object.keys(venueFields(input)) };
  } catch (err) {
    if (isDuplicateKey(err)) throw slugTaken();
    throw err;
  }
}

export async function updateVenue(
  vendorId: string,
  venueId: string,
  raw: unknown,
  now: Date,
): Promise<{ changedFields: string[] }> {
  const input = venueInputSchema.parse(raw);
  const venue = await requireOwnVenue(vendorId, venueId);
  await Promise.all([assertCity(input.cityId), assertSlugFree(input.slug, venue._id)]);

  if (input.status === "inactive" && (venue.status ?? "active") !== "inactive") {
    const withSales = await showsWithSales({ venueId: venue._id, ...upcomingShowFilter(now) });
    if (withSales.length > 0) {
      throw new AppError(
        "CONFLICT",
        "This venue has upcoming shows with tickets sold, so it can't be made inactive yet.",
        409,
        { shows: withSales.slice(0, 20) },
      );
    }
  }

  const before: Record<string, unknown> = {
    kind: venue.kind,
    name: venue.name,
    slug: venue.slug,
    cityId: venue.cityId,
    address: venue.address,
    phone: venue.phone ?? "",
    amenities: venue.amenities,
    status: venue.status ?? "active",
    "cancellation.allowed": venue.cancellation.allowed,
  };
  const next = venueFields(input);
  const changedFields = Object.entries(next)
    .filter(([key, value]) => JSON.stringify(before[key]) !== JSON.stringify(value))
    .map(([key]) => key);
  if (changedFields.length === 0) return { changedFields };

  try {
    await Venue.updateOne(
      { _id: venue._id, vendorId: venue.vendorId },
      {
        $set: {
          ...next,
          ...(changedFields.includes("cancellation.allowed")
            ? { "cancellation.label": input.cancellationAllowed ? "Cancellation Available" : "Non-cancellable" }
            : {}),
        },
      },
    );
  } catch (err) {
    if (isDuplicateKey(err)) throw slugTaken();
    throw err;
  }
  return { changedFields };
}

// ---------------------------------------------------------------------------------------------------------------
// Screens

/** A new screen starts with a simple layout (rows A–H of 12, one aisle) for the designer to reshape. */
function starterZones(): SeatZone[] {
  const regular = SEAT_CATEGORY_PRESETS.find((p) => p.name === "Regular");
  return [
    {
      id: "regular",
      name: "Regular",
      description: "Regular",
      accent: regular?.accent ?? "indigo",
      recliner: false,
      defaultPricePaise: regular?.pricePaise ?? 25_000,
      rows: "ABCDEFGH".split("").map((row) => ({
        row,
        count: 12,
        aislesAfter: [6],
        accessibleSeats: [],
        blockedSeats: [],
      })),
    },
  ];
}

function assertScreenNameFree(venue: LeanVenue, name: string, exceptId?: string): void {
  const clash = venue.screens.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === name.toLowerCase());
  if (clash) {
    throw new AppError("CONFLICT", "This venue already has a screen with that name.", 409, {
      fieldErrors: { name: ["Another screen here has this name"] },
    });
  }
}

function uniqueId(base: string, taken: Set<string>, fallback: string): string {
  const root = base || fallback;
  let id = root;
  for (let n = 2; taken.has(id); n += 1) id = `${root}-${n}`;
  return id;
}

function screenFields(input: ScreenInput) {
  return {
    name: input.name,
    layoutType: input.layoutType,
    formats: [...new Set(input.formats)],
    soundSystem: input.soundSystem,
  };
}

export async function addScreen(
  vendorId: string,
  venueId: string,
  raw: unknown,
): Promise<{ screenId: string; changedFields: string[] }> {
  const input = screenInputSchema.parse(raw);
  const venue = await requireOwnVenue(vendorId, venueId);
  assertScreenNameFree(venue, input.name);
  const screenId = uniqueId(screenIdFor(input.name).slice(0, 60), new Set(venue.screens.map((s) => s.id)), "screen");
  const result = await Venue.updateOne(
    { _id: venue._id, vendorId: venue.vendorId, "screens.id": { $ne: screenId } },
    { $push: { screens: { id: screenId, ...screenFields(input), zones: starterZones() } } },
  );
  if (result.modifiedCount === 0) {
    throw new AppError("CONFLICT", "The venue changed while saving. Please try again.", 409);
  }
  return { screenId, changedFields: ["screens"] };
}

export async function updateScreen(
  vendorId: string,
  venueId: string,
  screenId: string,
  raw: unknown,
  now: Date,
): Promise<{ changedFields: string[] }> {
  const input = screenInputSchema.parse(raw);
  const venue = await requireOwnVenue(vendorId, venueId);
  const screen = venue.screens.find((s) => s.id === screenId);
  if (!screen) throw SCREEN_NOT_FOUND();
  assertScreenNameFree(venue, input.name, screenId);

  const next = screenFields(input);
  const before = toScreen(screen);
  const changedFields = Object.entries(next)
    .filter(([key, value]) => JSON.stringify(before[key as keyof Screen] ?? "") !== JSON.stringify(value))
    .map(([key]) => `screens.${key}`);
  if (changedFields.length === 0) return { changedFields };

  await Venue.updateOne(
    { _id: venue._id, vendorId: venue.vendorId, "screens.id": screenId },
    {
      $set: {
        "screens.$.name": next.name,
        "screens.$.layoutType": next.layoutType,
        "screens.$.formats": next.formats,
        "screens.$.soundSystem": next.soundSystem,
      },
    },
  );
  if (next.name !== screen.name) {
    // Shows and the seeded daily templates carry the screen's display name.
    await Promise.all([
      Show.updateMany(
        { venueId: venue._id, screenId, ...upcomingShowFilter(now) },
        { $set: { screenName: next.name } },
      ),
      Venue.updateOne(
        { _id: venue._id },
        { $set: { "showTemplates.$[t].screenName": next.name } },
        { arrayFilters: [{ "t.screenName": screen.name }] },
      ),
    ]);
  }
  return { changedFields };
}

export async function deleteScreen(
  vendorId: string,
  venueId: string,
  screenId: string,
  now: Date,
): Promise<{ name: string }> {
  const venue = await requireOwnVenue(vendorId, venueId);
  const screen = venue.screens.find((s) => s.id === screenId);
  if (!screen) throw SCREEN_NOT_FOUND();
  const upcoming = await Show.find({ venueId: venue._id, screenId, ...upcomingShowFilter(now) }, { _id: 1 })
    .limit(1)
    .lean();
  if (upcoming.length > 0) {
    throw new AppError(
      "CONFLICT",
      "This screen has upcoming shows. Cancel or move them before removing the screen.",
      409,
    );
  }
  await Venue.updateOne(
    { _id: venue._id, vendorId: venue.vendorId },
    { $pull: { screens: { id: screenId }, showTemplates: { screenName: screen.name } } },
  );
  return { name: screen.name };
}

// ---------------------------------------------------------------------------------------------------------------
// Seat layout

interface SeatPlace {
  zoneId: string;
  blocked: boolean;
}

function seatPlaces(zones: Screen["zones"]): Map<string, SeatPlace> {
  const places = new Map<string, SeatPlace>();
  for (const zone of zones) {
    for (const row of zone.rows) {
      for (let n = 1; n <= row.count; n += 1) {
        places.set(`${row.row}${n}`, { zoneId: zone.id, blocked: row.blockedSeats.includes(n) });
      }
    }
  }
  return places;
}

interface LockedSeatRecord {
  showId: Types.ObjectId;
  seatId: string;
}

/** Seats sold, or held right now, on the screen's upcoming seat-map shows: these must keep their place. */
async function lockedSeatRecords(venueId: Types.ObjectId, screenId: string, now: Date) {
  const shows = await Show.find(
    { venueId, screenId, startsAt: { $gt: now } },
    { movieId: 1, eventId: 1, startsAt: 1, screenName: 1, zones: 1, inventory: 1 },
  ).lean();
  const seatShows = shows.filter((s) => (s.inventory ?? []).length === 0);
  const holds: LockedSeatRecord[] = seatShows.length
    ? await SeatHold.find(
        {
          showId: { $in: seatShows.map((s) => s._id) },
          $or: [{ status: "sold" }, { status: "held", expiresAt: { $gt: now } }],
        },
        { showId: 1, seatId: 1 },
      ).lean()
    : [];
  return { shows: seatShows, holds };
}

export async function getSeatLayout(
  vendorId: string,
  venueId: string,
  screenId: string,
  now: Date,
): Promise<SeatLayoutView | null> {
  const venue = await findOwnVenue(vendorId, venueId);
  const stored = venue?.screens.find((s) => s.id === screenId);
  if (!venue || !stored) return null;
  const screen = toScreen(stored);
  const places = seatPlaces(screen.zones);
  const { shows, holds } = await lockedSeatRecords(venue._id, screenId, now);
  const perSeat = new Map<string, Set<string>>();
  for (const hold of holds) {
    const set = perSeat.get(hold.seatId) ?? new Set<string>();
    set.add(hold.showId.toString());
    perSeat.set(hold.seatId, set);
  }
  const lockedSeats: LockedSeat[] = [...perSeat].flatMap(([seatId, showIds]) => {
    const place = places.get(seatId);
    return place ? [{ seatId, zoneId: place.zoneId, shows: showIds.size }] : [];
  });
  return {
    venue: { id: venue._id.toString(), name: venue.name, kind: venue.kind },
    screen,
    updatedAt: (venue.updatedAt ?? new Date(0)).toISOString(),
    upcomingShows: shows.length,
    lockedSeats,
  };
}

const unique = (numbers: number[]) => [...new Set(numbers)].sort((a, b) => a - b);

/** Validated input → stored zones, keeping existing category ids and giving new categories a fresh one. */
function toStoredZones(inputZones: SeatLayoutZoneInput[], existing: Screen["zones"]): SeatZone[] {
  const existingIds = new Set(existing.map((z) => z.id));
  const used = new Set<string>();
  return inputZones.map((zone) => {
    const id =
      zone.id && existingIds.has(zone.id) && !used.has(zone.id)
        ? zone.id
        : uniqueId(slugify(zone.name, 40), new Set([...existingIds, ...used]), "category");
    used.add(id);
    return {
      id,
      name: zone.name,
      description: zone.description || zone.name,
      accent: zone.accent,
      recliner: zone.recliner,
      defaultPricePaise: zone.defaultPricePaise,
      rows: zone.rows.map((row) => ({
        row: row.row,
        count: row.count,
        aislesAfter: unique(row.aislesAfter.filter((n) => n < row.count)),
        accessibleSeats: unique(row.accessibleSeats),
        blockedSeats: unique(row.blockedSeats),
      })),
    };
  });
}

export async function saveSeatLayout(
  vendorId: string,
  venueId: string,
  screenId: string,
  raw: unknown,
  now: Date,
): Promise<{ changedFields: string[]; capacity: number }> {
  const input = seatLayoutInputSchema.parse(raw);
  const venue = await requireOwnVenue(vendorId, venueId);
  const stored = venue.screens.find((s) => s.id === screenId);
  if (!stored) throw SCREEN_NOT_FOUND();
  if ((venue.updatedAt ?? new Date(0)).toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) {
    throw staleLayout();
  }

  const current = toScreen(stored);
  const zones = toStoredZones(input.zones, current.zones);
  const before = seatPlaces(current.zones);
  const after = seatPlaces(zones);

  // Every seat sold or held for an upcoming show keeps its seat id and category and stays sellable.
  const { shows, holds } = await lockedSeatRecords(venue._id, screenId, now);
  const broken = new Map<string, string[]>();
  for (const hold of holds) {
    const was = before.get(hold.seatId);
    const next = after.get(hold.seatId);
    if (was && (!next || next.zoneId !== was.zoneId || next.blocked)) {
      const key = hold.showId.toString();
      broken.set(key, [...(broken.get(key) ?? []), hold.seatId]);
    }
  }
  if (broken.size > 0) {
    const affected = shows.filter((s) => broken.has(s._id.toString()));
    const described = await describeShows(affected);
    const conflicts: LayoutConflictShow[] = affected.map((s) => {
      const info = described.get(s._id.toString());
      return {
        id: s._id.toString(),
        title: info?.title ?? "Show",
        ...(info?.startsAt ? { startsAt: info.startsAt } : {}),
        seats: (broken.get(s._id.toString()) ?? []).sort(),
      };
    });
    throw new AppError(
      "CONFLICT",
      "Some seats you changed are already sold (or in a customer's checkout) for upcoming shows. Keep them in their category and sellable, or cancel those bookings first.",
      409,
      { shows: conflicts.slice(0, 30), conflict: "sold_seats" },
    );
  }

  const result = await Venue.updateOne(
    { _id: venue._id, vendorId: venue.vendorId, updatedAt: venue.updatedAt, "screens.id": screenId },
    { $set: { "screens.$.zones": zones } },
  );
  if (result.matchedCount === 0) throw staleLayout();

  // Upcoming shows get new categories at their default price; their existing prices stay as they are.
  const showIds = shows.map((s) => s._id);
  if (showIds.length > 0) {
    await Promise.all(
      zones.map((zone) =>
        Show.updateMany(
          { _id: { $in: showIds }, "zones.zoneId": { $ne: zone.id } },
          {
            $push: {
              zones: {
                zoneId: zone.id,
                name: zone.name,
                description: zone.description,
                pricePaise: zone.defaultPricePaise,
              },
            },
          },
        ),
      ),
    );
    // Per-show blocks on seats that no longer exist (or are now blocked in the layout) have nothing left to block.
    const sellable = [...after].filter(([, p]) => !p.blocked).map(([id]) => id);
    await SeatHold.deleteMany({ showId: { $in: showIds }, status: "blocked", seatId: { $nin: sellable } });
  }

  return { changedFields: ["screens.zones"], capacity: screenStats({ ...current, zones }).capacity };
}

const staleLayout = () =>
  new AppError(
    "CONFLICT",
    "This venue was changed somewhere else (another tab or device) since you opened the designer. Reload to get the latest layout.",
    409,
    { conflict: "stale" },
  );
