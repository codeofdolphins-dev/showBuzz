import "server-only";
import {
  onboardingBankSchema,
  onboardingBusinessSchema,
  onboardingDocumentKindSchema,
  onboardingTaxSchema,
  type OnboardingDocumentKind,
} from "@showbuzz/schemas/partner";
import { REQUIRED_KYC_DOCUMENTS, vendorAddressSchema, vendorContactSchema } from "@showbuzz/schemas/vendor";
import type { OnboardingState, OnboardingStep, OnboardingStepId } from "@showbuzz/schemas/types/vendor";
import { connect } from "@showbuzz/db/connect";
import { ACTIVE_CITY_FILTER, City } from "@showbuzz/db/models/City";
import {
  Vendor,
  type StoredKycDocument,
  type VendorAttrs,
  toVendorKyc,
  toVendorSummary,
} from "@showbuzz/db/models/Vendor";
import { Types } from "@showbuzz/db/mongoose";
import { FileRejectedError, getFileStorage } from "@showbuzz/db/storage/file-storage";
import type { LeanDoc } from "@showbuzz/db/models/transforms";
import { log } from "@showbuzz/runtime/log";
import { AppError } from "../../http/app-error";

/**
 * Mandatory KYC onboarding for a vendor (partner signup, or a vendor the super-admin created). Every function takes
 * the vendor id from the caller's session, never from the request. Steps can be saved in any order and revisited
 * until the vendor submits; progress is derived from the saved data. Submitting completes onboarding at once
 * (no approval step, agreed 2026-10-13).
 *
 * After onboarding, Business Profile edits the same details through the same functions with `phase: "profile"`
 * (same validation, only allowed once onboarding is complete).
 */

/** Which screen is editing: the onboarding wizard (incomplete vendors) or Business Profile (complete vendors). */
export type KycEditPhase = "onboarding" | "profile";

const STATUS_FOR: Record<KycEditPhase, VendorAttrs["onboardingStatus"]> = {
  onboarding: "incomplete",
  profile: "complete",
};

export type { OnboardingState, OnboardingStep, OnboardingStepId };

export interface CityOption {
  value: string;
  label: string;
}

const NOT_EDITABLE = "Onboarding is already complete. Edit your details from Business Profile.";
const NOT_ONBOARDED = "Finish onboarding first.";

/**
 * Cities for the signup, business-details and venue forms: the active cities (the public city list), plus `keep`
 * (a record's current city, even if it was switched off later).
 */
export async function listCityOptions(keep?: string): Promise<CityOption[]> {
  await connect();
  const cities = await City.find(
    keep ? { $or: [ACTIVE_CITY_FILTER, { slug: keep }] } : ACTIVE_CITY_FILTER,
    { slug: 1, name: 1, state: 1 },
  )
    .sort({ name: 1 })
    .lean();
  return cities.map((c) => ({ value: c.slug, label: c.state ? `${c.name}, ${c.state}` : c.name }));
}

export async function getOnboardingState(vendorId: string): Promise<OnboardingState> {
  const vendor = await loadVendor(vendorId);
  const done = stepCompletion(vendor);
  const steps: OnboardingStep[] = [
    { id: "business", label: "Business details", done: done.business },
    { id: "tax", label: "GSTIN & PAN", done: done.tax },
    { id: "bank", label: "Bank account", done: done.bank },
    { id: "documents", label: "Documents", done: done.documents },
    { id: "review", label: "Review & submit", done: vendor.onboardingStatus === "complete" },
  ];
  return {
    vendor: toVendorSummary(vendor),
    kyc: toVendorKyc(vendor),
    steps,
    nextStep: steps.find((s) => !s.done)?.id ?? "review",
    missingDocuments: missingDocuments(vendor),
  };
}

