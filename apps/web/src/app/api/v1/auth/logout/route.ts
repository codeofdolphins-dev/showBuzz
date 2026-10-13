import { clearSessionCookies, readAccessToken, readRefreshToken } from "@showbuzz/core/auth/cookies";
import { signOut } from "@showbuzz/core/auth/customer-auth.service";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { assertSameOrigin, readRequestCookies } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";

/** Ends this device's session and clears the cookies. Idempotent: always 200 for a same-origin call. */
export const POST = apiHandler({}, async ({ request }) => {
  assertSameOrigin(request);
  const cookies = readRequestCookies(request);
  await signOut({ accessToken: readAccessToken(cookies), refreshToken: readRefreshToken(cookies) }, new Date());
  const response = ok({ signedOut: true });
  clearSessionCookies(response.cookies);
  return response;
});
