import { authContextFrom } from "@showbuzz/core/auth/context";
import { adminCookies } from "@showbuzz/core/auth/admin/cookies";
import { signInStaff } from "@showbuzz/core/auth/admin/staff-auth.service";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { assertSameOrigin } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";
import { staffLoginSchema } from "@showbuzz/schemas/staff";

/**
 * Email + password sign-in. Wrong email, wrong password and disabled accounts all answer 401 "Invalid email or
 * password."; attempts are rate-limited per email and per IP.
 */
export const POST = apiHandler({ body: staffLoginSchema }, async ({ request, body }) => {
  assertSameOrigin(request);
  const ctx = authContextFrom(request.headers);
  const { staff, tokens } = await signInStaff(body, ctx);
  const response = ok({ staff, accessExpiresAt: tokens.accessExpiresAt.toISOString() });
  adminCookies.setSessionCookies(response.cookies, tokens, ctx.now);
  return response;
});
