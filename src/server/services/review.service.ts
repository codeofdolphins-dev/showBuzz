import "server-only";
import { randomUUID } from "node:crypto";
import { createMovieReviewSchema, type CreateMovieReviewInput, type MovieReview } from "@/schemas/movie";
import { AppError } from "@/server/http/app-error";
import { getMovieById } from "./catalog.service";

/** Reviews submitted in this session, kept in memory until the `reviews` collection exists. */
const globalStore = globalThis as unknown as { __showbuzzReviews?: Map<string, MovieReview[]> };
const submitted = (globalStore.__showbuzzReviews ??= new Map<string, MovieReview[]>());

export async function listMovieReviews(movieId: string): Promise<MovieReview[]> {
  const movie = await getMovieById(movieId);
  if (!movie) return [];
  return [...(submitted.get(movieId) ?? []), ...movie.reviews];
}

export async function addMovieReview(input: CreateMovieReviewInput, author: string, now: Date): Promise<MovieReview> {
  const { movieId, rating, text } = createMovieReviewSchema.parse(input);
  const movie = await getMovieById(movieId);
  if (!movie) throw new AppError("NOT_FOUND", "Movie not found.", 404);
  if (movie.status !== "now-showing") {
    throw new AppError("VALIDATION_FAILED", "Reviews open once the movie releases.", 422);
  }

  const review: MovieReview = {
    id: randomUUID(),
    author,
    rating,
    text: text || "Rated without a written review.",
    createdAt: now.toISOString(),
  };
  submitted.set(movieId, [review, ...(submitted.get(movieId) ?? [])]);
  return review;
}
