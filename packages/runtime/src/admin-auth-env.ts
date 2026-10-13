import "server-only";
import { z } from "zod";
import { parseEnv } from "./env";

/** Secrets for staff sign-in, used by the admin app only. Never the same keys as the customer JWTs. */
const adminAuthEnvSchema = z
  .object({
    ADMIN_JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
    ADMIN_JWT_REFRESH_SECRET: z.string().min(32, "must be at least 32 characters"),
  })
  .refine((e) => e.ADMIN_JWT_ACCESS_SECRET !== e.ADMIN_JWT_REFRESH_SECRET, {
    message: "must differ from ADMIN_JWT_ACCESS_SECRET",
    path: ["ADMIN_JWT_REFRESH_SECRET"],
  });

export const adminAuthEnv = parseEnv(adminAuthEnvSchema, {
  ADMIN_JWT_ACCESS_SECRET: process.env.ADMIN_JWT_ACCESS_SECRET,
  ADMIN_JWT_REFRESH_SECRET: process.env.ADMIN_JWT_REFRESH_SECRET,
});
