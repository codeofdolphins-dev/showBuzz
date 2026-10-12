import "server-only";

export type AppErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "SEAT_UNAVAILABLE"
  | "COUPON_INVALID"
  | "BOOKING_NOT_CANCELLABLE"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED";

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
