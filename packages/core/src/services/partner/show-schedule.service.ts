import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Event } from "@showbuzz/db/models/Event";
import { Movie } from "@showbuzz/db/models/Movie";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { LIVE_SHOW_FILTER, Show, type ShowAttrs } from "@showbuzz/db/models/Show";
import { VendorMovie } from "@showbuzz/db/models/VendorMovie";
import { type StoredScreen, Venue, type VenueAttrs, toScreen } from "@showbuzz/db/models/Venue";
import { type ClientSession, Types } from "@showbuzz/db/mongoose";
import {
  EVENT_DEFAULT_DURATION_MINUTES,
  SHOW_TURNAROUND_MINUTES,
  bulkShowInputSchema,
  dateKeysBetween,
  showInputSchema,
  showUpdateSchema,
} from "@showbuzz/schemas/partner-listing";
import type {
  ScreenOption,
  ShowClash,
  ShowRowStatus,
  VendorShowDetail,
  VendorShowRow,
  VenueScreenOption,
} from "@showbuzz/schemas/types/partner-listing";
import type { Screen, ShowZone } from "@showbuzz/schemas/venue";
import { addDaysToKey, istDateTime } from "@showbuzz/utils/dates";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { isDuplicateKey, toObjectId } from "./ids";

/**
 * The vendor's show schedule: movie shows on its cinema screens (one at a time or a daily schedule over a date
 * range), price/format edits and cancellation. Stadium fixtures are scheduled from their sports listing
 * (listing.service) but use the same screen rules here. Every query is filtered by the session's vendor id.
 *
 * A screen runs one show at a time: a show occupies [start, end + turnaround). The check and the insert run in
 * one transaction that also bumps the venue's `scheduleVersion`, so two concurrent schedulers on one venue
 * conflict and the retry sees the other's shows. Demo template shows (seeded cinemas) without any seat activity
 * give way to a vendor's own show: they are cancelled in the same transaction.
 */

type LeanShow = ShowAttrs & { _id: Types.ObjectId };
type LeanVenue = VenueAttrs & { _id: Types.ObjectId };

const TURNAROUND_MS = SHOW_TURNAROUND_MINUTES * 60_000;
/** How far back to look for a show that could still be running at a new show's start. */
const LONGEST_SHOW_MS = 24 * 60 * 60_000;

const SHOW_NOT_FOUND = () => new AppError("NOT_FOUND", "This show doesn't exist or isn't yours.", 404);
const VENUE_NOT_FOUND = () => new AppError("NOT_FOUND", "This venue doesn't exist or isn't yours.", 404);
const fieldError = (field: string, message: string) =>
  new AppError("VALIDATION_FAILED", message, 422, { fieldErrors: { [field]: [message] } });

const vendorObjectId = (vendorId: string) => new Types.ObjectId(vendorId);

/** Seats on sale in a layout category (layout-blocked seats don't count). */
function zoneSeats(zone: Screen["zones"][number]): number {
  return zone.rows.reduce((sum, row) => sum + row.count - new Set(row.blockedSeats).size, 0);
}

export function screenCapacity(screen: Screen): number {
  return screen.zones.reduce((sum, zone) => sum + zoneSeats(zone), 0);
}

function toScreenOption(stored: StoredScreen): ScreenOption {
  const screen = toScreen(stored);
  return {
    id: screen.id,
    name: screen.name,
    formats: [...screen.formats],
    zones: screen.zones.map((z) => ({
      id: z.id,
      name: z.name,
      defaultPricePaise: z.defaultPricePaise,
      seats: zoneSeats(z),
    })),
  };
}

/** The vendor's venues with their screens, seat categories and default prices (show and fixture forms). */
export async function listVenueScreenOptions(vendorId: string): Promise<VenueScreenOption[]> {
  await connect();
  const venues = await Venue.find(
    { vendorId: vendorObjectId(vendorId) },
    { name: 1, kind: 1, cityId: 1, status: 1, screens: 1 },
  )
    .sort({ name: 1 })
    .lean();
  return venues.map((v) => ({
    id: v._id.toString(),
    name: v.name,
    kind: v.kind,
    cityId: v.cityId,
    status: v.status ?? "active",
    screens: v.screens.map(toScreenOption),
  }));
}

