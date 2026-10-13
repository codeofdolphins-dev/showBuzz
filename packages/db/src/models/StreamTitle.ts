import "server-only";
import { type Model, Schema, model, models } from "mongoose";
import type { StreamTitle as StreamTitleShape } from "@showbuzz/schemas/stream";
import { type LeanDoc, sortOrderField } from "./transforms";

/** A rent/buy title on /stream. */
export interface StreamTitleAttrs extends Omit<StreamTitleShape, "id"> {
  sortOrder: number;
}

const streamTitleSchema = new Schema<StreamTitleAttrs>(
  {
    slug: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    badge: { type: String, default: "" },
    rentPricePaise: { type: Number, required: true, min: 0 },
    buyPricePaise: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1 },
    rating: { type: Number, default: 0 },
    poster: { type: String, required: true },
    description: { type: String, required: true },
    featured: { type: Boolean, default: false },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

streamTitleSchema.index({ slug: 1 }, { unique: true });

export function toStreamTitle(doc: LeanDoc<StreamTitleAttrs>): StreamTitleShape {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    title: doc.title,
    category: doc.category,
    badge: doc.badge,
    rentPricePaise: doc.rentPricePaise,
    buyPricePaise: doc.buyPricePaise,
    durationMinutes: doc.durationMinutes,
    rating: doc.rating,
    poster: doc.poster,
    description: doc.description,
    featured: doc.featured,
  };
}

export const StreamTitle: Model<StreamTitleAttrs> =
  (models.StreamTitle as Model<StreamTitleAttrs> | undefined) ??
  model<StreamTitleAttrs>("StreamTitle", streamTitleSchema, "streamTitles");
