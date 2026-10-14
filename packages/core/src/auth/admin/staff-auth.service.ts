import "server-only";
import { ADMIN_AUTH } from "@showbuzz/schemas/constants";
import { staffLoginSchema, type StaffSnapshot } from "@showbuzz/schemas/staff";
import { connect } from "@showbuzz/db/connect";
import { Role } from "@showbuzz/db/models/Role";
import { Staff, type StaffDocument } from "@showbuzz/db/models/Staff";
import { AppError } from "../../http/app-error";
import type { AuthRequestContext } from "../context";
import type { SessionTokens } from "../session-store";
import { checkPasswordSignIn } from "../password-sign-in";
import { staffSessions } from "./sessions";
import { adminTokens } from "./tokens";

/**
 * Staff sign-in flows shared by the /api/v1/admin/auth route handlers and Server Actions, so both stay thin:
 * they parse input, call one of these and set or clear cookies.
 */

export interface SignedInStaff {
  staff: StaffSnapshot;
  tokens: SessionTokens;
}

export interface CurrentStaff {
  staff: StaffSnapshot;
  sid: string;
  accessExpiresAt: Date;
}

const NOT_SIGNED_IN = "Please sign in to continue.";

/** Checks email + password (shared rules: ../password-sign-in.ts) and starts a session on this device. */
export async function signInStaff(input: unknown, ctx: AuthRequestContext): Promise<SignedInStaff> {
  const { email, password } = staffLoginSchema.parse(input);
  const staff = await checkPasswordSignIn<StaffDocument>({
    email,
    password,
    ctx,
    label: "staff",
    limits: {
      windowSec: ADMIN_AUTH.loginWindowSec,
      maxPerEmail: ADMIN_AUTH.loginMaxPerEmail,
      maxPerIp: ADMIN_AUTH.loginMaxPerIp,
    },
    findAccount: async (address) => {
      await connect();
      return Staff.findOne({ email: address });
    },
  });

  const snapshot = await toSnapshot(staff, ctx.now);
  const tokens = await staffSessions.createSession(staff, ctx);
  await Staff.updateOne({ _id: staff._id }, { $set: { lastLoginAt: ctx.now } });
  return { staff: snapshot, tokens };
}

/** Rotates the refresh token. Missing, invalid or reused tokens all end in UNAUTHENTICATED. */
export async function refreshStaffSession(
  refreshToken: string | undefined,
  ctx: AuthRequestContext,
): Promise<SignedInStaff> {
  if (!refreshToken) throw notSignedIn();
  const tokens = await staffSessions.rotateSession(refreshToken, ctx);
  const verified = await adminTokens.verifyRefreshToken(tokens.refreshToken, ctx.now);
  const staff = verified.ok ? await staffSessions.findSessionOwner(verified.claims.sub, tokens.sid, ctx.now) : null;
  if (!staff) throw notSignedIn();
  return { staff: await toSnapshot(staff), tokens };
}

/**
 * The staff member behind an access token, or null. The token must verify against the admin keys and audience
 * (customer tokens never do) *and* its session must still exist, so sign-out, a password reset or disabling
 * the account takes effect before the token expires. The role is read on every request, so permission changes
 * apply immediately.
 */
export async function currentStaff(accessToken: string | undefined, now: Date): Promise<CurrentStaff | null> {
  if (!accessToken) return null;
  const verified = await adminTokens.verifyAccessToken(accessToken, now);
  if (!verified.ok) return null;
  const { sub, sid, exp } = verified.claims;
  const staff = await staffSessions.findSessionOwner(sub, sid, now);
  return staff ? { staff: await toSnapshot(staff), sid, accessExpiresAt: new Date(exp * 1000) } : null;
}

/** Ends the session on this device; with neither token valid there is nothing to revoke. */
export async function signOutStaff(tokens: { accessToken?: string; refreshToken?: string }, now: Date): Promise<void> {
  const access = tokens.accessToken ? await adminTokens.verifyAccessToken(tokens.accessToken, now) : undefined;
  const claims = access?.ok
    ? access.claims
    : tokens.refreshToken
      ? await adminTokens.verifyRefreshToken(tokens.refreshToken, now).then((r) => (r.ok ? r.claims : undefined))
      : undefined;
  if (claims) await staffSessions.revokeSession(claims.sub, claims.sid);
}

/** The only staff shape that leaves the server: no hashes, no sessions; permissions from the role. */
export async function toSnapshot(staff: StaffDocument, lastLoginAt?: Date): Promise<StaffSnapshot> {
  const role = await Role.findById(staff.roleId, { name: 1, permissions: 1 }).lean();
  const loginAt = lastLoginAt ?? staff.lastLoginAt;
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: role ? { id: String(role._id), name: role.name } : { id: String(staff.roleId), name: "No role" },
    permissions: role ? [...role.permissions] : [],
    ...(loginAt ? { lastLoginAt: loginAt.toISOString() } : {}),
  };
}

function notSignedIn() {
  return new AppError("UNAUTHENTICATED", NOT_SIGNED_IN, 401);
}
