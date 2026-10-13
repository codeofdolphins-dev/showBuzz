import { z } from "zod";
import { idSchema, paiseSchema, slugSchema, wallClockTimeSchema } from "./common";

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
  showTemplates: z.array(showTemplateSchema).min(1),
});

export type ShowAvailability = z.infer<typeof showAvailabilitySchema>;
export type ShowTemplate = z.infer<typeof showTemplateSchema>;
export type Cinema = z.infer<typeof cinemaSchema>;

export const venueKindSchema = z.enum(["cinema", "stadium", "venue"]);

export const seatRowSchema = z.object({
  row: z.string().regex(/^[A-Z]$/),
  count: z.int().min(1).max(40),
  /** Seat number after which an aisle gap is drawn. */
  aisleAfter: z.int().positive().optional(),
  /** Seat numbers marked wheelchair accessible. */
  accessibleSeats: z.array(z.int().positive()).default([]),
});

/** A block of rows sold at one price. Prices live on each show, so one layout serves every price list. */
export const seatZoneSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string(),
  accent: z.enum(["rose", "amber", "blue"]),
  recliner: z.boolean(),
  rows: z.array(seatRowSchema).min(1),
});

export const screenSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  layoutType: z.enum(["screen", "stadium"]),
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
export type SeatRowSpec = z.infer<typeof seatRowSchema>;
export type SeatZone = z.infer<typeof seatZoneSchema>;
export type Screen = z.infer<typeof screenSchema>;
export type ShowZone = z.infer<typeof showZoneSchema>;
