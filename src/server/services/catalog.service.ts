import "server-only";
import type { EventKind, EventListing } from "@/schemas/event";
import type { Movie } from "@/schemas/movie";
import type { SearchEntry } from "@/types/catalog";
import {
  cinemas,
  cities,
  coupons,
  events,
  foodItems,
  giftCardDesigns,
  movies,
  streamTitles,
} from "@/server/data/seed-catalog";

/**
 * Read access to the catalogue. Async on purpose: callers already await these, so swapping the
 * seed arrays for Mongoose queries in the backend phase does not touch any page.
 */

export const EVENT_SECTION_PATH: Record<EventKind, string> = {
  event: "/events",
  play: "/plays",
  sport: "/sports",
  activity: "/activities",
};

export async function listCities() {
  return cities;
}

export async function listMovies(): Promise<Movie[]> {
  return movies;
}

export async function getMovieBySlug(slug: string): Promise<Movie | undefined> {
  return movies.find((m) => m.slug === slug);
}

export async function getMovieById(id: string): Promise<Movie | undefined> {
  return movies.find((m) => m.id === id);
}

export async function listCinemas() {
  return cinemas;
}

export async function getCinemaById(id: string) {
  return cinemas.find((c) => c.id === id);
}

export async function listEvents(kind: EventKind): Promise<EventListing[]> {
  return events.filter((e) => e.kind === kind);
}

export async function getEventBySlug(kind: EventKind, slug: string): Promise<EventListing | undefined> {
  return events.find((e) => e.kind === kind && e.slug === slug);
}

export async function getEventById(id: string): Promise<EventListing | undefined> {
  return events.find((e) => e.id === id);
}

export async function listCoupons() {
  return coupons;
}

export async function getCouponByCode(code: string) {
  return coupons.find((c) => c.code === code.toUpperCase());
}

export async function listFoodItems() {
  return foodItems;
}

export async function listStreamTitles() {
  return streamTitles;
}

export async function listGiftCardDesigns() {
  return giftCardDesigns;
}

/** Everything the header search can match, small enough to ship to the client once. */
export async function getSearchIndex(): Promise<SearchEntry[]> {
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
