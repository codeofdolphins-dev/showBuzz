import { readAccessToken } from "@/server/auth/cookies";
import { currentCustomer } from "@/server/auth/customer-auth.service";
import { apiHandler } from "@/server/http/api-handler";
import { AppError } from "@/server/http/app-error";
import { readRequestCookies } from "@/server/http/request";
import { ok } from "@/server/http/responses";

/**
 * The signed-in customer. 401 when the access token is missing, expired or its session has ended;
 * cookies are left alone so a client with a valid refresh cookie can still POST /api/v1/auth/refresh.
 */
export const GET = apiHandler({}, async ({ request }) => {
  const customer = await currentCustomer(readAccessToken(readRequestCookies(request)), new Date());
  if (!customer) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return ok({ user: customer.user, accessExpiresAt: customer.accessExpiresAt.toISOString() });
});
