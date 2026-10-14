import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { Cinema, Screen, ShowTemplate, VenueKind } from "@showbuzz/schemas/venue";
import { type LeanDoc, sortOrderField } from "./transforms";

/**
 * Cinemas, stadiums and other venues. Screens and their seat layouts are embedded: a layout is a few
 * rows per zone, always read with its venue, never shared between venues, and edited with the venue.
 * Shows point at `venueId` + `screens.id`; seats are addressed by `showId` + seat id ("C7").
 */
export interface VenueAttrs {
  /** The vendor that operates this venue (its shows, prices and policy are that vendor's). */
  vendorId: Types.ObjectId;
  slug: string;
  kind: VenueKind;
  name: string;
  cityId: string;
  address: string;
  distanceLabel: string;
  amenities: string[];
  /**
   * Venue-level opt-out: a booking is cancellable only when both the vendor's policy and the venue allow it.
   * `label` is the seeded text; the public site builds its label from the vendor's policy.
   */
  cancellation: { allowed: boolean; label: string };
  /** Cinemas only: daily showtimes that become `shows` documents (see ../shows.ts). */
  showTemplates: ShowTemplate[];
  screens: Screen[];
  sortOrder: number;
}

const seatRowSchema = new Schema(
  { row: String, count: Number, aisleAfter: Number, accessibleSeats: { type: [Number], default: [] } },
  { _id: false },
);
const seatZoneSchema = new Schema(
  {
    id: String,
    name: String,
    description: String,
    accent: { type: String, enum: ["rose", "amber", "blue"] },
    recliner: Boolean,
    rows: [seatRowSchema],
  },
  { _id: false },
);
const screenSchema = new Schema(
  { id: String, name: String, layoutType: { type: String, enum: ["screen", "stadium"] }, zones: [seatZoneSchema] },
  { _id: false },
);
const showTemplateSchema = new Schema(
  {
    time: String,
    format: String,
    language: String,
    availability: { type: String, enum: ["available", "fast-filling", "almost-full"] },
    pricePaise: Number,
    priceTier: String,
    screenName: String,
  },
  { _id: false },
);

const venueSchema = new Schema<VenueAttrs>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    slug: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["cinema", "stadium", "venue"], required: true },
    name: { type: String, required: true, trim: true },
    cityId: { type: String, required: true },
    address: { type: String, default: "" },
    distanceLabel: { type: String, default: "" },
    amenities: { type: [String], default: [] },
    cancellation: {
      allowed: { type: Boolean, default: true },
      label: { type: String, default: "Cancellation Available" },
    },
    showTemplates: { type: [showTemplateSchema], default: [] },
    screens: { type: [screenSchema], default: [] },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

venueSchema.index({ slug: 1 }, { unique: true });
venueSchema.index({ kind: 1, sortOrder: 1 });
venueSchema.index({ vendorId: 1, kind: 1 });

/** Stable screen id from its display name ("Audi 02 (IMAX Laser)" → "audi-02-imax-laser"). */
export function screenIdFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toCinema(doc: LeanDoc<VenueAttrs>): Cinema {
  return {
    id: doc._id.toString(),
    ...(doc.vendorId ? { vendorId: doc.vendorId.toString() } : {}),
    slug: doc.slug,
    name: doc.name,
    cityId: doc.cityId,
    address: doc.address,
    distanceLabel: doc.distanceLabel,
    amenities: [...doc.amenities],
    cancellation: { allowed: doc.cancellation.allowed, label: doc.cancellation.label },
    showTemplates: doc.showTemplates.map((t) => ({
      time: t.time,
      format: t.format,
      language: t.language,
      availability: t.availability,
      pricePaise: t.pricePaise,
      priceTier: t.priceTier,
      screenName: t.screenName,
    })),
  };
}

export const Venue: Model<VenueAttrs> =
  (models.Venue as Model<VenueAttrs> | undefined) ?? model<VenueAttrs>("Venue", venueSchema, "venues");
