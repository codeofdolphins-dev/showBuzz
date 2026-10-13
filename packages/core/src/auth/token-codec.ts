import "server-only";
import { SignJWT, errors, jwtVerify } from "jose";

/**
 * Access/refresh JWTs for one audience (customers: "showbuzz-public", staff: "showbuzz-admin"). No database
 * access here, so proxy.ts can import a codec. Verification pins HS256 and checks issuer, audience and `typ`:
 * a refresh token never passes as an access token, and a token for one audience (signed with that audience's
 * own keys) never passes for the other.
 */

export const JWT_ISSUER = "showbuzz";

const ALGORITHM = "HS256";
const CLOCK_TOLERANCE_SEC = 5;

type TokenType = "access" | "refresh";

export interface AccessClaims {
  /** Account id (user or staff). */
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

export interface TokenCodecOptions {
  audience: string;
  accessSecret: string;
  refreshSecret: string;
  accessTtlSec: number;
  refreshTtlSec: number;
}

export interface TokenCodec {
  audience: string;
  signAccessToken(input: { sub: string; sid: string; issuedAt?: Date }): Promise<SignedToken>;
  /**
   * Signs a refresh token. HS256 is deterministic, so signing again with the same `jti` and `issuedAt`
   * reproduces the exact token; the session store relies on that during refresh races.
   */
  signRefreshToken(input: { sub: string; sid: string; jti: string; issuedAt?: Date }): Promise<SignedToken>;
  verifyAccessToken(token: string, now?: Date): Promise<VerifyResult<AccessClaims>>;
  verifyRefreshToken(token: string, now?: Date): Promise<VerifyResult<RefreshClaims>>;
}

type RawClaims = Record<string, unknown>;

export function createTokenCodec(options: TokenCodecOptions): TokenCodec {
  const encoder = new TextEncoder();
  const keys = { access: encoder.encode(options.accessSecret), refresh: encoder.encode(options.refreshSecret) };
  const ttl = { access: options.accessTtlSec, refresh: options.refreshTtlSec };

  async function sign(
    typ: TokenType,
    { sub, sid, jti, issuedAt }: { sub: string; sid: string; jti?: string; issuedAt?: Date },
  ): Promise<SignedToken> {
    const iat = Math.floor((issuedAt ?? new Date()).getTime() / 1000);
    const exp = iat + ttl[typ];
    const jwt = new SignJWT({ sid, typ })
      .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
      .setIssuer(JWT_ISSUER)
      .setAudience(options.audience)
      .setSubject(sub)
      .setIssuedAt(iat)
      .setExpirationTime(exp);
    if (jti) jwt.setJti(jti);
    return { token: await jwt.sign(keys[typ]), expiresAt: new Date(exp * 1000) };
  }

  async function verify(token: string, typ: TokenType, now?: Date): Promise<VerifyResult<RawClaims>> {
    try {
      const { payload } = await jwtVerify(token, keys[typ], {
        algorithms: [ALGORITHM],
        issuer: JWT_ISSUER,
        audience: options.audience,
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

  return {
    audience: options.audience,
    signAccessToken: (input) => sign("access", input),
    signRefreshToken: (input) => sign("refresh", input),
    async verifyAccessToken(token, now) {
      const result = await verify(token, "access", now);
      return result.ok ? { ok: true, claims: pickAccess(result.claims) } : result;
    },
    async verifyRefreshToken(token, now) {
      const result = await verify(token, "refresh", now);
      if (!result.ok) return result;
      const { jti } = result.claims;
      return typeof jti === "string" && jti ? { ok: true, claims: { ...pickAccess(result.claims), jti } } : invalid();
    },
  };
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
