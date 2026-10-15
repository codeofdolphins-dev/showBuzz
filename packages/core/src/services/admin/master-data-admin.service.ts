import "server-only";
import { connect } from "@showbuzz/db/connect";
import { City } from "@showbuzz/db/models/City";
import { Event } from "@showbuzz/db/models/Event";
import { Genre } from "@showbuzz/db/models/Genre";
import { Language } from "@showbuzz/db/models/Language";
import { Movie } from "@showbuzz/db/models/Movie";
import { LIVE_SHOW_FILTER, Show } from "@showbuzz/db/models/Show";
import { ACTIVE_VENUE_FILTER, Venue } from "@showbuzz/db/models/Venue";
import type { Model, Types } from "@showbuzz/db/mongoose";
import {
  type GenreScope,
  cityInputSchema,
  genreInputSchema,
  genreScopeSchema,
  languageInputSchema,
  reorderSchema,
} from "@showbuzz/schemas/master-data";
import type { AdminCityRow, GenreRow, LanguageRow } from "@showbuzz/schemas/types/admin-platform";
import { addDaysToKey, istDateKey, istDateTime } from "@showbuzz/utils/dates";
import { AppError } from "../../http/app-error";
import { changedKeys, idOr404, isDuplicateKey } from "./shared";

/**
 * Master data (prompt 7): cities, languages and genres. Records are switched off, never deleted (venues, events and
 * listings refer to them). City slugs are fixed once created; a language or genre rename is carried into every
 * movie, event and show that stores the old name, in one transaction.
 */

const conflict = (field: string, message: string) => new AppError("CONFLICT", message, 409, { fieldErrors: { [field]: [message] } });

/**
 * Moves one record up or down among `group` (renumbering the group 1..n so equal sort orders can't stall a move).
 * Lists here are small (tens of records), so reading the group is fine.
 */
export async function moveInOrder<T extends { sortOrder: number }>(
  model: Model<T>,
  group: Record<string, unknown>,
  input: unknown,
): Promise<{ moved: boolean }> {
  const { id, direction } = reorderSchema.parse(input);
  await connect();
  const docs = await model.find(group, { _id: 1 }).sort({ sortOrder: 1, _id: 1 }).lean<{ _id: Types.ObjectId }[]>();
  const index = docs.findIndex((d) => d._id.toString() === id);
  if (index < 0) throw new AppError("NOT_FOUND", "That record no longer exists.", 404);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= docs.length) return { moved: false };
  const order = docs.map((d) => d._id);
  [order[index], order[target]] = [order[target]!, order[index]!];
  await model.bulkWrite(
    order.map((_id, i) => ({ updateOne: { filter: { _id }, update: { $set: { sortOrder: i + 1 } } } })) as never,
  );
  return { moved: true };
}

async function nextSortOrder<T extends { sortOrder: number }>(model: Model<T>, group: Record<string, unknown> = {}) {
  const last = await model.findOne(group, { sortOrder: 1 }).sort({ sortOrder: -1 }).lean<{ sortOrder: number } | null>();
  return (last?.sortOrder ?? 0) + 1;
}

// ---------------------------------------------------------------------------------------------------------------
// Cities

export async function listCitiesAdmin(now: Date): Promise<AdminCityRow[]> {
  await connect();
  const todayKey = istDateKey(now);
  const [cities, venues] = await Promise.all([
    City.find().sort({ sortOrder: 1, name: 1 }).lean(),
    Venue.find({ ...ACTIVE_VENUE_FILTER }, { cityId: 1, kind: 1 }).lean(),
  ]);
  const shows = await Show.aggregate<{ _id: Types.ObjectId; n: number }>([
    {
      $match: {
        ...LIVE_SHOW_FILTER,
        startsAt: { $gte: istDateTime(todayKey, "00:00"), $lt: istDateTime(addDaysToKey(todayKey, 1), "00:00") },
      },
    },
    { $group: { _id: "$venueId", n: { $sum: 1 } } },
  ]);
  const venueCity = new Map(venues.map((v) => [v._id.toString(), v.cityId]));
  const cinemas = new Map<string, number>();
  for (const v of venues) if (v.kind === "cinema") cinemas.set(v.cityId, (cinemas.get(v.cityId) ?? 0) + 1);
  const todayShows = new Map<string, number>();
  for (const s of shows) {
    const city = venueCity.get(s._id.toString());
    if (city) todayShows.set(city, (todayShows.get(city) ?? 0) + s.n);
  }
  return cities.map((c) => ({
    id: c._id.toString(),
    slug: c.slug,
    name: c.name,
    state: c.state ?? "",
    tier: c.tier ?? "other",
    popular: c.popular,
    status: c.status ?? "active",
    cinemas: cinemas.get(c.slug) ?? 0,
    todayShows: todayShows.get(c.slug) ?? 0,
  }));
}

