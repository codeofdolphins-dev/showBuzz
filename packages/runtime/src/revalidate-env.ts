import "server-only";
import { z } from "zod";
import { parseEnv } from "./env";

/**
 * Shared secret for POST /api/internal/revalidate on the public app: the admin and partner consoles send it to
 * refresh showbuzz.com's cached catalogue after an edit. Every app needs the same value.
 */
const revalidateEnvSchema = z.object({
  REVALIDATE_SECRET: z.string().min(32, "must be at least 32 characters"),
});

export const revalidateEnv = parseEnv(revalidateEnvSchema, {
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
});
