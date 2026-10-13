import "server-only";
import { AUTH } from "@showbuzz/schemas/constants";
import { describeUserAgent } from "@showbuzz/utils/user-agent";
import {
  confirmCodeSchema,
  removeContactSchema,
  revokeSessionSchema,
  startContactChangeSchema,
  updateProfileSchema,
} from "@showbuzz/schemas/account";
import type { ContactIdentifier } from "@showbuzz/schemas/auth";
import type { CustomerSnapshot } from "@showbuzz/schemas/user";
import type { AuthRequestContext } from "../auth/context";
import { consumeChallenge, issueChallenge, type OtpRequestResult } from "../auth/otp";
import { revokeAllSessions, revokeSession } from "../auth/session";
import { connect } from "@showbuzz/db/connect";
import { AppError } from "../http/app-error";
import { log } from "@showbuzz/runtime/log";
import { User, type UserDocument } from "@showbuzz/db/models/User";
import { consumeRateLimit } from "../security/rate-limit";
import type { AccountProfile } from "@showbuzz/schemas/types/account";

/**
 * Profile and account management for a signed-in customer. Callers pass the user id and session id from
 * requireCustomerSession(), which has already checked the session is live in the database.
 */

/** Stands in for the name on deleted accounts; phone and email are removed entirely. */
export const DELETED_USER_NAME = "Deleted user";

const IDENTIFIER_UNAVAILABLE = "This number or email can't be used. Please try another.";

/** Bounds "is this number/email taken?" probing and code sends from one account or network. */
const CONTACT_CHANGE_LIMITS = {
  perUser: { limit: 5, windowSec: 60 * 60 },
  perIp: { limit: 20, windowSec: 60 * 60 },
};

export async function getAccountProfile(userId: string, currentSid: string, now: Date): Promise<AccountProfile> {
  const user = await activeUser(userId);
  const sessions = user.sessions
    .filter((s) => s.expiresAt > now)
    .sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime())
    .map((s) => ({
      sid: s.sid,
      device: describeUserAgent(s.userAgent),
      ...(s.ipPrefix ? { ipPrefix: s.ipPrefix } : {}),
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      current: s.sid === currentSid,
    }));
  return {
    user: user.toCustomerSnapshot(),
    phoneVerified: !!user.phone && !!user.phoneVerifiedAt,
    emailVerified: !!user.email && !!user.emailVerifiedAt,
    sessions,
  };
}

export async function updateProfile(userId: string, input: unknown): Promise<CustomerSnapshot> {
  const { name } = updateProfileSchema.parse(input);
  await connect();
  const user = await User.findOneAndUpdate(
    { _id: userId, status: "active" },
    { $set: { name } },
    { returnDocument: "after", runValidators: true },
  );
  if (!user) throw sessionEnded();
  return user.toCustomerSnapshot();
}

/**
 * Sends a code to a new phone or email the customer wants to add or switch to. An identifier that already
 * belongs to someone else is refused before anything is sent, with a message that doesn't say why.
 */
export async function startContactChange(
  userId: string,
  sid: string,
  input: unknown,
  ctx: AuthRequestContext,
): Promise<OtpRequestResult> {
  const { identifier: contact } = startContactChangeSchema.parse(input);
  const user = await activeUser(userId);
  requireRecentAuth(user, sid, ctx.now);
  // Limits first: the "taken" check below must not become an unlimited lookup.
  await limit(`contact-change:user:${userId}`, CONTACT_CHANGE_LIMITS.perUser, ctx.now);
  if (ctx.ip !== "unknown") await limit(`contact-change:ip:${ctx.ip}`, CONTACT_CHANGE_LIMITS.perIp, ctx.now);
  const field = fieldFor(contact);
  const value = valueOf(contact);

  if (user[field] === value) {
    throw new AppError("VALIDATION_FAILED", `That's already your ${field === "phone" ? "number" : "email"}.`, 422);
  }
  if (await User.exists({ [field]: value, _id: { $ne: user._id } })) {
    throw new AppError("CONFLICT", IDENTIFIER_UNAVAILABLE, 409);
  }
  return issueChallenge({ contact, purpose: "change_contact", userId }, ctx);
}

/** Verifies the code and saves the new phone or email as verified. */
export async function confirmContactChange(
  userId: string,
  input: unknown,
  ctx: AuthRequestContext,
): Promise<CustomerSnapshot> {
  const { challengeId, code } = confirmCodeSchema.parse(input);
  const { contact } = await consumeChallenge({ challengeId, code, purpose: "change_contact", userId }, ctx);
  const field = fieldFor(contact);

  await connect();
  try {
    const user = await User.findOneAndUpdate(
      { _id: userId, status: "active" },
      { $set: { [field]: valueOf(contact), [`${field}VerifiedAt`]: ctx.now } },
      { returnDocument: "after", runValidators: true },
    );
    if (!user) throw sessionEnded();
    return user.toCustomerSnapshot();
  } catch (err) {
    // Someone else verified the same identifier between the code being sent and confirmed.
    if (isDuplicateKeyError(err)) throw new AppError("CONFLICT", IDENTIFIER_UNAVAILABLE, 409);
    throw err;
  }
}

