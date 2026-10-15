import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Genre } from "@showbuzz/db/models/Genre";
import { Language } from "@showbuzz/db/models/Language";
import type { EventKind } from "@showbuzz/schemas/event";
import type { MasterOptions } from "@showbuzz/schemas/master-data";
import {
  EVENT_CATEGORY_OPTIONS,
  MOVIE_GENRE_OPTIONS,
  MOVIE_LANGUAGE_OPTIONS,
} from "@showbuzz/schemas/partner-listing";
import { AppError } from "../http/app-error";

/**
 * Option lists for the movie and event forms in both consoles (prompt 7 master data), read fresh (uncached: the
 * consoles don't use Cache Components). Until `pnpm db:seed` has filled the collections, the lists fall back to the
 * constants the forms used before, so nothing breaks on an unseeded database.
 *
 * Saving a listing accepts only active values, except values the listing already had (an edit never forces a
 * vendor to drop a language or genre that was later switched off).
 */

const EVENT_KINDS: EventKind[] = ["event", "play", "sport", "activity"];

export async function getMasterOptions(): Promise<MasterOptions> {
  await connect();
  const [languages, genres] = await Promise.all([
    Language.find({ status: "active" }, { name: 1 }).sort({ sortOrder: 1, name: 1 }).lean(),
    Genre.find({ status: "active" }, { name: 1, appliesTo: 1 }).sort({ sortOrder: 1, name: 1 }).lean(),
  ]);
  const seeded = (await Language.estimatedDocumentCount()) > 0 || (await Genre.estimatedDocumentCount()) > 0;
  if (!seeded) {
    return {
      languages: [...MOVIE_LANGUAGE_OPTIONS],
      movieGenres: [...MOVIE_GENRE_OPTIONS],
      eventCategories: Object.fromEntries(EVENT_KINDS.map((k) => [k, [...EVENT_CATEGORY_OPTIONS[k]]])) as Record<
        EventKind,
        string[]
      >,
    };
  }
  const named = (scope: string) => genres.filter((g) => g.appliesTo === scope).map((g) => g.name);
  return {
    languages: languages.map((l) => l.name),
    movieGenres: named("movie"),
    eventCategories: Object.fromEntries(EVENT_KINDS.map((k) => [k, named(k)])) as Record<EventKind, string[]>,
  };
}

function offList(values: readonly string[], allowed: readonly string[], kept: readonly string[]): string[] {
  const ok = new Set([...allowed, ...kept].map((v) => v.toLowerCase()));
  return values.filter((v) => !ok.has(v.toLowerCase()));
}

function rejected(field: string, values: string[], what: string): AppError {
  const message = `${values.join(", ")} ${values.length === 1 ? "isn't" : "aren't"} on the ${what} list. Pick from the list, or ask ShowBuzz to add it.`;
  return new AppError("VALIDATION_FAILED", message, 422, { fieldErrors: { [field]: [message] } });
}

/** A movie's languages and genres must come from the active lists (or be values it already had). */
export async function assertMovieOptions(
  input: { languages: string[]; genres: string[] },
  previous?: { languages: string[]; genres: string[] },
): Promise<void> {
  const options = await getMasterOptions();
  const badLanguages = offList(input.languages, options.languages, previous?.languages ?? []);
  if (badLanguages.length > 0) throw rejected("languages", badLanguages, "language");
  const badGenres = offList(input.genres, options.movieGenres, previous?.genres ?? []);
  if (badGenres.length > 0) throw rejected("genres", badGenres, "genre");
}

/** An event's category must be an active category of its kind (or the category it already had). */
export async function assertEventCategory(kind: EventKind, category: string, previous?: string): Promise<void> {
  const options = await getMasterOptions();
  const bad = offList([category], options.eventCategories[kind], previous ? [previous] : []);
  if (bad.length > 0) throw rejected("category", bad, "category");
}
