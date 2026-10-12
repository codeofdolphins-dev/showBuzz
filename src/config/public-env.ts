import { z } from "zod";

/**
 * Browser-safe configuration (NEXT_PUBLIC_* only). Next inlines these at build time, which only works
 * when each variable is referenced literally as process.env.NEXT_PUBLIC_X. Never add secrets here.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
});

const isProductionBuild = process.env.NODE_ENV === "production";

const result = publicEnvSchema.safeParse({
  // Local development and tests fall back to the dev server; production must set it explicitly.
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? (isProductionBuild ? undefined : "http://localhost:3000"),
});

if (!result.success) {
  const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid public environment (see .env.example):\n  ${problems.join("\n  ")}`);
}

export const publicEnv = {
  ...result.data,
  /** Scheme + host (+ port) of NEXT_PUBLIC_APP_URL, for origin checks. */
  appOrigin: new URL(result.data.NEXT_PUBLIC_APP_URL).origin,
};
