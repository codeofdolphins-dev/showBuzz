import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { env } from "@showbuzz/runtime/env";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "@showbuzz/core/auth/jwt";

const ids = { sub: "652f1c0e8b3f4a2d9c1e7b55", sid: "0b5e2f0c-6c1a-4a9e-9f7b-2d3c4e5f6a7b" };
const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

function base64url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("access tokens", () => {
  it("round-trips the user and session ids", async () => {
    const issuedAt = new Date();
    const { token, expiresAt } = await signAccessToken({ ...ids, issuedAt });
    const result = await verifyAccessToken(token);

    expect(result).toEqual({
      ok: true,
      claims: { ...ids, iat: Math.floor(issuedAt.getTime() / 1000), exp: expect.any(Number) },
    });
    expect(expiresAt.getTime() - Math.floor(issuedAt.getTime() / 1000) * 1000).toBe(15 * 60_000);
  });

  it("reports an expired token as expired, after the 5 s clock tolerance", async () => {
    const issuedAt = new Date("2026-10-12T10:00:00Z");
    const { token, expiresAt } = await signAccessToken({ ...ids, issuedAt });

    expect((await verifyAccessToken(token, new Date(expiresAt.getTime() + 4_000))).ok).toBe(true);
    expect(await verifyAccessToken(token, new Date(expiresAt.getTime() + 6_000))).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a token for another audience (e.g. the admin console)", async () => {
    const token = await new SignJWT({ sid: ids.sid, typ: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("showbuzz")
      .setAudience("showbuzz-admin")
      .setSubject(ids.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(accessKey);

    expect(await verifyAccessToken(token)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a token from another issuer", async () => {
    const token = await new SignJWT({ sid: ids.sid, typ: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("someone-else")
      .setAudience("showbuzz-public")
      .setSubject(ids.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(accessKey);

    expect((await verifyAccessToken(token)).ok).toBe(false);
  });

  it("rejects a refresh token, even one signed with the access key", async () => {
    const refresh = await signRefreshToken({ ...ids, jti: "j1" });
    expect((await verifyAccessToken(refresh.token)).ok).toBe(false);

    const wrongType = await new SignJWT({ sid: ids.sid, typ: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("showbuzz")
      .setAudience("showbuzz-public")
      .setSubject(ids.sub)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(accessKey);
    expect((await verifyAccessToken(wrongType)).ok).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const { token } = await signAccessToken(ids);
    const [header, payload, signature = ""] = token.split(".");
    const flipped = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

    expect((await verifyAccessToken(`${header}.${payload}.${flipped}`)).ok).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const { token } = await signAccessToken(ids);
    const [header, , signature] = token.split(".");
    const payload = base64url({ ...ids, sub: "000000000000000000000000", typ: "access" });

    expect((await verifyAccessToken(`${header}.${payload}.${signature}`)).ok).toBe(false);
  });

  it('rejects alg "none"', async () => {
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({
      ...ids,
      typ: "access",
      iss: "showbuzz",
      aud: "showbuzz-public",
      iat: now,
      exp: now + 900,
    })}.`;

    expect(await verifyAccessToken(unsigned)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects garbage without throwing", async () => {
    expect(await verifyAccessToken("not-a-jwt")).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyAccessToken("")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("refresh tokens", () => {
  it("round-trips with a jti and lasts 7 days", async () => {
    const issuedAt = new Date();
    const { token, expiresAt } = await signRefreshToken({ ...ids, jti: "jti-1", issuedAt });

    const result = await verifyRefreshToken(token);
    expect(result.ok && result.claims).toMatchObject({ ...ids, jti: "jti-1" });
    expect(expiresAt.getTime() - Math.floor(issuedAt.getTime() / 1000) * 1000).toBe(7 * 24 * 3600_000);
  });

  it("rejects access tokens", async () => {
    const { token } = await signAccessToken(ids);
    expect((await verifyRefreshToken(token)).ok).toBe(false);
  });

  it("re-signs to the identical token from the same jti and issue time", async () => {
    const issuedAt = new Date("2026-10-12T10:00:00.123Z");
    const first = await signRefreshToken({ ...ids, jti: "jti-1", issuedAt });
    const again = await signRefreshToken({ ...ids, jti: "jti-1", issuedAt: new Date("2026-10-12T10:00:00.999Z") });

    expect(again.token).toBe(first.token);
  });
});
