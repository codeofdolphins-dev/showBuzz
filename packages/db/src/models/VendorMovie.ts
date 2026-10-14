import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/**
 * A movie on a vendor's "My movies" list (the films it can schedule). Movies are one shared catalogue, so this is
 * only a link: adding an existing film creates one, creating a new film adds it for its creator. Unique per vendor
 * and movie, so adding twice is a no-op.
 */
export interface VendorMovieAttrs {
  vendorId: Types.ObjectId;
  movieId: Types.ObjectId;
  createdAt: Date;
}

const vendorMovieSchema = new Schema<VendorMovieAttrs>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    movieId: { type: Schema.Types.ObjectId, ref: "Movie", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

vendorMovieSchema.index({ vendorId: 1, movieId: 1 }, { unique: true });
vendorMovieSchema.index({ movieId: 1 });

export const VendorMovie: Model<VendorMovieAttrs> =
  (models.VendorMovie as Model<VendorMovieAttrs> | undefined) ??
  model<VendorMovieAttrs>("VendorMovie", vendorMovieSchema, "vendorMovies");
