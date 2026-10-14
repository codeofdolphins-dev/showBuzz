import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { Coupon } from "@showbuzz/db/models/Coupon";
import { ACTIVE_MOVIE_FILTER, Movie, type MovieAttrs } from "@showbuzz/db/models/Movie";
import { Review } from "@showbuzz/db/models/Review";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { LIVE_SHOW_FILTER, Show } from "@showbuzz/db/models/Show";
import { VendorMovie } from "@showbuzz/db/models/VendorMovie";
import { WishlistItem } from "@showbuzz/db/models/WishlistItem";
import { type ClientSession, Types } from "@showbuzz/db/mongoose";
import { log } from "@showbuzz/runtime/log";
import { movieMergeSchema } from "@showbuzz/schemas/admin-marketplace";
import type { AdminMovieDetail, AdminMovieRow, MovieMergePreview } from "@showbuzz/schemas/types/admin-marketplace";
import { AppError } from "../../http/app-error";
import { type AdminListQuery, optionalId, searchPattern, sortSpec, vendorNames } from "./shared";

/**
 * The platform-wide movie catalogue for the super-admin, and merging duplicates (two vendors created the same film).
 *
 * Merge (one transaction): the duplicate's shows, vendor "My movies" links, reviews, wishlist saves and coupon scopes
 * move to the film kept; where a customer has both films (review or wishlist), the kept film's entry wins and the
 * other is hidden / removed. A demo template show that clashes with one of the kept film's (same screen and start)
 * and has no seat activity is cancelled instead of moved; any other clash refuses the merge. The duplicate is
 * archived with `mergedIntoId`, so its public URL redirects; earlier merges into it are re-pointed.
 */

export const MOVIE_SORT_FIELDS = ["title", "releaseDate", "createdAt"] as const;

export interface AdminMovieListQuery extends AdminListQuery {
  status?: "now-showing" | "upcoming";
  creator?: "platform" | "vendor";
  archived?: boolean;
}

type LeanMovie = MovieAttrs & { _id: Types.ObjectId };

