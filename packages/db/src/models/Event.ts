import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { EventListing } from "@showbuzz/schemas/event";
import { type LeanDoc, sortOrderField } from "./transforms";

/** Stored flat; `toEvent` turns it back into the `eventScheduleSchema` union. */
interface StoredSchedule {
  type: "once" | "daily";
  startsAt?: Date;
  endsAt?: Date;
  opensAt?: string;
  closesAt?: string;
}

/** Every non-movie listing (one collection, `kind` picks the public section). Slugs are unique per kind. */
export interface EventAttrs extends Omit<EventListing, "id" | "schedule" | "vendorId" | "organiserName"> {
  schedule: StoredSchedule;
  /** The organiser selling this listing. */
  vendorId: Types.ObjectId;
  /** The venue document behind `venueName`; stadium fixtures have a Show there. */
  venueId?: Types.ObjectId;
  /** Inactive listings are hidden from the public site (older documents have no status = active). */
  status?: EventStatus;
  /** Running time in minutes (partner form); stadium fixtures use it to keep a screen free. `durationLabel` is shown. */
  durationMinutes?: number;
  /** Set by ShowBuzz staff (admin oversight): hidden publicly whatever `status` says; only staff can restore it. */
  takenDownAt?: Date;
  takedownReason?: string;
  takenDownBy?: Types.ObjectId;
  sortOrder: number;
}

export type EventStatus = "active" | "inactive";

/** Public reads: listings not switched off by their organiser and not taken down by ShowBuzz. */
export const ACTIVE_EVENT_FILTER = { status: { $ne: "inactive" }, takenDownAt: { $exists: false } } as const;

const ticketTierSchema = new Schema(
  { id: String, name: String, description: String, pricePaise: Number, available: Number },
  { _id: false },
);
const artistSchema = new Schema({ name: String, role: String, image: String }, { _id: false });
const scheduleSchema = new Schema(
  {
    type: { type: String, enum: ["once", "daily"], required: true },
    startsAt: Date,
    endsAt: Date,
    opensAt: String,
    closesAt: String,
  },
  { _id: false },
);

const eventSchema = new Schema<EventAttrs>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    slug: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["event", "play", "sport", "activity"], required: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    schedule: { type: scheduleSchema, required: true },
    durationLabel: String,
    language: String,
    ageLimit: String,
    venueName: { type: String, required: true },
    venueId: { type: Schema.Types.ObjectId, ref: "Venue" },
    cityId: { type: String, required: true },
    poster: { type: String, required: true },
    backdrop: String,
    about: { type: String, required: true },
    director: String,
    artists: { type: [artistSchema], default: [] },
    ticketTiers: { type: [ticketTierSchema], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    durationMinutes: { type: Number, min: 1 },
    takenDownAt: Date,
    takedownReason: { type: String, maxlength: 300 },
    takenDownBy: { type: Schema.Types.ObjectId, ref: "Staff" },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

eventSchema.index({ kind: 1, slug: 1 }, { unique: true });
eventSchema.index({ kind: 1, sortOrder: 1 });
eventSchema.index({ vendorId: 1, kind: 1 });
// Admin oversight lists (all vendors, one kind).
eventSchema.index({ kind: 1, "schedule.startsAt": -1 });

function toSchedule(s: StoredSchedule): EventListing["schedule"] {
  if (s.type === "daily") return { type: "daily", opensAt: s.opensAt ?? "00:00", closesAt: s.closesAt ?? "23:59" };
  return {
    type: "once",
    startsAt: (s.startsAt ?? new Date(0)).toISOString(),
    ...(s.endsAt ? { endsAt: s.endsAt.toISOString() } : {}),
  };
}

/** Optional strings come back from Mongo as missing or null; the Zod shape wants them absent. */
function opt<K extends string>(key: K, value: string | null | undefined): Partial<Record<K, string>> {
  return value ? ({ [key]: value } as Record<K, string>) : {};
}

export function toEvent(doc: LeanDoc<EventAttrs>): EventListing {
  return {
    id: doc._id.toString(),
    ...(doc.vendorId ? { vendorId: doc.vendorId.toString() } : {}),
    slug: doc.slug,
    kind: doc.kind,
    title: doc.title,
    category: doc.category,
    schedule: toSchedule(doc.schedule),
    ...opt("durationLabel", doc.durationLabel),
    ...opt("language", doc.language),
    ...opt("ageLimit", doc.ageLimit),
    venueName: doc.venueName,
    cityId: doc.cityId,
    poster: doc.poster,
    ...opt("backdrop", doc.backdrop),
    about: doc.about,
    ...opt("director", doc.director),
    artists: doc.artists.map((a) => ({ name: a.name, role: a.role, image: a.image })),
    ticketTiers: doc.ticketTiers.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      pricePaise: t.pricePaise,
      available: t.available,
    })),
  };
}

export const Event: Model<EventAttrs> =
  (models.Event as Model<EventAttrs> | undefined) ?? model<EventAttrs>("Event", eventSchema, "events");
