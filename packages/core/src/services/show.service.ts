import "server-only";
import { cache } from "react";
import { connect } from "@showbuzz/db/connect";
import { Show as ShowModel, type ShowAttrs } from "@showbuzz/db/models/Show";
import { ensureMovieShows } from "@showbuzz/db/shows";
import { log } from "@showbuzz/runtime/log";
import { objectIdSchema } from "@showbuzz/schemas/common";
import { SHOW_DATE_WINDOW_DAYS } from "@showbuzz/schemas/constants";
import type { Show, ShowDetails } from "@showbuzz/schemas/types/catalog";
import type { Cinema } from "@showbuzz/schemas/venue";
import { addDaysToKey, istDateKey, istDateTime } from "@showbuzz/utils/dates";
import { EVENT_SECTION_PATH, getEventById, getMovieById, listCinemas } from "./catalog.service";

/**
 * Showtimes are real `shows` documents. They are created lazily: the first showtimes request for a date
 * on each server instance upserts that date's shows from the cinemas' templates (idempotent), so the demo
 * never runs out of shows and needs no cron job. Everything here is time-dependent and stays uncached.
 */

type LeanShow = ShowAttrs & { _id: { toString(): string } };

const globalStore = globalThis as unknown as { __showbuzzEnsuredShowDates?: Map<string, Promise<void>> };
const ensuredDates = (globalStore.__showbuzzEnsuredShowDates ??= new Map<string, Promise<void>>());

async function ensureShowsForDate(dateKey: string): Promise<void> {
  let pending = ensuredDates.get(dateKey);
  if (!pending) {
    pending = connect()
      .then(() => ensureMovieShows([dateKey]))
      .then((inserted) => {
        if (inserted > 0) log.info("Shows generated", { dateKey, inserted });
      });
    ensuredDates.set(dateKey, pending);
    // A failed run is retried by the next request instead of being remembered.
    pending.catch(() => ensuredDates.delete(dateKey));
  }
  try {
    await pending;
  } catch (err) {
    log.warn("Show generation failed; listing existing shows", { dateKey, err });
  }
}

function toShow(doc: LeanShow): Show {
  return {
    id: doc._id.toString(),
    movieId: doc.movieId?.toString() ?? "",
    cinemaId: doc.venueId.toString(),
    startsAt: doc.startsAt.toISOString(),
    format: doc.format ?? "",
    language: doc.language ?? "",
    availability: doc.availability,
    pricePaise: doc.pricePaise,
    priceTier: doc.priceTier ?? "",
    screenName: doc.screenName,
  };
}

/** One show document by id, once per request (the seat page and the order quote both need it). */
export const findShow = cache(async (showId: string): Promise<LeanShow | undefined> => {
  if (!objectIdSchema.safeParse(showId).success) return undefined;
  await connect();
  return (await ShowModel.findById(showId).lean()) ?? undefined;
});

export interface CinemaShowtimes {
  cinema: Cinema;
  shows: Show[];
}

export function bookableDateKeys(now: Date): string[] {
  const today = istDateKey(now);
  return Array.from({ length: SHOW_DATE_WINDOW_DAYS }, (_, i) => addDaysToKey(today, i));
}

/** Showtimes for a movie on an IST date, excluding shows that have already started. */
export async function listShowtimes(movieId: string, dateKey: string, now: Date): Promise<CinemaShowtimes[]> {
  const movie = await getMovieById(movieId);
  if (!movie || movie.status !== "now-showing" || !bookableDateKeys(now).includes(dateKey)) return [];

  await ensureShowsForDate(dateKey);
  const dayStart = istDateTime(dateKey, "00:00");
  const dayEnd = istDateTime(addDaysToKey(dateKey, 1), "00:00");
  const from = dayStart > now ? dayStart : now;

  const [cinemas, shows] = await Promise.all([
    listCinemas(),
    ShowModel.find({ movieId: movie.id, startsAt: { $gt: from, $lt: dayEnd } })
      .sort({ startsAt: 1 })
      .lean(),
  ]);
  return cinemas.map((cinema) => ({
    cinema,
    shows: shows.filter((s) => s.venueId.toString() === cinema.id).map(toShow),
  }));
}

/** Resolves a show id. Returns undefined for unknown, started or out-of-window shows. */
export async function getShowDetails(showId: string, now: Date): Promise<ShowDetails | undefined> {
  const show = await findShow(showId);
  if (!show || show.startsAt <= now) return undefined;
  const startsAt = show.startsAt.toISOString();

  if (show.eventId) {
    const event = await getEventById(show.eventId.toString());
    if (!event || event.kind !== "sport") return undefined;
    return {
      id: showId,
      kind: "sport",
      title: event.title,
      poster: event.poster,
      category: event.category,
      venueName: event.venueName,
      screenName: show.screenName,
      startsAt,
      cancellationAllowed: true,
      backHref: `${EVENT_SECTION_PATH.sport}/${event.slug}`,
    };
  }

  const dateKey = istDateKey(show.startsAt);
  if (!show.movieId || !bookableDateKeys(now).includes(dateKey)) return undefined;
  const [movie, cinemas] = await Promise.all([getMovieById(show.movieId.toString()), listCinemas()]);
  const cinema = cinemas.find((c) => c.id === show.venueId.toString());
  if (!movie || movie.status !== "now-showing" || !cinema) return undefined;

  return {
    id: showId,
    kind: "movie",
    title: movie.title,
    poster: movie.poster,
    certificate: movie.certificate,
    format: show.format,
    language: show.language,
    venueName: cinema.name,
    venueAddress: cinema.address,
    screenName: show.screenName,
    startsAt,
    cancellationAllowed: cinema.cancellation.allowed,
    backHref: `/cinemas?movie=${movie.slug}&date=${dateKey}`,
  };
}
