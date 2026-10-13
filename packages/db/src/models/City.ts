import "server-only";
import { type Model, Schema, model, models } from "mongoose";
import type { City as CityShape } from "@showbuzz/schemas/city";
import { type LeanDoc, sortOrderField } from "./transforms";

/** A city customers can pick. The slug ("kolkata") is the public id used by venues, events and the city store. */
export interface CityAttrs {
  slug: string;
  name: string;
  state?: string;
  popular: boolean;
  sortOrder: number;
}

const citySchema = new Schema<CityAttrs>(
  {
    slug: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    popular: { type: Boolean, default: false },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

citySchema.index({ slug: 1 }, { unique: true });

export function toCity(doc: LeanDoc<CityAttrs>): CityShape {
  return { id: doc.slug, name: doc.name, ...(doc.state ? { state: doc.state } : {}), popular: doc.popular };
}

export const City: Model<CityAttrs> =
  (models.City as Model<CityAttrs> | undefined) ?? model<CityAttrs>("City", citySchema, "cities");