async function showCounts(movieIds: Types.ObjectId[], now: Date) {
  const rows = await Show.aggregate<{ _id: Types.ObjectId; upcoming: number; total: number }>([
    { $match: { movieId: { $in: movieIds }, ...LIVE_SHOW_FILTER } },
    {
      $group: {
        _id: "$movieId",
        total: { $sum: 1 },
        upcoming: { $sum: { $cond: [{ $gt: ["$startsAt", now] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r]));
}

async function vendorLinks(movieIds: Types.ObjectId[]) {
  const rows = await VendorMovie.find({ movieId: { $in: movieIds } }, { movieId: 1, vendorId: 1 }).lean();
  const byMovie = new Map<string, Types.ObjectId[]>();
  for (const r of rows) byMovie.set(r.movieId.toString(), [...(byMovie.get(r.movieId.toString()) ?? []), r.vendorId]);
  return byMovie;
}

function toRow(
  doc: LeanMovie,
  ctx: {
    vendors: Map<string, string>;
    links: Map<string, Types.ObjectId[]>;
    shows: Map<string, { upcoming: number; total: number }>;
    mergedTitles: Map<string, string>;
  },
): AdminMovieRow {
  const id = doc._id.toString();
  const mergedIntoTitle = doc.mergedIntoId ? ctx.mergedTitles.get(doc.mergedIntoId.toString()) : undefined;
  return {
    id,
    slug: doc.slug,
    title: doc.title,
    poster: doc.poster,
    languages: [...doc.languages],
    releaseDate: doc.releaseDate,
    status: doc.status,
    createdBy: doc.createdByVendorId
      ? (ctx.vendors.get(doc.createdByVendorId.toString()) ?? "Removed vendor")
      : "ShowBuzz",
    vendors: ctx.links.get(id)?.length ?? 0,
    upcomingShows: ctx.shows.get(id)?.upcoming ?? 0,
    archived: Boolean(doc.archivedAt),
    ...(mergedIntoTitle ? { mergedIntoTitle } : {}),
  };
}

async function rowContext(docs: LeanMovie[], now: Date) {
  const ids = docs.map((d) => d._id);
  const [links, shows] = await Promise.all([vendorLinks(ids), showCounts(ids, now)]);
  const mergedIds = docs.flatMap((d) => (d.mergedIntoId ? [d.mergedIntoId] : []));
  const [vendors, merged] = await Promise.all([
    vendorNames([...docs.map((d) => d.createdByVendorId), ...[...links.values()].flat()]),
    mergedIds.length ? Movie.find({ _id: { $in: mergedIds } }, { title: 1 }).lean() : [],
  ]);
  return { vendors, links, shows, mergedTitles: new Map(merged.map((m) => [m._id.toString(), m.title])) };
}

export async function listMoviesAdmin(
  query: AdminMovieListQuery,
  now: Date,
): Promise<{ rows: AdminMovieRow[]; total: number }> {
  const filter: Record<string, unknown> = query.archived
    ? { archivedAt: { $exists: true } }
    : { ...ACTIVE_MOVIE_FILTER };
  if (query.status) filter.status = query.status;
  if (query.creator === "platform") filter.createdByVendorId = null;
  if (query.creator === "vendor") filter.createdByVendorId = { $ne: null };
  if (query.q.trim()) filter.$or = [{ title: searchPattern(query.q) }, { slug: searchPattern(query.q) }];
  await connect();
  const [docs, total] = await Promise.all([
    Movie.find(filter)
      .sort(sortSpec(query, MOVIE_SORT_FIELDS, "title"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Movie.countDocuments(filter),
  ]);
  const ctx = await rowContext(docs, now);
  return { rows: docs.map((d) => toRow(d, ctx)), total };
}

export async function getMovieAdmin(movieId: string, now: Date): Promise<AdminMovieDetail | null> {
  const _id = optionalId(movieId);
  if (!_id) return null;
  await connect();
  const doc = await Movie.findById(_id).lean();
  if (!doc) return null;
  const [ctx, reviews, mergedFrom] = await Promise.all([
    rowContext([doc], now),
    Review.countDocuments({ movieId: _id }),
    Movie.find({ mergedIntoId: _id }, { title: 1 }).lean(),
  ]);
  return {
    ...toRow(doc, ctx),
    certificate: doc.certificate,
    durationMinutes: doc.durationMinutes,
    genres: [...doc.genres],
    synopsis: doc.synopsis,
    vendorNames: (ctx.links.get(movieId) ?? []).map((v) => ctx.vendors.get(v.toString()) ?? "Removed vendor"),
    totalShows: ctx.shows.get(movieId)?.total ?? 0,
    reviews,
    ...(doc.mergedIntoId ? { mergedIntoId: doc.mergedIntoId.toString() } : {}),
    mergedFrom: mergedFrom.map((m) => ({ id: m._id.toString(), title: m.title })),
  };
}

/** Films to merge into (search by title), excluding the duplicate itself. */
export async function searchMergeTargets(excludeId: string, q: string) {
  if (q.trim().length < 2) return [];
  await connect();
  const docs = await Movie.find(
    { ...ACTIVE_MOVIE_FILTER, _id: { $ne: optionalId(excludeId) }, title: searchPattern(q) },
    { title: 1, releaseDate: 1, languages: 1 },
  )
    .sort({ title: 1 })
    .limit(10)
    .lean();
  return docs.map((d) => ({
    value: d._id.toString(),
    label: `${d.title} · ${d.releaseDate.slice(0, 4)} · ${d.languages.join(", ")}`,
  }));
}

interface MergePlan {
  source: LeanMovie;
  keep: LeanMovie;
  /** Source shows that clash with a kept-film show and are cancelled. */
  cancelIds: Types.ObjectId[];
  moveCount: number;
  keepReviewers: Types.ObjectId[];
  keepWishers: Types.ObjectId[];
}

async function planMerge(sourceId: string, keepId: string, session?: ClientSession): Promise<MergePlan> {
  const opts = { session: session ?? null };
  const [source, keep] = await Promise.all([
    Movie.findOne({ _id: sourceId, ...ACTIVE_MOVIE_FILTER }, null, opts).lean(),
    Movie.findOne({ _id: keepId, ...ACTIVE_MOVIE_FILTER }, null, opts).lean(),
  ]);
  if (!source || !keep) throw new AppError("NOT_FOUND", "One of the films doesn't exist or was already merged.", 404);

  const sourceShows = await Show.find(
    { movieId: source._id },
    { venueId: 1, screenId: 1, startsAt: 1, source: 1, status: 1 },
    opts,
  ).lean();
  const slot = (s: { venueId: Types.ObjectId; screenId: string; startsAt?: Date }) =>
    `${s.venueId.toString()}|${s.screenId}|${s.startsAt?.toISOString() ?? ""}`;
  const keepSlots = new Set(
    (
      await Show.find(
        { movieId: keep._id, venueId: { $in: [...new Set(sourceShows.map((s) => s.venueId))] } },
        { venueId: 1, screenId: 1, startsAt: 1 },
        opts,
      ).lean()
    ).map(slot),
  );
  const clashes = sourceShows.filter((s) => keepSlots.has(slot(s)));
  const clashIds = clashes.map((s) => s._id);
  const [held, booked] = await Promise.all([
    SeatHold.distinct("showId", { showId: { $in: clashIds } }).session(session ?? null),
    Booking.distinct("showId", { showId: { $in: clashIds } }).session(session ?? null),
  ]);
  const active = new Set([...held, ...booked].map(String));
  const blocking = clashes.filter(
    (s) => s.status !== "cancelled" && (s.source !== "template" || active.has(s._id.toString())),
  );
  if (blocking.length > 0) {
    throw new AppError(
      "CONFLICT",
      "Both films have shows on the same screen at the same time. Cancel one of them first.",
      409,
      { shows: blocking.map((s) => ({ id: s._id.toString(), startsAt: s.startsAt?.toISOString() ?? null })) },
    );
  }

  const [keepReviewers, keepWishers] = await Promise.all([
    Review.distinct("userId", { movieId: keep._id }).session(session ?? null),
    WishlistItem.distinct("userId", { kind: "movie", itemId: keep._id }).session(session ?? null),
  ]);
  return {
    source,
    keep,
    cancelIds: clashIds,
    moveCount: sourceShows.length - clashIds.length,
    keepReviewers: keepReviewers as Types.ObjectId[],
    keepWishers: keepWishers as Types.ObjectId[],
  };
}

const brief = (m: LeanMovie) => ({ id: m._id.toString(), title: m.title, slug: m.slug });

export async function previewMovieMerge(input: unknown): Promise<MovieMergePreview> {
  const { sourceId, keepId } = movieMergeSchema.parse(input);
  await connect();
  const plan = await planMerge(sourceId, keepId);
  const sid = plan.source._id;
  const [vendorLinksCount, reviews, reviewsHidden, wishlists, coupons] = await Promise.all([
    VendorMovie.countDocuments({ movieId: sid }),
    Review.countDocuments({ movieId: sid, userId: { $nin: plan.keepReviewers } }),
    Review.countDocuments({ movieId: sid, userId: { $in: plan.keepReviewers } }),
    WishlistItem.countDocuments({ kind: "movie", itemId: sid }),
    Coupon.countDocuments({ movieIds: sid }),
  ]);
  return {
    source: brief(plan.source),
    keep: brief(plan.keep),
    shows: plan.moveCount,
    showsCancelled: plan.cancelIds.length,
    vendorLinks: vendorLinksCount,
    reviews,
    reviewsHidden,
    wishlists,
    coupons,
  };
}

export async function mergeMovies(
  input: unknown,
  now: Date,
): Promise<{ source: string; keep: string; keepSlug: string }> {
  const { sourceId, keepId } = movieMergeSchema.parse(input);
  const mongoose = await connect();
  let result: { source: string; keep: string; keepSlug: string } | undefined;

  await mongoose.connection.transaction(async (session) => {
    const plan = await planMerge(sourceId, keepId, session);
    const sid = plan.source._id;
    const kid = plan.keep._id;

    // Shows: clashing demo shows are cancelled (they stay on the archived film), the rest move.
    if (plan.cancelIds.length) {
      await Show.updateMany({ _id: { $in: plan.cancelIds } }, { $set: { status: "cancelled" } }, { session });
    }
    await Show.updateMany({ movieId: sid, _id: { $nin: plan.cancelIds } }, { $set: { movieId: kid } }, { session });

    // Vendors' "My movies" lists.
    const links = await VendorMovie.find({ movieId: sid }, { vendorId: 1 }, { session }).lean();
    for (const link of links) {
      await VendorMovie.updateOne(
        { vendorId: link.vendorId, movieId: kid },
        { $setOnInsert: { vendorId: link.vendorId, movieId: kid } },
        { upsert: true, session },
      );
    }
    await VendorMovie.deleteMany({ movieId: sid }, { session });

    // Reviews: one per customer per film, so a customer who reviewed both keeps the kept film's review.
    await Review.updateMany(
      { movieId: sid, userId: { $nin: plan.keepReviewers } },
      { $set: { movieId: kid } },
      { session },
    );
    await Review.updateMany({ movieId: sid }, { $set: { status: "hidden" } }, { session });
    for (const id of [kid, sid]) {
      const [agg] = await Review.aggregate<{ count: number; sum: number }>([
        { $match: { movieId: id, status: "published" } },
        { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$rating" } } },
      ]).session(session);
      await Movie.updateOne(
        { _id: id },
        { $set: { userRatingCount: agg?.count ?? 0, userRatingSum: agg?.sum ?? 0 } },
        { session },
      );
    }

    // Wishlists: the duplicate save of a customer who saved both is removed.
    await WishlistItem.deleteMany({ kind: "movie", itemId: sid, userId: { $in: plan.keepWishers } }, { session });
    await WishlistItem.updateMany({ kind: "movie", itemId: sid }, { $set: { itemId: kid } }, { session });

    // Vendor coupons limited to the duplicate now cover the kept film.
    await Coupon.updateMany({ movieIds: sid }, { $addToSet: { movieIds: kid } }, { session });
    await Coupon.updateMany({ movieIds: sid }, { $pull: { movieIds: sid } }, { session });

    // Archive the duplicate; earlier merges into it now point at the kept film (no redirect chains).
    await Movie.updateMany({ mergedIntoId: sid }, { $set: { mergedIntoId: kid } }, { session });
    const archived = await Movie.updateOne(
      { _id: sid, ...ACTIVE_MOVIE_FILTER },
      { $set: { archivedAt: now, mergedIntoId: kid } },
      { session },
    );
    if (archived.modifiedCount !== 1) throw new AppError("CONFLICT", "This film was merged already. Reload.", 409);
    result = { source: plan.source.title, keep: plan.keep.title, keepSlug: plan.keep.slug };
  });

  if (!result) throw new Error("Merge transaction finished without a result");
  log.info("Movies merged", { event: "movie.merged", sourceId, keepId });
  return result;
}