export async function requireOwnVenueScreen(
  vendorId: string,
  venueId: string,
  screenId: string,
): Promise<{ venue: LeanVenue; screen: Screen }> {
  const _id = toObjectId(venueId);
  if (!_id) throw VENUE_NOT_FOUND();
  await connect();
  const venue = await Venue.findOne({ _id, vendorId: vendorObjectId(vendorId) }).lean();
  if (!venue) throw VENUE_NOT_FOUND();
  const stored = venue.screens.find((s) => s.id === screenId);
  if (!stored) throw fieldError("screenId", "Choose one of this venue's screens");
  return { venue, screen: toScreen(stored) };
}

/** Show zones from the screen's categories and the vendor's prices (every category must be priced, nothing else). */
export function pricedZones(screen: Screen, prices: { zoneId: string; pricePaise: number }[]): ShowZone[] {
  const byZone = new Map(prices.map((p) => [p.zoneId, p.pricePaise]));
  const unknown = prices.find((p) => !screen.zones.some((z) => z.id === p.zoneId));
  if (unknown) throw fieldError("prices", "The seat categories changed. Reload the page and try again.");
  return screen.zones.map((zone) => {
    const pricePaise = byZone.get(zone.id);
    if (pricePaise === undefined) throw fieldError("prices", `Enter a price for ${zone.name}`);
    return { zoneId: zone.id, name: zone.name, description: zone.description, pricePaise };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Overlap

export interface ShowWindow {
  startsAt: Date;
  endsAt: Date;
}

const endOf = (show: Pick<LeanShow, "startsAt" | "endsAt">): Date =>
  show.endsAt ?? new Date((show.startsAt ?? new Date(0)).getTime() + EVENT_DEFAULT_DURATION_MINUTES * 60_000);

const clashes = (a: ShowWindow, b: ShowWindow) =>
  a.startsAt.getTime() < b.endsAt.getTime() + TURNAROUND_MS &&
  b.startsAt.getTime() < a.endsAt.getTime() + TURNAROUND_MS;

async function titlesOf(shows: Pick<LeanShow, "movieId" | "eventId">[]): Promise<Map<string, string>> {
  const movieIds = [...new Set(shows.flatMap((s) => (s.movieId ? [s.movieId.toString()] : [])))];
  const eventIds = [...new Set(shows.flatMap((s) => (s.eventId ? [s.eventId.toString()] : [])))];
  const [movies, events] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }, { title: 1 }).lean() : [],
    eventIds.length ? Event.find({ _id: { $in: eventIds } }, { title: 1 }).lean() : [],
  ]);
  return new Map<string, string>([
    ...movies.map((m) => [m._id.toString(), m.title] as const),
    ...events.map((e) => [e._id.toString(), e.title] as const),
  ]);
}

const titleKey = (show: Pick<LeanShow, "movieId" | "eventId">) => (show.movieId ?? show.eventId)?.toString() ?? "";

/**
 * Inside a scheduling transaction: locks the venue's schedule, then checks `windows` against each other and
 * against the screen's live shows. Template shows (demo) with no seat activity give way and are cancelled;
 * anything else that overlaps is a 409 listing the clashes. Returns how many demo shows were cancelled.
 */
