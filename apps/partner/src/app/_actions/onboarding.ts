"use server";

import { requireVendor } from "@showbuzz/core/auth/partner/current-vendor";
import type { CurrentVendor } from "@showbuzz/core/auth/partner/vendor-auth.service";
import { AppError } from "@showbuzz/core/http/app-error";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import {
  saveBankAccount,
  saveBusinessDetails,
  saveTaxIds,
  submitOnboarding,
  uploadKycDocument,
} from "@showbuzz/core/services/partner/onboarding.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import { KYC_DOCUMENT_LABELS } from "@showbuzz/schemas/vendor";

/**
 * Onboarding steps. The vendor is always the signed-in one (from the session); every save is recorded in the
 * activity log with the names of the changed fields only (never KYC or bank values).
 */

const actorOf = ({ vendorUser, vendor }: CurrentVendor) => ({
  type: "vendor" as const,
  id: vendorUser.id,
  vendorId: vendor.id,
});

export async function saveBusinessDetailsAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requireVendor();
    const { changedFields } = await saveBusinessDetails(current.vendor.id, input);
    await logActivity(actorOf(current), {
      action: "onboarding_business",
      resource: "vendor",
      resourceId: current.vendor.id,
      summary: "Saved business details",
      changedFields,
    });
    return { saved: true as const };
  });
}

export async function saveTaxIdsAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requireVendor();
    const { changedFields } = await saveTaxIds(current.vendor.id, input);
    await logActivity(actorOf(current), {
      action: "onboarding_tax",
      resource: "vendor",
      resourceId: current.vendor.id,
      summary: "Saved GSTIN and PAN",
      changedFields,
    });
    return { saved: true as const };
  });
}

export async function saveBankAccountAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requireVendor();
    const { changedFields } = await saveBankAccount(current.vendor.id, input);
    await logActivity(actorOf(current), {
      action: "bank_account_change",
      resource: "vendor",
      resourceId: current.vendor.id,
      summary: "Saved payout bank account",
      changedFields,
    });
    return { saved: true as const };
  });
}

/** FormData: `kind` (document kind) and `file`. */
export async function uploadKycDocumentAction(formData: FormData): Promise<ActionResult<{ filename: string }>> {
  return runAction(async () => {
    const current = await requireVendor();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("VALIDATION_FAILED", "Choose a file to upload.", 422, {
        fieldErrors: { file: ["Choose a file to upload."] },
      });
    }
    const { kind, filename } = await uploadKycDocument(current.vendor.id, {
      kind: formData.get("kind"),
      file: { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
    });
    await logActivity(actorOf(current), {
      action: "kyc_document_upload",
      resource: "vendor",
      resourceId: current.vendor.id,
      summary: `Uploaded ${KYC_DOCUMENT_LABELS[kind]}`,
      changedFields: [`kyc.documents.${kind}`],
    });
    return { filename };
  });
}

export async function submitOnboardingAction(): Promise<ActionResult<{ next: string }>> {
  return runAction(async () => {
    const current = await requireVendor();
    await submitOnboarding(current.vendor.id);
    await logActivity(actorOf(current), {
      action: "onboarding_submit",
      resource: "vendor",
      resourceId: current.vendor.id,
      summary: "Completed onboarding; listings can go live",
      changedFields: ["onboardingStatus"],
    });
    // The vendor's name and policy appear on public pages ("by …", "Organised by …").
    revalidateWeb([CATALOG_TAGS.vendors]);
    return { next: "/dashboard" };
  });
}
