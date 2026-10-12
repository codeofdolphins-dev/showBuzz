import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { safeNextPath } from "@/lib/safe-next";
import type { CustomerSnapshot } from "@/schemas/user";
import type { CurrentSession } from "@/types/auth";
import { AppError } from "@/server/http/app-error";
import { hasSessionHint, readAccessToken } from "./cookies";
import { currentCustomer } from "./customer-auth.service";

/**
 * The session for this request. Verifies the access cookie, then checks the user is active and the
 * session still exists (so sign-out takes effect immediately). cache() makes every caller in one
 * request share a single lookup. Reads cookies, so call it inside <Suspense>.
 */
export const getCurrentSession = cache(async (): Promise<CurrentSession> => {
  const store = await cookies();
  const current = await currentCustomer(readAccessToken(store), new Date());
  if (current) {
    return {
      customer: { user: current.user, accessExpiresAt: current.accessExpiresAt.toISOString() },
      mightRefresh: false,
    };
  }
  return { customer: null, mightRefresh: hasSessionHint(store) };
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
 * For Server Components: the customer, or a redirect through the refresh route, which renews an expired
 * access token (the refresh cookie only reaches /api/v1/auth) or sends the visitor to the sign-in modal.
 */
export async function requireCustomerPage(currentPath: string): Promise<CustomerSnapshot> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect(`/api/v1/auth/refresh?next=${encodeURIComponent(safeNextPath(currentPath))}`);
  return customer;
}