/** Removes the email or phone, but never the last way to sign in (checked in the same atomic update). */
export async function removeContact(userId: string, sid: string, input: unknown, now: Date): Promise<CustomerSnapshot> {
  const { channel } = removeContactSchema.parse(input);
  requireRecentAuth(await activeUser(userId), sid, now);
  const field = channel === "sms" ? "phone" : "email";
  const other = field === "phone" ? "email" : "phone";

  await connect();
  const user = await User.findOneAndUpdate(
    { _id: userId, status: "active", [field]: { $type: "string" }, [other]: { $type: "string" } },
    { $unset: { [field]: "", [`${field}VerifiedAt`]: "" } },
    { returnDocument: "after" },
  );
  if (!user) {
    await activeUser(userId);
    throw new AppError("VALIDATION_FAILED", "You need at least one phone number or email to sign in.", 422);
  }
  return user.toCustomerSnapshot();
}

/** Signs one of the customer's devices out. Returns whether that was this device (the caller signs out). */
export async function revokeOwnSession(
  userId: string,
  currentSid: string,
  input: unknown,
): Promise<{ signedOutHere: boolean }> {
  const { sid } = revokeSessionSchema.parse(input);
  await revokeSession(userId, sid);
  return { signedOutHere: sid === currentSid };
}

export async function signOutOtherDevices(userId: string, currentSid: string): Promise<void> {
  await revokeAllSessions(userId, currentSid);
}

/** Sends a fresh code to the customer's own phone (or email) to confirm account deletion. */
export async function startAccountDeletion(userId: string, ctx: AuthRequestContext): Promise<OtpRequestResult> {
  return issueChallenge({ contact: ownContact(await activeUser(userId)), purpose: "delete_account", userId }, ctx);
}

/**
 * Deletes the account after the code is confirmed: the document stays (bookings and payments keep their
 * userId for GST records) but becomes a tombstone without name, phone or email, and every session ends.
 * The old phone/email is free again, so signing in with it later creates a new account.
 */
export async function confirmAccountDeletion(userId: string, input: unknown, ctx: AuthRequestContext): Promise<void> {
  const { challengeId, code } = confirmCodeSchema.parse(input);
  await consumeChallenge({ challengeId, code, purpose: "delete_account", userId }, ctx);

  await connect();
  const result = await User.updateOne(
    { _id: userId, status: "active" },
    {
      $set: { status: "deleted", name: DELETED_USER_NAME, deletedAt: ctx.now, sessions: [] },
      $unset: { phone: "", email: "", phoneVerifiedAt: "", emailVerifiedAt: "", lastLoginAt: "" },
    },
  );
  if (result.modifiedCount !== 1) throw sessionEnded();
  log.info("Customer account deleted", { event: "account.deleted", userId });
}

/** Sends a "confirm it's you" code to the customer's own phone (or email), for the step-up check. */
export async function startReauthentication(userId: string, ctx: AuthRequestContext): Promise<OtpRequestResult> {
  return issueChallenge({ contact: ownContact(await activeUser(userId)), purpose: "reauthenticate", userId }, ctx);
}

/** Confirms the code and marks this device's session as recently re-authenticated. */
export async function confirmReauthentication(
  userId: string,
  sid: string,
  input: unknown,
  ctx: AuthRequestContext,
): Promise<{ reauthenticated: true }> {
  const { challengeId, code } = confirmCodeSchema.parse(input);
  await consumeChallenge({ challengeId, code, purpose: "reauthenticate", userId }, ctx);
  const result = await User.updateOne(
    { _id: userId, status: "active", "sessions.sid": sid },
    { $set: { "sessions.$.reauthenticatedAt": ctx.now } },
  );
  if (result.matchedCount !== 1) throw sessionEnded();
  return { reauthenticated: true };
}

/**
 * Step-up: sensitive account changes need this device to have signed in or confirmed a code recently, so a
 * stolen session alone can't swap the phone/email and take the account over.
 */
function requireRecentAuth(user: UserDocument, sid: string, now: Date) {
  const session = user.sessions.find((s) => s.sid === sid);
  const lastProof = Math.max(session?.createdAt.getTime() ?? 0, session?.reauthenticatedAt?.getTime() ?? 0);
  if (now.getTime() - lastProof > AUTH.stepUpWindowSec * 1000) {
    throw new AppError("STEP_UP_REQUIRED", "Please confirm it's you before changing your sign-in details.", 403);
  }
}

async function limit(key: string, options: { limit: number; windowSec: number }, now: Date) {
  const result = await consumeRateLimit(key, { ...options, now });
  if (!result.allowed) {
    throw new AppError("RATE_LIMITED", "Too many attempts. Please try again later.", 429, {
      retryAfterSec: result.retryAfterSec,
    });
  }
}

function ownContact(user: UserDocument): ContactIdentifier {
  if (user.phone) return { channel: "sms", phone: user.phone };
  if (user.email) return { channel: "email", email: user.email };
  throw sessionEnded();
}

async function activeUser(userId: string): Promise<UserDocument> {
  await connect();
  const user = await User.findOne({ _id: userId, status: "active" });
  if (!user) throw sessionEnded();
  return user;
}

function fieldFor(contact: ContactIdentifier): "phone" | "email" {
  return contact.channel === "sms" ? "phone" : "email";
}

function valueOf(contact: ContactIdentifier): string {
  return contact.channel === "sms" ? contact.phone : contact.email;
}

function sessionEnded() {
  return new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}
