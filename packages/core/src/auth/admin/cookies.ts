import "server-only";
import { createSessionCookies } from "../session-cookies";

/**
 * Staff session cookies: sba_at, sba_rt (path /api/v1/admin/auth), sba_has_session; __Host-/__Secure- in
 * production. Host-only like the customer cookies, and named differently, so admin.showbuzz.com never reads a
 * customer cookie even on a shared host in development.
 */
export const ADMIN_REFRESH_PATH = "/api/v1/admin/auth";

export const adminCookies = createSessionCookies({ prefix: "sba", refreshPath: ADMIN_REFRESH_PATH });
