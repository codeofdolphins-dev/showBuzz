import { z } from "zod";
import { idSchema, objectIdSchema, paiseSchema, slugSchema, wallClockTimeSchema } from "./common";

export const showAvailabilitySchema = z.enum(["available", "fast-filling", "almost-full"]);

/** A recurring daily showtime at a cinema. Concrete shows are generated per date from these. */
export const showTemplateSchema = z.object({
  time: wallClockTimeSchema,
  format: z.string().min(1),
  language: z.string().min(1),
  availability: showAvailabilitySchema,
  pricePaise: paiseSchema,
  priceTier: z.string().min(1),
  screenName: z.string().min(1),
});

export const cinemaSchema = z.object({
  id: idSchema,
  /** The vendor operating the cinema (filled from the database; seed data has none). */
  vendorId: objectIdSchema.optional(),
  /** The vendor's business name, shown as "by …". */
  operatorName: z.string().optional(),
  slug: slugSchema,
  name: z.string().min(1),
  cityId: idSchema,
  address: z.string().min(1),
  distanceLabel: z.string(),
  amenities: z.array(z.string()),
  cancellation: z.object({
    allowed: z.boolean(),
    label: z.string().min(1),
  }),
  /** Seeded cinemas generate their shows from these; a vendor's new cinema has none (its shows are scheduled). */
  showTemplates: z.array(showTemplateSchema),
});

export type ShowAvailability = z.infer<typeof showAvailabilitySchema>;
export type ShowTemplate = z.infer<typeof showTemplateSchema>;
export type Cinema = z.infer<typeof cinemaSchema>;

export const venueKindSchema = z.enum(["cinema", "stadium", "venue"]);
/** Inactive venues are hidden from the public site; tickets already sold stay valid. */
export const venueStatusSchema = z.enum(["active", "inactive"]);

/** Seat-category colours (prototype seat-layout legend); the public seat map uses them for the category badge. */
export const SEAT_ACCENTS = ["indigo", "blue", "teal", "amber", "purple", "green", "rose", "slate"] as const;
export const seatAccentSchema = z.enum(SEAT_ACCENTS);

/** Seat ids are row letter + number ("C7", SeatHold.seatId), so rows are A–Z and numbers stay below 100. */
export const MAX_SEATS_PER_ROW = 40;

export const seatRowSchema = z.object({
  row: z.string().regex(/^[A-Z]$/),
  count: z.int().min(1).max(MAX_SEATS_PER_ROW),
  /** Seat numbers after which an aisle gap is drawn. */
  aislesAfter: z.array(z.int().positive()).default([]),
  /** Seat numbers marked wheelchair accessible. */
  accessibleSeats: z.array(z.int().positive()).default([]),
  /** Seat numbers that are never sold (broken, removed, camera position...). */
  blockedSeats: z.array(z.int().positive()).default([]),
});

/** A block of rows sold at one price. Prices live on each show, so one layout serves every price list. */
export const seatZoneSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string(),
  accent: seatAccentSchema,
  recliner: z.boolean(),
  /** The price a newly scheduled show starts with for this category (each show keeps its own prices). */
  defaultPricePaise: paiseSchema,
  rows: z.array(seatRowSchema).min(1),
});

export const screenLayoutTypeSchema = z.enum(["screen", "stadium"]);

export const screenSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  layoutType: screenLayoutTypeSchema,
  /** Projection / experience formats this screen can run (2D, IMAX, 4DX...). */
  formats: z.array(z.string().min(1)).default([]),
  soundSystem: z.string().optional(),
  zones: z.array(seatZoneSchema).min(1),
});

/** A zone's name and price for one show (sports fixtures rename the stadium's zones after their stands). */
export const showZoneSchema = z.object({
  zoneId: idSchema,
  name: z.string().min(1),
  description: z.string(),
  pricePaise: paiseSchema,
});

export type VenueKind = z.infer<typeof venueKindSchema>;
export type VenueStatus = z.infer<typeof venueStatusSchema>;
export type SeatAccent = z.infer<typeof seatAccentSchema>;
export type ScreenLayoutType = z.infer<typeof screenLayoutTypeSchema>;
export type SeatRowSpec = z.infer<typeof seatRowSchema>;
export type SeatZone = z.infer<typeof seatZoneSchema>;
export type Screen = z.infer<typeof screenSchema>;
export type ShowZone = z.infer<typeof showZoneSchema>;
