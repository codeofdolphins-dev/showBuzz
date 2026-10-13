import "server-only";
import { randomUUID } from "node:crypto";
import { createMovieReviewSchema, type CreateMovieReviewInput, type MovieReview } from "@showbuzz/schemas/movie";
import { AppError } from "../http/app-error";
import { getMovieById } from "./catalog.service";

/**
 * Reviews submitted by customers, kept in memory until the `reviews` collection exists (batch 4.1).
 * One review per customer per movie: submitting again updates it. The owner id never leaves the server.
 */
interface StoredReview {
  userId: string;
  review: MovieReview;
}

const globalStore = globalThis as unknown as { __showbuzzReviews?: Map<string, StoredReview[]> };
const submitted = (globalStore.__showbuzzReviews ??= new Map<string, StoredReview[]>());

export async function listMovieReviews(movieId: string): Promise<MovieReview[]> {
  const movie = await getMovieById(movieId);
  if (!movie) return [];
  return [...(submitted.get(movieId) ?? []).map((s) => s.review), ...movie.reviews];
}

export interface ReviewAuthor {
  userId: string;
  name: string;
}

export async function addMovieReview(
  input: CreateMovieReviewInput,
  author: ReviewAuthor,
  now: Date,
): Promise<{ review: MovieReview; updated: boolean }> {
  const { movieId, rating, text } = createMovieReviewSchema.parse(input);
  const movie = await getMovieById(movieId);
  if (!movie) throw new AppError("NOT_FOUND", "Movie not found.", 404);
  if (movie.status !== "now-showing") {
    throw new AppError("VALIDATION_FAILED", "Reviews open once the movie releases.", 422);
  }

  const existing = submitted.get(movieId) ?? [];
  const previous = existing.find((s) => s.userId === author.userId);
  const review: MovieReview = {
    id: previous?.review.id ?? randomUUID(),
    author: author.name,
    rating,
    text: text || "Rated without a written review.",
    createdAt: now.toISOString(),
  };
  // The latest version goes to the top, replacing the customer's earlier review.
  submitted.set(movieId, [{ userId: author.userId, review }, ...existing.filter((s) => s.userId !== author.userId)]);
  return { review, updated: !!previous };
}
