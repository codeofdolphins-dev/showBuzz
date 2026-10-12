import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import { AUTH, DEFAULT_CUSTOMER_NAME } from "@/config/constants";
import { env } from "@/config/env";
import {
  otpRequestSchema,
  otpVerifySchema,
  type ContactIdentifier,
  type OtpRequestInput,
  type OtpVerifyInput,
} from "@/schemas/auth";
import { connect } from "@/server/db/connect";
import { AppError } from "@/server/http/app-error";
import { ipPrefix } from "@/server/http/request";
import { maskEmail } from "@/server/log";
import { OtpChallenge } from "@/server/models/OtpChallenge";
import { User, type UserDocument } from "@/server/models/User";
import { consumeRateLimit, type RateLimitOptions } from "@/server/security/rate-limit";
import type { AuthRequestContext } from "./context";
import { getOtpSender } from "./otp-delivery";

/**
 * Customer sign-in by one-time code (docs/roadmap.md "Decisions already taken"). Login and register
 * are one flow: verifying an unknown phone/email creates the account, and requesting a code looks the
 * same whether or not an account exists, so the endpoint can't be used to discover customers.
 */

export interface OtpRequestResult {
  challengeId: string;
  /** Masked: "98******10" or "a***@example.com". */
  destination: string;
  expiresInSec: number;
  resendAfterSec: number;
  /** Only outside production, for on-screen display while no SMS/email provider exists. */
  devCode?: string;
}

type Limit = Omit<RateLimitOptions, "now">;

const LIMITS = {
  requestPerIp: { limit: 20, windowSec: 60 * 60 },
  requestCooldown: { limit: 1, windowSec: AUTH.otpResendCooldownSec },
  requestPerIdentifier: { limit: 5, windowSec: 60 * 60 },
  verifyPerIp: { limit: 30, windowSec: 10 * 60 },
} satisfies Record<string, Limit>;

const SIGN_IN_FAILED = "We couldn't sign you in. Please contact support.";

/** `input` is validated here (raw JSON from a route, or typed input from a Server Action). */
export async function requestOtp(input: OtpRequestInput | unknown, ctx: AuthRequestContext): Promise<OtpRequestResult> {
  const { identifier: contact, name } = otpRequestSchema.parse(input);
  const identifier = identifierValue(contact);
  const purpose = "sign_in" as const;
  const { now } = ctx;

  await enforceIpLimit("otp:request", LIMITS.requestPerIp, ctx, "Too many codes requested from this network.");
  await enforce(`otp:cooldown:${identifier}`, LIMITS.requestCooldown, now, "Please wait before requesting a new code.");
  await enforce(
    `otp:request:${identifier}`,
    LIMITS.requestPerIdentifier,
    now,
    "Too many codes requested for this number or email.",
  );

  await connect();
  // Only the newest code works: older live codes for the same identifier stop working now.
  await OtpChallenge.updateMany(
    { identifier, purpose, consumedAt: null, expiresAt: { $gt: now } },
    { $set: { expiresAt: now } },
  );

  const challengeId = new Types.ObjectId();
  const code = randomInt(0, 10 ** AUTH.otpLength)
    .toString()
    .padStart(AUTH.otpLength, "0");
  await OtpChallenge.create({
    _id: challengeId,
    channel: contact.channel,
    identifier,
    purpose,
    pendingName: name,
    codeHash: hashCode(challengeId.toString(), code),
    expiresAt: new Date(now.getTime() + AUTH.otpTtlSec * 1000),
    ipPrefix: ipPrefix(ctx.ip),
  });

  let sent;
  try {
    sent = await getOtpSender().send({ channel: contact.channel, to: identifier, code, purpose });
  } catch (err) {
    await OtpChallenge.updateOne({ _id: challengeId }, { $set: { expiresAt: now } });
    throw err;
  }

  return {
    challengeId: challengeId.toString(),
    destination: maskDestination(contact),
    expiresInSec: AUTH.otpTtlSec,
    resendAfterSec: AUTH.otpResendCooldownSec,
    ...(sent.devCode ? { devCode: sent.devCode } : {}),
  };
}

