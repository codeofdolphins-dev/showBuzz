import "server-only";
import { safeNextPath } from "@showbuzz/utils/safe-next";
import type { RouteDecision, RouteRequest } from "./route-guard";
import type { TokenCodec } from "./token-codec";

/**
 * proxy.ts decision for a back-office console (admin, partner), kept pure so it can be tested without Next. A fast
 * pre-check on the console's access JWT only (no database): pages, route handlers and actions still verify the
 * session themselves.
 */
export function createConsoleRouteGuard({
  tokens,
  publicPages,
  refreshPath,
}: {
  tokens: TokenCodec;
  /** Reachable without a session (sign-in, signup, robots.txt). */
  publicPages: readonly string[];
  /** GET <refreshPath>?next= renews the session or sends the browser to the login page. */
  refreshPath: string;
}): (req: RouteRequest) => Promise<RouteDecision> {
  const open = new Set(publicPages);
  return async (req) => {
    if (open.has(req.pathname)) return { type: "next" };
    // API routes answer 401/403 JSON themselves (and the auth API must stay reachable without a session).
    if (req.pathname.startsWith("/api/")) return { type: "next" };
    // Server Actions post to the page URL and check auth themselves.
    if (req.method !== "GET" && req.method !== "HEAD") return { type: "next" };
    if (req.accessToken && (await tokens.verifyAccessToken(req.accessToken, req.now)).ok) return { type: "next" };

    const next = safeNextPath(`${req.pathname}${req.search}`);
    return { type: "redirect", location: `${refreshPath}?next=${encodeURIComponent(next)}` };
  };
}
