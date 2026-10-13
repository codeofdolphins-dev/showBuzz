import "server-only";
import { SHOW_DATE_WINDOW_DAYS } from "@showbuzz/schemas/constants";
import { addDaysToKey, istDateKey, istDateTime } from "@showbuzz/utils/dates";
import type { Cinema } from "@showbuzz/schemas/venue";
import type { Show, ShowDetails } from "@showbuzz/schemas/types/catalog";
import { cinemas, events, movies } from "@showbuzz/db/seed-catalog";
import { EVENT_SECTION_PATH } from "./catalog.service";

/**
 * Shows are generated from each cinema's daily templates for every now-showing movie, which
 * is how the prototype behaves. In the backend phase they become real `shows` documents.
 */

const SPORT_PREFIX = "sport_";

function toCompactDate(dateKey: string) {
  return dateKey.replaceAll("-", "");
}

function fromCompactDate(compact: string) {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function buildShow(cinema: Cinema, movieId: string, dateKey: string, slot: number): Show | undefined {
  const template = cinema.showTemplates[slot];
  if (!template) return undefined;
  return {
    id: `${cinema.id}_${movieId}_${toCompactDate(dateKey)}_${slot}`,
    movieId,
    cinemaId: cinema.id,
    startsAt: istDateTime(dateKey, template.time).toISOString(),
    format: template.format,
    language: template.language,
    availability: template.availability,
    pricePaise: template.pricePaise,
    priceTier: template.priceTier,
    screenName: template.screenName,
  };
}

export interface CinemaShowtimes {
  cinema: Cinema;
  shows: Show[];
}

/** Showtimes for a movie on an IST date, excluding shows that have already started. */
export async function listShowtimes(movieId: string, dateKey: string, now: Date): Promise<CinemaShowtimes[]> {
  const movie = movies.find((m) => m.id === movieId);
  if (!movie || movie.status !== "now-showing") return [];

  return cinemas.map((cinema) => ({
    cinema,
    shows: cinema.showTemplates
      .map((_, slot) => buildShow(cinema, movie.id, dateKey, slot))
      .filter((s): s is Show => s !== undefined && new Date(s.startsAt) > now),
  }));
}

export function bookableDateKeys(now: Date): string[] {
  const today = istDateKey(now);
  return Array.from({ length: SHOW_DATE_WINDOW_DAYS }, (_, i) => addDaysToKey(today, i));
}

export function sportShowId(eventId: string) {
  return `${SPORT_PREFIX}${eventId}`;
}

/** Resolves an opaque show id. Returns undefined for unknown, malformed or out-of-window ids. */
export async function getShowDetails(showId: string, now: Date): Promise<ShowDetails | undefined> {
  if (showId.startsWith(SPORT_PREFIX)) {
    const event = events.find((e) => e.id === showId.slice(SPORT_PREFIX.length) && e.kind === "sport");
    if (!event || event.schedule.type !== "once") return undefined;
    if (new Date(event.schedule.startsAt) <= now) return undefined;
    return {
      id: showId,
      kind: "sport",
      title: event.title,
      poster: event.poster,
      category: event.category,
      venueName: event.venueName,
      screenName: "Stadium",
      startsAt: new Date(event.schedule.startsAt).toISOString(),
      cancellationAllowed: true,
      backHref: `${EVENT_SECTION_PATH.sport}/${event.slug}`,
    };
  }

  const [cinemaId, movieId, compactDate, slotText] = showId.split("_");
  if (!cinemaId || !movieId || !compactDate || !slotText || !/^\d{8}$/.test(compactDate)) return undefined;

  const dateKey = fromCompactDate(compactDate);
  if (!bookableDateKeys(now).includes(dateKey)) return undefined;

  const cinema = cinemas.find((c) => c.id === cinemaId);
  const movie = movies.find((m) => m.id === movieId && m.status === "now-showing");
  if (!cinema || !movie) return undefined;

  const show = buildShow(cinema, movie.id, dateKey, Number(slotText));
  if (!show || new Date(show.startsAt) <= now) return undefined;

  return {
    id: show.id,
    kind: "movie",
    title: movie.title,
    poster: movie.poster,
    certificate: movie.certificate,
    format: show.format,
    language: show.language,
    venueName: cinema.name,
    venueAddress: cinema.address,
    screenName: show.screenName,
    startsAt: show.startsAt,
    cancellationAllowed: cinema.cancellation.allowed,
    backHref: `/cinemas?movie=${movie.slug}&date=${dateKey}`,
  };
}

/** Base ticket price for a movie show; tier prices on the seat map derive from it. */
export function getShowBasePrice(showId: string): number | undefined {
  const [cinemaId, , , slotText] = showId.split("_");
  const cinema = cinemas.find((c) => c.id === cinemaId);
  return cinema?.showTemplates[Number(slotText)]?.pricePaise;
}
