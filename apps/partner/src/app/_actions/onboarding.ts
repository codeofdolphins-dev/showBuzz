"use server";

import { z } from "zod";
import { requireVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { AppError } from "@showbuzz/core/http/app-error";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import {
  type KycEditPhase,
  saveBankAccount,
  saveBusinessDetails,
  saveTaxIds,
  submitOnboarding,
  uploadKycDocument,
} from "@showbuzz/core/services/partner/onboarding.service";
import { revalidateWeb } from "@showbuzz/core/services/web-revalidate.service";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog-tags";
import { KYC_DOCUMENT_LABELS } from "@showbuzz/schemas/vendor";
import { actorOf } from "@/lib/actor";

/**
 * Onboarding steps, and the same edits from Business Profile once onboarding is complete (`mode: "profile"`).
 * The vendor is always the signed-in one (from the session); every save is recorded in the activity log with the
 * names of the changed fields only (never KYC or bank values). Bank changes are always logged as
 * `bank_account_change`.
 */

const modeSchema = z.enum(["onboarding", "profile"]).default("onboarding");

const logName = (phase: KycEditPhase, step: string) => (phase === "profile" ? `profile_${step}` : `onboarding_${step}`);

export async function saveBusinessDetailsAction(
  input: unknown,
  mode?: unknown,
): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requireVendor();
    const phase = modeSchema.parse(mode);
    const { changedFields } = await saveBusinessDetails(current.vendor.id, input, phase);
    await logActivity(actorOf(current), {
      action: logName(phase, "business"),
      resource: "vendor",
      resourceId: current.vendor.id,
      summary: "Saved business details",
      changedFields,
    });
    // The business name appears on public pages ("by …", "Organised by …").
    if (phase === "profile" && changedFields.includes("businessName")) revalidateWeb([CATALOG_TAGS.vendors]);
    return { saved: true as const };
  });
}

export async function saveTaxIdsAction(input: unknown, mode?: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requireVendor();
    const phase = modeSchema.parse(mode);
    const { changedFields } = await saveTaxIds(current.vendor.id, input, phase);
    await logActivity(actorOf(current), {
      action: logName(phase, "tax"),
      resource: "vendor",
      resourceId: current.vendor.id,
      summary: "Saved GSTIN and PAN",
      changedFields,
    });
    return { saved: true as const };
  });
}

export async function saveBankAccountAction(input: unknown, mode?: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requireVendor();
    const phase = modeSchema.parse(mode);
    const { changedFields } = await saveBankAccount(current.vendor.id, input, phase);
    await logActivity(actorOf(current), {
      action: "bank_account_change",
      resource: "vendor",
      resourceId: current.vendor.id,
      summary: phase === "profile" ? "Changed payout bank account" : "Saved payout bank account",
      changedFields,
    });
    return { saved: true as const };
  });
}

/** FormData: `kind` (document kind), `file`, and optional `mode` ("profile" from Business Profile). */
export async function uploadKycDocumentAction(formData: FormData): Promise<ActionResult<{ filename: string }>> {
  return runAction(async () => {
    const current = await requireVendor();
    const phase = modeSchema.parse(formData.get("mode") ?? undefined);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("VALIDATION_FAILED", "Choose a file to upload.", 422, {
        fieldErrors: { file: ["Choose a file to upload."] },
      });
    }
    const { kind, filename } = await uploadKycDocument(
      current.vendor.id,
      { kind: formData.get("kind"), file: { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } },
      phase,
    );
    await logActivity(actorOf(current), {
      action: "kyc_document_upload",
      resource: "vendor",
      resourceId: current.vendor.id,
      summary: `${phase === "profile" ? "Replaced" : "Uploaded"} ${KYC_DOCUMENT_LABELS[kind]}`,
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
