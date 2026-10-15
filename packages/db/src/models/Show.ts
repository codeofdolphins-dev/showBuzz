import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { ShowZone } from "@showbuzz/schemas/venue";

/**
 * One concrete performance: a movie show at a cinema screen, a stadium fixture (`eventId` + seat zones) or an
 * event "pass" show (`eventId` + `inventory`: quantity tiers without seat numbers).
 * Vendors schedule shows in the partner portal; the seeded demo vendors' cinemas also get shows from their daily
 * templates (`ensureMovieShows`, ../shows.ts).
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
  /**
   * When the screen is free again (start + running time). Seat-map shows only: the partner scheduler refuses a show
   * that overlaps another on the same screen (plus a cleaning buffer).
   */
  endsAt?: Date;
  /** Cancelled shows stay (bookings and the generator's unique key point at them) but are hidden and unbookable. */
  status?: ShowStatus;
  /** `template` = made by the demo generator from a seeded cinema's templates; `manual` = scheduled by the vendor. */
  source?: ShowSource;
  format?: string;
  language?: string;
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

export type ShowStatus = "scheduled" | "cancelled";
export type ShowSource = "template" | "manual";

/** Shows that haven't been cancelled (older documents have no status). */
export const LIVE_SHOW_FILTER = { status: { $ne: "cancelled" } } as const;

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
    endsAt: Date,
    status: { type: String, enum: ["scheduled", "cancelled"], default: "scheduled" },
    source: { type: String, enum: ["template", "manual"] },
    format: String,
    language: String,
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
