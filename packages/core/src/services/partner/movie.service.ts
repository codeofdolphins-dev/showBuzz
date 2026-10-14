import "server-only";
import { connect } from "@showbuzz/db/connect";
import { ACTIVE_MOVIE_FILTER, Movie, type MovieAttrs, toMovie } from "@showbuzz/db/models/Movie";
import { LIVE_SHOW_FILTER, Show } from "@showbuzz/db/models/Show";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { VendorMovie } from "@showbuzz/db/models/VendorMovie";
import { Types } from "@showbuzz/db/mongoose";
import type { MovieStatus } from "@showbuzz/schemas/movie";
import { type MovieInput, movieInputSchema, movieSearchSchema } from "@showbuzz/schemas/partner-listing";
import type {
  MovieOption,
  MovieSearchHit,
  VendorMovieDetail,
  VendorMovieRow,
} from "@showbuzz/schemas/types/partner-listing";
import { escapeRegex } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { changedKeys, isDuplicateKey, toObjectId } from "./ids";

/**
 * Movies are one shared catalogue (one public page per film, every vendor's cinemas listed on it). A vendor keeps
 * a "My movies" list (`vendorMovies` links) of the films it schedules: it adds an existing film from a catalogue
 * search, or creates a new one (which joins its list). Only the creating vendor (and the super-admin, prompt 6) may
 * edit a film; everyone else sees it read-only. Vendors never delete films: they only take them off their list.
 */

type LeanMovie = MovieAttrs & { _id: Types.ObjectId };

const NOT_FOUND = () => new AppError("NOT_FOUND", "This movie doesn't exist.", 404);
const NOT_EDITABLE = () =>
  new AppError("FORBIDDEN", "Only the partner that added this film to ShowBuzz can edit it.", 403);

const vendorObjectId = (vendorId: string) => new Types.ObjectId(vendorId);

async function upcomingShowCounts(vendorId: string, movieIds: Types.ObjectId[], now: Date) {
  if (movieIds.length === 0) return new Map<string, number>();
  const counts = await Show.aggregate<{ _id: Types.ObjectId; n: number }>([
    {
      $match: {
        vendorId: vendorObjectId(vendorId),
        movieId: { $in: movieIds },
        startsAt: { $gt: now },
        ...LIVE_SHOW_FILTER,
      },
    },
    { $group: { _id: "$movieId", n: { $sum: 1 } } },
  ]);
  return new Map(counts.map((c) => [c._id.toString(), c.n]));
}

async function linkedMovieIds(vendorId: string): Promise<Types.ObjectId[]> {
  const links = await VendorMovie.find({ vendorId: vendorObjectId(vendorId) }, { movieId: 1 }).lean();
  return links.map((l) => l.movieId);
}

const isOwn = (movie: Pick<LeanMovie, "createdByVendorId">, vendorId: string) =>
  movie.createdByVendorId?.toString() === vendorId;

// ---------------------------------------------------------------------------------------------------------------
// Lists

export const MOVIE_SORT_FIELDS = ["title", "releaseDate", "durationMinutes", "createdAt"] as const;

export interface MovieListQuery {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
  status?: MovieStatus;
  language?: string;
}

/** The vendor's "My movies" list. */
export async function listVendorMovies(
  vendorId: string,
  query: MovieListQuery,
  now: Date,
): Promise<{ rows: VendorMovieRow[]; total: number }> {
  await connect();
  const ids = await linkedMovieIds(vendorId);
  const filter: Record<string, unknown> = { _id: { $in: ids } };
  if (query.status) filter.status = query.status;
  if (query.language) filter.languages = query.language;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ title: pattern }, { genres: pattern }, { slug: pattern }];
  }
  const field = (MOVIE_SORT_FIELDS as readonly string[]).includes(query.sort.field) ? query.sort.field : "title";
  const [docs, total] = await Promise.all([
    Movie.find(filter, { reviews: 0, cast: 0, crew: 0 })
      .sort({ [field]: query.sort.direction === "desc" ? -1 : 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Movie.countDocuments(filter),
  ]);
  const counts = await upcomingShowCounts(
    vendorId,
    docs.map((d) => d._id),
    now,
  );
  return {
    total,
    rows: docs.map((doc) => ({
      id: doc._id.toString(),
      slug: doc.slug,
      title: doc.title,
      poster: doc.poster,
      genres: [...doc.genres],
      languages: [...doc.languages],
      formats: [...doc.formats],
      certificate: doc.certificate,
      durationMinutes: doc.durationMinutes,
      releaseDate: doc.releaseDate,
      rating: doc.rating,
      status: doc.status,
      own: isOwn(doc, vendorId),
      upcomingShows: counts.get(doc._id.toString()) ?? 0,
    })),
  };
}

/** Distinct languages on the vendor's list (the list filter). */
export async function listVendorMovieLanguages(vendorId: string): Promise<string[]> {
  await connect();
  const ids = await linkedMovieIds(vendorId);
  const languages = await Movie.distinct("languages", { _id: { $in: ids } });
  return (languages as string[]).sort();
}

/** "Add movie": the whole catalogue by title, language and release year (20 best by editorial order). */
export async function searchCatalogMovies(vendorId: string, raw: unknown): Promise<MovieSearchHit[]> {
  const input = movieSearchSchema.parse(raw);
  if (!input.q && !input.language && !input.year) return [];
  await connect();
  const filter: Record<string, unknown> = { ...ACTIVE_MOVIE_FILTER };
  if (input.q) filter.title = new RegExp(escapeRegex(input.q), "i");
  if (input.language) filter.languages = new RegExp(`^${escapeRegex(input.language)}$`, "i");
  if (input.year) filter.releaseDate = new RegExp(`^${input.year}-`);
  const [docs, ids] = await Promise.all([
    Movie.find(filter, {
      title: 1,
      poster: 1,
      languages: 1,
      releaseDate: 1,
      certificate: 1,
      durationMinutes: 1,
      status: 1,
    })
      .sort({ sortOrder: 1, title: 1 })
      .limit(20)
      .lean(),
    linkedMovieIds(vendorId),
  ]);
  const added = new Set(ids.map((id) => id.toString()));
  return docs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    poster: doc.poster,
    languages: [...doc.languages],
    year: doc.releaseDate.slice(0, 4),
    certificate: doc.certificate,
    durationMinutes: doc.durationMinutes,
    status: doc.status,
    added: added.has(doc._id.toString()),
  }));
}

