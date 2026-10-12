import "server-only";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { isDemoMode } from "@/config/env";
import { otpRequestSchema, otpVerifySchema, type OtpRequestInput, type OtpVerifyInput } from "@/schemas/auth";
import { AppError } from "@/server/http/app-error";

/**
 * Customer OTP sign-in. Codes are random, stored hashed with an expiry and attempt limit.
 * No SMS/email provider is chosen yet, so outside production the code is returned to the
 * caller for display instead of being delivered; in production the request is refused.
 * There is no fixed demo code. Session cookies (jose JWTs) arrive with the backend phase.
 */

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

interface PendingOtp {
  identifier: string;
  name?: string;
  codeHash: Buffer;
  expiresAt: number;
  attempts: number;
}

const globalStore = globalThis as unknown as { __showbuzzOtps?: Map<string, PendingOtp> };
const pending = (globalStore.__showbuzzOtps ??= new Map<string, PendingOtp>());

const hash = (code: string) => createHash("sha256").update(code).digest();

export interface CustomerSnapshot {
  name: string;
  email?: string;
  phone?: string;
  joinedAt: string;
}

export async function requestOtp(input: OtpRequestInput, now: Date) {
  if (!isDemoMode) {
    throw new AppError("NOT_CONFIGURED", "Sign-in is not available yet. Please try again later.", 503);
  }
  const { identifier, name } = otpRequestSchema.parse(input);

  for (const [id, otp] of pending) if (otp.expiresAt < now.getTime()) pending.delete(id);

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const requestId = randomUUID();
  pending.set(requestId, { identifier, name, codeHash: hash(code), expiresAt: now.getTime() + OTP_TTL_MS, attempts: 0 });

  return { requestId, destination: identifier, devCode: code };
}

export async function verifyOtp(input: OtpVerifyInput, now: Date): Promise<CustomerSnapshot> {
  const { requestId, code } = otpVerifySchema.parse(input);
  const otp = pending.get(requestId);
  if (!otp || otp.expiresAt < now.getTime()) {
    pending.delete(requestId);
    throw new AppError("OTP_EXPIRED", "This code has expired. Please request a new one.", 410);
  }

  otp.attempts += 1;
  if (otp.attempts > MAX_ATTEMPTS) {
    pending.delete(requestId);
    throw new AppError("RATE_LIMITED", "Too many attempts. Please request a new code.", 429);
  }
  if (!timingSafeEqual(otp.codeHash, hash(code))) {
    throw new AppError("OTP_INVALID", "Incorrect code. Please try again.", 401);
  }

  pending.delete(requestId);
  const isEmail = otp.identifier.includes("@");
  return {
    name: otp.name ?? "ShowBuzz Member",
    email: isEmail ? otp.identifier : undefined,
    phone: isEmail ? undefined : otp.identifier,
    joinedAt: now.toISOString(),
  };
}
