import { z } from "zod";
import { idSchema, imageUrlSchema, paiseSchema, slugSchema } from "./common";

export const streamTitleSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().min(1),
  category: z.string().min(1),
  badge: z.string(),
  rentPricePaise: paiseSchema,
  buyPricePaise: paiseSchema,
  durationMinutes: z.int().positive(),
  rating: z.number().min(0).max(10),
  poster: imageUrlSchema,
  description: z.string().min(1),
  featured: z.boolean(),
});

export type StreamTitle = z.infer<typeof streamTitleSchema>;
