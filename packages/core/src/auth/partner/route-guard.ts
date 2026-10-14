import "server-only";
import { createConsoleRouteGuard } from "../console-route-guard";
import { PARTNER_REFRESH_PATH } from "./cookies";
import { partnerTokens } from "./tokens";

/**
 * The partner app's proxy.ts decision: a fast pre-check on the vendor access JWT only (no database). Pages, route
 * handlers and actions still verify the session (and the onboarding state) themselves.
 */
export const decidePartnerRoute = createConsoleRouteGuard({
  tokens: partnerTokens,
  publicPages: ["/login", "/signup", "/forgot-password", "/robots.txt"],
  refreshPath: `${PARTNER_REFRESH_PATH}/refresh`,
});
