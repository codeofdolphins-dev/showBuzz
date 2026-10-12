import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once when first imported so a misconfigured deployment fails at
 * boot (and `next build` fails) instead of on the first request. Together with public-env.ts this is
 * the only place that reads process.env. Variables from CLAUDE.md §6 that no code uses yet (JWT_*,
 * QR_SIGNING_SECRET, PAYMENT_*, ...) are added here when the code that needs them lands.
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
});

function parseServerEnv() {
  const result = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB: process.env.MONGODB_DB,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
  });
  if (!result.success) {
    // Name the variables only: values can hold credentials.
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid server environment (see .env.example):\n  ${problems.join("\n  ")}`);
  }
  return result.data;
}

export const env = parseServerEnv();

export const isProduction = env.NODE_ENV === "production";

/** Demo flows (mock OTP delivery, simulated payment) only run outside production. */
export const isDemoMode = !isProduction;
