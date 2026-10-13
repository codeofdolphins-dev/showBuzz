import { z } from "zod";
import { idSchema, imageUrlSchema, isoDateSchema, isoDateTimeSchema, slugSchema } from "./common";

export const movieStatusSchema = z.enum(["now-showing", "upcoming"]);

export const castMemberSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  image: imageUrlSchema,
});

export const crewMemberSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
});

export const movieReviewSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1),
  rating: z.number().min(1).max(5),
  text: z.string().min(1),
  createdAt: isoDateTimeSchema,
});

export const movieSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().min(1),
  genres: z.array(z.string()).min(1),
  languages: z.array(z.string()).min(1),
  certificate: z.string().min(1),
  /** Out of 10; 0 for unreleased titles. */
  rating: z.number().min(0).max(10),
  votesLabel: z.string(),
  durationMinutes: z.int().positive(),
  releaseDate: isoDateSchema,
  status: movieStatusSchema,
  isTrending: z.boolean(),
  formats: z.array(z.string()).min(1),
  poster: imageUrlSchema,
  backdrop: imageUrlSchema,
  trailerUrl: z.url(),
  synopsis: z.string().min(1),
  director: z.string().min(1),
  cast: z.array(castMemberSchema),
  crew: z.array(crewMemberSchema),
  reviews: z.array(movieReviewSchema),
  /** Customer reviews (1–5 stars): average and count, kept on the movie document. Absent until the first review. */
  userRating: z.object({ average: z.number().min(1).max(5), count: z.int().positive() }).optional(),
});

export const movieSortSchema = z.enum(["popularity", "rating", "newest"]);

/** Query string for /movies. Single values are accepted so `?language=Hindi` deep links work. */
export const movieListQuerySchema = z.object({
  status: movieStatusSchema.catch("now-showing"),
  language: z.string().max(40).optional().catch(undefined),
  genre: z.string().max(40).optional().catch(undefined),
});

export const createMovieReviewSchema = z.object({
  movieId: idSchema,
  rating: z.int().min(1).max(5),
  text: z.string().trim().max(500).optional(),
});

export type Movie = z.infer<typeof movieSchema>;
export type MovieStatus = z.infer<typeof movieStatusSchema>;
export type MovieReview = z.infer<typeof movieReviewSchema>;
export type MovieSort = z.infer<typeof movieSortSchema>;
export type CreateMovieReviewInput = z.infer<typeof createMovieReviewSchema>;
