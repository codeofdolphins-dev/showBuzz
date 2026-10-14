import "server-only";
import { PARTNER_AUTH } from "@showbuzz/schemas/constants";
import { partnerLoginSchema, type VendorUserSnapshot } from "@showbuzz/schemas/partner";
import type { VendorSummary } from "@showbuzz/schemas/types/vendor";
import { connect } from "@showbuzz/db/connect";
import { Vendor, toVendorSummary } from "@showbuzz/db/models/Vendor";
import { VendorUser, type VendorUserDocument } from "@showbuzz/db/models/VendorUser";
import { AppError } from "../../http/app-error";
import type { AuthRequestContext } from "../context";
import { changeAccountPassword } from "../password-change";
import { INVALID_CREDENTIALS, checkPasswordSignIn } from "../password-sign-in";
import type { SessionTokens } from "../session-store";
import { vendorUserSessions } from "./sessions";
import { partnerTokens } from "./tokens";

/**
 * Vendor-user sign-in flows behind the /api/v1/partner/auth route handlers and the partner Server Actions. Same
 * rules as staff (../password-sign-in.ts). A suspended vendor can still sign in (it sees a notice and can't change
 * listings); a disabled login can't.
 */

/** Who is signed in to the partner portal: the login and its vendor (bank account masked). */
export interface PartnerIdentity {
  vendorUser: VendorUserSnapshot;
  vendor: VendorSummary;
}

export interface SignedInVendorUser extends PartnerIdentity {
  tokens: SessionTokens;
}

export interface CurrentVendor extends PartnerIdentity {
  sid: string;
  accessExpiresAt: Date;
}

const NOT_SIGNED_IN = "Please sign in to continue.";

export async function signInVendorUser(input: unknown, ctx: AuthRequestContext): Promise<SignedInVendorUser> {
  const { email, password } = partnerLoginSchema.parse(input);
  const user = await checkPasswordSignIn<VendorUserDocument>({
    email,
    password,
    ctx,
    label: "vendor-user",
    limits: {
      windowSec: PARTNER_AUTH.loginWindowSec,
      maxPerEmail: PARTNER_AUTH.loginMaxPerEmail,
      maxPerIp: PARTNER_AUTH.loginMaxPerIp,
    },
    findAccount: async (address) => {
      await connect();
      return VendorUser.findOne({ email: address });
    },
  });

  const identity = await toIdentity(user, ctx.now);
  if (!identity) throw new AppError("UNAUTHENTICATED", INVALID_CREDENTIALS, 401);
  const tokens = await startVendorSession(user, ctx);
  return { ...identity, tokens };
}

/** Starts a session for a vendor user who just proved who they are (sign-in or signup). */
export async function startVendorSession(user: VendorUserDocument, ctx: AuthRequestContext): Promise<SessionTokens> {
  const tokens = await vendorUserSessions.createSession(user, ctx);
  await VendorUser.updateOne({ _id: user._id }, { $set: { lastLoginAt: ctx.now } });
  return tokens;
}

/** Rotates the refresh token. Missing, invalid or reused tokens all end in UNAUTHENTICATED. */
export async function refreshVendorSession(
  refreshToken: string | undefined,
  ctx: AuthRequestContext,
): Promise<SignedInVendorUser> {
  if (!refreshToken) throw notSignedIn();
  const tokens = await vendorUserSessions.rotateSession(refreshToken, ctx);
  const verified = await partnerTokens.verifyRefreshToken(tokens.refreshToken, ctx.now);
  const user = verified.ok ? await vendorUserSessions.findSessionOwner(verified.claims.sub, tokens.sid, ctx.now) : null;
  const identity = user ? await toIdentity(user) : null;
  if (!identity) throw notSignedIn();
  return { ...identity, tokens };
}

/**
 * The vendor user behind an access token, or null. The token must verify against the partner keys and audience and
 * its session must still exist, so sign-out and password changes take effect before the token expires. The vendor
 * is read on every request, so suspension and onboarding changes apply immediately.
 */
export async function currentVendor(accessToken: string | undefined, now: Date): Promise<CurrentVendor | null> {
  if (!accessToken) return null;
  const verified = await partnerTokens.verifyAccessToken(accessToken, now);
  if (!verified.ok) return null;
  const { sub, sid, exp } = verified.claims;
  const user = await vendorUserSessions.findSessionOwner(sub, sid, now);
  const identity = user ? await toIdentity(user) : null;
  return identity ? { ...identity, sid, accessExpiresAt: new Date(exp * 1000) } : null;
}

/** Ends the session on this device; with neither token valid there is nothing to revoke. */
export async function signOutVendorUser(
  tokens: { accessToken?: string; refreshToken?: string },
  now: Date,
): Promise<void> {
  const access = tokens.accessToken ? await partnerTokens.verifyAccessToken(tokens.accessToken, now) : undefined;
  const claims = access?.ok
    ? access.claims
    : tokens.refreshToken
      ? await partnerTokens.verifyRefreshToken(tokens.refreshToken, now).then((r) => (r.ok ? r.claims : undefined))
      : undefined;
  if (claims) await vendorUserSessions.revokeSession(claims.sub, claims.sid);
}

/** Changes the signed-in vendor user's password; other devices are signed out. */
export async function changeOwnVendorPassword(actor: { vendorUserId: string; sid: string }, input: unknown) {
  await changeAccountPassword(
    {
      model: VendorUser,
      sessions: vendorUserSessions,
      label: "vendor-user",
      accountId: actor.vendorUserId,
      sid: actor.sid,
    },
    input,
  );
}

/** The only vendor-user shape that leaves the server: no hashes, no sessions. */
export function toVendorUserSnapshot(user: VendorUserDocument, lastLoginAt?: Date): VendorUserSnapshot {
  const loginAt = lastLoginAt ?? user.lastLoginAt;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(loginAt ? { lastLoginAt: loginAt.toISOString() } : {}),
  };
}

/** Login + its vendor; null when the vendor record is gone (the login is then unusable). */
async function toIdentity(user: VendorUserDocument, lastLoginAt?: Date): Promise<PartnerIdentity | null> {
  await connect();
  const vendor = await Vendor.findById(user.vendorId).lean();
  if (!vendor) return null;
  return { vendorUser: toVendorUserSnapshot(user, lastLoginAt), vendor: toVendorSummary(vendor) };
}

function notSignedIn() {
  return new AppError("UNAUTHENTICATED", NOT_SIGNED_IN, 401);
}
