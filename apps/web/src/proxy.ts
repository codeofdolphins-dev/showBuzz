import { type NextRequest, NextResponse } from "next/server";
import { readAccessToken } from "@showbuzz/core/auth/cookies";
import { decideCustomerRoute } from "@showbuzz/core/auth/route-guard";

/**
 * Route pre-checks (Next 16 Proxy, Node.js runtime). Not the security boundary: protected pages call
 * requireCustomerPage() and Server Actions/route handlers check auth themselves.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/account" || pathname.startsWith("/account/")) {
    const decision = await decideCustomerRoute({
      method: request.method,
      pathname,
      search,
      accessToken: readAccessToken(request.cookies),
    });
    if (decision.type === "redirect") return NextResponse.redirect(new URL(decision.location, request.url));
  }

  // Phase 5: /admin/** rules (admin access token, aud "showbuzz-admin") go here, and "/admin/:path*" joins
  // the matcher below.

  return NextResponse.next();
}

export const config = {
  // Only account pages for now, so API routes, _next and static files never reach the proxy.
  // Link prefetches are skipped (Next strips their headers before proxy code runs, so only the matcher
  // can tell them apart); otherwise every prefetch of an account link would rotate the session.
  matcher: [
    {
      source: "/account/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
