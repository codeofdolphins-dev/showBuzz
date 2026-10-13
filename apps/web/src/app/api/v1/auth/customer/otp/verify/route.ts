import { z } from "zod";
import { authContextFrom } from "@showbuzz/core/auth/context";
import { setSessionCookies } from "@showbuzz/core/auth/cookies";
import { signInWithOtp } from "@showbuzz/core/auth/customer-auth.service";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { assertSameOrigin } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";

/** Checks the code, starts a session and sets the session cookies. Body: { challengeId, code }. */
export const POST = apiHandler({ body: z.unknown() }, async ({ request, body }) => {
  assertSameOrigin(request);
  const ctx = authContextFrom(request.headers);
  const { user, tokens } = await signInWithOtp(body, ctx);
  const response = ok({ user, accessExpiresAt: tokens.accessExpiresAt.toISOString() });
  setSessionCookies(response.cookies, tokens, ctx.now);
  return response;
});
