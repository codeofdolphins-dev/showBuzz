import { describe, expect, it } from "vitest";
import { decideStaffRoute } from "@showbuzz/core/auth/admin/route-guard";
import { adminTokens } from "@showbuzz/core/auth/admin/tokens";
import { signAccessToken as signCustomerAccessToken } from "@showbuzz/core/auth/jwt";

const ids = { sub: "652f1c0e8b3f4a2d9c1e7b55", sid: "0b5e2f0c-6c1a-4a9e-9f7b-2d3c4e5f6a7b" };
const page = { method: "GET", pathname: "/dashboard", search: "" };
const toRefresh = (next: string) => ({
  type: "redirect",
  location: `/api/v1/admin/auth/refresh?next=${encodeURIComponent(next)}`,
});

describe("decideStaffRoute", () => {
  it("lets a valid staff access token through", async () => {
    const { token } = await adminTokens.signAccessToken(ids);
    expect(await decideStaffRoute({ ...page, accessToken: token })).toEqual({ type: "next" });
  });

  it("sends a browser without a token through the refresh route, keeping the path and query", async () => {
    expect(await decideStaffRoute({ ...page, pathname: "/movies", search: "?q=x", accessToken: undefined })).toEqual(
      toRefresh("/movies?q=x"),
    );
  });

  it("rejects a customer access token", async () => {
    const { token } = await signCustomerAccessToken(ids);
    expect(await decideStaffRoute({ ...page, accessToken: token })).toEqual(toRefresh("/dashboard"));
  });

  it("rejects an expired staff token", async () => {
    const { token } = await adminTokens.signAccessToken({ ...ids, issuedAt: new Date(Date.now() - 60 * 60 * 1000) });
    expect(await decideStaffRoute({ ...page, accessToken: token })).toEqual(toRefresh("/dashboard"));
  });

  it("rejects a staff refresh token used as an access token", async () => {
    const { token } = await adminTokens.signRefreshToken({ ...ids, jti: "jti-1" });
    expect(await decideStaffRoute({ ...page, accessToken: token })).toEqual(toRefresh("/dashboard"));
  });

  it("leaves the sign-in pages, robots.txt and API routes open", async () => {
    for (const pathname of ["/login", "/forgot-password", "/robots.txt", "/api/v1/admin/auth/login", "/api/v1/admin/x"]) {
      expect(await decideStaffRoute({ ...page, pathname, accessToken: undefined })).toEqual({ type: "next" });
    }
  });

  it("lets non-GET requests through (Server Actions check auth themselves)", async () => {
    expect(await decideStaffRoute({ ...page, method: "POST", accessToken: undefined })).toEqual({ type: "next" });
  });
});
