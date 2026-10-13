import "server-only";

export type AppErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "SEAT_UNAVAILABLE"
  | "COUPON_INVALID"
  | "BOOKING_NOT_CANCELLABLE"
  | "HOLD_EXPIRED"
  | "PAYMENT_FAILED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "STEP_UP_REQUIRED"
  | "INTERNAL";

/**
 * An expected failure with a customer-facing message. `details` is returned to the client, so it
 * must only hold safe values (e.g. `retryAfterSec`, which also sets the Retry-After header).
 */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly status = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
