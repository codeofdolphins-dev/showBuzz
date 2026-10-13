import "server-only";
import { createSessionCookies } from "./session-cookies";

/** Customer session cookies: sb_at, sb_rt (path /api/v1/auth), sb_has_session. */

export type { CookieStore, CookieTokens, SessionCookieAttributes } from "./session-cookies";

export const customerCookies = createSessionCookies({ prefix: "sb", refreshPath: "/api/v1/auth" });

export const {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_HINT_COOKIE,
  setSessionCookies,
  clearSessionCookies,
  readAccessToken,
  hasSessionHint,
  readRefreshToken,
} = customerCookies;
