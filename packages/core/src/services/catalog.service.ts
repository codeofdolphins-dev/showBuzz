import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { connect } from "@showbuzz/db/connect";
import { City, toCity } from "@showbuzz/db/models/City";
import { Coupon, toCoupon } from "@showbuzz/db/models/Coupon";
import { ACTIVE_EVENT_FILTER, Event, toEvent } from "@showbuzz/db/models/Event";
import { FoodItem, toFoodItem } from "@showbuzz/db/models/FoodItem";
import { GiftCardDesign, toGiftCardDesign } from "@showbuzz/db/models/GiftCardDesign";
import { ACTIVE_MOVIE_FILTER, Movie, toMovie } from "@showbuzz/db/models/Movie";
import { LIVE_SHOW_FILTER, Show } from "@showbuzz/db/models/Show";
import { StreamTitle, toStreamTitle } from "@showbuzz/db/models/StreamTitle";
import { Vendor, toVendorPublic } from "@showbuzz/db/models/Vendor";
import { ACTIVE_VENUE_FILTER, Venue, toCinema, toScreen } from "@showbuzz/db/models/Venue";
import { objectIdSchema } from "@showbuzz/schemas/common";
import type { EventKind, EventListing } from "@showbuzz/schemas/event";
import type { Movie as MovieShape } from "@showbuzz/schemas/movie";
import type { OfferListing } from "@showbuzz/schemas/offer";
import type { SearchEntry } from "@showbuzz/schemas/types/catalog";
import type { VendorPublic } from "@showbuzz/schemas/types/vendor";
import { type CancellationPolicy, describeCutoff } from "@showbuzz/schemas/vendor";
import type { Cinema, Screen } from "@showbuzz/schemas/venue";
import { CATALOG_TAGS, type CatalogTag } from "./catalog-tags";

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

export { CATALOG_TAGS, type CatalogTag };

/**
 * Marks a collection's cached reads stale (served once more, then refetched). Works inside this app only:
 * the admin app is a separate deployment, so it will need a protected revalidate route on the web app.
 */
export function revalidateCatalog(tag: CatalogTag): void {
  revalidateTag(tag, "max");
}

const isObjectId = (id: string) => objectIdSchema.safeParse(id).success;

/** Vendor names and policies for display ("by …", "Organised by …", cancellation labels). Never KYC. */
export async function listVendorsPublic(): Promise<VendorPublic[]> {
  "use cache";
  cacheTag(CATALOG_TAGS.vendors);
  cacheLife("hours");
  await connect();
  const docs = await Vendor.find().sort({ businessName: 1 }).lean();
  return docs.map(toVendorPublic);
}

async function vendorsById(): Promise<Map<string, VendorPublic>> {
  return new Map((await listVendorsPublic()).map((v) => [v.id, v]));
}

/**
 * Vendors whose listings are hidden from the public site: suspended by the super-admin, or onboarding not finished.
 * Tagged `vendors`, so suspending or reactivating a vendor (revalidateWeb([vendors])) shows or hides all its
 * cinemas, events and offers at once. Their shows were already unbookable (getSellerTerms answers 410).
 */
async function listHiddenVendorIds(): Promise<string[]> {
  "use cache";
  cacheTag(CATALOG_TAGS.vendors);
  cacheLife("hours");
  await connect();
  const docs = await Vendor.find(
    { $or: [{ status: { $ne: "active" } }, { onboardingStatus: { $ne: "complete" } }] },
    { _id: 1 },
  ).lean();
  return docs.map((d) => d._id.toString());
}

/** Drops listings of hidden vendors (listings without a vendor predate the marketplace and stay). */
async function visibleOnly<T extends { vendorId?: unknown }>(docs: T[]): Promise<T[]> {
  const hidden = new Set(await listHiddenVendorIds());
  if (hidden.size === 0) return docs;
  return docs.filter((d) => !d.vendorId || !hidden.has(String(d.vendorId)));
}

