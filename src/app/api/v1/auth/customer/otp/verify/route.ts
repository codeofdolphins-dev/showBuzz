import { z } from "zod";
import { authContextFrom } from "@/server/auth/context";
import { setSessionCookies } from "@/server/auth/cookies";
import { signInWithOtp } from "@/server/auth/customer-auth.service";
import { apiHandler } from "@/server/http/api-handler";
import { assertSameOrigin } from "@/server/http/request";
import { ok } from "@/server/http/responses";

/** Checks the code, starts a session and sets the session cookies. Body: { challengeId, code }. */
export const POST = apiHandler({ body: z.unknown() }, async ({ request, body }) => {
  assertSameOrigin(request);
  const ctx = authContextFrom(request.headers);
  const { user, tokens } = await signInWithOtp(body, ctx);
  const response = ok({ user, accessExpiresAt: tokens.accessExpiresAt.toISOString() });
  setSessionCookies(response.cookies, tokens, ctx.now);
  return response;
});