export async function createCity(input: unknown): Promise<{ id: string; name: string }> {
  const data = cityInputSchema.parse(input);
  await connect();
  try {
    const doc = await City.create({
      name: data.name,
      slug: data.slug,
      ...(data.state ? { state: data.state } : {}),
      tier: data.tier,
      popular: data.popular,
      status: data.status,
      sortOrder: await nextSortOrder(City),
    });
    return { id: doc._id.toString(), name: doc.name };
  } catch (err) {
    if (isDuplicateKey(err)) throw conflict("slug", "Another city already uses this URL name.");
    throw err;
  }
}

/** The slug can't change (venues, events and saved city choices point at it). */
export async function updateCity(cityId: string, input: unknown): Promise<{ name: string; changedFields: string[] }> {
  const _id = idOr404(cityId, "City");
  const data = cityInputSchema.parse(input);
  await connect();
  const before = await City.findById(_id).lean();
  if (!before) throw new AppError("NOT_FOUND", "City not found.", 404);
  if (data.slug !== before.slug) throw conflict("slug", "A city's URL name can't change once created.");
  if (data.status === "inactive" && before.status !== "inactive") {
    const venues = await Venue.countDocuments({ cityId: before.slug, ...ACTIVE_VENUE_FILTER });
    if (venues > 0) {
      throw conflict(
        "status",
        `${venues} active venue${venues === 1 ? " is" : "s are"} in ${before.name}. Vendors must switch them off first.`,
      );
    }
  }
  const next = { name: data.name, state: data.state, tier: data.tier, popular: data.popular, status: data.status };
  const { state, ...rest } = next;
  await City.updateOne({ _id }, state ? { $set: next } : { $set: rest, $unset: { state: 1 } });
  return {
    name: data.name,
    changedFields: changedKeys(
      {
        name: before.name,
        state: before.state ?? "",
        tier: before.tier ?? "other",
        popular: before.popular,
        status: before.status ?? "active",
      },
      next,
    ),
  };
}

export const moveCity = (input: unknown) => moveInOrder(City, {}, input);

// ---------------------------------------------------------------------------------------------------------------
// Languages