export async function claimScreenTime(
  session: ClientSession,
  venueId: Types.ObjectId,
  screenId: string,
  windows: ShowWindow[],
  exceptShowId?: Types.ObjectId,
): Promise<number> {
  await Venue.updateOne({ _id: venueId }, { $inc: { scheduleVersion: 1 } }, { session, timestamps: false });
  if (windows.length === 0) return 0;

  const sorted = [...windows].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (prev && next && clashes(prev, next)) {
      throw new AppError(
        "CONFLICT",
        "Two of these start times are too close together for one screen (running time plus a 15-minute changeover).",
        409,
        { fieldErrors: { times: ["Leave the running time plus 15 minutes between start times"] } },
      );
    }
  }

  const first = sorted[0]?.startsAt ?? new Date();
  const last = sorted.reduce((max, w) => (w.endsAt > max ? w.endsAt : max), first);
  const existing = await Show.find(
    {
      venueId,
      screenId,
      ...LIVE_SHOW_FILTER,
      ...(exceptShowId ? { _id: { $ne: exceptShowId } } : {}),
      startsAt: { $gt: new Date(first.getTime() - LONGEST_SHOW_MS), $lt: new Date(last.getTime() + TURNAROUND_MS) },
    },
    { movieId: 1, eventId: 1, startsAt: 1, endsAt: 1, source: 1 },
    { session },
  ).lean();

  const overlapping = existing.filter((show) =>
    sorted.some((w) => clashes(w, { startsAt: show.startsAt ?? new Date(0), endsAt: endOf(show) })),
  );
  if (overlapping.length === 0) return 0;

  // Demo shows give way unless someone has touched their seats (held, sold or blocked).
  const templateIds = overlapping.filter((s) => s.source === "template").map((s) => s._id);
  const touched = templateIds.length
    ? new Set(
        (await SeatHold.distinct("showId", { showId: { $in: templateIds } }, { session })).map((id) => String(id)),
      )
    : new Set<string>();
  const yielding = overlapping.filter((s) => s.source === "template" && !touched.has(s._id.toString()));
  const blocking = overlapping.filter((s) => !yielding.includes(s));

  if (blocking.length > 0) {
    const titles = await titlesOf(blocking);
    const details: ShowClash[] = [];
    for (const w of sorted) {
      for (const show of blocking) {
        const window = { startsAt: show.startsAt ?? new Date(0), endsAt: endOf(show) };
        if (!clashes(w, window)) continue;
        details.push({
          requestedStartsAt: w.startsAt.toISOString(),
          title: titles.get(titleKey(show)) ?? "Show",
          startsAt: window.startsAt.toISOString(),
          endsAt: window.endsAt.toISOString(),
        });
      }
    }
    throw new AppError(
      "CONFLICT",
      `This screen is busy at ${details.length === 1 ? "that time" : "some of those times"}. Nothing was scheduled.`,
      409,
      { clashes: details.slice(0, 30), clashCount: details.length },
    );
  }

  await Show.updateMany(
    { _id: { $in: yielding.map((s) => s._id) }, source: "template" },
    { $set: { status: "cancelled" } },
    { session },
  );
  return yielding.length;
}

// ---------------------------------------------------------------------------------------------------------------
// Create

async function requireListedMovie(vendorId: string, movieId: string) {
  const _id = toObjectId(movieId);
  if (!_id) throw fieldError("movieId", "Choose a movie from your list");
  const [movie, link] = await Promise.all([
    Movie.findById(_id, { title: 1, durationMinutes: 1, languages: 1 }).lean(),
    VendorMovie.exists({ vendorId: vendorObjectId(vendorId), movieId: _id }),
  ]);
  if (!movie || !link) throw fieldError("movieId", "Choose a movie from your list (Movies → Add movie)");
  return movie;
}

interface MovieShowPlan {
  venue: LeanVenue;
  screen: Screen;
  movieId: Types.ObjectId;
  durationMs: number;
  base: Omit<ShowAttrs, "startsAt" | "endsAt">;
}

async function planMovieShow(
  vendorId: string,
  input: {
    venueId: string;
    screenId: string;
    movieId: string;
    format: string;
    language: string;
    prices: { zoneId: string; pricePaise: number }[];
  },
): Promise<MovieShowPlan> {
  const { venue, screen } = await requireOwnVenueScreen(vendorId, input.venueId, input.screenId);
  if (venue.kind !== "cinema") throw fieldError("venueId", "Movie shows run at cinemas. Choose one of your cinemas.");
  const movie = await requireListedMovie(vendorId, input.movieId);
  if (screen.formats.length > 0 && !screen.formats.includes(input.format)) {
    throw fieldError("format", `${screen.name} doesn't run ${input.format}`);
  }
  if (!movie.languages.includes(input.language)) throw fieldError("language", "Choose one of the film's languages");
  const zones = pricedZones(screen, input.prices);
  return {
    venue,
    screen,
    movieId: movie._id,
    durationMs: movie.durationMinutes * 60_000,
    base: {
      vendorId: vendorObjectId(vendorId),
      movieId: movie._id,
      venueId: venue._id,
      screenId: screen.id,
      screenName: screen.name,
      format: input.format,
      language: input.language,
      availability: "available",
      // The headline price on showtime chips is the top (first) category, as for the seeded shows.
      pricePaise: zones[0]?.pricePaise ?? 0,
      zones,
      inventory: [],
      status: "scheduled",
      source: "manual",
    },
  };
}

