import { z } from "zod";
import { idSchema } from "./common";

export const citySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  state: z.string().optional(),
  popular: z.boolean(),
});

export type City = z.infer<typeof citySchema>;