const normalise = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Films whose title looks like `title` (same words ignoring case and punctuation, one containing the other, or
 * most significant words shared): the "possible duplicates" warning on the movie form. A warning, never a block.
 */
export async function findPossibleDuplicates(
  rawTitle: string,
  exceptId?: string,
): Promise<{ id: string; title: string; year: string; languages: string[] }[]> {
  const title = normalise(rawTitle.slice(0, 150));
  if (title.length < 3) return [];
  const words = title.split(" ").filter((w) => w.length >= 3);
  const longest = [...words].sort((a, b) => b.length - a.length)[0] ?? title;
  await connect();
  const candidates = await Movie.find(
    { title: new RegExp(escapeRegex(longest), "i"), ...ACTIVE_MOVIE_FILTER },
    { title: 1, releaseDate: 1, languages: 1 },
  )
    .limit(50)
    .lean();
  return candidates
    .filter((m) => m._id.toString() !== exceptId)
    .filter((m) => {
      const other = normalise(m.title);
      if (other.includes(title) || title.includes(other)) return true;
      const otherWords = new Set(other.split(" ").filter((w) => w.length >= 3));
      const shared = words.filter((w) => otherWords.has(w)).length;
      return words.length > 0 && shared / Math.max(words.length, otherWords.size) >= 0.6;
    })
    .slice(0, 8)
    .map((m) => ({
      id: m._id.toString(),
      title: m.title,
      year: m.releaseDate.slice(0, 4),
      languages: [...m.languages],
    }));
}

