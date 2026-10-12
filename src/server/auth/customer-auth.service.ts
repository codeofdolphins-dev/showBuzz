import "server-only";
import type { OtpVerifyInput } from "@/schemas/auth";
import type { CustomerSnapshot } from "@/schemas/user";
import { AppError } from "@/server/http/app-error";
import type { AuthRequestContext } from "./context";
import { verifyAccessToken, verifyRefreshToken } from "./jwt";
import { verifyOtp } from "./otp";
import { createSession, findSessionUser, revokeSession, rotateSession, type SessionTokens } from "./session";

/**
 * Customer sign-in flows shared by the /api/v1/auth route handlers and the Server Actions, so both
 * stay thin: they parse input, call one of these and set or clear cookies.
 */

export interface SignedInCustomer {
  user: CustomerSnapshot;
  tokens: SessionTokens;
}

export interface CurrentCustomer {
  user: CustomerSnapshot;
  sid: string;
  accessExpiresAt: Date;
}

const NOT_SIGNED_IN = "Please sign in to continue.";

/** Verifies a one-time code and starts a session on this device. */
export async function signInWithOtp(
  input: OtpVerifyInput | unknown,
  ctx: AuthRequestContext,
): Promise<SignedInCustomer> {
  const user = await verifyOtp(input, ctx);
  const tokens = await createSession(user, ctx);
  return { user: user.toCustomerSnapshot(), tokens };
}

/** Rotates the refresh token. Missing, invalid or reused tokens all end in UNAUTHENTICATED. */
export async function refreshCustomerSession(
  refreshToken: string | undefined,
  ctx: AuthRequestContext,
): Promise<SignedInCustomer> {
  if (!refreshToken) throw notSignedIn();
  const tokens = await rotateSession(refreshToken, ctx);
  const verified = await verifyRefreshToken(tokens.refreshToken, ctx.now);
  const user = verified.ok ? await findSessionUser(verified.claims.sub, tokens.sid, ctx.now) : null;
  if (!user) throw notSignedIn();
  return { user: user.toCustomerSnapshot(), tokens };
}

/**
 * The customer behind an access token, or null. The token must verify *and* its session must still
 * exist, so signing out (or a revoked session) takes effect before the token expires.
 */
export async function currentCustomer(accessToken: string | undefined, now: Date): Promise<CurrentCustomer | null> {
  if (!accessToken) return null;
  const verified = await verifyAccessToken(accessToken, now);
  if (!verified.ok) return null;
  const { sub, sid, exp } = verified.claims;
  const user = await findSessionUser(sub, sid, now);
  return user ? { user: user.toCustomerSnapshot(), sid, accessExpiresAt: new Date(exp * 1000) } : null;
}

/**
 * Ends the session on this device. Only a verified token identifies the session to revoke; with
 * neither token valid there is nothing to revoke and the caller just clears cookies.
 */
export async function signOut(tokens: { accessToken?: string; refreshToken?: string }, now: Date): Promise<void> {
  const access = tokens.accessToken ? await verifyAccessToken(tokens.accessToken, now) : undefined;
  const claims = access?.ok
    ? access.claims
    : tokens.refreshToken
      ? await verifyRefreshToken(tokens.refreshToken, now).then((r) => (r.ok ? r.claims : undefined))
      : undefined;
  if (claims) await revokeSession(claims.sub, claims.sid);
}

function notSignedIn() {
  return new AppError("UNAUTHENTICATED", NOT_SIGNED_IN, 401);
}
