import "server-only";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { AUTH, DEFAULT_CUSTOMER_NAME } from "@/config/constants";
import { isDemoMode } from "@/config/env";
import {
  otpRequestSchema,
  otpVerifySchema,
  type ContactIdentifier,
  type OtpRequestInput,
  type OtpVerifyInput,
} from "@/schemas/auth";
import type { CustomerSnapshot } from "@/schemas/user";
import { AppError } from "@/server/http/app-error";

/**
 * Customer OTP sign-in. Codes are random, stored hashed with an expiry and attempt limit.
 * No SMS/email provider is chosen yet, so outside production the code is returned to the
 * caller for display instead of being delivered; in production the request is refused.
 * There is no fixed demo code. Session cookies (jose JWTs) arrive with the backend phase.
 */

interface PendingOtp {
  contact: ContactIdentifier;
  name?: string;
  codeHash: Buffer;
  expiresAt: number;
  attempts: number;
}

const globalStore = globalThis as unknown as { __showbuzzOtps?: Map<string, PendingOtp> };
const pending = (globalStore.__showbuzzOtps ??= new Map<string, PendingOtp>());

const hash = (code: string) => createHash("sha256").update(code).digest();

export async function requestOtp(input: OtpRequestInput, now: Date) {
  if (!isDemoMode) {
    throw new AppError("NOT_CONFIGURED", "Sign-in is not available yet. Please try again later.", 503);
  }
  const { identifier, name } = otpRequestSchema.parse(input);

  for (const [id, otp] of pending) if (otp.expiresAt < now.getTime()) pending.delete(id);

  const code = randomInt(0, 10 ** AUTH.otpLength)
    .toString()
    .padStart(AUTH.otpLength, "0");
  const requestId = randomUUID();
  pending.set(requestId, {
    contact: identifier,
    name,
    codeHash: hash(code),
    expiresAt: now.getTime() + AUTH.otpTtlSec * 1000,
    attempts: 0,
  });

  const destination = identifier.channel === "sms" ? identifier.phone : identifier.email;
  return { requestId, destination, devCode: code };
}

export async function verifyOtp(input: OtpVerifyInput, now: Date): Promise<CustomerSnapshot> {
  const { requestId, code } = otpVerifySchema.parse(input);
  const otp = pending.get(requestId);
  if (!otp || otp.expiresAt < now.getTime()) {
    pending.delete(requestId);
    throw new AppError("OTP_EXPIRED", "This code has expired. Please request a new one.", 410);
  }

  otp.attempts += 1;
  if (otp.attempts > AUTH.otpMaxAttempts) {
    pending.delete(requestId);
    throw new AppError("RATE_LIMITED", "Too many attempts. Please request a new code.", 429);
  }
  if (!timingSafeEqual(otp.codeHash, hash(code))) {
    throw new AppError("OTP_INVALID", "Incorrect code. Please try again.", 401);
  }

  pending.delete(requestId);
  const { contact } = otp;
  return {
    // Placeholder until batch 1.2 stores customers: the real id comes from the users collection.
    id: randomUUID(),
    name: otp.name ?? DEFAULT_CUSTOMER_NAME,
    ...(contact.channel === "email" ? { email: contact.email } : { phone: contact.phone }),
    joinedAt: now.toISOString(),
  };
}
