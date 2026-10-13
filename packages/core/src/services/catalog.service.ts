import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { connect } from "@showbuzz/db/connect";
import { City, toCity } from "@showbuzz/db/models/City";
import { Coupon, toCoupon } from "@showbuzz/db/models/Coupon";
import { Event, toEvent } from "@showbuzz/db/models/Event";
import { FoodItem, toFoodItem } from "@showbuzz/db/models/FoodItem";
import { GiftCardDesign, toGiftCardDesign } from "@showbuzz/db/models/GiftCardDesign";
import { Movie, toMovie } from "@showbuzz/db/models/Movie";
import { Show } from "@showbuzz/db/models/Show";
import { StreamTitle, toStreamTitle } from "@showbuzz/db/models/StreamTitle";
import { Venue, toCinema } from "@showbuzz/db/models/Venue";
import { objectIdSchema } from "@showbuzz/schemas/common";
import type { EventKind, EventListing } from "@showbuzz/schemas/event";
import type { Movie as MovieShape } from "@showbuzz/schemas/movie";
import type { SearchEntry } from "@showbuzz/schemas/types/catalog";
import type { Screen } from "@showbuzz/schemas/venue";

/**
 * Read access to the catalogue in MongoDB. Every read is a cached function (`use cache`) tagged per
 * collection, so pages are prerendered and served from cache; `revalidateCatalog(tag)` refreshes a
 * collection after an edit. Showtimes and seat availability are not here: they stay dynamic (show.service).
 */

export const EVENT_SECTION_PATH: Record<EventKind, string> = {
  event: "/events",
  play: "/plays",
  sport: "/sports",
  activity: "/activities",
};

export const CATALOG_TAGS = {
  cities: "catalog:cities",
  movies: "catalog:movies",
  venues: "catalog:venues",
  events: "catalog:events",
  streamTitles: "catalog:stream-titles",
  coupons: "catalog:coupons",
  foodItems: "catalog:food-items",
  giftCardDesigns: "catalog:gift-card-designs",
  shows: "catalog:shows",
} as const;

export type CatalogTag = (typeof CATALOG_TAGS)[keyof typeof CATALOG_TAGS];

/**
 * Marks a collection's cached reads stale (served once more, then refetched). Works inside this app only:
 * the admin app is a separate deployment, so it will need a protected revalidate route on the web app.
 */
export function revalidateCatalog(tag: CatalogTag): void {
  revalidateTag(tag, "max");
}

const isObjectId = (id: string) => objectIdSchema.safeParse(id).success;

export async function listCities() {
  "use cache";
  cacheTag(CATALOG_TAGS.cities);
  cacheLife("days");
  await connect();
  const docs = await City.find().sort({ sortOrder: 1 }).lean();
  return docs.map(toCity);
}

export async function listMovies(): Promise<MovieShape[]> {
  "use cache";
  cacheTag(CATALOG_TAGS.movies);
  cacheLife("hours");
  await connect();
  const docs = await Movie.find().sort({ sortOrder: 1 }).lean();
  return docs.map(toMovie);
}

export async function getMovieBySlug(slug: string): Promise<MovieShape | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.movies);
  cacheLife("hours");
  await connect();
  const doc = await Movie.findOne({ slug }).lean();
  return doc ? toMovie(doc) : undefined;
}

export async function getMovieById(id: string): Promise<MovieShape | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.movies);
  cacheLife("hours");
  if (!isObjectId(id)) return undefined;
  await connect();
  const doc = await Movie.findById(id).lean();
  return doc ? toMovie(doc) : undefined;
}

export async function listCinemas() {
  "use cache";
  cacheTag(CATALOG_TAGS.venues);
  cacheLife("hours");
  await connect();
  const docs = await Venue.find({ kind: "cinema" }).sort({ sortOrder: 1 }).lean();
  return docs.map(toCinema);
}

export async function getCinemaById(id: string) {
  return (await listCinemas()).find((c) => c.id === id);
}

/** A venue screen with its seat layout (cinema auditorium or stadium). */
export async function getScreen(venueId: string, screenId: string): Promise<Screen | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.venues);
  cacheLife("hours");
  if (!isObjectId(venueId)) return undefined;
  await connect();
  const venue = await Venue.findById(venueId, { screens: 1 }).lean();
  const screen = venue?.screens.find((s) => s.id === screenId);
  if (!screen) return undefined;
  return {
    id: screen.id,
    name: screen.name,
    layoutType: screen.layoutType,
    zones: screen.zones.map((z) => ({
      id: z.id,
      name: z.name,
      description: z.description,
      accent: z.accent,
      recliner: z.recliner,
      rows: z.rows.map((r) => ({
        row: r.row,
        count: r.count,
        ...(r.aisleAfter ? { aisleAfter: r.aisleAfter } : {}),
        accessibleSeats: [...(r.accessibleSeats ?? [])],
      })),
    })),
  };
}

