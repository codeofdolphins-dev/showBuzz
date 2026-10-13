import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { safeNextPath } from "@showbuzz/utils/safe-next";
import { AppError } from "../../http/app-error";
import { adminCookies } from "./cookies";
import { currentStaff, type CurrentStaff } from "./staff-auth.service";

/**
 * Server-side guards for the admin app. proxy.ts only pre-checks the JWT; these are the security boundary:
 * every admin page, route handler and Server Action calls one of them.
 */

/** Verified staff member + session id for this request (one lookup per request). Reads cookies. */
export const getCurrentStaff = cache(async (): Promise<CurrentStaff | null> => {
  const store = await cookies();
  // The clock (token and session expiry) may only be read for a real request (Cache Components).
  await connection();
  return currentStaff(adminCookies.readAccessToken(store), new Date());
});

/** For Server Actions and route handlers: the staff member, or 401 UNAUTHENTICATED. */
export async function requireStaff(): Promise<CurrentStaff> {
  const current = await getCurrentStaff();
  if (!current) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return current;
}

/** For Server Actions and route handlers: the staff member if their role grants `permission`, else 401/403. */
export async function requirePermission(permission: string): Promise<CurrentStaff> {
  const current = await requireStaff();
  if (!hasPermission(current.staff.permissions, permission)) {
    throw new AppError("FORBIDDEN", "You don't have permission to do that.", 403);
  }
  return current;
}

/**
 * For Server Components: the staff member, or a redirect through the refresh route, which renews an expired
 * access token (the refresh cookie only reaches /api/v1/admin/auth) or sends the browser to /login.
 */
export async function requireStaffPage(currentPath: string): Promise<CurrentStaff> {
  const current = await getCurrentStaff();
  if (!current) redirect(`/api/v1/admin/auth/refresh?next=${encodeURIComponent(safeNextPath(currentPath))}`);
  return current;
}
