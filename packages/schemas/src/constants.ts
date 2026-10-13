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

/** Customer sign-in (docs/roadmap.md "Decisions already taken"). */
export const AUTH = {
  otpLength: 6,
  // Short enough that a code read over someone's shoulder is soon useless, long enough for slow SMS.
  otpTtlSec: 5 * 60,
  // With 6 digits, 5 guesses per code give a 1-in-200,000 chance; rate limits cap how many codes.
  otpMaxAttempts: 5,
  // Stops "resend" from being used to flood a phone or inbox; matches the UI's resend timer.
  otpResendCooldownSec: 30,
  // Access tokens can't be revoked, so they stay short; refresh tokens are revocable per session.
  accessTokenTtlSec: 15 * 60,
  refreshTokenTtlSec: 7 * 24 * 60 * 60,
  // One entry per signed-in device; the oldest session is evicted beyond this.
  maxSessionsPerUser: 10,
  // Changing or removing a phone/email needs a sign-in or "confirm it's you" code this recent (step-up).
  stepUpWindowSec: 10 * 60,
} as const;

/** Staff sign-in (admin app). Tokens use their own keys and audience; see ADMIN_JWT_* in runtime/admin-auth-env. */
export const ADMIN_AUTH = {
  accessTokenTtlSec: 15 * 60,
  // Rotated on every use and revocable per device, like customer refresh tokens.
  refreshTokenTtlSec: 7 * 24 * 60 * 60,
  maxSessionsPerStaff: 5,
  bcryptCost: 12,
  // Login attempts per window: per email stops guessing one account, per IP stops spraying many.
  loginWindowSec: 15 * 60,
  loginMaxPerEmail: 5,
  loginMaxPerIp: 20,
  // Current-password checks on /profile (same guessing risk as login).
  passwordChangeMaxPerWindow: 5,
} as const;

/** Display name for accounts created from the sign-in tab, where no name is asked for. */
export const DEFAULT_CUSTOMER_NAME = "ShowBuzz Member";

export const GIFT_CARD_LIMITS = { minPaise: 25_000, maxPaise: 1_000_000 } as const;
export const GIFT_CARD_PRESETS_PAISE = [50_000, 100_000, 200_000, 500_000] as const;

export const SHOW_DATE_WINDOW_DAYS = 7;
