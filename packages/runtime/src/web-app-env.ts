import "server-only";
import { z } from "zod";
import { isProduction, parseEnv } from "./env";

/**
 * Where the consoles (admin, partner) reach the public app server-to-server, e.g. to refresh its cache. Required in
 * production (https://showbuzz.com); defaults to the local web dev server otherwise. The public app doesn't use it.
 */
const webAppEnvSchema = z
  .object({
    WEB_APP_URL: z.url({ protocol: /^https?$/ }).optional(),
  })
  .refine((e) => !isProduction || e.WEB_APP_URL, { message: "is required in production", path: ["WEB_APP_URL"] });

const parsed = parseEnv(webAppEnvSchema, { WEB_APP_URL: process.env.WEB_APP_URL || undefined });

/** Origin of the public app, without a trailing slash. */
export const webAppOrigin = new URL(parsed.WEB_APP_URL ?? "http://localhost:3000").origin;
