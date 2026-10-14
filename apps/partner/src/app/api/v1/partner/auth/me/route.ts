import { partnerCookies } from "@showbuzz/core/auth/partner/cookies";
import { currentVendor } from "@showbuzz/core/auth/partner/vendor-auth.service";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { AppError } from "@showbuzz/core/http/app-error";
import { readRequestCookies } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";

/**
 * The signed-in vendor user and their vendor (bank account masked). 401 when the access token is missing, expired,
 * not a partner token (customer and staff tokens never verify here) or its session has ended.
 */
export const GET = apiHandler({}, async ({ request }) => {
  const current = await currentVendor(partnerCookies.readAccessToken(readRequestCookies(request)), new Date());
  if (!current) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return ok({
    vendorUser: current.vendorUser,
    vendor: current.vendor,
    accessExpiresAt: current.accessExpiresAt.toISOString(),
  });
});
