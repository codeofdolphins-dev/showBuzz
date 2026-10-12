import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { signAccessToken, signRefreshToken } from "@/server/auth/jwt";
import { decideCustomerRoute } from "@/server/auth/route-guard";

const ids = { sub: "652f1c0e8b3f4a2d9c1e7b55", sid: "0b5e2f0c-6c1a-4a9e-9f7b-2d3c4e5f6a7b" };
const page = { method: "GET", pathname: "/account/profile", search: "" };
const toRefresh = (next: string) => ({
  type: "redirect",
  location: `/api/v1/auth/refresh?next=${encodeURIComponent(next)}`,
});

describe("decideCustomerRoute", () => {
  it("lets a valid customer access token through", async () => {
    const { token } = await signAccessToken(ids);
    expect(await decideCustomerRoute({ ...page, accessToken: token })).toEqual({ type: "next" });
  });

  it("sends a visitor without a cookie through the refresh route", async () => {
    expect(await decideCustomerRoute({ ...page, accessToken: undefined })).toEqual(toRefresh("/account/profile"));
  });

  it("preserves the query string in next", async () => {
    expect(
      await decideCustomerRoute({
        method: "GET",
        pathname: "/account/bookings",
        search: "?tab=past",
        accessToken: undefined,
      }),
    ).toEqual(toRefresh("/account/bookings?tab=past"));
  });

  it("refreshes an expired access token", async () => {
    const issuedAt = new Date("2026-10-12T10:00:00Z");
    const { token } = await signAccessToken({ ...ids, issuedAt });

    expect(await decideCustomerRoute({ ...page, accessToken: token, now: new Date("2026-10-12T10:20:00Z") })).toEqual(
      toRefresh("/account/profile"),
    );
  });

  it("rejects an admin-audience token", async () => {
    const adminToken = await new SignJWT({ sid: ids.sid, typ: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("showbuzz")
      .setAudience("showbuzz-admin")
      .setSubject(ids.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));

    expect(await decideCustomerRoute({ ...page, accessToken: adminToken })).toEqual(toRefresh("/account/profile"));
  });

  it("rejects a refresh token or garbage in the access cookie", async () => {
    const { token } = await signRefreshToken({ ...ids, jti: "j1" });
    expect((await decideCustomerRoute({ ...page, accessToken: token })).type).toBe("redirect");
    expect((await decideCustomerRoute({ ...page, accessToken: "not-a-jwt" })).type).toBe("redirect");
  });

  it("lets Server Action POSTs through (they check auth themselves)", async () => {
    expect(await decideCustomerRoute({ ...page, method: "POST", accessToken: undefined })).toEqual({ type: "next" });
  });

  it("treats HEAD like GET", async () => {
    expect((await decideCustomerRoute({ ...page, method: "HEAD", accessToken: undefined })).type).toBe("redirect");
  });
});
