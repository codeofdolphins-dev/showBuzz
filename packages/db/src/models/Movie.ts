import "server-only";
import { type Model, Schema, model, models } from "mongoose";
import type { Movie as MovieShape, MovieReview } from "@showbuzz/schemas/movie";
import { type LeanDoc, sortOrderField } from "./transforms";

type StoredReview = Omit<MovieReview, "createdAt"> & { createdAt: Date };

/** A film. Fields follow `movieSchema`; `releaseDate` stays a calendar date string ("2026-08-14", IST). */
export interface MovieAttrs extends Omit<MovieShape, "id" | "reviews" | "userRating"> {
  /** Editorial reviews shipped with the catalogue; customer reviews get their own collection (batch 4.1). */
  reviews: StoredReview[];
  /** Customer review totals, changed only with $inc by review.service (in the same transaction as the review). */
  userRatingCount: number;
  userRatingSum: number;
  sortOrder: number;
}

const personSchema = new Schema({ name: String, role: String, image: String }, { _id: false });
const crewSchema = new Schema({ name: String, role: String }, { _id: false });
const reviewSchema = new Schema(
  { id: String, author: String, rating: Number, text: String, createdAt: Date },
  { _id: false },
);

const movieSchema = new Schema<MovieAttrs>(
  {
    slug: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    genres: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    certificate: { type: String, required: true },
    rating: { type: Number, default: 0, min: 0, max: 10 },
    votesLabel: { type: String, default: "" },
    durationMinutes: { type: Number, required: true, min: 1 },
    releaseDate: { type: String, required: true },
    status: { type: String, enum: ["now-showing", "upcoming"], required: true },
    isTrending: { type: Boolean, default: false },
    formats: { type: [String], default: [] },
    poster: { type: String, required: true },
    backdrop: { type: String, required: true },
    trailerUrl: { type: String, required: true },
    synopsis: { type: String, required: true },
    director: { type: String, required: true },
    cast: { type: [personSchema], default: [] },
    crew: { type: [crewSchema], default: [] },
    reviews: { type: [reviewSchema], default: [] },
    userRatingCount: { type: Number, default: 0, min: 0 },
    userRatingSum: { type: Number, default: 0, min: 0 },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

movieSchema.index({ slug: 1 }, { unique: true });
movieSchema.index({ status: 1, sortOrder: 1 });

/** Average to one decimal; missing until the first customer review (older documents lack the totals). */
function userRating(
  doc: Partial<Pick<MovieAttrs, "userRatingCount" | "userRatingSum">>,
): Pick<MovieShape, "userRating"> {
  const count = doc.userRatingCount ?? 0;
  if (count <= 0) return {};
  return { userRating: { average: Math.round(((doc.userRatingSum ?? 0) / count) * 10) / 10, count } };
}

export function toMovie(doc: LeanDoc<MovieAttrs>): MovieShape {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    title: doc.title,
    genres: [...doc.genres],
    languages: [...doc.languages],
    certificate: doc.certificate,
    rating: doc.rating,
    votesLabel: doc.votesLabel,
    durationMinutes: doc.durationMinutes,
    releaseDate: doc.releaseDate,
    status: doc.status,
    isTrending: doc.isTrending,
    formats: [...doc.formats],
    poster: doc.poster,
    backdrop: doc.backdrop,
    trailerUrl: doc.trailerUrl,
    synopsis: doc.synopsis,
    director: doc.director,
    cast: doc.cast.map((c) => ({ name: c.name, role: c.role, image: c.image })),
    crew: doc.crew.map((c) => ({ name: c.name, role: c.role })),
    reviews: doc.reviews.map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
    })),
    ...userRating(doc),
  };
}

export const Movie: Model<MovieAttrs> =
  (models.Movie as Model<MovieAttrs> | undefined) ?? model<MovieAttrs>("Movie", movieSchema, "movies");
