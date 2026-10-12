"use server";

import { headers } from "next/headers";
import type { OtpRequestInput, OtpVerifyInput } from "@/schemas/auth";
import type { AuthRequestContext } from "@/server/auth/context";
import { requestOtp, verifyOtp } from "@/server/auth/otp";
import { runAction } from "@/server/http/action-result";
import { getClientIp } from "@/server/http/request";

async function requestContext(): Promise<AuthRequestContext> {
  const h = await headers();
  return { ip: getClientIp(h), userAgent: h.get("user-agent")?.slice(0, 300) ?? undefined, now: new Date() };
}

export async function requestOtpAction(input: OtpRequestInput) {
  return runAction(async () => requestOtp(input, await requestContext()));
}

export async function verifyOtpAction(input: OtpVerifyInput) {
  // Until sessions exist (batch 1.3) the UI keeps a display snapshot of the customer.
  return runAction(async () => (await verifyOtp(input, await requestContext())).toCustomerSnapshot());
}