/** Checks the code and returns the signed-in customer, creating the account on first sign-in. */
export async function verifyOtp(input: OtpVerifyInput | unknown, ctx: AuthRequestContext): Promise<UserDocument> {
  const { challengeId, code } = otpVerifySchema.parse(input);
  const { now } = ctx;

  await enforceIpLimit("otp:verify", LIMITS.verifyPerIp, ctx, "Too many sign-in attempts from this network.");

  await connect();
  // Count the attempt atomically: only a live challenge with attempts left matches.
  const challenge = await OtpChallenge.findOneAndUpdate(
    {
      _id: challengeId,
      purpose: "sign_in",
      consumedAt: null,
      expiresAt: { $gt: now },
      $expr: { $lt: ["$attempts", "$maxAttempts"] },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!challenge) throw await rejectionFor(challengeId, now);

  if (!codesMatch(challenge.codeHash, hashCode(challengeId, code))) {
    const remainingAttempts = Math.max(0, challenge.maxAttempts - challenge.attempts);
    throw new AppError("OTP_INVALID", "Incorrect code. Please try again.", 401, { remainingAttempts });
  }

  // Single use: only the first verify to get here consumes the code.
  const consumed = await OtpChallenge.updateOne({ _id: challengeId, consumedAt: null }, { $set: { consumedAt: now } });
  if (consumed.modifiedCount !== 1) throw expired();

  const contact: ContactIdentifier =
    challenge.channel === "sms"
      ? { channel: "sms", phone: challenge.identifier }
      : { channel: "email", email: challenge.identifier };
  return signIn(contact, challenge.pendingName, now);
}

async function signIn(contact: ContactIdentifier, pendingName: string | undefined, now: Date): Promise<UserDocument> {
  const user = await findOrCreateUser(contact, pendingName ?? DEFAULT_CUSTOMER_NAME);
  if (user.status !== "active") {
    // Blocked and deleted accounts get the same message; the reason isn't disclosed.
    throw new AppError("UNAUTHENTICATED", SIGN_IN_FAILED, 401);
  }
  user.set(contact.channel === "sms" ? { phoneVerifiedAt: now } : { emailVerifiedAt: now });
  user.set({ lastLoginAt: now });
  await user.save();
  return user;
}

/** Atomic find-or-create keyed on the unique phone/email index; existing accounts are left unchanged. */
async function findOrCreateUser(contact: ContactIdentifier, name: string, isRetry = false): Promise<UserDocument> {
  const filter = contact.channel === "sms" ? { phone: contact.phone } : { email: contact.email };
  try {
    const user = await User.findOneAndUpdate(
      filter,
      { $setOnInsert: { ...filter, name, status: "active" } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    );
    if (!user) throw new Error("User upsert returned no document");
    return user;
  } catch (err) {
    // Two first sign-ins for the same identifier can race to insert; the second finds the first's user.
    if (!isRetry && isDuplicateKeyError(err)) return findOrCreateUser(contact, name, true);
    throw err;
  }
}

async function enforce(key: string, limit: Limit, now: Date, message: string): Promise<void> {
  const result = await consumeRateLimit(key, { ...limit, now });
  if (result.allowed) return;
  throw new AppError("RATE_LIMITED", `${message} Try again in ${describeWait(result.retryAfterSec)}.`, 429, {
    retryAfterSec: result.retryAfterSec,
  });
}

/** Per-IP limits are skipped when the IP is unknown (local development) rather than sharing one bucket. */
async function enforceIpLimit(prefix: string, limit: Limit, ctx: AuthRequestContext, message: string) {
  if (ctx.ip === "unknown") return;
  await enforce(`${prefix}:ip:${ctx.ip}`, limit, ctx.now, message);
}

/** Explains a failed attempt after the atomic update matched nothing. Never grants anything. */
async function rejectionFor(challengeId: string, now: Date): Promise<AppError> {
  const existing = await OtpChallenge.findById(challengeId, {
    attempts: 1,
    maxAttempts: 1,
    consumedAt: 1,
    expiresAt: 1,
  });
  const live = existing && !existing.consumedAt && existing.expiresAt > now;
  if (live && existing.attempts >= existing.maxAttempts) {
    return new AppError("RATE_LIMITED", "Too many attempts. Please request a new code.", 429);
  }
  return expired();
}

function expired() {
  return new AppError("OTP_EXPIRED", "This code has expired. Please request a new one.", 410);
}

/** HMAC over challenge id + code, so a stored hash only ever matches its own challenge. */
function hashCode(challengeId: string, code: string): string {
  return createHmac("sha256", env.OTP_HASH_SECRET).update(`${challengeId}:${code}`).digest("hex");
}

function codesMatch(storedHex: string, candidateHex: string): boolean {
  const stored = Buffer.from(storedHex, "hex");
  const candidate = Buffer.from(candidateHex, "hex");
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

function identifierValue(contact: ContactIdentifier): string {
  return contact.channel === "sms" ? contact.phone : contact.email;
}

/** "+919876543210" → "98******10"; emails → "a***@example.com". */
function maskDestination(contact: ContactIdentifier): string {
  if (contact.channel === "email") return maskEmail(contact.email);
  const national = contact.phone.slice(-10);
  return `${national.slice(0, 2)}******${national.slice(-2)}`;
}

function describeWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}