/** Cancellable only when the vendor's policy and the venue both allow it. */
export function cancellationLabel(venueAllows: boolean, policy: CancellationPolicy): Cinema["cancellation"] {
  if (!venueAllows || !policy.allowed) return { allowed: false, label: "Non-Cancellable" };
  const cutoff = describeCutoff(policy.cutoffMinutes);
  return { allowed: true, label: `Cancellation Available (${cutoff.charAt(0).toUpperCase()}${cutoff.slice(1)})` };
}

function withOperator(cinema: Cinema, vendors: Map<string, VendorPublic>): Cinema {
  const vendor = cinema.vendorId ? vendors.get(cinema.vendorId) : undefined;
  if (!vendor) return cinema;
  return {
    ...cinema,
    operatorName: vendor.businessName,
    cancellation: cancellationLabel(cinema.cancellation.allowed, vendor.cancellation),
  };
}

function withOrganiser(event: EventListing, vendors: Map<string, VendorPublic>): EventListing {
  const vendor = event.vendorId ? vendors.get(event.vendorId) : undefined;
  return vendor ? { ...event, organiserName: vendor.businessName } : event;
}

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
  const docs = await Movie.find(ACTIVE_MOVIE_FILTER).sort({ sortOrder: 1 }).lean();
  return docs.map(toMovie);
}

export async function getMovieBySlug(slug: string): Promise<MovieShape | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.movies);
  cacheLife("hours");
  await connect();
  const doc = await Movie.findOne({ slug, ...ACTIVE_MOVIE_FILTER }).lean();
  return doc ? toMovie(doc) : undefined;
}

/** The slug a merged (archived) film now redirects to, if `slug` belongs to one. */
export async function getMergedMovieSlug(slug: string): Promise<string | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.movies);
  cacheLife("hours");
  await connect();
  const archived = await Movie.findOne({ slug, archivedAt: { $exists: true } }, { mergedIntoId: 1 }).lean();
  if (!archived?.mergedIntoId) return undefined;
  const target = await Movie.findOne({ _id: archived.mergedIntoId, ...ACTIVE_MOVIE_FILTER }, { slug: 1 }).lean();
  return target?.slug;
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

export async function listCinemas(): Promise<Cinema[]> {
  "use cache";
  cacheTag(CATALOG_TAGS.venues, CATALOG_TAGS.vendors);
  cacheLife("hours");
  await connect();
  const [docs, vendors] = await Promise.all([
    Venue.find({ kind: "cinema", ...ACTIVE_VENUE_FILTER })
      .sort({ sortOrder: 1 })
      .lean(),
    vendorsById(),
  ]);
  return (await visibleOnly(docs)).map((doc) => withOperator(toCinema(doc), vendors));
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
  return screen ? toScreen(screen) : undefined;
}

export async function listEvents(kind: EventKind): Promise<EventListing[]> {
  "use cache";
  cacheTag(CATALOG_TAGS.events, CATALOG_TAGS.vendors);
  cacheLife("hours");
  await connect();
  const [docs, vendors] = await Promise.all([
    Event.find({ kind, ...ACTIVE_EVENT_FILTER })
      .sort({ sortOrder: 1 })
      .lean(),
    vendorsById(),
  ]);
  return (await visibleOnly(docs)).map((doc) => withOrganiser(toEvent(doc), vendors));
}

export async function getEventBySlug(kind: EventKind, slug: string): Promise<EventListing | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.events, CATALOG_TAGS.vendors);
  cacheLife("hours");
  await connect();
  const [doc, vendors] = await Promise.all([
    Event.findOne({ kind, slug, ...ACTIVE_EVENT_FILTER }).lean(),
    vendorsById(),
  ]);
  const [visible] = doc ? await visibleOnly([doc]) : [];
  return visible ? withOrganiser(toEvent(visible), vendors) : undefined;
}

