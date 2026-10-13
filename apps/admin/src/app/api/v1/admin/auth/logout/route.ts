import { adminCookies } from "@showbuzz/core/auth/admin/cookies";
import { signOutStaff } from "@showbuzz/core/auth/admin/staff-auth.service";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { assertSameOrigin, readRequestCookies } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";

/** Ends this device's staff session and clears the cookies. Idempotent: always 200 for a same-origin call. */
export const POST = apiHandler({}, async ({ request }) => {
  assertSameOrigin(request);
  const cookies = readRequestCookies(request);
  await signOutStaff(
    { accessToken: adminCookies.readAccessToken(cookies), refreshToken: adminCookies.readRefreshToken(cookies) },
    new Date(),
  );
  const response = ok({ signedOut: true });
  adminCookies.clearSessionCookies(response.cookies);
  return response;
});
