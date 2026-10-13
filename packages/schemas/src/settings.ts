import { z } from "zod";
import { CANCELLATION_CUTOFF_MINUTES, MAX_TICKETS_PER_ORDER, PRICING_DEFAULTS, SEAT_HOLD_MINUTES } from "./constants";
import { paiseSchema } from "./common";

/** Operator-editable business rules (the single `settings` document). Percentages are basis points. */
export const settingsSchema = z.object({
  gstBps: z.int().min(0).max(10_000),
  convenienceFeeBps: z.int().min(0).max(10_000),
  // Never above the hard limit the order schemas enforce.
  maxTicketsPerOrder: z.int().min(1).max(MAX_TICKETS_PER_ORDER),
  cancellationCutoffMinutes: z
    .int()
    .min(0)
    .max(7 * 24 * 60),
  cancellationFeePaise: paiseSchema,
  seatHoldMinutes: z.int().min(1).max(60),
});

export const SETTINGS_DEFAULTS: Settings = {
  gstBps: PRICING_DEFAULTS.gstBps,
  convenienceFeeBps: PRICING_DEFAULTS.convenienceFeeBps,
  maxTicketsPerOrder: MAX_TICKETS_PER_ORDER,
  cancellationCutoffMinutes: CANCELLATION_CUTOFF_MINUTES,
  cancellationFeePaise: PRICING_DEFAULTS.cancellationFeePaise,
  seatHoldMinutes: SEAT_HOLD_MINUTES,
};

export type Settings = z.infer<typeof settingsSchema>;
