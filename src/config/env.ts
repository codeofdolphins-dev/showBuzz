import { z } from "zod";

/**
 * The only place that reads process.env. Phase 1 (UI on seed data) needs no secrets, so the
 * backend variables from CLAUDE.md §6 (MONGODB_URI, JWT_*, QR_SIGNING_SECRET, PAYMENT_*, ...)
 * are added here as required when the code that uses them lands.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

/** Demo flows (mock OTP delivery, simulated payment) only run outside production. */
export const isDemoMode = env.NODE_ENV !== "production";
