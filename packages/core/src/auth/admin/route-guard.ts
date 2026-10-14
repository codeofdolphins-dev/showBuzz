import "server-only";
import { createConsoleRouteGuard } from "../console-route-guard";
import { adminTokens } from "./tokens";

/**
 * The admin app's proxy.ts decision: a fast pre-check on the staff access JWT only (no database). Pages, route
 * handlers and actions still verify the session themselves.
 */
export const decideStaffRoute = createConsoleRouteGuard({
  tokens: adminTokens,
  publicPages: ["/login", "/forgot-password", "/robots.txt"],
  refreshPath: "/api/v1/admin/auth/refresh",
});
