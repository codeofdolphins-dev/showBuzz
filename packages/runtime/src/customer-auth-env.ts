import "server-only";
import { z } from "zod";
import { isProduction, parseEnv } from "./env";

/** Secrets for customer sign-in (OTP + customer JWTs), used by the public app only. */
const customerAuthEnvSchema = z
  .object({
    /** HMAC key for OTP codes at rest (codes are never stored in plain text). */
    OTP_HASH_SECRET: z.string().min(32, "must be at least 32 characters"),
    /**
     * How sign-in codes reach the customer. No SMS/email provider is chosen yet:
     * - "none" (default): the code is written to the server log (and shown on screen outside production);
     * - "dev": shown on screen only, never logged; not allowed in production.
     */
    OTP_PROVIDER: z.enum(["none", "dev"]).default("none"),
    /** HS256 keys for customer JWTs. Separate keys so one can be rotated without the other. */
    JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "must be at least 32 characters"),
  })
  .refine((e) => !(isProduction && e.OTP_PROVIDER === "dev"), {
    message: '"dev" is not allowed in production',
    path: ["OTP_PROVIDER"],
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    message: "must differ from JWT_ACCESS_SECRET",
    path: ["JWT_REFRESH_SECRET"],
  });

export const customerAuthEnv = parseEnv(customerAuthEnvSchema, {
  OTP_HASH_SECRET: process.env.OTP_HASH_SECRET,
  OTP_PROVIDER: process.env.OTP_PROVIDER,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
});
