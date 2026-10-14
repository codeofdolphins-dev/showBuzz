import "server-only";
import { z } from "zod";
import { parseEnv } from "./env";
import { otpEnv } from "./otp-env";

/** Secrets for customer sign-in (OTP + customer JWTs), used by the public app only. */
const customerJwtEnvSchema = z
  .object({
    /** HS256 keys for customer JWTs. Separate keys so one can be rotated without the other. */
    JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "must be at least 32 characters"),
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    message: "must differ from JWT_ACCESS_SECRET",
    path: ["JWT_REFRESH_SECRET"],
  });

/** The OTP settings (otp-env.ts, shared with the partner app's signup) plus the customer JWT keys. */
export const customerAuthEnv = {
  ...otpEnv,
  ...parseEnv(customerJwtEnvSchema, {
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  }),
};
