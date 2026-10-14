import "server-only";
import { createSessionCookies } from "../session-cookies";

/**
 * Vendor session cookies: sbp_at, sbp_rt (path /api/v1/partner/auth), sbp_has_session; __Host-/__Secure- in
 * production. Host-only, so partner.showbuzz.com never shares cookies with showbuzz.com or admin.showbuzz.com.
 */
export const PARTNER_REFRESH_PATH = "/api/v1/partner/auth";

export const partnerCookies = createSessionCookies({ prefix: "sbp", refreshPath: PARTNER_REFRESH_PATH });
