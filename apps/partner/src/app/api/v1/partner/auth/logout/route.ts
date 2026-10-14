import { partnerCookies } from "@showbuzz/core/auth/partner/cookies";
import { signOutVendorUser } from "@showbuzz/core/auth/partner/vendor-auth.service";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { assertSameOrigin, readRequestCookies } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";

/** Ends this device's vendor session and clears the cookies. Idempotent: always 200 for a same-origin call. */
export const POST = apiHandler({}, async ({ request }) => {
  assertSameOrigin(request);
  const cookies = readRequestCookies(request);
  await signOutVendorUser(
    { accessToken: partnerCookies.readAccessToken(cookies), refreshToken: partnerCookies.readRefreshToken(cookies) },
    new Date(),
  );
  const response = ok({ signedOut: true });
  partnerCookies.clearSessionCookies(response.cookies);
  return response;
});
