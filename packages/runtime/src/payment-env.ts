import "server-only";
import { z } from "zod";
import { parseEnv } from "./env";

/**
 * Razorpay credentials. Unlike the other env modules these are parsed lazily, not at import: they are only
 * required when PAYMENT_PROVIDER=razorpay, so a deployment still running the simulated gateway must boot
 * without them. The web app charges with these keys; admin and partner need them too, because staff and
 * vendor cancellations refund through the same gateway (services/booking-cancel.service.ts).
 */
const paymentEnvSchema = z.object({
  /** Public key id, also handed to Razorpay Checkout in the browser. */
  PAYMENT_KEY_ID: z
    .string()
    .regex(/^rzp_(test|live)_[A-Za-z0-9]+$/, "must be a Razorpay key id (rzp_test_… or rzp_live_…)"),
  /** Secret half of the key pair. Signs and verifies every handshake; never leaves the server. */
  PAYMENT_KEY_SECRET: z.string().min(16, "must be at least 16 characters"),
  /**
   * Webhook signing secret from the Razorpay dashboard (Settings → Webhooks). Optional: without it the
   * webhook route answers 503 and confirmation relies on the browser handshake alone.
   */
  PAYMENT_WEBHOOK_SECRET: z.string().min(8, "must be at least 8 characters").optional(),
});

export type PaymentEnv = z.output<typeof paymentEnvSchema>;

let cached: PaymentEnv | undefined;

/** Validates and caches the Razorpay credentials on first use. Throws (naming only the bad variable) if unset. */
export function paymentEnv(): PaymentEnv {
  cached ??= parseEnv(paymentEnvSchema, {
    PAYMENT_KEY_ID: process.env.PAYMENT_KEY_ID,
    PAYMENT_KEY_SECRET: process.env.PAYMENT_KEY_SECRET,
    PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
  });
  return cached;
}
