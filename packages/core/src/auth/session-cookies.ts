import "server-only";
import { isProduction } from "@showbuzz/runtime/env";

/**
 * Session cookies for one app (docs/roadmap.md "Cookies"). The access cookie goes to every path; the refresh
 * cookie only to `refreshPath`, so it is sent nowhere except the refresh/logout endpoints. All cookies are
 * host-only (never a Domain attribute): showbuzz.com and admin.showbuzz.com never see each other's cookies.
 * In production the __Host-/__Secure- prefixes make browsers refuse cookies not set over HTTPS (and __Host-
 * forbids a Domain attribute outright).
 */

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

export interface SessionCookies {
  ACCESS_COOKIE: string;
  REFRESH_COOKIE: string;
  /**
   * "This browser has a session" (value "1", no secret). Lives as long as the refresh cookie but is sent to
   * every page, so the server can tell an expired access token (worth a silent refresh) from a visitor who
   * never signed in, without the client having to try a refresh on every page load.
   */
  SESSION_HINT_COOKIE: string;
  setSessionCookies(store: CookieStore, tokens: CookieTokens, now?: Date): void;
  /** Expires all session cookies. `cookies().delete(name)` can't do this: it only clears path "/". */
  clearSessionCookies(store: CookieStore): void;
  readAccessToken(store: Pick<CookieStore, "get">): string | undefined;
  /** True when the browser says it holds a session (see SESSION_HINT_COOKIE). */
  hasSessionHint(store: Pick<CookieStore, "get">): boolean;
  readRefreshToken(store: Pick<CookieStore, "get">): string | undefined;
}

const ACCESS_PATH = "/";

/** `prefix` names the cookies (`<prefix>_at`, `<prefix>_rt`, `<prefix>_has_session`). */
export function createSessionCookies({ prefix, refreshPath }: { prefix: string; refreshPath: string }): SessionCookies {
  const ACCESS_COOKIE = isProduction ? `__Host-${prefix}_at` : `${prefix}_at`;
  const REFRESH_COOKIE = isProduction ? `__Secure-${prefix}_rt` : `${prefix}_rt`;
  const SESSION_HINT_COOKIE = isProduction ? `__Host-${prefix}_has_session` : `${prefix}_has_session`;

  return {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    SESSION_HINT_COOKIE,
    setSessionCookies(store, tokens, now = new Date()) {
      store.set(ACCESS_COOKIE, tokens.accessToken, attributes(ACCESS_PATH, secondsUntil(tokens.accessExpiresAt, now)));
      store.set(REFRESH_COOKIE, tokens.refreshToken, attributes(refreshPath, secondsUntil(tokens.refreshExpiresAt, now)));
      store.set(SESSION_HINT_COOKIE, "1", attributes(ACCESS_PATH, secondsUntil(tokens.refreshExpiresAt, now)));
    },
    clearSessionCookies(store) {
      store.set(ACCESS_COOKIE, "", attributes(ACCESS_PATH, 0));
      store.set(REFRESH_COOKIE, "", attributes(refreshPath, 0));
      store.set(SESSION_HINT_COOKIE, "", attributes(ACCESS_PATH, 0));
    },
    readAccessToken: (store) => store.get(ACCESS_COOKIE)?.value || undefined,
    hasSessionHint: (store) => store.get(SESSION_HINT_COOKIE)?.value === "1",
    readRefreshToken: (store) => store.get(REFRESH_COOKIE)?.value || undefined,
  };
}

function attributes(path: string, maxAge: number): SessionCookieAttributes {
  return { httpOnly: true, secure: isProduction, sameSite: "lax", path, maxAge };
}

function secondsUntil(expiresAt: Date, now: Date): number {
  // Token expiry is in whole seconds while now has milliseconds: round up so maxAge matches the lifetime.
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}