export async function listLanguagesAdmin(): Promise<LanguageRow[]> {
  await connect();
  const [docs, usage] = await Promise.all([
    Language.find().sort({ sortOrder: 1, name: 1 }).lean(),
    Movie.aggregate<{ _id: string; n: number }>([
      { $match: { archivedAt: { $exists: false } } },
      { $unwind: "$languages" },
      { $group: { _id: "$languages", n: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(usage.map((u) => [u._id.toLowerCase(), u.n]));
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    nativeName: d.nativeName,
    status: d.status,
    movies: counts.get(d.name.toLowerCase()) ?? 0,
  }));
}

export async function createLanguage(input: unknown): Promise<{ id: string; name: string }> {
  const data = languageInputSchema.parse(input);
  await connect();
  try {
    const doc = await Language.create({ ...data, sortOrder: await nextSortOrder(Language) });
    return { id: doc._id.toString(), name: doc.name };
  } catch (err) {
    if (isDuplicateKey(err)) throw conflict("name", "This language is already on the list.");
    throw err;
  }
}

/** A rename rewrites the name on movies (`languages`), events (`language`), shows and cinema show templates. */
export async function updateLanguage(
  languageId: string,
  input: unknown,
): Promise<{ name: string; changedFields: string[]; renamed: boolean }> {
  const _id = idOr404(languageId, "Language");
  const data = languageInputSchema.parse(input);
  const mongoose = await connect();
  const before = await Language.findById(_id).lean();
  if (!before) throw new AppError("NOT_FOUND", "Language not found.", 404);
  const renamed = before.name !== data.name;
  try {
    await mongoose.connection.transaction(async (session) => {
      await Language.updateOne({ _id }, { $set: data }, { session });
      if (!renamed) return;
      const from = before.name;
      await Movie.updateMany(
        { languages: from },
        { $set: { "languages.$[l]": data.name } },
        { arrayFilters: [{ l: from }], session },
      );
      await Event.updateMany({ language: from }, { $set: { language: data.name } }, { session });
      await Show.updateMany({ language: from }, { $set: { language: data.name } }, { session });
      await Venue.updateMany(
        { "showTemplates.language": from },
        { $set: { "showTemplates.$[t].language": data.name } },
        { arrayFilters: [{ "t.language": from }], session },
      );
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw conflict("name", "This language is already on the list.");
    throw err;
  }
  return {
    name: data.name,
    renamed,
    changedFields: changedKeys(
      { name: before.name, nativeName: before.nativeName, status: before.status },
      { ...data },
    ),
  };
}

export const moveLanguage = (input: unknown) => moveInOrder(Language, {}, input);

// ---------------------------------------------------------------------------------------------------------------
// Genres

export async function listGenresAdmin(scope?: GenreScope): Promise<GenreRow[]> {
  await connect();
  const filter = scope ? { appliesTo: scope } : {};
  const [docs, movieUsage, eventUsage] = await Promise.all([
    Genre.find(filter).sort({ appliesTo: 1, sortOrder: 1, name: 1 }).lean(),
    Movie.aggregate<{ _id: string; n: number }>([
      { $match: { archivedAt: { $exists: false } } },
      { $unwind: "$genres" },
      { $group: { _id: "$genres", n: { $sum: 1 } } },
    ]),
    Event.aggregate<{ _id: { kind: string; category: string }; n: number }>([
      { $group: { _id: { kind: "$kind", category: "$category" }, n: { $sum: 1 } } },
    ]),
  ]);
  const movies = new Map(movieUsage.map((u) => [u._id.toLowerCase(), u.n]));
  const events = new Map(eventUsage.map((u) => [`${u._id.kind}:${u._id.category.toLowerCase()}`, u.n]));
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    slug: d.slug,
    appliesTo: d.appliesTo,
    status: d.status,
    listings:
      d.appliesTo === "movie"
        ? (movies.get(d.name.toLowerCase()) ?? 0)
        : (events.get(`${d.appliesTo}:${d.name.toLowerCase()}`) ?? 0),
  }));
}

export async function createGenre(input: unknown): Promise<{ id: string; name: string }> {
  const data = genreInputSchema.parse(input);
  await connect();
  try {
    const doc = await Genre.create({ ...data, sortOrder: await nextSortOrder(Genre, { appliesTo: data.appliesTo }) });
    return { id: doc._id.toString(), name: doc.name };
  } catch (err) {
    if (isDuplicateKey(err)) throw conflict("name", "This genre already exists for that section (name or URL name).");
    throw err;
  }
}

/** Where a genre applies is fixed once created; a rename rewrites movie genres or event categories. */
export async function updateGenre(
  genreId: string,
  input: unknown,
): Promise<{ name: string; changedFields: string[]; renamed: boolean; appliesTo: GenreScope }> {
  const _id = idOr404(genreId, "Genre");
  const data = genreInputSchema.parse(input);
  const mongoose = await connect();
  const before = await Genre.findById(_id).lean();
  if (!before) throw new AppError("NOT_FOUND", "Genre not found.", 404);
  if (data.appliesTo !== before.appliesTo) {
    throw conflict("appliesTo", "Where a genre applies can't change; add a new one instead.");
  }
  const renamed = before.name !== data.name;
  try {
    await mongoose.connection.transaction(async (session) => {
      await Genre.updateOne({ _id }, { $set: data }, { session });
      if (!renamed) return;
      if (before.appliesTo === "movie") {
        await Movie.updateMany(
          { genres: before.name },
          { $set: { "genres.$[g]": data.name } },
          { arrayFilters: [{ g: before.name }], session },
        );
      } else {
        await Event.updateMany(
          { kind: before.appliesTo, category: before.name },
          { $set: { category: data.name } },
          { session },
        );
      }
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw conflict("name", "This genre already exists for that section (name or URL name).");
    throw err;
  }
  return {
    name: data.name,
    renamed,
    appliesTo: before.appliesTo,
    changedFields: changedKeys(
      { name: before.name, slug: before.slug, appliesTo: before.appliesTo, status: before.status },
      { ...data },
    ),
  };
}

export async function moveGenre(input: unknown): Promise<{ moved: boolean }> {
  const { id } = reorderSchema.parse(input);
  const _id = idOr404(id, "Genre");
  await connect();
  const genre = await Genre.findById(_id, { appliesTo: 1 }).lean();
  if (!genre) throw new AppError("NOT_FOUND", "Genre not found.", 404);
  return moveInOrder(Genre, { appliesTo: genreScopeSchema.parse(genre.appliesTo) }, input);
}
