import "server-only";
import { z } from "zod";
import { parseEnv } from "./env";

/**
 * Appdoot transactional messaging (SMS), the provider that delivers one-time codes when
 * OTP_PROVIDER=appdoot. Parsed lazily rather than at import, like payment-env.ts: a deployment still
 * running OTP_PROVIDER=none/dev must boot without these credentials.
 */
const appdootEnvSchema = z.object({
  /** App id, sent as the X-App-Id header. */
  APPDOOT_APP_ID: z.string().min(8, "must be at least 8 characters"),
  /** Secret key, sent as the X-Secret-Key header. Never leaves the server. */
  APPDOOT_SECRET_KEY: z.string().min(16, "must be at least 16 characters"),
  /**
   * The DLT-registered template the code is sent with. Its single variable {{1}} is the code, so one
   * template serves every purpose (sign-in, contact change, deletion, re-authentication).
   */
  APPDOOT_OTP_TEMPLATE_ID: z.string().min(1).default("authentication"),
  /** API base, without a trailing slash. Overridable for a staging host. */
  APPDOOT_BASE_URL: z
    .string()
    .regex(/^https:\/\/\S+[^/]$/, "must be an https URL without a trailing slash")
    .default("https://appdoot.com/v1"),
});

export type AppdootEnv = z.output<typeof appdootEnvSchema>;

let cached: AppdootEnv | undefined;

/** Validates and caches the Appdoot credentials on first use. Throws (naming only the bad variable) if unset. */
export function appdootEnv(): AppdootEnv {
  cached ??= parseEnv(appdootEnvSchema, {
    APPDOOT_APP_ID: process.env.APPDOOT_APP_ID,
    APPDOOT_SECRET_KEY: process.env.APPDOOT_SECRET_KEY,
    APPDOOT_OTP_TEMPLATE_ID: process.env.APPDOOT_OTP_TEMPLATE_ID,
    APPDOOT_BASE_URL: process.env.APPDOOT_BASE_URL,
  });
  return cached;
}
