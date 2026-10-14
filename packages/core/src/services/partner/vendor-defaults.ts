import "server-only";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { Types } from "@showbuzz/db/mongoose";
import type { Settings } from "@showbuzz/schemas/settings";

/**
 * What every new vendor starts with, shared by the partner signup and the super-admin's "Create vendor" (kept apart
 * from the signup service so the admin app doesn't load the OTP code).
 */

/**
 * Status and money terms every new vendor starts with (signup and super-admin creation): onboarding incomplete,
 * commission billing at the platform's default rates and cancellation policy from Settings.
 */
export function newVendorTerms(settings: Settings) {
  return {
    onboardingStatus: "incomplete" as const,
    status: "active" as const,
    billingModel: "commission" as const,
    commissionBps: settings.defaultCommissionBps,
    convenienceFeeBps: settings.convenienceFeeBps,
    gstBps: settings.gstBps,
    cancellation: {
      allowed: true,
      cutoffMinutes: settings.cancellationCutoffMinutes,
      feePaise: settings.cancellationFeePaise,
    },
    shareCustomerContact: false,
  };
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