export async function listEvents(kind: EventKind): Promise<EventListing[]> {
  "use cache";
  cacheTag(CATALOG_TAGS.events);
  cacheLife("hours");
  await connect();
  const docs = await Event.find({ kind }).sort({ sortOrder: 1 }).lean();
  return docs.map(toEvent);
}

export async function getEventBySlug(kind: EventKind, slug: string): Promise<EventListing | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.events);
  cacheLife("hours");
  await connect();
  const doc = await Event.findOne({ kind, slug }).lean();
  return doc ? toEvent(doc) : undefined;
}

export async function getEventById(id: string): Promise<EventListing | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.events);
  cacheLife("hours");
  if (!isObjectId(id)) return undefined;
  await connect();
  const doc = await Event.findById(id).lean();
  return doc ? toEvent(doc) : undefined;
}

/** The bookable stadium Show for a sports fixture (its seat map), if one exists. */
export async function getShowIdForEvent(eventId: string): Promise<string | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.shows);
  cacheLife("hours");
  if (!isObjectId(eventId)) return undefined;
  await connect();
  const show = await Show.findOne({ eventId }, { _id: 1 }).sort({ startsAt: -1 }).lean();
  return show?._id.toString();
}

export async function listCoupons() {
  "use cache";
  cacheTag(CATALOG_TAGS.coupons);
  cacheLife("hours");
  await connect();
  const docs = await Coupon.find().sort({ sortOrder: 1 }).lean();
  return docs.map(toCoupon);
}

export async function getCouponByCode(code: string) {
  return (await listCoupons()).find((c) => c.code === code.toUpperCase());
}

export async function listFoodItems() {
  "use cache";
  cacheTag(CATALOG_TAGS.foodItems);
  cacheLife("hours");
  await connect();
  const docs = await FoodItem.find().sort({ sortOrder: 1 }).lean();
  return docs.map(toFoodItem);
}

export async function listStreamTitles() {
  "use cache";
  cacheTag(CATALOG_TAGS.streamTitles);
  cacheLife("hours");
  await connect();
  const docs = await StreamTitle.find().sort({ sortOrder: 1 }).lean();
  return docs.map(toStreamTitle);
}

export async function listGiftCardDesigns() {
  "use cache";
  cacheTag(CATALOG_TAGS.giftCardDesigns);
  cacheLife("days");
  await connect();
  const docs = await GiftCardDesign.find().sort({ sortOrder: 1 }).lean();
  return docs.map(toGiftCardDesign);
}

const SEARCH_LIMIT_PER_TYPE = 6;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Header search: case-insensitive substring match on titles, genres, categories and venue names. */
export async function searchCatalog(query: string): Promise<SearchEntry[]> {
  "use cache";
  cacheTag(CATALOG_TAGS.movies, CATALOG_TAGS.events, CATALOG_TAGS.venues);
  cacheLife("hours");
  const q = query.trim();
  if (!q) return [];
  const pattern = new RegExp(escapeRegex(q), "i");

  await connect();
  const [movies, events, cinemas] = await Promise.all([
    Movie.find({ $or: [{ title: pattern }, { genres: pattern }, { languages: pattern }] })
      .sort({ sortOrder: 1 })
      .limit(SEARCH_LIMIT_PER_TYPE)
      .lean(),
    Event.find({ $or: [{ title: pattern }, { category: pattern }, { venueName: pattern }] })
      .sort({ kind: 1, sortOrder: 1 })
      .limit(SEARCH_LIMIT_PER_TYPE * 2)
      .lean(),
    Venue.find({ kind: "cinema", $or: [{ name: pattern }, { address: pattern }] })
      .sort({ sortOrder: 1 })
      .limit(SEARCH_LIMIT_PER_TYPE)
      .lean(),
  ]);

  const movieEntries: SearchEntry[] = movies.map((m) => ({
    type: "movie",
    title: m.title,
    subtitle: `${m.genres.join(", ")} • ${m.certificate}`,
    keywords: [...m.genres, ...m.languages].join(" "),
    href: `/movies/${m.slug}`,
    image: m.poster,
  }));
  const eventEntries: SearchEntry[] = events.map((e) => ({
    type: e.kind,
    title: e.title,
    subtitle: e.category,
    keywords: `${e.category} ${e.venueName}`,
    href: `${EVENT_SECTION_PATH[e.kind]}/${e.slug}`,
    image: e.poster,
  }));
  const cinemaEntries: SearchEntry[] = cinemas.map((c) => ({
    type: "cinema",
    title: c.name,
    subtitle: c.address,
    keywords: c.address,
    href: `/cinemas?cinema=${c.slug}`,
  }));
  return [...movieEntries, ...eventEntries, ...cinemaEntries];
}
