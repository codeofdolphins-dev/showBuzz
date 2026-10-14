import "server-only";
import { z } from "zod";
import { isProduction, parseEnv } from "./env";

/**
 * One-time codes (OTP service in @showbuzz/core): customer sign-in on the public app and mobile verification at
 * vendor signup on the partner app. Each app may use its own OTP_HASH_SECRET: a code is only ever checked by the
 * app that issued it.
 */
const otpEnvSchema = z
  .object({
    /** HMAC key for OTP codes at rest (codes are never stored in plain text). */
    OTP_HASH_SECRET: z.string().min(32, "must be at least 32 characters"),
    /**
     * How codes are delivered. No SMS/email provider is chosen yet:
     * - "none" (default): the code is written to the server log (and shown on screen outside production);
     * - "dev": shown on screen only, never logged; not allowed in production.
     */
    OTP_PROVIDER: z.enum(["none", "dev"]).default("none"),
  })
  .refine((e) => !(isProduction && e.OTP_PROVIDER === "dev"), {
    message: '"dev" is not allowed in production',
    path: ["OTP_PROVIDER"],
  });

export const otpEnv = parseEnv(otpEnvSchema, {
  OTP_HASH_SECRET: process.env.OTP_HASH_SECRET,
  OTP_PROVIDER: process.env.OTP_PROVIDER,
});
