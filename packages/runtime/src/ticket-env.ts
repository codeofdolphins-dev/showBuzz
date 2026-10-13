import "server-only";
import { z } from "zod";
import { parseEnv } from "./env";

/**
 * Ticket QR signing key. Used by the public app to sign M-tickets and, later, by the admin scan-qr screen to
 * verify them, so both apps need the same value.
 */
const ticketEnvSchema = z.object({
  /** HMAC-SHA256 key for ticket QR payloads. Rotating it invalidates every issued QR. */
  QR_SIGNING_SECRET: z.string().min(32, "must be at least 32 characters"),
});

export const ticketEnv = parseEnv(ticketEnvSchema, {
  QR_SIGNING_SECRET: process.env.QR_SIGNING_SECRET,
});
