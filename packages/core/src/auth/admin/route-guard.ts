import "server-only";
import { safeNextPath } from "@showbuzz/utils/safe-next";
import type { RouteDecision, RouteRequest } from "../route-guard";
import { adminTokens } from "./tokens";

/**
 * The admin app's proxy.ts decision, kept pure so it can be tested without Next. A fast pre-check on the staff
 * access JWT only (no database): pages, route handlers and actions still verify the session themselves.
 */

/** Reachable without a session. */
const PUBLIC_PAGES = new Set(["/login", "/forgot-password", "/robots.txt"]);

export async function decideStaffRoute(req: RouteRequest): Promise<RouteDecision> {
  if (PUBLIC_PAGES.has(req.pathname)) return { type: "next" };
  // API routes answer 401/403 JSON themselves (and the auth API must stay reachable without a session).
  if (req.pathname.startsWith("/api/")) return { type: "next" };
  // Server Actions post to the page URL and check auth themselves.
  if (req.method !== "GET" && req.method !== "HEAD") return { type: "next" };
  if (req.accessToken && (await adminTokens.verifyAccessToken(req.accessToken, req.now)).ok) return { type: "next" };

  const next = safeNextPath(`${req.pathname}${req.search}`);
  return { type: "redirect", location: `/api/v1/admin/auth/refresh?next=${encodeURIComponent(next)}` };
}
