import { z } from "zod";
import { authContextFrom } from "@/server/auth/context";
import { requestOtp } from "@/server/auth/otp";
import { apiHandler } from "@/server/http/api-handler";
import { assertSameOrigin } from "@/server/http/request";
import { ok } from "@/server/http/responses";

/** Sends a sign-in code. The body ({ identifier, name? }) is validated by requestOtp. */
export const POST = apiHandler({ body: z.unknown() }, async ({ request, body }) => {
  assertSameOrigin(request);
  return ok(await requestOtp(body, authContextFrom(request.headers)));
});