export async function getEventById(id: string): Promise<EventListing | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.events, CATALOG_TAGS.vendors);
  cacheLife("hours");
  if (!isObjectId(id)) return undefined;
  await connect();
  const [doc, vendors] = await Promise.all([Event.findOne({ _id: id, ...ACTIVE_EVENT_FILTER }).lean(), vendorsById()]);
  const [visible] = doc ? await visibleOnly([doc]) : [];
  return visible ? withOrganiser(toEvent(visible), vendors) : undefined;
}

/** The bookable stadium Show for a sports fixture (its seat map), if one exists. */
export async function getShowIdForEvent(eventId: string): Promise<string | undefined> {
  "use cache";
  cacheTag(CATALOG_TAGS.shows);
  cacheLife("hours");
  if (!isObjectId(eventId)) return undefined;
  await connect();
  const show = await Show.findOne({ eventId, ...LIVE_SHOW_FILTER }, { _id: 1 })
    .sort({ startsAt: -1 })
    .lean();
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

/** Platform coupons (always valid everywhere). */
export async function listPlatformCoupons() {
  return (await listCoupons()).filter((c) => !c.vendorId);
}

/**
 * The /offers page: active platform coupons, plus vendor coupons whose vendor chose to list them, labelled with the
 * vendor's business name (they apply only to that vendor's shows).
 */
export async function listOffers(): Promise<OfferListing[]> {
  const [coupons, vendors, hidden] = await Promise.all([listCoupons(), vendorsById(), listHiddenVendorIds()]);
  const hiddenIds = new Set(hidden);
  return coupons.flatMap((c): OfferListing[] => {
    if (c.status === "inactive") return [];
    if (!c.vendorId) return [c];
    if (hiddenIds.has(c.vendorId)) return [];
    const vendor = vendors.get(c.vendorId);
    return c.showOnOffersPage && vendor ? [{ ...c, vendorName: vendor.businessName }] : [];
  });
}

export async function getCouponByCode(code: string) {
  return (await listCoupons()).find((c) => c.code === code.toUpperCase());
}

/** The menu of one vendor's cinema: that vendor's items for every venue, plus those limited to this venue. */
export async function listFoodItemsFor(vendorId: string, venueId: string) {
  "use cache";
  cacheTag(CATALOG_TAGS.foodItems);
  cacheLife("hours");
  if (!isObjectId(vendorId) || !isObjectId(venueId)) return [];
  await connect();
  const docs = await FoodItem.find({
    vendorId,
    available: { $ne: false },
    $or: [{ venueIds: { $size: 0 } }, { venueIds: { $exists: false } }, { venueIds: venueId }],
  })
    .sort({ sortOrder: 1 })
    .lean();
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
  cacheTag(CATALOG_TAGS.movies, CATALOG_TAGS.events, CATALOG_TAGS.venues, CATALOG_TAGS.vendors);
  cacheLife("hours");
  const q = query.trim();
  if (!q) return [];
  const pattern = new RegExp(escapeRegex(q), "i");

  await connect();
  const [movies, allEvents, allCinemas] = await Promise.all([
    Movie.find({ ...ACTIVE_MOVIE_FILTER, $or: [{ title: pattern }, { genres: pattern }, { languages: pattern }] })
      .sort({ sortOrder: 1 })
      .limit(SEARCH_LIMIT_PER_TYPE)
      .lean(),
    Event.find({ ...ACTIVE_EVENT_FILTER, $or: [{ title: pattern }, { category: pattern }, { venueName: pattern }] })
      .sort({ kind: 1, sortOrder: 1 })
      .limit(SEARCH_LIMIT_PER_TYPE * 2)
      .lean(),
    Venue.find({ kind: "cinema", ...ACTIVE_VENUE_FILTER, $or: [{ name: pattern }, { address: pattern }] })
      .sort({ sortOrder: 1 })
      .limit(SEARCH_LIMIT_PER_TYPE)
      .lean(),
  ]);
  const [events, cinemas] = await Promise.all([visibleOnly(allEvents), visibleOnly(allCinemas)]);

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
