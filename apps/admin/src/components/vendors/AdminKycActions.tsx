"use client";

import { useMemo, type ReactNode } from "react";
import { type KycActions, KycActionsProvider } from "@showbuzz/console-ui/vendor-kyc/KycActions";
import {
  saveVendorBankAction,
  saveVendorBusinessAction,
  saveVendorTaxAction,
  submitVendorOnboardingAction,
  uploadVendorDocumentAction,
} from "@/app/_actions/vendors";

/** The shared KYC forms acting on one vendor (from the URL; every action re-checks the staff permission). */
export function AdminKycActions({ vendorId, children }: { vendorId: string; children: ReactNode }) {
  const actions = useMemo<KycActions>(
    () => ({
      audience: "staff",
      saveBusiness: (input, mode) => saveVendorBusinessAction(vendorId, input, mode),
      saveTax: (input, mode) => saveVendorTaxAction(vendorId, input, mode),
      saveBank: (input, mode) => saveVendorBankAction(vendorId, input, mode),
      uploadDocument: (data) => {
        data.set("vendorId", vendorId);
        return uploadVendorDocumentAction(data);
      },
      submit: () => submitVendorOnboardingAction(vendorId),
      documentHref: (fileId) => `/api/v1/admin/vendors/${vendorId}/documents/${fileId}`,
    }),
    [vendorId],
  );
  return <KycActionsProvider actions={actions}>{children}</KycActionsProvider>;
}
