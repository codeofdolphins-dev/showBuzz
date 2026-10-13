import "server-only";
import { ADMIN_AUTH } from "@showbuzz/schemas/constants";
import { staffLoginSchema, type StaffSnapshot } from "@showbuzz/schemas/staff";
import { connect } from "@showbuzz/db/connect";
import { Role } from "@showbuzz/db/models/Role";
import { Staff, type StaffDocument } from "@showbuzz/db/models/Staff";
import { log } from "@showbuzz/runtime/log";
import { AppError } from "../../http/app-error";
import { consumeRateLimit } from "../../security/rate-limit";
import type { AuthRequestContext } from "../context";
import type { SessionTokens } from "../session-store";
import { burnPasswordCheck, verifyPassword } from "./password";
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

/** One message for unknown email, wrong password and disabled account: no account enumeration. */
const INVALID_CREDENTIALS = "Invalid email or password.";
const NOT_SIGNED_IN = "Please sign in to continue.";

/** Checks email + password and starts a session on this device. */
export async function signInStaff(input: unknown, ctx: AuthRequestContext): Promise<SignedInStaff> {
  const { email, password } = staffLoginSchema.parse(input);

  await limitLogin(`staff-login:email:${email}`, ADMIN_AUTH.loginMaxPerEmail, ctx.now);
  if (ctx.ip !== "unknown") await limitLogin(`staff-login:ip:${ctx.ip}`, ADMIN_AUTH.loginMaxPerIp, ctx.now);

  await connect();
  const staff = await Staff.findOne({ email });
  if (!staff) {
    await burnPasswordCheck(password);
    throw invalidCredentials();
  }
  // The password is checked before the status, so a disabled account answers exactly like a wrong password.
  const passwordOk = await verifyPassword(password, staff.passwordHash);
  if (!passwordOk || staff.status !== "active") {
    if (passwordOk) log.info("Disabled staff account tried to sign in", { event: "staff.login_disabled", staffId: staff.id });
    throw invalidCredentials();
  }

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

async function limitLogin(key: string, limit: number, now: Date): Promise<void> {
  const result = await consumeRateLimit(key, { limit, windowSec: ADMIN_AUTH.loginWindowSec, now });
  if (result.allowed) return;
  const minutes = Math.max(1, Math.ceil(result.retryAfterSec / 60));
  throw new AppError(
    "RATE_LIMITED",
    `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    429,
    { retryAfterSec: result.retryAfterSec },
  );
}

function invalidCredentials() {
  return new AppError("UNAUTHENTICATED", INVALID_CREDENTIALS, 401);
}

function notSignedIn() {
  return new AppError("UNAUTHENTICATED", NOT_SIGNED_IN, 401);
}
