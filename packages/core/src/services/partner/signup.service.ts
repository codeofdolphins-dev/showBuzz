import "server-only";
import { PARTNER_AUTH } from "@showbuzz/schemas/constants";
import { vendorSignupCodeSchema, vendorSignupVerifySchema } from "@showbuzz/schemas/partner";
import { connect } from "@showbuzz/db/connect";
import { City } from "@showbuzz/db/models/City";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { VendorUser, type VendorUserDocument } from "@showbuzz/db/models/VendorUser";
import { Types } from "@showbuzz/db/mongoose";
import { log } from "@showbuzz/runtime/log";
import type { AuthRequestContext } from "../../auth/context";
import { consumeChallenge, issueChallenge, type OtpRequestResult } from "../../auth/otp";
import { hashPassword } from "../../auth/password";
import { AppError } from "../../http/app-error";
import { consumeRateLimit } from "../../security/rate-limit";
import { getSettings } from "../settings.service";

/**
 * Self-service vendor signup (partner.showbuzz.com/signup). The mobile number is proven with a one-time code (the
 * OTP service; no SMS provider yet, so the code is logged as for customer sign-in). Email is not verified until an
 * email provider exists. The new vendor starts with onboarding incomplete, commission billing and the platform's
 * default rates from Settings; KYC is collected by the onboarding steps.
 */

const SIGNUP_UNAVAILABLE =
  "We couldn't create a partner account with these details. If you already have one, sign in instead.";

/** Step 1: send a code to the mobile number (same limits as customer sign-in codes). */
export async function sendSignupCode(input: unknown, ctx: AuthRequestContext): Promise<OtpRequestResult> {
  const { phone } = vendorSignupCodeSchema.parse(input);
  return issueChallenge({ contact: { channel: "sms", phone }, purpose: "vendor_signup" }, ctx);
}

/**
 * Step 2: checks the code, then creates the vendor and its owner login in one transaction. Returns the new login so
 * the caller can start a session.
 */
export async function signupVendor(input: unknown, ctx: AuthRequestContext): Promise<VendorUserDocument> {
  const { form, challengeId, code } = vendorSignupVerifySchema.parse(input);

  const limit = await consumeRateLimit(`vendor-signup:ip:${ctx.ip}`, {
    limit: PARTNER_AUTH.signupMaxPerIpPerHour,
    windowSec: 60 * 60,
    now: ctx.now,
  });
  if (!limit.allowed) {
    throw new AppError("RATE_LIMITED", "Too many signups from this network. Please try again later.", 429, {
      retryAfterSec: limit.retryAfterSec,
    });
  }

  const challenge = await consumeChallenge({ challengeId, code, purpose: "vendor_signup" }, ctx);
  if (challenge.contact.channel !== "sms" || challenge.contact.phone !== form.phone) {
    throw new AppError("OTP_EXPIRED", "This code was sent to a different number. Request a new code.", 401);
  }

  const mongoose = await connect();
  if (!(await City.exists({ slug: form.cityId }))) {
    throw new AppError("VALIDATION_FAILED", "Choose a city from the list.", 422, {
      fieldErrors: { cityId: ["Choose a city from the list."] },
    });
  }
  if (await VendorUser.exists({ email: form.email })) throw new AppError("CONFLICT", SIGNUP_UNAVAILABLE, 409);

  const settings = await getSettings();
  const passwordHash = await hashPassword(form.password);
  const vendorId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const slug = await availableSlug(form.businessName);

  try {
    await mongoose.connection.transaction(async (session) => {
      await Vendor.create(
        [
          {
            _id: vendorId,
            businessName: form.businessName,
            slug,
            businessType: form.businessType,
            contact: { name: form.contactName, email: form.email, phone: form.phone },
            address: { line: "", cityId: form.cityId, pincode: "" },
            kyc: { documents: [] },
            onboardingStatus: "incomplete",
            status: "active",
            billingModel: "commission",
            commissionBps: settings.defaultCommissionBps,
            convenienceFeeBps: settings.convenienceFeeBps,
            gstBps: settings.gstBps,
            cancellation: {
              allowed: true,
              cutoffMinutes: settings.cancellationCutoffMinutes,
              feePaise: settings.cancellationFeePaise,
            },
            shareCustomerContact: false,
          },
        ],
        { session },
      );
      await VendorUser.create(
        [
          {
            _id: userId,
            vendorId,
            name: form.contactName,
            email: form.email,
            passwordHash,
            passwordChangedAt: ctx.now,
            role: "owner",
            status: "active",
          },
        ],
        { session },
      );
    });
  } catch (err) {
    // A concurrent signup took the email (or, rarely, the slug) between the checks and the insert.
    if (err instanceof Error && "code" in err && err.code === 11000)
      throw new AppError("CONFLICT", SIGNUP_UNAVAILABLE, 409);
    throw err;
  }

  log.info("Vendor signed up", { event: "vendor.signup", vendorId: vendorId.toString() });
  const user = await VendorUser.findById(userId);
  if (!user) throw new Error("Vendor user missing after signup");
  return user;
}

/** "Acme Events Pvt Ltd" → "acme-events-pvt-ltd", with -2, -3... when taken. */
export async function availableSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "vendor";
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await Vendor.exists({ slug }))) return slug;
  }
  return `${base}-${new Types.ObjectId().toString().slice(-6)}`;
}
