/**
 * Business constants. Values that operators can change (fees, limits) will move to the
 * `settings` document in the backend phase; until then these are the defaults.
 */

export const APP_NAME = "ShowBuzz";
export const APP_TIME_ZONE = "Asia/Kolkata";
export const IST_OFFSET = "+05:30";
export const CURRENCY = "INR";

export const DEFAULT_CITY = { id: "kolkata", name: "Kolkata", state: "West Bengal" } as const;

/** Percentage values are basis points (850 = 8.5%) so pricing stays in integer maths. */
export const PRICING_DEFAULTS = {
  gstBps: 1800,
  convenienceFeeBps: 850,
  cancellationFeePaise: 5000,
} as const;

// Open question (CLAUDE.md §12): the public seat page enforces 8, admin settings say 10.
export const MAX_TICKETS_PER_ORDER = 8;

// Open question (CLAUDE.md §12): public data says 20 minutes, admin settings say 4 hours.
export const CANCELLATION_CUTOFF_MINUTES = 20;

export const SEAT_HOLD_MINUTES = 10;

export const GIFT_CARD_LIMITS = { minPaise: 25_000, maxPaise: 1_000_000 } as const;
export const GIFT_CARD_PRESETS_PAISE = [50_000, 100_000, 200_000, 500_000] as const;

export const SHOW_DATE_WINDOW_DAYS = 7;
