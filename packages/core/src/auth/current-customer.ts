import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { safeNextPath } from "@showbuzz/utils/safe-next";
import type { CustomerSnapshot } from "@showbuzz/schemas/user";
import type { CurrentSession } from "@showbuzz/schemas/types/auth";
import { AppError } from "../http/app-error";
import { hasSessionHint, readAccessToken } from "./cookies";
import { currentCustomer } from "./customer-auth.service";

/** Verified customer + session id for this request (one lookup per request). */
const loadCurrent = cache(async () => {
  const store = await cookies();
  // Partial prefetching can render this with cookies but no live request; the clock (token expiry, session
  // expiry) may only be read for a real request.
  await connection();
  return { current: await currentCustomer(readAccessToken(store), new Date()), hint: hasSessionHint(store) };
});

/**
 * The session for this request. Verifies the access cookie, then checks the user is active and the
 * session still exists (so sign-out takes effect immediately). cache() makes every caller in one
 * request share a single lookup. Reads cookies, so call it inside <Suspense>.
 */
export const getCurrentSession = cache(async (): Promise<CurrentSession> => {
  const { current, hint } = await loadCurrent();
  if (current) {
    return {
      customer: { user: current.user, accessExpiresAt: current.accessExpiresAt.toISOString() },
      mightRefresh: false,
    };
  }
  return { customer: null, mightRefresh: hint };
});

/** The signed-in customer for this request, or null. */
export const getCurrentCustomer = cache(
  async (): Promise<CustomerSnapshot | null> => (await getCurrentSession()).customer?.user ?? null,
);

/** For Server Actions and route handlers: the customer, or 401 UNAUTHENTICATED. */
export async function requireCustomer(): Promise<CustomerSnapshot> {
  const customer = await getCurrentCustomer();
  if (!customer) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return customer;
}

/**
 * For account mutations: the customer and the current session id ("this device"), checked live in the
 * database (an access token alone isn't enough), or 401 UNAUTHENTICATED.
 */
export async function requireCustomerSession(): Promise<{ user: CustomerSnapshot; sid: string }> {
  const { current } = await loadCurrent();
  if (!current) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return { user: current.user, sid: current.sid };
}

/**
 * For Server Components: the customer, or a redirect through the refresh route, which renews an expired
 * access token (the refresh cookie only reaches /api/v1/auth) or sends the visitor to the sign-in modal.
 */
export async function requireCustomerPage(currentPath: string): Promise<CustomerSnapshot> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect(`/api/v1/auth/refresh?next=${encodeURIComponent(safeNextPath(currentPath))}`);
  return customer;
}
