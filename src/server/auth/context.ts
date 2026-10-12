/** Request facts the auth services need, built by Server Actions and route handlers from headers(). */
export interface AuthRequestContext {
  /** From getClientIp(); "unknown" skips per-IP limits (local development has no forwarded IP). */
  ip: string;
  userAgent?: string;
  now: Date;
}
