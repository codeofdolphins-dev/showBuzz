import "server-only";
import { safeNextPath } from "@showbuzz/utils/safe-next";
import { verifyAccessToken } from "./jwt";

/**
 * proxy.ts decisions, kept pure so they can be tested without Next. This is a fast pre-check on the
 * access JWT only (no database): pages and actions still verify the session themselves.
 */

export type RouteDecision = { type: "next" } | { type: "redirect"; location: string };

export interface RouteRequest {
  method: string;
  pathname: string;
  /** Includes the leading "?" when present. */
  search: string;
  accessToken: string | undefined;
  now?: Date;
}

/**
 * /account/** page navigations need a valid customer access token. Without one the browser goes to the
 * refresh route, which renews the session and comes back, or moves on to the sign-in modal.
 * Non-GET requests (Server Actions post to the page URL) pass through: they check auth themselves.
 */
export async function decideCustomerRoute(req: RouteRequest): Promise<RouteDecision> {
  if (req.method !== "GET" && req.method !== "HEAD") return { type: "next" };
  if (req.accessToken && (await verifyAccessToken(req.accessToken, req.now)).ok) return { type: "next" };

  const next = safeNextPath(`${req.pathname}${req.search}`);
  return { type: "redirect", location: `/api/v1/auth/refresh?next=${encodeURIComponent(next)}` };
}
