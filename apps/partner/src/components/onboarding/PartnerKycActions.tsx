"use client";

import type { ReactNode } from "react";
import { type KycActions, KycActionsProvider } from "@showbuzz/console-ui/vendor-kyc/KycActions";
import {
  saveBankAccountAction,
  saveBusinessDetailsAction,
  saveTaxIdsAction,
  submitOnboardingAction,
  uploadKycDocumentAction,
} from "@/app/_actions/onboarding";

/** The shared KYC forms acting on the signed-in vendor (the actions take the vendor from the session). */
const PARTNER_KYC_ACTIONS: KycActions = {
  audience: "vendor",
  saveBusiness: saveBusinessDetailsAction,
  saveTax: saveTaxIdsAction,
  saveBank: saveBankAccountAction,
  uploadDocument: uploadKycDocumentAction,
  submit: submitOnboardingAction,
  documentHref: (fileId) => `/api/v1/partner/documents/${fileId}`,
};

export function PartnerKycActions({ children }: { children: ReactNode }) {
  return <KycActionsProvider actions={PARTNER_KYC_ACTIONS}>{children}</KycActionsProvider>;
}
