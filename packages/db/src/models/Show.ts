import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { ShowAvailability, ShowZone } from "@showbuzz/schemas/venue";

/**
 * One concrete performance: a movie show at a cinema screen, a stadium fixture (`eventId` + seat zones) or an
 * event "pass" show (`eventId` + `inventory`: quantity tiers without seat numbers).
 * Movie shows are created from the cinemas' daily templates by `ensureMovieShows` (../shows.ts).
 */
export interface ShowAttrs {
  /** The vendor selling this show (the venue's vendor); its rates price the order. */
  vendorId: Types.ObjectId;
  movieId?: Types.ObjectId;
  eventId?: Types.ObjectId;
  venueId: Types.ObjectId;
  screenId: string;
  screenName: string;
  /** UTC instant. Missing only for passes to daily activities (no fixed start). */
  startsAt?: Date;
  format?: string;
  language?: string;
  availability: ShowAvailability;
  /** Headline (top zone) price shown on showtime chips. */
  pricePaise: number;
  priceTier?: string;
  zones: ShowZone[];
  /**
   * Pass shows only. `remaining` is decremented with one conditional update (`remaining >= qty`) when an order is
   * placed and given back on failure, expiry or cancellation, so a tier can never be oversold.
   */
  inventory: ShowInventoryTier[];
}

export interface ShowInventoryTier {
  tierId: string;
  capacity: number;
  remaining: number;
  sold: number;
}

const inventoryTierSchema = new Schema(
  { tierId: String, capacity: Number, remaining: { type: Number, min: 0 }, sold: { type: Number, default: 0 } },
  { _id: false },
);

const showZoneSchema = new Schema(
  { zoneId: String, name: String, description: String, pricePaise: Number },
  { _id: false },
);

const showSchema = new Schema<ShowAttrs>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    movieId: { type: Schema.Types.ObjectId, ref: "Movie" },
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    venueId: { type: Schema.Types.ObjectId, ref: "Venue", required: true },
    screenId: { type: String, required: true },
    screenName: { type: String, required: true },
    startsAt: Date,
    format: String,
    language: String,
    availability: { type: String, enum: ["available", "fast-filling", "almost-full"], default: "available" },
    pricePaise: { type: Number, required: true, min: 0 },
    priceTier: String,
    zones: { type: [showZoneSchema], default: [] },
    inventory: { type: [inventoryTierSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

// The generator upserts on this key, so re-running it never duplicates a show. movieId is part of it
// because the demo screens every now-showing movie in every slot (decided 2026-10-13).
showSchema.index({ venueId: 1, screenId: 1, startsAt: 1, movieId: 1, eventId: 1 }, { unique: true });
showSchema.index({ movieId: 1, startsAt: 1 });
showSchema.index({ eventId: 1, startsAt: 1 });
showSchema.index({ vendorId: 1, startsAt: 1 });

export const Show: Model<ShowAttrs> =
  (models.Show as Model<ShowAttrs> | undefined) ?? model<ShowAttrs>("Show", showSchema, "shows");
