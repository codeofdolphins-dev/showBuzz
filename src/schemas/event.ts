import { z } from "zod";
import { idSchema, imageUrlSchema, isoDateTimeSchema, paiseSchema, slugSchema, wallClockTimeSchema } from "./common";

/** One `events` collection holds every non-movie listing; `kind` decides the public section. */
export const eventKindSchema = z.enum(["event", "play", "sport", "activity"]);

export const ticketTierSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string(),
  pricePaise: paiseSchema,
  available: z.int().nonnegative(),
});

export const eventScheduleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("once"),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema.optional(),
  }),
  z.object({
    type: z.literal("daily"),
    opensAt: wallClockTimeSchema,
    closesAt: wallClockTimeSchema,
  }),
]);

export const artistSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  image: imageUrlSchema,
});

export const eventSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  kind: eventKindSchema,
  title: z.string().min(1),
  category: z.string().min(1),
  schedule: eventScheduleSchema,
  durationLabel: z.string().optional(),
  language: z.string().optional(),
  ageLimit: z.string().optional(),
  venueName: z.string().min(1),
  cityId: idSchema,
  poster: imageUrlSchema,
  backdrop: imageUrlSchema.optional(),
  about: z.string().min(1),
  director: z.string().optional(),
  artists: z.array(artistSchema),
  ticketTiers: z.array(ticketTierSchema).min(1),
});

export type EventKind = z.infer<typeof eventKindSchema>;
export type TicketTier = z.infer<typeof ticketTierSchema>;
export type EventSchedule = z.infer<typeof eventScheduleSchema>;
export type EventListing = z.infer<typeof eventSchema>;
