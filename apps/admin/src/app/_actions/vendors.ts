"use server";

import { z } from "zod";
import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { AppError } from "@showbuzz/core/http/app-error";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import {
  createVendorByStaff,
  reactivateVendor,
  resetVendorPassword,
  suspendVendor,
  updateVendorTerms,
} from "@showbuzz/core/services/admin/vendor-admin.service";
import {
  type KycEditPhase,
  saveBankAccount,
  saveBusinessDetails,
  saveTaxIds,
  submitOnboarding,
  uploadKycDocument,
} from "@showbuzz/core/services/partner/onboarding.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { objectIdSchema } from "@showbuzz/schemas/common";
import { KYC_DOCUMENT_LABELS } from "@showbuzz/schemas/vendor";
import { actorOf } from "@/lib/actor";

/**
 * Super-admin vendor actions. Every one checks the staff permission first; the vendor id comes from the URL of the
 * vendor screen and is validated. KYC edits reuse the partner onboarding service, so the rules are the same whoever
 * fills the forms. The activity log stores field names only (never KYC or bank values).
 */

const vendorIdSchema = objectIdSchema;
const modeSchema = z.enum(["onboarding", "profile"]).default("onboarding");

export async function createVendorAction(
  input: unknown,
): Promise<ActionResult<{ vendorId: string; email: string; temporaryPassword: string }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:write");
    const created = await createVendorByStaff(input, new Date());
    await logActivity(actorOf(current, created.vendorId), {
      action: "vendor_create",
      resource: "vendor",
      resourceId: created.vendorId,
      summary: created.leadId ? "Created vendor from a list-your-show request" : "Created vendor on its behalf",
      changedFields: ["businessName", "businessType", "contact", "address.cityId", "login"],
    });
    return { vendorId: created.vendorId, email: created.email, temporaryPassword: created.temporaryPassword };
  });
}

export async function updateVendorTermsAction(
  vendorId: unknown,
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:write");
    const id = vendorIdSchema.parse(vendorId);
    const { changedFields } = await updateVendorTerms(id, input);
    await logActivity(actorOf(current, id), {
      action: "vendor_terms_change",
      resource: "vendor",
      resourceId: id,
      summary: "Changed billing, rates or contact sharing",
      changedFields,
    });
    return { saved: true as const };
  });
}

export async function suspendVendorAction(vendorId: unknown, input: unknown): Promise<ActionResult<{ name: string }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:write");
    const id = vendorIdSchema.parse(vendorId);
    const { businessName } = await suspendVendor(id, input, new Date());
    await logActivity(actorOf(current, id), {
      action: "vendor_suspend",
      resource: "vendor",
      resourceId: id,
      summary: `Suspended ${businessName}`,
      changedFields: ["status", "suspendReason"],
    });
    // Its cinemas, events and offers leave showbuzz.com (public reads skip hidden vendors, tagged `vendors`).
    revalidateWeb([CATALOG_TAGS.vendors]);
    return { name: businessName };
  });
}

export async function reactivateVendorAction(vendorId: unknown): Promise<ActionResult<{ name: string }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:write");
    const id = vendorIdSchema.parse(vendorId);
    const { businessName } = await reactivateVendor(id);
    await logActivity(actorOf(current, id), {
      action: "vendor_reactivate",
      resource: "vendor",
      resourceId: id,
      summary: `Reactivated ${businessName}`,
      changedFields: ["status"],
    });
    revalidateWeb([CATALOG_TAGS.vendors]);
    return { name: businessName };
  });
}

export async function resetVendorPasswordAction(
  vendorId: unknown,
): Promise<ActionResult<{ email: string; temporaryPassword: string }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:reset-password");
    const id = vendorIdSchema.parse(vendorId);
    const result = await resetVendorPassword(id, new Date());
    await logActivity(actorOf(current, id), {
      action: "vendor_password_reset",
      resource: "vendor_user",
      resourceId: id,
      summary: "Set a temporary partner password and signed the vendor out everywhere",
      changedFields: ["passwordHash", "sessions"],
    });
    return result;
  });
}

// KYC steps on the vendor's behalf (same service and validation as the partner onboarding).

const stepLog = (phase: KycEditPhase, step: string) => (phase === "profile" ? `profile_${step}` : `onboarding_${step}`);

export async function saveVendorBusinessAction(
  vendorId: unknown,
  input: unknown,
  mode?: unknown,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:write");
    const id = vendorIdSchema.parse(vendorId);
    const phase = modeSchema.parse(mode);
    const { changedFields } = await saveBusinessDetails(id, input, phase);
    await logActivity(actorOf(current, id), {
      action: stepLog(phase, "business"),
      resource: "vendor",
      resourceId: id,
      summary: "Saved business details for the vendor",
      changedFields,
    });
    if (phase === "profile" && changedFields.includes("businessName")) revalidateWeb([CATALOG_TAGS.vendors]);
    return { saved: true as const };
  });
}

export async function saveVendorTaxAction(
  vendorId: unknown,
  input: unknown,
  mode?: unknown,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:write");
    const id = vendorIdSchema.parse(vendorId);
    const phase = modeSchema.parse(mode);
    const { changedFields } = await saveTaxIds(id, input, phase);
    await logActivity(actorOf(current, id), {
      action: stepLog(phase, "tax"),
      resource: "vendor",
      resourceId: id,
      summary: "Saved GSTIN and PAN for the vendor",
      changedFields,
    });
    return { saved: true as const };
  });
}

export async function saveVendorBankAction(
  vendorId: unknown,
  input: unknown,
  mode?: unknown,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:write");
    const id = vendorIdSchema.parse(vendorId);
    const phase = modeSchema.parse(mode);
    const { changedFields } = await saveBankAccount(id, input, phase);
    await logActivity(actorOf(current, id), {
      action: "bank_account_change",
      resource: "vendor",
      resourceId: id,
      summary: "Saved the vendor's payout bank account",
      changedFields,
    });
    return { saved: true as const };
  });
}

/** FormData: `vendorId`, `kind`, `file`, optional `mode`. */
export async function uploadVendorDocumentAction(formData: FormData): Promise<ActionResult<{ filename: string }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:write");
    const id = vendorIdSchema.parse(formData.get("vendorId"));
    const phase = modeSchema.parse(formData.get("mode") ?? undefined);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("VALIDATION_FAILED", "Choose a file to upload.", 422, {
        fieldErrors: { file: ["Choose a file to upload."] },
      });
    }
    const { kind, filename } = await uploadKycDocument(
      id,
      { kind: formData.get("kind"), file: { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } },
      phase,
    );
    await logActivity(actorOf(current, id), {
      action: "kyc_document_upload",
      resource: "vendor",
      resourceId: id,
      summary: `Uploaded ${KYC_DOCUMENT_LABELS[kind]} for the vendor`,
      changedFields: [`kyc.documents.${kind}`],
    });
    return { filename };
  });
}

export async function submitVendorOnboardingAction(vendorId: unknown): Promise<ActionResult<{ next: string }>> {
  return runAction(async () => {
    const current = await requirePermission("organisers:write");
    const id = vendorIdSchema.parse(vendorId);
    await submitOnboarding(id);
    await logActivity(actorOf(current, id), {
      action: "onboarding_submit",
      resource: "vendor",
      resourceId: id,
      summary: "Completed the vendor's onboarding; listings can go live",
      changedFields: ["onboardingStatus"],
    });
    revalidateWeb([CATALOG_TAGS.vendors]);
    return { next: `/vendors/${id}` };
  });
}
