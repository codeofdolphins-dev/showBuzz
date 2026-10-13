import "server-only";
import { SignJWT, errors, jwtVerify } from "jose";
import { AUTH } from "@showbuzz/schemas/constants";
import { env } from "@showbuzz/runtime/env";

/**
 * Customer JWTs (docs/roadmap.md "Tokens"). No database access here, so proxy.ts can import it.
 * Verification pins HS256 and checks issuer, audience and `typ`: a refresh token never passes as an
 * access token, and admin tokens (aud "showbuzz-admin", later) never pass as customer tokens.
 */

export const JWT_ISSUER = "showbuzz";
export const CUSTOMER_AUDIENCE = "showbuzz-public";

const ALGORITHM = "HS256";
const CLOCK_TOLERANCE_SEC = 5;

const encoder = new TextEncoder();
const accessKey = encoder.encode(env.JWT_ACCESS_SECRET);
const refreshKey = encoder.encode(env.JWT_REFRESH_SECRET);

type TokenType = "access" | "refresh";

export interface AccessClaims {
  /** User id. */
  sub: string;
  /** Session id (one per signed-in device). */
  sid: string;
  /** Seconds since the epoch. */
  iat: number;
  exp: number;
}

export interface RefreshClaims extends AccessClaims {
  jti: string;
}

export type VerifyResult<T> = { ok: true; claims: T } | { ok: false; reason: "expired" | "invalid" };

export interface SignedToken {
  token: string;
  expiresAt: Date;
}

export function signAccessToken(input: { sub: string; sid: string; issuedAt?: Date }): Promise<SignedToken> {
  return sign("access", input, AUTH.accessTokenTtlSec);
}

/**
 * Signs a refresh token. HS256 is deterministic, so signing again with the same `jti` and `issuedAt`
 * reproduces the exact token; the session service relies on that during refresh races.
 */
export function signRefreshToken(input: {
  sub: string;
  sid: string;
  jti: string;
  issuedAt?: Date;
}): Promise<SignedToken> {
  return sign("refresh", input, AUTH.refreshTokenTtlSec);
}

export async function verifyAccessToken(token: string, now?: Date): Promise<VerifyResult<AccessClaims>> {
  const result = await verify(token, "access", now);
  return result.ok ? { ok: true, claims: pickAccess(result.claims) } : result;
}

export async function verifyRefreshToken(token: string, now?: Date): Promise<VerifyResult<RefreshClaims>> {
  const result = await verify(token, "refresh", now);
  if (!result.ok) return result;
  const { jti } = result.claims;
  return typeof jti === "string" && jti ? { ok: true, claims: { ...pickAccess(result.claims), jti } } : invalid();
}

async function sign(
  typ: TokenType,
  { sub, sid, jti, issuedAt }: { sub: string; sid: string; jti?: string; issuedAt?: Date },
  ttlSec: number,
): Promise<SignedToken> {
  const iat = Math.floor((issuedAt ?? new Date()).getTime() / 1000);
  const exp = iat + ttlSec;
  const jwt = new SignJWT({ sid, typ })
    .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
    .setIssuer(JWT_ISSUER)
    .setAudience(CUSTOMER_AUDIENCE)
    .setSubject(sub)
    .setIssuedAt(iat)
    .setExpirationTime(exp);
  if (jti) jwt.setJti(jti);
  return { token: await jwt.sign(typ === "access" ? accessKey : refreshKey), expiresAt: new Date(exp * 1000) };
}

type RawClaims = Record<string, unknown>;

async function verify(token: string, typ: TokenType, now?: Date): Promise<VerifyResult<RawClaims>> {
  try {
    const { payload } = await jwtVerify(token, typ === "access" ? accessKey : refreshKey, {
      algorithms: [ALGORITHM],
      issuer: JWT_ISSUER,
      audience: CUSTOMER_AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SEC,
      requiredClaims: ["sub", "sid", "iat", "exp"],
      ...(now ? { currentDate: now } : {}),
    });
    const valid =
      payload.typ === typ &&
      typeof payload.sub === "string" &&
      typeof payload.sid === "string" &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number";
    return valid ? { ok: true, claims: payload } : invalid();
  } catch (err) {
    // Callers only learn whether the token expired; jose's error details stay here.
    return { ok: false, reason: err instanceof errors.JWTExpired ? "expired" : "invalid" };
  }
}

function pickAccess(claims: RawClaims): AccessClaims {
  return {
    sub: String(claims.sub),
    sid: String(claims.sid),
    iat: Number(claims.iat),
    exp: Number(claims.exp),
  };
}

function invalid(): { ok: false; reason: "invalid" } {
  return { ok: false, reason: "invalid" };
}
