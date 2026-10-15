import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import {
  SEAT_ACCENTS,
  type Cinema,
  type Screen,
  type ShowTemplate,
  type VenueKind,
  type VenueStatus,
} from "@showbuzz/schemas/venue";
import { type LeanDoc, sortOrderField } from "./transforms";

/**
 * Cinemas, stadiums and other venues. Screens and their seat layouts are embedded: a layout is a few
 * rows per zone, always read with its venue, never shared between venues, and edited with the venue.
 * Shows point at `venueId` + `screens.id`; seats are addressed by `showId` + seat id ("C7").
 */
/** A seat row as stored: documents from before the layout designer have one `aisleAfter` and no blocked seats. */
export interface StoredSeatRow {
  row: string;
  count: number;
  /** Legacy single aisle; read by `toScreen`, never written. */
  aisleAfter?: number;
  aislesAfter?: number[];
  accessibleSeats?: number[];
  blockedSeats?: number[];
}

export interface StoredSeatZone extends Omit<Screen["zones"][number], "rows" | "defaultPricePaise"> {
  defaultPricePaise?: number;
  rows: StoredSeatRow[];
}

export interface StoredScreen extends Omit<Screen, "zones" | "formats"> {
  formats?: string[];
  zones: StoredSeatZone[];
}

export interface VenueAttrs {
  /** The vendor that operates this venue (its shows, prices and policy are that vendor's). */
  vendorId: Types.ObjectId;
  slug: string;
  kind: VenueKind;
  name: string;
  cityId: string;
  address: string;
  distanceLabel: string;
  /** Box office phone (free text: landlines too). */
  phone?: string;
  amenities: string[];
  /** Inactive venues are hidden from the public site; older documents have no status (= active). */
  status?: VenueStatus;
  /**
   * Venue-level opt-out: a booking is cancellable only when both the vendor's policy and the venue allow it.
   * `label` is the seeded text; the public site builds its label from the vendor's policy.
   */
  cancellation: { allowed: boolean; label: string };
  /** Seeded cinemas only: daily showtimes that become `shows` documents (see ../shows.ts). */
  showTemplates: ShowTemplate[];
  screens: StoredScreen[];
  /**
   * Bumped (without touching `updatedAt`) inside every partner scheduling transaction, so two vendors' sessions
   * scheduling on one venue at once conflict and one retries after seeing the other's shows.
   */
  scheduleVersion?: number;
  sortOrder: number;
  createdAt?: Date;
  /** Bumped on every save; the layout designer writes conditionally on it. */
  updatedAt?: Date;
}

const seatRowSchema = new Schema(
  {
    row: String,
    count: Number,
    aisleAfter: Number,
    aislesAfter: { type: [Number], default: undefined },
    accessibleSeats: { type: [Number], default: [] },
    blockedSeats: { type: [Number], default: [] },
  },
  { _id: false },
);
const seatZoneSchema = new Schema(
  {
    id: String,
    name: String,
    description: String,
    accent: { type: String, enum: SEAT_ACCENTS },
    recliner: Boolean,
    defaultPricePaise: Number,
    rows: [seatRowSchema],
  },
  { _id: false },
);
const screenSchema = new Schema(
  {
    id: String,
    name: String,
    layoutType: { type: String, enum: ["screen", "stadium"] },
    formats: { type: [String], default: [] },
    soundSystem: String,
    zones: [seatZoneSchema],
  },
  { _id: false },
);
const showTemplateSchema = new Schema(
  {
    time: String,
    format: String,
    language: String,
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
    phone: { type: String, default: "" },
    amenities: { type: [String], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    cancellation: {
      allowed: { type: Boolean, default: true },
      label: { type: String, default: "Cancellation Available" },
    },
    showTemplates: { type: [showTemplateSchema], default: [] },
    screens: { type: [screenSchema], default: [] },
    scheduleVersion: { type: Number, default: 0 },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

venueSchema.index({ slug: 1 }, { unique: true });
venueSchema.index({ kind: 1, sortOrder: 1 });
venueSchema.index({ vendorId: 1, kind: 1 });
venueSchema.index({ vendorId: 1, name: 1 });

/** Stable screen id from its display name ("Audi 02 (IMAX Laser)" → "audi-02-imax-laser"). */
export function screenIdFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Public reads skip inactive venues (documents from before venue status count as active). */
export const ACTIVE_VENUE_FILTER = { status: { $ne: "inactive" } } as const;

/** A stored screen in the current layout shape (legacy single aisle → list, missing lists and prices → empty / 0). */
export function toScreen(stored: StoredScreen): Screen {
  return {
    id: stored.id,
    name: stored.name,
    layoutType: stored.layoutType,
    formats: [...(stored.formats ?? [])],
    ...(stored.soundSystem ? { soundSystem: stored.soundSystem } : {}),
    zones: stored.zones.map((z) => ({
      id: z.id,
      name: z.name,
      description: z.description ?? "",
      accent: z.accent,
      recliner: Boolean(z.recliner),
      defaultPricePaise: z.defaultPricePaise ?? 0,
      rows: z.rows.map((r) => ({
        row: r.row,
        count: r.count,
        aislesAfter: r.aislesAfter?.length ? [...r.aislesAfter] : r.aisleAfter ? [r.aisleAfter] : [],
        accessibleSeats: [...(r.accessibleSeats ?? [])],
        blockedSeats: [...(r.blockedSeats ?? [])],
      })),
    })),
  };
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
      pricePaise: t.pricePaise,
      priceTier: t.priceTier,
      screenName: t.screenName,
    })),
  };
}

export const Venue: Model<VenueAttrs> =
  (models.Venue as Model<VenueAttrs> | undefined) ?? model<VenueAttrs>("Venue", venueSchema, "venues");
