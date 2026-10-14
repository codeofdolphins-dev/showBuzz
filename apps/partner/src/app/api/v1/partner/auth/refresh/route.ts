import { NextResponse } from "next/server";
import { z } from "zod";
import { safeNextPath } from "@showbuzz/utils/safe-next";
import { authContextFrom } from "@showbuzz/core/auth/context";
import { partnerCookies } from "@showbuzz/core/auth/partner/cookies";
import { refreshVendorSession } from "@showbuzz/core/auth/partner/vendor-auth.service";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { AppError } from "@showbuzz/core/http/app-error";
import { assertSameOrigin, readRequestCookies } from "@showbuzz/core/http/request";
import { ok } from "@showbuzz/core/http/responses";

/**
 * Rotates the vendor session. The refresh cookie is only sent to /api/v1/partner/auth, so this is the one place a
 * session can be renewed: the client POSTs here, and proxy.ts bounces page navigations through GET.
 */
export const POST = apiHandler(
  {
    // A failed refresh means the session is over: clear the cookies so the client stops retrying.
    onFailure: (response, failure) => {
      if (failure.status === 401) partnerCookies.clearSessionCookies(response.cookies);
    },
  },
  async ({ request }) => {
    assertSameOrigin(request);
    const ctx = authContextFrom(request.headers);
    const { vendorUser, tokens } = await refreshVendorSession(
      partnerCookies.readRefreshToken(readRequestCookies(request)),
      ctx,
    );
    const response = ok({ vendorUser, accessExpiresAt: tokens.accessExpiresAt.toISOString() });
    partnerCookies.setSessionCookies(response.cookies, tokens, ctx.now);
    return response;
  },
);

/** Same rotation for full-page navigations; always answers with a 303 to a safe local path or /login. */
export const GET = apiHandler({ query: z.object({ next: z.string().optional() }) }, async ({ request, query }) => {
  const next = safeNextPath(query.next, "/dashboard");
  const ctx = authContextFrom(request.headers);
  try {
    const { tokens } = await refreshVendorSession(partnerCookies.readRefreshToken(readRequestCookies(request)), ctx);
    const response = NextResponse.redirect(new URL(next, request.url), 303);
    partnerCookies.setSessionCookies(response.cookies, tokens, ctx.now);
    return response;
  } catch (err) {
    if (!(err instanceof AppError) || err.status !== 401) throw err;
    const login = new URL("/login", request.url);
    login.searchParams.set("next", next);
    const response = NextResponse.redirect(login, 303);
    partnerCookies.clearSessionCookies(response.cookies);
    return response;
  }
});
