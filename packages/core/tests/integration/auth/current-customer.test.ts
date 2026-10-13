import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_COOKIE, SESSION_HINT_COOKIE } from "@showbuzz/core/auth/cookies";
import {
  getCurrentCustomer,
  getCurrentSession,
  requireCustomer,
  requireCustomerPage,
} from "@showbuzz/core/auth/current-customer";
import { createSession, revokeSession } from "@showbuzz/core/auth/session";
import { connect, disconnect } from "@showbuzz/db/connect";
import { AppError } from "@showbuzz/core/http/app-error";
import { User, type UserDocument } from "@showbuzz/db/models/User";

// A fake cookie jar standing in for next/headers' cookies() outside a Next request.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

let user: UserDocument;
let sid: string;

beforeAll(async () => {
  await connect();
  await User.init();
});

beforeEach(async () => {
  jar.clear();
  user = await User.create({ name: "Guard Tester", phone: "+919876543210" });
  const tokens = await createSession(user, { ip: "203.0.113.10", userAgent: "vitest", now: new Date() });
  sid = tokens.sid;
  jar.set(ACCESS_COOKIE, tokens.accessToken);
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await disconnect();
});

describe("getCurrentCustomer", () => {
  it("returns the snapshot for a live session", async () => {
    expect(await getCurrentCustomer()).toEqual(user.toCustomerSnapshot());
  });

  it("returns null without an access cookie", async () => {
    jar.clear();
    expect(await getCurrentCustomer()).toBeNull();
  });

  it("returns null once the session is revoked, even with the old token", async () => {
    await revokeSession(user._id.toString(), sid);
    expect(await getCurrentCustomer()).toBeNull();
  });

  it("returns null for a blocked user", async () => {
    await User.updateOne({ _id: user._id }, { $set: { status: "blocked" } });
    expect(await getCurrentCustomer()).toBeNull();
  });
});

describe("getCurrentSession", () => {
  it("returns the customer and access expiry for a live session", async () => {
    const session = await getCurrentSession();
    expect(session.mightRefresh).toBe(false);
    expect(session.customer?.user).toEqual(user.toCustomerSnapshot());
    expect(Date.parse(session.customer?.accessExpiresAt ?? "")).toBeGreaterThan(Date.now());
  });

  it("suggests a silent refresh when only the session hint cookie is present", async () => {
    jar.clear();
    jar.set(SESSION_HINT_COOKIE, "1");
    expect(await getCurrentSession()).toEqual({ customer: null, mightRefresh: true });
  });

  it("treats a visitor without cookies as signed out, with no refresh", async () => {
    jar.clear();
    expect(await getCurrentSession()).toEqual({ customer: null, mightRefresh: false });
  });
});

describe("requireCustomer", () => {
  it("returns the customer when signed in", async () => {
    expect((await requireCustomer()).id).toBe(user._id.toString());
  });

  it("throws 401 UNAUTHENTICATED when not signed in", async () => {
    jar.clear();
    const err = await requireCustomer().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });
});

describe("requireCustomerPage", () => {
  it("redirects through the refresh route with the current path", async () => {
    jar.clear();
    const err = await requireCustomerPage("/account/bookings").catch((e: unknown) => e);

    expect(String((err as { digest?: string }).digest)).toContain(
      `/api/v1/auth/refresh?next=${encodeURIComponent("/account/bookings")}`,
    );
  });

  it("never puts an unsafe path in the redirect", async () => {
    jar.clear();
    const err = await requireCustomerPage("//evil.com").catch((e: unknown) => e);

    expect(String((err as { digest?: string }).digest)).toContain("/api/v1/auth/refresh?next=%2F;");
  });
});