async function insertShows(plan: MovieShowPlan, starts: Date[]): Promise<{ ids: string[]; replacedDemoShows: number }> {
  const windows = starts.map((startsAt) => ({ startsAt, endsAt: new Date(startsAt.getTime() + plan.durationMs) }));
  const mongoose = await connect();
  const state = { ids: [] as string[], replacedDemoShows: 0 };
  try {
    await mongoose.connection.transaction(async (session) => {
      state.replacedDemoShows = await claimScreenTime(session, plan.venue._id, plan.screen.id, windows);
      const docs = await Show.insertMany(
        windows.map((w) => ({ ...plan.base, startsAt: w.startsAt, endsAt: w.endsAt })),
        { session },
      );
      state.ids = docs.map((d) => d._id.toString());
    });
  } catch (err) {
    // The unique key (venue, screen, start, movie) still holds a cancelled show of this film at this time.
    if (isDuplicateKey(err)) {
      throw new AppError(
        "CONFLICT",
        "This film was already scheduled at that time on this screen (the show was cancelled). Pick another start time.",
        409,
      );
    }
    throw err;
  }
  return state;
}

export async function createShow(
  vendorId: string,
  raw: unknown,
  now: Date,
): Promise<{ id: string; replacedDemoShows: number }> {
  const input = showInputSchema.parse(raw);
  const startsAt = new Date(input.startsAt);
  if (startsAt <= now) throw fieldError("startsAt", "Choose a time in the future");
  const plan = await planMovieShow(vendorId, input);
  const { ids, replacedDemoShows } = await insertShows(plan, [startsAt]);
  return { id: ids[0] ?? "", replacedDemoShows };
}

/** A daily schedule: every start time on every date in the range (IST). All or nothing. */
export async function createShowSchedule(
  vendorId: string,
  raw: unknown,
  now: Date,
): Promise<{ created: number; replacedDemoShows: number }> {
  const input = bulkShowInputSchema.parse(raw);
  const starts = dateKeysBetween(input.fromDate, input.toDate).flatMap((key) =>
    input.times.map((time) => istDateTime(key, time)),
  );
  if (starts.some((s) => s <= now)) throw fieldError("fromDate", "Some of these start times have already passed");
  const plan = await planMovieShow(vendorId, input);
  const { ids, replacedDemoShows } = await insertShows(plan, starts);
  return { created: ids.length, replacedDemoShows };
}

// ---------------------------------------------------------------------------------------------------------------
// List and detail

export const SHOW_SORT_FIELDS = ["startsAt", "pricePaise"] as const;

export interface ShowListQuery {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
  /** IST date; without it, shows from today on. */
  dateKey?: string;
  venueId?: string;
  movieId?: string;
  eventId?: string;
  status?: "scheduled" | "cancelled";
}

function rowStatus(show: Pick<LeanShow, "status" | "startsAt">, now: Date): ShowRowStatus {
  if (show.status === "cancelled") return "cancelled";
  return show.startsAt && show.startsAt <= now ? "started" : "scheduled";
}

async function soldCounts(showIds: Types.ObjectId[]): Promise<Map<string, { sold: number; held: number }>> {
  if (showIds.length === 0) return new Map();
  const counts = await SeatHold.aggregate<{ _id: { showId: Types.ObjectId; status: string }; n: number }>([
    { $match: { showId: { $in: showIds }, status: { $in: ["sold", "held"] } } },
    { $group: { _id: { showId: "$showId", status: "$status" }, n: { $sum: 1 } } },
  ]);
  const map = new Map<string, { sold: number; held: number }>();
  for (const c of counts) {
    const key = c._id.showId.toString();
    const entry = map.get(key) ?? { sold: 0, held: 0 };
    if (c._id.status === "sold") entry.sold = c.n;
    else entry.held = c.n;
    map.set(key, entry);
  }
  return map;
}

