import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Movie } from "@showbuzz/db/models/Movie";
import { Review, type ReviewAttrs } from "@showbuzz/db/models/Review";
import { Types } from "@showbuzz/db/mongoose";
import { createMovieReviewSchema, type CreateMovieReviewInput, type MovieReview } from "@showbuzz/schemas/movie";
import { AppError } from "../http/app-error";
import { getMovieById } from "./catalog.service";

/**
 * Customer movie reviews (`reviews`). One per customer per movie (unique index): submitting again updates it.
 * The movie keeps the rating totals (`userRatingCount`, `userRatingSum`), changed with $inc in the same
 * transaction as the review, so the average shown on cards always matches the stored reviews.
 * The owner id never leaves the server; the author name comes from the session.
 */

const LIST_LIMIT = 50;

function toMovieReview(doc: ReviewAttrs & { _id: Types.ObjectId }): MovieReview {
  return {
    id: doc._id.toString(),
    author: doc.authorName,
    rating: doc.rating,
    text: doc.text,
    createdAt: doc.updatedAt.toISOString(),
  };
}

/** Published customer reviews (latest first), then the catalogue's editorial reviews. */
export async function listMovieReviews(movieId: string): Promise<MovieReview[]> {
  const movie = await getMovieById(movieId);
  if (!movie) return [];
  await connect();
  const docs = await Review.find({ movieId: movie.id, status: "published" })
    .sort({ updatedAt: -1 })
    .limit(LIST_LIMIT)
    .lean();
  return [...docs.map(toMovieReview), ...movie.reviews];
}

export interface ReviewAuthor {
  userId: string;
  name: string;
}

export async function addMovieReview(
  input: CreateMovieReviewInput,
  author: ReviewAuthor,
): Promise<{ review: MovieReview; updated: boolean }> {
  const { movieId, rating, text } = createMovieReviewSchema.parse(input);
  const movie = await getMovieById(movieId);
  if (!movie) throw new AppError("NOT_FOUND", "Movie not found.", 404);
  if (movie.status !== "now-showing") {
    throw new AppError("VALIDATION_FAILED", "Reviews open once the movie releases.", 422);
  }

  const mongoose = await connect();
  const filter = { movieId: new Types.ObjectId(movie.id), userId: new Types.ObjectId(author.userId) };
  const state = { updated: false };
  await mongoose.connection.transaction(async (session) => {
    const previous = await Review.findOneAndUpdate(
      filter,
      {
        $set: { authorName: author.name, rating, text: text || "Rated without a written review." },
        $setOnInsert: { status: "published" },
      },
      { upsert: true, returnDocument: "before", session, lean: true },
    );
    // A new review adds one vote; an edit only shifts the sum by the rating change. A review hidden by moderation
    // stays hidden when edited and isn't in the totals, so its edits change nothing.
    if (previous?.status !== "hidden") {
      const inc = previous ? { userRatingSum: rating - previous.rating } : { userRatingCount: 1, userRatingSum: rating };
      await Movie.updateOne({ _id: filter.movieId }, { $inc: inc }, { session });
    }
    state.updated = previous !== null;
  });

  const saved = await Review.findOne(filter).lean();
  if (!saved) throw new AppError("INTERNAL", "Your review could not be saved. Please try again.", 500);
  return { review: toMovieReview(saved), updated: state.updated };
}
