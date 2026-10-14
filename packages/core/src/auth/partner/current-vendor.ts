import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { safeNextPath } from "@showbuzz/utils/safe-next";
import { AppError } from "../../http/app-error";
import { PARTNER_REFRESH_PATH, partnerCookies } from "./cookies";
import { currentVendor, type CurrentVendor } from "./vendor-auth.service";

/**
 * Server-side guards for the partner app. proxy.ts only pre-checks the JWT; these are the security boundary: every
 * partner page, route handler and Server Action calls one of them. The vendor id used to scope data always comes
 * from here (the session), never from the request.
 */

/** Verified vendor user + vendor + session id for this request (one lookup per request). Reads cookies. */
export const getCurrentVendor = cache(async (): Promise<CurrentVendor | null> => {
  const store = await cookies();
  // The clock (token and session expiry) may only be read for a real request.
  await connection();
  return currentVendor(partnerCookies.readAccessToken(store), new Date());
});

/** For Server Actions and route handlers: the signed-in vendor, or 401 UNAUTHENTICATED. */
export async function requireVendor(): Promise<CurrentVendor> {
  const current = await getCurrentVendor();
  if (!current) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return current;
}

/**
 * For actions that change listings (venues, shows, prices, offers...): onboarding must be complete and the vendor
 * not suspended. Suspended vendors can still sign in and read their data.
 */
export async function requireListingAccess(): Promise<CurrentVendor> {
  const current = await requireVendor();
  if (current.vendor.onboardingStatus !== "complete") {
    throw new AppError("ONBOARDING_INCOMPLETE", "Finish onboarding before managing listings.", 403);
  }
  if (current.vendor.status === "suspended") {
    throw new AppError(
      "VENDOR_SUSPENDED",
      "Your account is suspended, so listings can't be changed. Please contact ShowBuzz.",
      403,
    );
  }
  return current;
}

/**
 * For Server Components: the signed-in vendor, or a redirect through the refresh route (which renews an expired
 * access token or sends the browser to /login). Console pages need finished onboarding (otherwise → /onboarding);
 * onboarding pages pass `{ stage: "onboarding" }` and send finished vendors to the dashboard.
 */
export async function requireVendorPage(
  currentPath: string,
  { stage = "console" }: { stage?: "console" | "onboarding" | "any" } = {},
): Promise<CurrentVendor> {
  const current = await getCurrentVendor();
  if (!current) redirect(`${PARTNER_REFRESH_PATH}/refresh?next=${encodeURIComponent(safeNextPath(currentPath))}`);
  const onboarded = current.vendor.onboardingStatus === "complete";
  if (stage === "console" && !onboarded) redirect("/onboarding");
  if (stage === "onboarding" && onboarded) redirect("/dashboard");
  return current;
}
