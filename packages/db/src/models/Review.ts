import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/**
 * A customer's review of a movie: one per customer per movie (unique), so submitting again updates it.
 * `authorName` is copied from the account when submitted, never taken from the client.
 */
export interface ReviewAttrs {
  movieId: Types.ObjectId;
  userId: Types.ObjectId;
  authorName: string;
  /** 1–5 stars (the prototype's scale). */
  rating: number;
  text: string;
  /** Moderation comes with the admin app; everything is published for now. */
  status: "published" | "hidden";
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewAttrs>(
  {
    movieId: { type: Schema.Types.ObjectId, ref: "Movie", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ["published", "hidden"], required: true, default: "published" },
  },
  { timestamps: true, versionKey: false },
);

reviewSchema.index({ movieId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ movieId: 1, status: 1, updatedAt: -1 });

export const Review: Model<ReviewAttrs> =
  (models.Review as Model<ReviewAttrs> | undefined) ?? model<ReviewAttrs>("Review", reviewSchema, "reviews");
