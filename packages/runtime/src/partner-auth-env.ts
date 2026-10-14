import "server-only";
import { z } from "zod";
import { parseEnv } from "./env";

/** Secrets for vendor sign-in, used by the partner app only. Never the same keys as the customer or staff JWTs. */
const partnerAuthEnvSchema = z
  .object({
    PARTNER_JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
    PARTNER_JWT_REFRESH_SECRET: z.string().min(32, "must be at least 32 characters"),
  })
  .refine((e) => e.PARTNER_JWT_ACCESS_SECRET !== e.PARTNER_JWT_REFRESH_SECRET, {
    message: "must differ from PARTNER_JWT_ACCESS_SECRET",
    path: ["PARTNER_JWT_REFRESH_SECRET"],
  });

export const partnerAuthEnv = parseEnv(partnerAuthEnvSchema, {
  PARTNER_JWT_ACCESS_SECRET: process.env.PARTNER_JWT_ACCESS_SECRET,
  PARTNER_JWT_REFRESH_SECRET: process.env.PARTNER_JWT_REFRESH_SECRET,
});
