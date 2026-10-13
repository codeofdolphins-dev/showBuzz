import { type NextRequest, NextResponse } from "next/server";
import { adminCookies } from "@showbuzz/core/auth/admin/cookies";
import { decideStaffRoute } from "@showbuzz/core/auth/admin/route-guard";

/**
 * Route pre-check for every console page (Next 16 Proxy, Node.js runtime): no valid staff access token →
 * refresh bounce → /login?next=. Not the security boundary: pages call requireStaffPage() and route handlers
 * and Server Actions check requireStaff()/requirePermission() themselves.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const decision = await decideStaffRoute({
    method: request.method,
    pathname,
    search,
    accessToken: adminCookies.readAccessToken(request.cookies),
  });
  if (decision.type === "redirect") return NextResponse.redirect(new URL(decision.location, request.url));
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files. Link prefetches are skipped (Next strips their headers
  // before proxy code runs, so only the matcher can tell them apart); otherwise a prefetch with an expired
  // token would rotate the session.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
