import { adminCookies } from "@showbuzz/core/auth/admin/cookies";
import { currentStaff } from "@showbuzz/core/auth/admin/staff-auth.service";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { AppError } from "@showbuzz/core/http/app-error";
import { readRequestCookies } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";

/**
 * The signed-in staff member with their role and permissions. 401 when the access token is missing, expired,
 * not a staff token (customer tokens never verify here) or its session has ended.
 */
export const GET = apiHandler({}, async ({ request }) => {
  const current = await currentStaff(adminCookies.readAccessToken(readRequestCookies(request)), new Date());
  if (!current) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return ok({ staff: current.staff, accessExpiresAt: current.accessExpiresAt.toISOString() });
});
