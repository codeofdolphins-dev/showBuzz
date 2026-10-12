import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as requestOtpRoute } from "@/app/api/v1/auth/customer/otp/request/route";
import { POST as verifyOtpRoute } from "@/app/api/v1/auth/customer/otp/verify/route";
import { POST as logoutRoute } from "@/app/api/v1/auth/logout/route";
import { GET as meRoute } from "@/app/api/v1/auth/me/route";
import { GET as refreshGetRoute, POST as refreshPostRoute } from "@/app/api/v1/auth/refresh/route";
import { connect, disconnect } from "@/server/db/connect";
import { OtpChallenge } from "@/server/models/OtpChallenge";
import { RateLimit } from "@/server/models/RateLimit";
import { User } from "@/server/models/User";

const ORIGIN = "http://localhost:3000";
const PHONE = "+919876543210";

interface Options {
  cookie?: string;
  origin?: string | null;
  body?: unknown;
}

function request(method: "GET" | "POST", path: string, { cookie, origin = ORIGIN, body }: Options = {}) {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.20", "user-agent": "vitest" });
  if (origin) headers.set("origin", origin);
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Set-Cookie headers as { name: { value, attrs } }, attributes lowercased. */
function setCookies(response: Response) {
  const out: Record<string, { value: string; attrs: string[] }> = {};
  for (const header of response.headers.getSetCookie()) {
    const [pair = "", ...attrs] = header.split("; ");
    const eq = pair.indexOf("=");
    out[pair.slice(0, eq)] = { value: pair.slice(eq + 1), attrs: attrs.map((a) => a.toLowerCase()) };
  }
  return out;
}

/** The Cookie header a browser would send to /api/v1/auth after these Set-Cookie headers. */
function cookieHeader(response: Response) {
  return Object.entries(setCookies(response))
    .map(([name, { value }]) => `${name}=${value}`)
    .join("; ");
}

async function signIn(identifier = PHONE) {
  const sent = await requestOtpRoute(request("POST", "/api/v1/auth/customer/otp/request", { body: { identifier } }));
  const { data } = await sent.json();
  return verifyOtpRoute(
    request("POST", "/api/v1/auth/customer/otp/verify", {
      body: { challengeId: data.challengeId, code: data.devCode },
    }),
  );
}

async function sessionCount() {
  return (await User.findOne({ phone: PHONE }))?.sessions.length ?? 0;
}

beforeAll(async () => {
  await connect();
  await Promise.all([User.init(), OtpChallenge.init(), RateLimit.init()]);
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  // In-memory test database only (tests/integration/setup.ts refuses any other URI).
  await Promise.all([User.deleteMany({}), OtpChallenge.deleteMany({}), RateLimit.deleteMany({})]);
});

afterAll(async () => {
  await disconnect();
});

describe("POST /api/v1/auth/customer/otp/*", () => {
  it("signs in, sets both session cookies and returns the customer", async () => {
    const response = await signIn();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.data).toEqual({
      user: { id: expect.any(String), name: "ShowBuzz Member", phone: PHONE, joinedAt: expect.any(String) },
      accessExpiresAt: expect.any(String),
    });

    const cookies = setCookies(response);
    expect(cookies.sb_at?.attrs).toEqual(expect.arrayContaining(["path=/", "max-age=900", "httponly", "samesite=lax"]));
    expect(cookies.sb_rt?.attrs).toEqual(
      expect.arrayContaining(["path=/api/v1/auth", "max-age=604800", "httponly", "samesite=lax"]),
    );
    expect(cookies.sb_has_session).toMatchObject({ value: "1" });
    expect(cookies.sb_has_session?.attrs).toEqual(expect.arrayContaining(["path=/", "max-age=604800", "httponly"]));
    expect(await sessionCount()).toBe(1);
  });

  it("rejects a wrong code with 401 and sets no cookies", async () => {
    const sent = await requestOtpRoute(
      request("POST", "/api/v1/auth/customer/otp/request", { body: { identifier: PHONE } }),
    );
    const { data } = await sent.json();
    const wrong = data.devCode === "000000" ? "111111" : "000000";

    const response = await verifyOtpRoute(
      request("POST", "/api/v1/auth/customer/otp/verify", { body: { challengeId: data.challengeId, code: wrong } }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatchObject({ code: "OTP_INVALID", details: { remainingAttempts: 4 } });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("answers a second request inside the cooldown with 429 and Retry-After", async () => {
    const send = () =>
      requestOtpRoute(request("POST", "/api/v1/auth/customer/otp/request", { body: { identifier: PHONE } }));
    await send();
    const response = await send();

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("returns 422 for an invalid identifier", async () => {
    const response = await requestOtpRoute(
      request("POST", "/api/v1/auth/customer/otp/request", { body: { identifier: "123" } }),
    );
    expect(response.status).toBe(422);
  });
});

describe("cross-origin requests", () => {
  it.each([
    ["otp request", () => requestOtpRoute],
    ["otp verify", () => verifyOtpRoute],
    ["refresh", () => refreshPostRoute],
    ["logout", () => logoutRoute],
  ])("rejects %s from another origin with 403", async (_label, route) => {
    const response = await route()(
      request("POST", "/api/v1/auth/x", { origin: "https://evil.example", body: { identifier: PHONE } }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });
});

describe("/api/v1/auth/refresh", () => {
  it("rotates both cookies", async () => {
    const signedIn = await signIn();

    const response = await refreshPostRoute(
      request("POST", "/api/v1/auth/refresh", { cookie: cookieHeader(signedIn) }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.user.phone).toBe(PHONE);
    const before = setCookies(signedIn);
    const after = setCookies(response);
    expect(after.sb_rt?.value).not.toBe(before.sb_rt?.value);
    expect(after.sb_at?.value).toBeTruthy();
  });

  it("revokes the session when the old refresh token is replayed after the grace window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const signedIn = await signIn();
    const oldCookies = cookieHeader(signedIn);
    await refreshPostRoute(request("POST", "/api/v1/auth/refresh", { cookie: oldCookies }));

    vi.setSystemTime(Date.now() + 11_000);
    const replay = await refreshPostRoute(request("POST", "/api/v1/auth/refresh", { cookie: oldCookies }));

    expect(replay.status).toBe(401);
    expect(setCookies(replay).sb_rt?.attrs).toContain("max-age=0");
    expect(setCookies(replay).sb_at?.attrs).toContain("max-age=0");
    expect(setCookies(replay).sb_has_session?.attrs).toContain("max-age=0");
    expect(await sessionCount()).toBe(0);
  });

  it("returns 401 and clears cookies without a refresh cookie", async () => {
    const response = await refreshPostRoute(request("POST", "/api/v1/auth/refresh"));

    expect(response.status).toBe(401);
    expect(setCookies(response).sb_rt?.value).toBe("");
  });

  it("redirects a page navigation back to a safe next path with fresh cookies", async () => {
    const signedIn = await signIn();

    const response = await refreshGetRoute(
      request("GET", "/api/v1/auth/refresh?next=%2Faccount%2Fbookings", {
        cookie: cookieHeader(signedIn),
        origin: null,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/account/bookings`);
    expect(setCookies(response).sb_rt?.value).toBeTruthy();
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com"])("never redirects to %s", async (next) => {
    const signedIn = await signIn();

    const response = await refreshGetRoute(
      request("GET", `/api/v1/auth/refresh?next=${encodeURIComponent(next)}`, {
        cookie: cookieHeader(signedIn),
        origin: null,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/`);
  });

  it("sends a signed-out navigation to the sign-in modal, keeping next", async () => {
    const response = await refreshGetRoute(
      request("GET", "/api/v1/auth/refresh?next=%2Faccount%2Fprofile", { origin: null }),
    );

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("auth")).toBe("signin");
    expect(location.searchParams.get("next")).toBe("/account/profile");
    expect(setCookies(response).sb_at?.attrs).toContain("max-age=0");
  });
});

describe("/api/v1/auth/logout and /me", () => {
  it("returns the signed-in customer", async () => {
    const signedIn = await signIn();

    const response = await meRoute(request("GET", "/api/v1/auth/me", { cookie: cookieHeader(signedIn), origin: null }));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ user: { phone: PHONE }, accessExpiresAt: expect.any(String) });
  });

  it("clears cookies and revokes the session; a second logout still succeeds", async () => {
    const signedIn = await signIn();

    const first = await logoutRoute(request("POST", "/api/v1/auth/logout", { cookie: cookieHeader(signedIn) }));
    expect(first.status).toBe(200);
    expect(setCookies(first).sb_at?.attrs).toContain("max-age=0");
    expect(setCookies(first).sb_rt?.attrs).toEqual(expect.arrayContaining(["path=/api/v1/auth", "max-age=0"]));
    expect(setCookies(first).sb_has_session?.attrs).toContain("max-age=0");
    expect(await sessionCount()).toBe(0);

    const second = await logoutRoute(request("POST", "/api/v1/auth/logout"));
    expect(second.status).toBe(200);
  });

  it("rejects the old access token after logout", async () => {
    const signedIn = await signIn();
    const cookie = cookieHeader(signedIn);
    await logoutRoute(request("POST", "/api/v1/auth/logout", { cookie }));

    const response = await meRoute(request("GET", "/api/v1/auth/me", { cookie, origin: null }));

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 without cookies", async () => {
    expect((await meRoute(request("GET", "/api/v1/auth/me", { origin: null }))).status).toBe(401);
  });
});
