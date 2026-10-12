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
