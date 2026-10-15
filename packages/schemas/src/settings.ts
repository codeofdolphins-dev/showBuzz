import { z } from "zod";
import {
  CANCELLATION_CUTOFF_MINUTES,
  DEFAULT_CITY,
  MAX_TICKETS_PER_ORDER,
  PRICING_DEFAULTS,
  SEAT_HOLD_MINUTES,
} from "./constants";
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
  /** Commission for new commission-billed vendors (each vendor then has its own rate). */
  defaultCommissionBps: z.int().min(0).max(10_000),
  /** Shown on the public contact page, footer and FAQ (prompt 7). */
  supportEmail: z.email(),
  supportPhone: z.string().min(3).max(60),
  /** City slug the public city picker starts on for a new visitor. */
  defaultCityId: z.string().min(1).max(64),
});

export const SETTINGS_DEFAULTS: Settings = {
  gstBps: PRICING_DEFAULTS.gstBps,
  convenienceFeeBps: PRICING_DEFAULTS.convenienceFeeBps,
  maxTicketsPerOrder: MAX_TICKETS_PER_ORDER,
  cancellationCutoffMinutes: CANCELLATION_CUTOFF_MINUTES,
  cancellationFeePaise: PRICING_DEFAULTS.cancellationFeePaise,
  seatHoldMinutes: SEAT_HOLD_MINUTES,
  defaultCommissionBps: PRICING_DEFAULTS.commissionBps,
  supportEmail: "support@showbuzz.in",
  supportPhone: "+91 (033) 4000-SHOW / 1800-200-8899",
  defaultCityId: DEFAULT_CITY.id,
};

export type Settings = z.infer<typeof settingsSchema>;

/** What the public site may show from Settings (support contact, default city). */
export type PublicSettings = Pick<Settings, "supportEmail" | "supportPhone" | "defaultCityId">;
