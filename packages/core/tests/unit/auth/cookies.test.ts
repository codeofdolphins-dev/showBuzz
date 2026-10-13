import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CookieStore, SessionCookieAttributes } from "@showbuzz/core/auth/cookies";

const now = new Date("2026-10-12T10:00:00Z");
const tokens = {
  accessToken: "access.jwt",
  refreshToken: "refresh.jwt",
  accessExpiresAt: new Date(now.getTime() + 15 * 60_000),
  refreshExpiresAt: new Date(now.getTime() + 7 * 24 * 3600_000),
};

/** Records what the helpers write, like a cookie jar. */
function recordingStore() {
  const jar = new Map<string, { value: string; attributes: SessionCookieAttributes }>();
  const store: CookieStore = {
    get: (name) => (jar.has(name) ? { value: jar.get(name)?.value ?? "" } : undefined),
    set: (name, value, attributes) => jar.set(name, { value, attributes }),
  };
  return { jar, store };
}

async function loadCookies(production: boolean) {
  if (production) {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://showbuzz.example");
  }
  vi.resetModules();
  return import("@showbuzz/core/auth/cookies");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("session cookies", () => {
  it("uses plain names without Secure in development", async () => {
    const { setSessionCookies } = await loadCookies(false);
    const { jar, store } = recordingStore();

    setSessionCookies(store, tokens, now);

    expect(Object.fromEntries(jar)).toEqual({
      sb_at: {
        value: "access.jwt",
        attributes: { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 900 },
      },
      sb_rt: {
        value: "refresh.jwt",
        attributes: { httpOnly: true, secure: false, sameSite: "lax", path: "/api/v1/auth", maxAge: 604_800 },
      },
      sb_has_session: {
        value: "1",
        attributes: { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 604_800 },
      },
    });
  });

  it("uses __Host-/__Secure- prefixes and Secure in production", async () => {
    const { setSessionCookies } = await loadCookies(true);
    const { jar, store } = recordingStore();

    setSessionCookies(store, tokens, now);

    expect(jar.get("__Host-sb_at")?.attributes).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
    expect(jar.get("__Secure-sb_rt")?.attributes).toMatchObject({ secure: true, path: "/api/v1/auth" });
    expect(jar.get("__Host-sb_has_session")?.attributes).toMatchObject({ secure: true, path: "/" });
  });

  it("reads the tokens back and clears both cookies on their own paths", async () => {
    const { setSessionCookies, clearSessionCookies, readAccessToken, readRefreshToken, hasSessionHint } =
      await loadCookies(false);
    const { jar, store } = recordingStore();
    setSessionCookies(store, tokens, now);

    expect(readAccessToken(store)).toBe("access.jwt");
    expect(readRefreshToken(store)).toBe("refresh.jwt");
    expect(hasSessionHint(store)).toBe(true);

    clearSessionCookies(store);
    expect(jar.get("sb_at")).toMatchObject({ value: "", attributes: { path: "/", maxAge: 0 } });
    expect(jar.get("sb_rt")).toMatchObject({ value: "", attributes: { path: "/api/v1/auth", maxAge: 0 } });
    expect(jar.get("sb_has_session")).toMatchObject({ value: "", attributes: { path: "/", maxAge: 0 } });
    expect(readAccessToken(store)).toBeUndefined();
    expect(hasSessionHint(store)).toBe(false);
  });

  it("writes real Set-Cookie headers on a NextResponse", async () => {
    const { setSessionCookies } = await loadCookies(true);
    const response = NextResponse.json({ ok: true });

    setSessionCookies(response.cookies, tokens, now);

    const [access = "", refresh = ""] = response.headers.getSetCookie();
    const attrs = (cookie: string) => cookie.split("; ").map((part) => part.toLowerCase());

    expect(access.startsWith("__Host-sb_at=access.jwt;")).toBe(true);
    expect(attrs(access)).toEqual(
      expect.arrayContaining(["path=/", "max-age=900", "secure", "httponly", "samesite=lax"]),
    );
    expect(refresh.startsWith("__Secure-sb_rt=refresh.jwt;")).toBe(true);
    expect(attrs(refresh)).toEqual(
      expect.arrayContaining(["path=/api/v1/auth", "max-age=604800", "secure", "httponly", "samesite=lax"]),
    );
  });
});

// Compile-time check: the cookies() store from next/headers fits CookieStore.
type NextCookies = Awaited<ReturnType<typeof import("next/headers").cookies>>;
export const acceptsNextCookies = (store: NextCookies): CookieStore => store;
