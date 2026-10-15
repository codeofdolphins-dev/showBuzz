import "server-only";
import { type Model, Schema, model, models } from "mongoose";
import type { GenreScope, MasterStatus } from "@showbuzz/schemas/master-data";
import { sortOrderField } from "./transforms";

/**
 * A genre (movies) or category (events, plays, sports, activities): prompt 7 master data. Movies store genre names
 * in `genres`, events their category in `category`; renaming one updates the listings that use it.
 */
export interface GenreAttrs {
  name: string;
  slug: string;
  appliesTo: GenreScope;
  status: MasterStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const genreSchema = new Schema<GenreAttrs>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, trim: true },
    appliesTo: { type: String, enum: ["movie", "event", "play", "sport", "activity"], required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

genreSchema.index({ appliesTo: 1, slug: 1 }, { unique: true });
genreSchema.index({ appliesTo: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
genreSchema.index({ appliesTo: 1, sortOrder: 1 });

export const Genre: Model<GenreAttrs> =
  (models.Genre as Model<GenreAttrs> | undefined) ?? model<GenreAttrs>("Genre", genreSchema, "genres");
