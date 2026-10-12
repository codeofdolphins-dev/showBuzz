"use server";

import { cookies, headers } from "next/headers";
import type { OtpRequestInput, OtpVerifyInput } from "@/schemas/auth";
import { authContextFrom } from "@/server/auth/context";
import { clearSessionCookies, readAccessToken, setSessionCookies } from "@/server/auth/cookies";
import { signInWithOtp, signOut } from "@/server/auth/customer-auth.service";
import { requestOtp } from "@/server/auth/otp";
import { runAction } from "@/server/http/action-result";

/*
 * Mirrors POST /api/v1/auth/customer/otp/{request,verify} and /logout for the sign-in modal.
 * There is no refresh action: the refresh cookie is scoped to /api/v1/auth, which Server Actions
 * never receive, so the client calls POST /api/v1/auth/refresh instead.
 */

export async function requestOtpAction(input: OtpRequestInput) {
  return runAction(async () => requestOtp(input, authContextFrom(await headers())));
}

export async function verifyOtpAction(input: OtpVerifyInput) {
  return runAction(async () => {
    const ctx = authContextFrom(await headers());
    const { user, tokens } = await signInWithOtp(input, ctx);
    setSessionCookies(await cookies(), tokens, ctx.now);
    return { user, accessExpiresAt: tokens.accessExpiresAt.toISOString() };
  });
}

export async function logoutAction() {
  return runAction(async () => {
    const store = await cookies();
    // Only the access cookie reaches a Server Action; it identifies the session to revoke.
    await signOut({ accessToken: readAccessToken(store) }, new Date());
    clearSessionCookies(store);
    return { signedOut: true };
  });
}
