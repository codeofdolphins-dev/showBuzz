import { authContextFrom } from "@showbuzz/core/auth/context";
import { partnerCookies } from "@showbuzz/core/auth/partner/cookies";
import { signInVendorUser } from "@showbuzz/core/auth/partner/vendor-auth.service";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { assertSameOrigin } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";
import { partnerLoginSchema } from "@showbuzz/schemas/partner";

/**
 * Email + password sign-in for vendor logins. Wrong email, wrong password and disabled logins all answer 401
 * "Invalid email or password."; attempts are rate-limited per email and per IP. Suspended vendors can sign in.
 */
export const POST = apiHandler({ body: partnerLoginSchema }, async ({ request, body }) => {
  assertSameOrigin(request);
  const ctx = authContextFrom(request.headers);
  const { vendorUser, vendor, tokens } = await signInVendorUser(body, ctx);
  const response = ok({
    vendorUser,
    vendor: { id: vendor.id, businessName: vendor.businessName, onboardingStatus: vendor.onboardingStatus },
    accessExpiresAt: tokens.accessExpiresAt.toISOString(),
  });
  partnerCookies.setSessionCookies(response.cookies, tokens, ctx.now);
  return response;
});
