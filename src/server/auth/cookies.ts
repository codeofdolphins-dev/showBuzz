import "server-only";
import { isProduction } from "@/config/env";

/**
 * Session cookies (docs/roadmap.md "Cookies"). The access cookie goes to every path; the refresh
 * cookie only to /api/v1/auth, so it is sent nowhere except the refresh/logout endpoints. In
 * production the __Host-/__Secure- prefixes make browsers refuse cookies not set over HTTPS.
 */

export const ACCESS_COOKIE = isProduction ? "__Host-sb_at" : "sb_at";
export const REFRESH_COOKIE = isProduction ? "__Secure-sb_rt" : "sb_rt";

const ACCESS_PATH = "/";
const REFRESH_PATH = "/api/v1/auth";

export interface SessionCookieAttributes {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
}

/**
 * The part of a cookie jar these helpers need. Both `await cookies()` (Server Actions, route
 * handlers) and `NextResponse.cookies` / `NextRequest.cookies` fit it.
 */
export interface CookieStore {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, attributes: SessionCookieAttributes): unknown;
}

export interface CookieTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export function setSessionCookies(store: CookieStore, tokens: CookieTokens, now = new Date()): void {
  store.set(ACCESS_COOKIE, tokens.accessToken, attributes(ACCESS_PATH, secondsUntil(tokens.accessExpiresAt, now)));
  store.set(REFRESH_COOKIE, tokens.refreshToken, attributes(REFRESH_PATH, secondsUntil(tokens.refreshExpiresAt, now)));
}

/** Expires both cookies. `cookies().delete(name)` can't do this: it only clears path "/". */
export function clearSessionCookies(store: CookieStore): void {
  store.set(ACCESS_COOKIE, "", attributes(ACCESS_PATH, 0));
  store.set(REFRESH_COOKIE, "", attributes(REFRESH_PATH, 0));
}

export function readAccessToken(store: Pick<CookieStore, "get">): string | undefined {
  return store.get(ACCESS_COOKIE)?.value || undefined;
}

export function readRefreshToken(store: Pick<CookieStore, "get">): string | undefined {
  return store.get(REFRESH_COOKIE)?.value || undefined;
}

function attributes(path: string, maxAge: number): SessionCookieAttributes {
  return { httpOnly: true, secure: isProduction, sameSite: "lax", path, maxAge };
}

function secondsUntil(expiresAt: Date, now: Date): number {
  // Token expiry is in whole seconds while now has milliseconds: round up so maxAge matches the lifetime.
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}
