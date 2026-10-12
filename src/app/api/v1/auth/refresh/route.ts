import { NextResponse } from "next/server";
import { z } from "zod";
import { safeNextPath } from "@/lib/safe-next";
import { authContextFrom } from "@/server/auth/context";
import { clearSessionCookies, readRefreshToken, setSessionCookies } from "@/server/auth/cookies";
import { refreshCustomerSession } from "@/server/auth/customer-auth.service";
import { apiHandler } from "@/server/http/api-handler";
import { AppError } from "@/server/http/app-error";
import { assertSameOrigin, readRequestCookies } from "@/server/http/request";
import { ok } from "@/server/http/responses";

/**
 * Rotates the session. The refresh cookie is only sent to /api/v1/auth, so this is the one place a
 * session can be renewed: the client POSTs here, and proxy.ts bounces page navigations through GET.
 */
export const POST = apiHandler(
  {
    // A failed refresh means the session is over: clear the cookies so the client stops retrying.
    onFailure: (response, failure) => {
      if (failure.status === 401) clearSessionCookies(response.cookies);
    },
  },
  async ({ request }) => {
    assertSameOrigin(request);
    const ctx = authContextFrom(request.headers);
    const { user, tokens } = await refreshCustomerSession(readRefreshToken(readRequestCookies(request)), ctx);
    const response = ok({ user, accessExpiresAt: tokens.accessExpiresAt.toISOString() });
    setSessionCookies(response.cookies, tokens, ctx.now);
    return response;
  },
);

/** Same rotation for full-page navigations; always answers with a 303 to a safe local path. */
export const GET = apiHandler({ query: z.object({ next: z.string().optional() }) }, async ({ request, query }) => {
  const next = safeNextPath(query.next);
  const ctx = authContextFrom(request.headers);
  try {
    const { tokens } = await refreshCustomerSession(readRefreshToken(readRequestCookies(request)), ctx);
    const response = NextResponse.redirect(new URL(next, request.url), 303);
    setSessionCookies(response.cookies, tokens, ctx.now);
    return response;
  } catch (err) {
    if (!(err instanceof AppError) || err.status !== 401) throw err;
    const signIn = new URL("/", request.url);
    signIn.searchParams.set("auth", "signin");
    signIn.searchParams.set("next", next);
    const response = NextResponse.redirect(signIn, 303);
    clearSessionCookies(response.cookies);
    return response;
  }
});
