import { z } from "zod";
import { authContextFrom } from "@showbuzz/core/auth/context";
import { requestOtp } from "@showbuzz/core/auth/otp";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { assertSameOrigin } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";

/** Sends a sign-in code. The body ({ identifier, name? }) is validated by requestOtp. */
export const POST = apiHandler({ body: z.unknown() }, async ({ request, body }) => {
  assertSameOrigin(request);
  return ok(await requestOtp(body, authContextFrom(request.headers)));
});
