import { clearSessionCookies, readAccessToken, readRefreshToken } from "@/server/auth/cookies";
import { signOut } from "@/server/auth/customer-auth.service";
import { apiHandler } from "@/server/http/api-handler";
import { assertSameOrigin, readRequestCookies } from "@/server/http/request";
import { ok } from "@/server/http/responses";

/** Ends this device's session and clears the cookies. Idempotent: always 200 for a same-origin call. */
export const POST = apiHandler({}, async ({ request }) => {
  assertSameOrigin(request);
  const cookies = readRequestCookies(request);
  await signOut({ accessToken: readAccessToken(cookies), refreshToken: readRefreshToken(cookies) }, new Date());
  const response = ok({ signedOut: true });
  clearSessionCookies(response.cookies);
  return response;
});
