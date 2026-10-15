import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Movie } from "@showbuzz/db/models/Movie";
import { Review } from "@showbuzz/db/models/Review";
import type { Types } from "@showbuzz/db/mongoose";
import { moderateReviewSchema } from "@showbuzz/schemas/admin-platform";
import type { Option, ReviewRow } from "@showbuzz/schemas/types/admin-platform";
import { AppError } from "../../http/app-error";
import { type AdminListQuery, idOr404, optionalId, searchPattern, sortSpec } from "./shared";

/**
 * Review moderation (prompt 7). A movie's `userRatingCount` / `userRatingSum` count published reviews only: hiding
 * or publishing flips the status conditionally and moves the totals with $inc in the same transaction, so the
 * average on the public site always matches the reviews it shows. Editorial reviews embedded on movies (seed
 * content) aren't moderated here.
 */

export const REVIEW_SORT_FIELDS = ["updatedAt", "rating"] as const;

export interface ReviewListQuery extends AdminListQuery {
  status?: "published" | "hidden";
  movieId?: string;
  rating?: number;
}

export async function listReviewsAdmin(query: ReviewListQuery): Promise<{ rows: ReviewRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const movieId = optionalId(query.movieId);
  if (movieId) filter.movieId = movieId;
  if (query.rating) filter.rating = query.rating;
  if (query.q.trim()) filter.$or = [{ text: searchPattern(query.q) }, { authorName: searchPattern(query.q) }];
  const [docs, total] = await Promise.all([
    Review.find(filter)
      .sort(sortSpec(query, REVIEW_SORT_FIELDS, "updatedAt"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Review.countDocuments(filter),
  ]);
  const movies = await Movie.find({ _id: { $in: [...new Set(docs.map((d) => d.movieId))] } }, { title: 1, slug: 1 }).lean();
  const byId = new Map(movies.map((m) => [m._id.toString(), m]));
  return {
    rows: docs.map((d) => {
      const movie = byId.get(d.movieId.toString());
      return {
        id: d._id.toString(),
        movieId: d.movieId.toString(),
        movieTitle: movie?.title ?? "Unknown movie",
        movieSlug: movie?.slug ?? "",
        authorName: d.authorName,
        customerId: d.userId.toString(),
        rating: d.rating,
        text: d.text,
        status: d.status,
        updatedAt: d.updatedAt.toISOString(),
        ...(d.moderatedAt ? { moderatedAt: d.moderatedAt.toISOString() } : {}),
      };
    }),
    total,
  };
}

/** Movies that have customer reviews (filter dropdown). */
export async function listReviewedMovieOptions(): Promise<Option[]> {
  await connect();
  const ids = (await Review.distinct("movieId")) as Types.ObjectId[];
  const movies = await Movie.find({ _id: { $in: ids } }, { title: 1 }).sort({ title: 1 }).lean();
  return movies.map((m) => ({ value: m._id.toString(), label: m.title }));
}

/** Hide or publish a review and move the movie's rating totals with it (one transaction). */
export async function moderateReview(
  reviewId: string,
  input: unknown,
  staffId: string,
  now: Date,
): Promise<{ movieId: string; movieTitle: string; changed: boolean }> {
  const _id = idOr404(reviewId, "Review");
  const { status } = moderateReviewSchema.parse(input);
  const mongoose = await connect();
  const state = { changed: false, movieId: "" };
  await mongoose.connection.transaction(async (session) => {
    state.changed = false;
    const from = status === "hidden" ? "published" : "hidden";
    const review = await Review.findOneAndUpdate(
      { _id, status: from },
      { $set: { status, moderatedAt: now, moderatedByStaffId: staffId } },
      // timestamps: false keeps updatedAt = the customer's last edit.
      { session, lean: true, timestamps: false, projection: { movieId: 1, rating: 1 } },
    );
    if (!review) return;
    const sign = status === "hidden" ? -1 : 1;
    await Movie.updateOne(
      { _id: review.movieId },
      { $inc: { userRatingCount: sign, userRatingSum: sign * review.rating } },
      { session },
    );
    state.changed = true;
    state.movieId = review.movieId.toString();
  });
  if (!state.changed) {
    const current = await Review.findById(_id, { movieId: 1, status: 1 }).lean();
    if (!current) throw new AppError("NOT_FOUND", "Review not found.", 404);
    state.movieId = current.movieId.toString();
  }
  const movie = await Movie.findById(state.movieId, { title: 1 }).lean();
  return { movieId: state.movieId, movieTitle: movie?.title ?? "movie", changed: state.changed };
}
