"use server";

import { cookies, headers } from "next/headers";
import { authContextFrom } from "@showbuzz/core/auth/context";
import { partnerCookies } from "@showbuzz/core/auth/partner/cookies";
import { startVendorSession } from "@showbuzz/core/auth/partner/vendor-auth.service";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { sendSignupCode, signupVendor } from "@showbuzz/core/services/partner/signup.service";

/**
 * Self-service partner signup. Step 1 sends a code to the mobile number; step 2 checks it, creates the vendor and
 * its owner login, and signs the new owner in (cookies set here) so the browser can go straight to onboarding.
 */

export async function sendSignupCodeAction(
  input: unknown,
): Promise<ActionResult<{ challengeId: string; destination: string; resendAfterSec: number; devCode?: string }>> {
  return runAction(async () => {
    const result = await sendSignupCode(input, authContextFrom(await headers()));
    return {
      challengeId: result.challengeId,
      destination: result.destination,
      resendAfterSec: result.resendAfterSec,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    };
  });
}

export async function signupAction(input: unknown): Promise<ActionResult<{ next: string }>> {
  return runAction(async () => {
    const ctx = authContextFrom(await headers());
    const user = await signupVendor(input, ctx);
    const tokens = await startVendorSession(user, ctx);
    partnerCookies.setSessionCookies(await cookies(), tokens, ctx.now);
    await logActivity(
      { type: "vendor", id: user.id, vendorId: user.vendorId.toString() },
      {
        action: "signup",
        resource: "vendor",
        resourceId: user.vendorId.toString(),
        summary: "Vendor signed up from the partner portal",
      },
    );
    return { next: "/onboarding" };
  });
}
