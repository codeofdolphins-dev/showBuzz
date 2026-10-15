import "server-only";
import { type Model, Schema, model, models } from "mongoose";
import type { City as CityShape } from "@showbuzz/schemas/city";
import type { CityTier, MasterStatus } from "@showbuzz/schemas/master-data";
import { type LeanDoc, sortOrderField } from "./transforms";

/**
 * A city customers can pick. The slug ("kolkata") is the public id used by venues, events and the city store, so it
 * never changes once created. Inactive cities (prompt 7) leave the public picker and the venue forms; documents from
 * before prompt 7 have no `status` and count as active.
 */
export interface CityAttrs {
  slug: string;
  name: string;
  state?: string;
  popular: boolean;
  tier?: CityTier;
  status?: MasterStatus;
  sortOrder: number;
}

const citySchema = new Schema<CityAttrs>(
  {
    slug: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    popular: { type: Boolean, default: false },
    tier: { type: String, enum: ["metro", "tier2", "other"] },
    status: { type: String, enum: ["active", "inactive"] },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

citySchema.index({ slug: 1 }, { unique: true });
citySchema.index({ sortOrder: 1 });

/** Cities shown to customers and offered for new venues (missing status = active). */
export const ACTIVE_CITY_FILTER = { status: { $ne: "inactive" } } as const;

export function toCity(doc: LeanDoc<CityAttrs>): CityShape {
  return { id: doc.slug, name: doc.name, ...(doc.state ? { state: doc.state } : {}), popular: doc.popular };
}

export const City: Model<CityAttrs> =
  (models.City as Model<CityAttrs> | undefined) ?? model<CityAttrs>("City", citySchema, "cities");