/** The vendor's films for the show forms (with what a show needs: running time, languages, formats). */
export async function listVendorMovieOptions(vendorId: string): Promise<MovieOption[]> {
  await connect();
  const ids = await linkedMovieIds(vendorId);
  const docs = await Movie.find({ _id: { $in: ids } }, { title: 1, durationMinutes: 1, languages: 1, formats: 1 })
    .sort({ title: 1 })
    .lean();
  return docs.map((m) => ({
    id: m._id.toString(),
    title: m.title,
    durationMinutes: m.durationMinutes,
    languages: [...m.languages],
    formats: [...m.formats],
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// One movie

function toValues(doc: LeanMovie): MovieInput {
  return {
    title: doc.title,
    slug: doc.slug,
    synopsis: doc.synopsis,
    durationMinutes: doc.durationMinutes,
    certificate: doc.certificate as MovieInput["certificate"],
    languages: [...doc.languages],
    genres: [...doc.genres],
    formats: [...doc.formats],
    releaseDate: doc.releaseDate,
    status: doc.status,
    poster: doc.poster,
    backdrop: doc.backdrop,
    trailerUrl: doc.trailerUrl,
    director: doc.director,
    cast: doc.cast.map((c) => ({ name: c.name, role: c.role, image: c.image })),
    crew: doc.crew.map((c) => ({ name: c.name, role: c.role })),
  };
}

/** Any catalogue film (the catalogue is shared and public); `values` only for the vendor that created it. */
export async function getVendorMovie(vendorId: string, movieId: string, now: Date): Promise<VendorMovieDetail | null> {
  const _id = toObjectId(movieId);
  if (!_id) return null;
  await connect();
  const [doc, link, counts] = await Promise.all([
    Movie.findById(_id).lean(),
    VendorMovie.exists({ vendorId: vendorObjectId(vendorId), movieId: _id }),
    upcomingShowCounts(vendorId, [_id], now),
  ]);
  if (!doc) return null;
  const own = isOwn(doc, vendorId);
  const creator = doc.createdByVendorId
    ? await Vendor.findById(doc.createdByVendorId, { businessName: 1 }).lean()
    : null;
  return {
    movie: toMovie(doc),
    own,
    added: Boolean(link),
    createdBy: own ? "You" : (creator?.businessName ?? "ShowBuzz"),
    upcomingShows: counts.get(movieId) ?? 0,
    ...(own ? { values: toValues(doc) } : {}),
  };
}

export async function addMovieToVendor(vendorId: string, movieId: string): Promise<{ title: string; added: boolean }> {
  const _id = toObjectId(movieId);
  if (!_id) throw NOT_FOUND();
  await connect();
  // A film merged into another can't be added again (its shows and lists moved to the kept film).
  const movie = await Movie.findOne({ _id, ...ACTIVE_MOVIE_FILTER }, { title: 1 }).lean();
  if (!movie) throw NOT_FOUND();
  const result = await VendorMovie.updateOne(
    { vendorId: vendorObjectId(vendorId), movieId: _id },
    { $setOnInsert: { vendorId: vendorObjectId(vendorId), movieId: _id } },
    { upsert: true },
  );
  return { title: movie.title, added: result.upsertedCount === 1 };
}

/** Takes a film off the vendor's list; refused while the vendor still has upcoming shows of it. */
export async function removeMovieFromVendor(vendorId: string, movieId: string, now: Date): Promise<{ title: string }> {
  const _id = toObjectId(movieId);
  if (!_id) throw NOT_FOUND();
  await connect();
  const movie = await Movie.findById(_id, { title: 1 }).lean();
  if (!movie) throw NOT_FOUND();
  const upcoming = (await upcomingShowCounts(vendorId, [_id], now)).get(movieId) ?? 0;
  if (upcoming > 0) {
    throw new AppError(
      "CONFLICT",
      `You have ${upcoming} upcoming show${upcoming === 1 ? "" : "s"} of this film. Cancel them first.`,
      409,
    );
  }
  await VendorMovie.deleteOne({ vendorId: vendorObjectId(vendorId), movieId: _id });
  return { title: movie.title };
}

const slugTaken = () =>
  new AppError("CONFLICT", "That URL name is already used by another film.", 409, {
    fieldErrors: { slug: ["Already used by another film on ShowBuzz: pick another"] },
  });

function movieFields(input: MovieInput) {
  return {
    title: input.title,
    slug: input.slug,
    synopsis: input.synopsis,
    durationMinutes: input.durationMinutes,
    certificate: input.certificate,
    languages: [...new Set(input.languages)],
    genres: [...new Set(input.genres)],
    formats: [...new Set(input.formats)],
    releaseDate: input.releaseDate,
    status: input.status,
    poster: input.poster,
    backdrop: input.backdrop,
    trailerUrl: input.trailerUrl,
    director: input.director,
    cast: input.cast,
    crew: input.crew,
  };
}

/** A new catalogue film created by this vendor (and put on its list). Editorial fields start empty. */
export async function createMovie(vendorId: string, raw: unknown): Promise<{ id: string; changedFields: string[] }> {
  const input = movieInputSchema.parse(raw);
  await connect();
  if (await Movie.exists({ slug: input.slug })) throw slugTaken();
  const last = await Movie.findOne({}, { sortOrder: 1 }).sort({ sortOrder: -1 }).lean();
  const fields = movieFields(input);
  try {
    const doc = await Movie.create({
      ...fields,
      rating: 0,
      votesLabel: "",
      isTrending: false,
      reviews: [],
      userRatingCount: 0,
      userRatingSum: 0,
      createdByVendorId: vendorObjectId(vendorId),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    });
    await VendorMovie.updateOne(
      { vendorId: vendorObjectId(vendorId), movieId: doc._id },
      { $setOnInsert: { vendorId: vendorObjectId(vendorId), movieId: doc._id } },
      { upsert: true },
    );
    return { id: doc._id.toString(), changedFields: Object.keys(fields) };
  } catch (err) {
    if (isDuplicateKey(err)) throw slugTaken();
    throw err;
  }
}

/**
 * Edits a film this vendor created. A new running time applies to shows scheduled from now on (existing shows keep
 * their end time).
 */
export async function updateMovie(
  vendorId: string,
  movieId: string,
  raw: unknown,
): Promise<{ changedFields: string[] }> {
  const input = movieInputSchema.parse(raw);
  const _id = toObjectId(movieId);
  if (!_id) throw NOT_FOUND();
  await connect();
  const doc = await Movie.findById(_id).lean();
  if (!doc) throw NOT_FOUND();
  if (!isOwn(doc, vendorId)) throw NOT_EDITABLE();
  if (await Movie.exists({ slug: input.slug, _id: { $ne: _id } })) throw slugTaken();
  const next = movieFields(input);
  const changedFields = changedKeys(movieFields(toValues(doc)), next);
  if (changedFields.length === 0) return { changedFields };
  try {
    // Conditional on the creator, so a merge or ownership change in between can't be overwritten.
    const result = await Movie.updateOne({ _id, createdByVendorId: vendorObjectId(vendorId) }, { $set: next });
    if (result.matchedCount !== 1) throw NOT_EDITABLE();
  } catch (err) {
    if (isDuplicateKey(err)) throw slugTaken();
    throw err;
  }
  return { changedFields };
}
