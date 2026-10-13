import "server-only";
import { getClientIp } from "../http/request";

/** Request facts the auth services need, built by Server Actions and route handlers from headers(). */
export interface AuthRequestContext {
  /** From getClientIp(); "unknown" skips per-IP limits (local development has no forwarded IP). */
  ip: string;
  userAgent?: string;
  now: Date;
}

/** Works with a Request's headers or `await headers()` in a Server Action. */
export function authContextFrom(headers: Pick<Headers, "get">, now = new Date()): AuthRequestContext {
  const userAgent = headers.get("user-agent")?.slice(0, 300);
  return { ip: getClientIp(headers), now, ...(userAgent ? { userAgent } : {}) };
}
