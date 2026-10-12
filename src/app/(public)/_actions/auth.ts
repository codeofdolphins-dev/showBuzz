"use server";

import type { OtpRequestInput, OtpVerifyInput } from "@/schemas/auth";
import { requestOtp, verifyOtp } from "@/server/auth/otp";
import { runAction } from "@/server/http/action-result";

export async function requestOtpAction(input: OtpRequestInput) {
  return runAction(() => requestOtp(input, new Date()));
}

export async function verifyOtpAction(input: OtpVerifyInput) {
  return runAction(() => verifyOtp(input, new Date()));
}