export async function saveBusinessDetails(
  vendorId: string,
  input: unknown,
  phase: KycEditPhase = "onboarding",
): Promise<{ changedFields: string[] }> {
  const data = onboardingBusinessSchema.parse(input);
  const vendor = await loadEditableVendor(vendorId, phase);
  if (!(await City.exists({ slug: data.address.cityId }))) {
    throw new AppError("VALIDATION_FAILED", "Choose a city from the list.", 422, {
      fieldErrors: { "address.cityId": ["Choose a city from the list."] },
    });
  }
  await Vendor.updateOne(
    { _id: vendor._id, onboardingStatus: STATUS_FOR[phase] },
    {
      $set: {
        businessName: data.businessName,
        businessType: data.businessType,
        contact: data.contact,
        address: data.address,
      },
    },
  );
  return {
    changedFields: changed({
      businessName: [vendor.businessName, data.businessName],
      businessType: [vendor.businessType, data.businessType],
      contact: [vendor.contact, data.contact],
      address: [vendor.address, data.address],
    }),
  };
}

export async function saveTaxIds(
  vendorId: string,
  input: unknown,
  phase: KycEditPhase = "onboarding",
): Promise<{ changedFields: string[] }> {
  const { gstin, pan } = onboardingTaxSchema.parse(input);
  const vendor = await loadEditableVendor(vendorId, phase);
  await Vendor.updateOne(
    { _id: vendor._id, onboardingStatus: STATUS_FOR[phase] },
    { $set: { "kyc.gstin": gstin, "kyc.pan": pan } },
  );
  return { changedFields: changed({ "kyc.gstin": [vendor.kyc.gstin, gstin], "kyc.pan": [vendor.kyc.pan, pan] }) };
}

export async function saveBankAccount(
  vendorId: string,
  input: unknown,
  phase: KycEditPhase = "onboarding",
): Promise<{ changedFields: string[] }> {
  const { holderName, accountNumber, ifsc } = onboardingBankSchema.parse(input);
  const vendor = await loadEditableVendor(vendorId, phase);
  const bankAccount = { holderName, accountNumber, ifsc };
  await Vendor.updateOne(
    { _id: vendor._id, onboardingStatus: STATUS_FOR[phase] },
    { $set: { "kyc.bankAccount": bankAccount } },
  );
  const before = vendor.kyc.bankAccount;
  return {
    changedFields: changed({
      "kyc.bankAccount.holderName": [before?.holderName, holderName],
      "kyc.bankAccount.accountNumber": [before?.accountNumber, accountNumber],
      "kyc.bankAccount.ifsc": [before?.ifsc, ifsc],
    }),
  };
}

/**
 * Stores one KYC document (PDF/JPEG/PNG up to 4 MB, checked by its first bytes) and replaces any earlier document
 * of the same kind, whose file is then deleted.
 */