/** The vendor's seat-map shows (movies and fixtures; event passes are managed on their listing). */
export async function listVendorShows(
  vendorId: string,
  query: ShowListQuery,
  now: Date,
): Promise<{ rows: VendorShowRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = {
    vendorId: vendorObjectId(vendorId),
    "inventory.0": { $exists: false },
    startsAt: query.dateKey
      ? { $gte: istDateTime(query.dateKey, "00:00"), $lt: istDateTime(addDaysToKey(query.dateKey, 1), "00:00") }
      : { $gte: istDateTime(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now), "00:00") },
  };
  const venueId = query.venueId ? toObjectId(query.venueId) : null;
  if (venueId) filter.venueId = venueId;
  const movieId = query.movieId ? toObjectId(query.movieId) : null;
  if (movieId) filter.movieId = movieId;
  const eventId = query.eventId ? toObjectId(query.eventId) : null;
  if (eventId) filter.eventId = eventId;
  if (query.status === "cancelled") filter.status = "cancelled";
  if (query.status === "scheduled") Object.assign(filter, LIVE_SHOW_FILTER);
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    const [movies, events] = await Promise.all([
      Movie.find({ title: pattern }, { _id: 1 }).limit(200).lean(),
      Event.find({ title: pattern, vendorId: vendorObjectId(vendorId) }, { _id: 1 })
        .limit(200)
        .lean(),
    ]);
    filter.$or = [
      { movieId: { $in: movies.map((m) => m._id) } },
      { eventId: { $in: events.map((e) => e._id) } },
      { screenName: pattern },
      { format: pattern },
    ];
  }
  const field = (SHOW_SORT_FIELDS as readonly string[]).includes(query.sort.field) ? query.sort.field : "startsAt";
  const [docs, total] = await Promise.all([
    Show.find(filter)
      .sort({ [field]: query.sort.direction === "desc" ? -1 : 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Show.countDocuments(filter),
  ]);
  const venueIds = [...new Set(docs.map((d) => d.venueId.toString()))];
  const [titles, counts, venues] = await Promise.all([
    titlesOf(docs),
    soldCounts(docs.map((d) => d._id)),
    Venue.find({ _id: { $in: venueIds } }, { name: 1, screens: 1 }).lean(),
  ]);
  const venueById = new Map(venues.map((v) => [v._id.toString(), v]));
  return {
    total,
    rows: docs.map((doc) => {
      const venue = venueById.get(doc.venueId.toString());
      const stored = venue?.screens.find((s) => s.id === doc.screenId);
      return {
        id: doc._id.toString(),
        title: titles.get(titleKey(doc)) ?? "Show",
        href: doc.movieId ? `/movies/${doc.movieId.toString()}` : `/events/${doc.eventId?.toString() ?? ""}/edit`,
        kind: doc.movieId ? "movie" : "sport",
        venueName: venue?.name ?? "",
        screenName: doc.screenName,
        startsAt: (doc.startsAt ?? new Date(0)).toISOString(),
        ...(doc.endsAt ? { endsAt: doc.endsAt.toISOString() } : {}),
        format: doc.format ?? "",
        language: doc.language ?? "",
        pricePaise: doc.pricePaise,
        sold: counts.get(doc._id.toString())?.sold ?? 0,
        capacity: stored ? screenCapacity(toScreen(stored)) : 0,
        status: rowStatus(doc, now),
        generated: doc.source === "template",
      };
    }),
  };
}

async function findOwnSeatShow(vendorId: string, showId: string): Promise<LeanShow | null> {
  const _id = toObjectId(showId);
  if (!_id) return null;
  await connect();
  const show = await Show.findOne({ _id, vendorId: vendorObjectId(vendorId) }).lean();
  if (!show?.startsAt || (show.inventory ?? []).length > 0) return null;
  return show;
}

export async function getVendorShow(vendorId: string, showId: string, now: Date): Promise<VendorShowDetail | null> {
  const show = await findOwnSeatShow(vendorId, showId);
  if (!show?.startsAt) return null;
  const [titles, counts, venue, movie] = await Promise.all([
    titlesOf([show]),
    soldCounts([show._id]),
    Venue.findById(show.venueId, { name: 1, screens: 1 }).lean(),
    show.movieId ? Movie.findById(show.movieId, { formats: 1 }).lean() : null,
  ]);
  const stored = venue?.screens.find((s) => s.id === show.screenId);
  const screen = stored ? toScreen(stored) : undefined;
  const screenFormats = screen?.formats ?? [];
  const formatOptions = [
    ...new Set([
      ...(screenFormats.length > 0 ? screenFormats : (movie?.formats ?? [])),
      ...(show.format ? [show.format] : []),
    ]),
  ];
  return {
    id: show._id.toString(),
    title: titles.get(titleKey(show)) ?? "Show",
    kind: show.movieId ? "movie" : "sport",
    venueName: venue?.name ?? "",
    screenName: show.screenName,
    startsAt: show.startsAt.toISOString(),
    ...(show.endsAt ? { endsAt: show.endsAt.toISOString() } : {}),
    format: show.format ?? "",
    language: show.language ?? "",
    status: rowStatus(show, now),
    generated: show.source === "template",
    formatOptions,
    zones: show.zones.map((z) => ({ zoneId: z.zoneId, name: z.name, pricePaise: z.pricePaise })),
    sold: counts.get(showId)?.sold ?? 0,
    held: counts.get(showId)?.held ?? 0,
    capacity: screen ? screenCapacity(screen) : 0,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Edit and cancel

/**
 * New prices and format for a show that hasn't started. Orders already placed keep the price they were quoted; new
 * quotes read the show's zones.
 */
export async function updateShow(
  vendorId: string,
  showId: string,
  raw: unknown,
  now: Date,
): Promise<{ changedFields: string[]; isFixture: boolean }> {
  const input = showUpdateSchema.parse(raw);
  const show = await findOwnSeatShow(vendorId, showId);
  if (!show?.startsAt) throw SHOW_NOT_FOUND();
  if (show.status === "cancelled") throw new AppError("CONFLICT", "This show was cancelled.", 409);
  if (show.startsAt <= now) throw new AppError("CONFLICT", "This show has already started.", 409);
  const detail = await getVendorShow(vendorId, showId, now);
  if (show.movieId && !input.format) throw fieldError("format", "Choose a format");
  if (input.format && detail && !detail.formatOptions.includes(input.format)) {
    throw fieldError("format", "Choose a format this screen runs");
  }

  const prices = new Map(input.prices.map((p) => [p.zoneId, p.pricePaise]));
  const zones = show.zones.map((z) => {
    const pricePaise = prices.get(z.zoneId);
    if (pricePaise === undefined) throw fieldError("prices", `Enter a price for ${z.name}`);
    return { zoneId: z.zoneId, name: z.name, description: z.description, pricePaise };
  });
  const changedFields = [
    ...(input.format !== (show.format ?? "") ? ["format"] : []),
    ...(zones.some((z, i) => z.pricePaise !== show.zones[i]?.pricePaise) ? ["zones.pricePaise"] : []),
  ];
  if (changedFields.length === 0) return { changedFields, isFixture: Boolean(show.eventId) };
  const result = await Show.updateOne(
    { _id: show._id, vendorId: show.vendorId, ...LIVE_SHOW_FILTER, startsAt: { $gt: now } },
    { $set: { format: input.format, zones, pricePaise: zones[0]?.pricePaise ?? show.pricePaise } },
  );
  if (result.matchedCount !== 1) throw new AppError("CONFLICT", "This show changed meanwhile. Reload the page.", 409);
  // A fixture's listing shows its seat categories as ticket tiers (same ids): keep their prices in step.
  if (show.eventId) {
    await Promise.all(
      zones.map((z) =>
        Event.updateOne(
          { _id: show.eventId, vendorId: show.vendorId, "ticketTiers.id": z.zoneId },
          { $set: { "ticketTiers.$.pricePaise": z.pricePaise } },
        ),
      ),
    );
  }
  return { changedFields, isFixture: Boolean(show.eventId) };
}

/**
 * Cancels a show that has no sold seats (with sales, the bookings must be cancelled first, so customers are
 * refunded). Seats in checkout and per-show blocks are released in the same transaction; an unpaid order on it
 * then fails at payment and is refunded in full (confirmation needs every seat still held).
 */
export async function cancelShow(vendorId: string, showId: string, now: Date): Promise<{ title: string }> {
  const show = await findOwnSeatShow(vendorId, showId);
  if (!show?.startsAt) throw SHOW_NOT_FOUND();
  if (show.status === "cancelled") return { title: (await titlesOf([show])).get(titleKey(show)) ?? "Show" };
  if (show.startsAt <= now) throw new AppError("CONFLICT", "This show has already started.", 409);
  const mongoose = await connect();
  await mongoose.connection.transaction(async (session) => {
    const sold = await SeatHold.countDocuments({ showId: show._id, status: "sold" }, { session });
    if (sold > 0) {
      throw new AppError(
        "CONFLICT",
        `${sold} seat${sold === 1 ? " is" : "s are"} sold for this show. Cancel those bookings first (Bookings), then cancel the show.`,
        409,
        { sold },
      );
    }
    await Show.updateOne({ _id: show._id }, { $set: { status: "cancelled" } }, { session });
    await SeatHold.deleteMany({ showId: show._id, status: { $in: ["held", "blocked"] } }, { session });
  });
  return { title: (await titlesOf([show])).get(titleKey(show)) ?? "Show" };
}
