import "server-only";
import { z } from "zod";

/**
 * Server environment shared by every app, validated once when first imported so a misconfigured deployment
 * fails at boot (and `next build` fails) instead of on the first request. Secrets that only one app needs
 * live in their own module (customer-auth-env.ts, admin-auth-env.ts), so the admin app never needs customer
 * secrets and vice versa. Together with public-env.ts these are the only places that read process.env.
 * Variables from CLAUDE.md §6 that no code uses yet (QR_SIGNING_SECRET, PAYMENT_KEY_*, ...) are added when the
 * code that needs them lands.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\/\S+$/, "must be a mongodb:// or mongodb+srv:// connection string"),
  MONGODB_DB: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,63}$/, "must be a database name (letters, digits, _ and -, max 63 characters)"),
  /** Set by Vercel: the deployment and branch hostnames, accepted as same-origin on preview deployments. */
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  /**
   * Payment gateway behind the PaymentGateway interface. Only "simulated" exists until Razorpay/Cashfree is
   * chosen; it is allowed in production (agreed 2026-10-13) so the demo can book on Vercel.
   */
  PAYMENT_PROVIDER: z.enum(["simulated"]).default("simulated"),
});

/** Parses `values` with `schema`, naming only the failing variables (values can hold credentials). */
export function parseEnv<T extends z.ZodType>(schema: T, values: Record<string, string | undefined>): z.output<T> {
  const result = schema.safeParse(values);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid server environment (see .env.example):\n  ${problems.join("\n  ")}`);
  }
  return result.data;
}

export const env = parseEnv(serverEnvSchema, {
  NODE_ENV: process.env.NODE_ENV,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB: process.env.MONGODB_DB,
  VERCEL_URL: process.env.VERCEL_URL,
  VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
});

export const isProduction = env.NODE_ENV === "production";

/** Demo-only flows (on-screen OTP codes) run outside production. Simulated payment is PAYMENT_PROVIDER instead. */
export const isDemoMode = !isProduction;