export async function uploadKycDocument(
  vendorId: string,
  input: { kind: unknown; file: { name: string; bytes: Uint8Array } },
  phase: KycEditPhase = "onboarding",
): Promise<{ kind: OnboardingDocumentKind; filename: string }> {
  const kind = onboardingDocumentKindSchema.parse(input.kind);
  const vendor = await loadEditableVendor(vendorId, phase);

  const storage = getFileStorage();
  let stored;
  try {
    stored = await storage.put({
      filename: input.file.name,
      data: input.file.bytes,
      owner: { ownerType: "vendor", ownerId: vendorId },
    });
  } catch (err) {
    if (err instanceof FileRejectedError) {
      throw new AppError("VALIDATION_FAILED", err.message, 422, { fieldErrors: { file: [err.message] } });
    }
    throw err;
  }

  const document: StoredKycDocument = {
    fileId: new Types.ObjectId(stored.fileId),
    kind,
    filename: stored.filename,
    contentType: stored.contentType,
    size: stored.size,
    uploadedAt: stored.uploadedAt,
  };
  const previous = vendor.kyc.documents.filter((d) => d.kind === kind);
  const result = await Vendor.updateOne(
    { _id: vendor._id, onboardingStatus: STATUS_FOR[phase] },
    [
      {
        $set: {
          "kyc.documents": {
            $concatArrays: [
              { $filter: { input: { $ifNull: ["$kyc.documents", []] }, cond: { $ne: ["$$this.kind", kind] } } },
              { $literal: [document] },
            ],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
  if (result.matchedCount !== 1) {
    await storage.delete(stored.fileId);
    throw new AppError("CONFLICT", phase === "onboarding" ? NOT_EDITABLE : NOT_ONBOARDED, 409);
  }
  for (const old of previous) {
    await storage
      .delete(old.fileId.toString())
      .catch((err: unknown) =>
        log.warn("Old KYC file not deleted", { event: "kyc.file_delete_failed", error: String(err) }),
      );
  }
  return { kind, filename: stored.filename };
}

/**
 * Completes onboarding after re-checking every step against the schemas (data saved by an older form or by the
 * super-admin must still be valid). Listings go live without approval.
 */
export async function submitOnboarding(vendorId: string): Promise<void> {
  const vendor = await loadEditableVendor(vendorId);
  const done = stepCompletion(vendor);
  const firstMissing = (["business", "tax", "bank", "documents"] as const).find((step) => !done[step]);
  if (firstMissing) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Some onboarding steps are incomplete. Finish them before submitting.",
      422,
      {
        step: firstMissing,
      },
    );
  }
  const result = await Vendor.updateOne(
    { _id: vendor._id, onboardingStatus: "incomplete" },
    { $set: { onboardingStatus: "complete" } },
  );
  if (result.modifiedCount !== 1) throw new AppError("CONFLICT", NOT_EDITABLE, 409);
  log.info("Vendor onboarding complete", { event: "vendor.onboarding_complete", vendorId });
}

/**
 * A KYC file of this vendor, for its own document viewer. A file of another vendor (or one no longer listed on
 * this vendor's KYC) answers 404 exactly like a missing one.
 */
export async function getOwnKycFile(vendorId: string, fileId: string) {
  const vendor = await loadVendor(vendorId);
  const listed = vendor.kyc.documents.some((d) => d.fileId.toString() === fileId);
  const file = listed ? await getFileStorage().get(fileId) : undefined;
  if (!file || file.info.owner.ownerType !== "vendor" || file.info.owner.ownerId !== vendorId) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }
  return file;
}

type LeanVendor = LeanDoc<VendorAttrs>;

async function loadVendor(vendorId: string): Promise<LeanVendor> {
  if (!Types.ObjectId.isValid(vendorId)) throw new AppError("NOT_FOUND", "Vendor not found.", 404);
  await connect();
  const vendor = await Vendor.findById(vendorId).lean();
  if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found.", 404);
  return vendor;
}

async function loadEditableVendor(vendorId: string, phase: KycEditPhase = "onboarding"): Promise<LeanVendor> {
  const vendor = await loadVendor(vendorId);
  if (vendor.onboardingStatus !== STATUS_FOR[phase]) {
    throw new AppError("CONFLICT", phase === "onboarding" ? NOT_EDITABLE : NOT_ONBOARDED, 409);
  }
  return vendor;
}

function stepCompletion(vendor: LeanVendor): Record<"business" | "tax" | "bank" | "documents", boolean> {
  return {
    business:
      vendorContactSchema.safeParse(vendor.contact).success && vendorAddressSchema.safeParse(vendor.address).success,
    tax: onboardingTaxSchema.safeParse({ gstin: vendor.kyc.gstin, pan: vendor.kyc.pan }).success,
    bank: onboardingBankSchema.safeParse({
      ...vendor.kyc.bankAccount,
      confirmAccountNumber: vendor.kyc.bankAccount?.accountNumber,
    }).success,
    documents: missingDocuments(vendor).length === 0,
  };
}

function missingDocuments(vendor: LeanVendor): OnboardingDocumentKind[] {
  const kinds = new Set(vendor.kyc.documents.map((d) => d.kind));
  return REQUIRED_KYC_DOCUMENTS.filter((kind) => !kinds.has(kind));
}

/** Names of the fields whose value changed (values never leave this function: the activity log stores names only). */
function changed(fields: Record<string, [unknown, unknown]>): string[] {
  return Object.entries(fields)
    .filter(([, [before, after]]) => JSON.stringify(before ?? null) !== JSON.stringify(after ?? null))
    .map(([name]) => name);
}
