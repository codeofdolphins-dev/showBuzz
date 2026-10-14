"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ActionFailure } from "../action-errors";

/**
 * The KYC forms (onboarding wizard, Business Profile, the super-admin's vendor screen) are the same components in
 * both consoles; each app plugs in its own Server Actions here. The partner app's actions act on the signed-in vendor
 * (from the session); the admin app's are bound to the vendor in the URL and check the staff permission.
 */

export type ActionOutcome<T> = { success: true; data: T } | { success: false; error: ActionFailure };

/** "onboarding" = the wizard of a vendor not yet onboarded; "profile" = edits after onboarding is complete. */
export type StepMode = "onboarding" | "profile";

export interface KycActions {
  /** Who is filling the forms: changes the wording ("your business" vs "this vendor"). */
  audience: "vendor" | "staff";
  saveBusiness: (input: unknown, mode: StepMode) => Promise<ActionOutcome<unknown>>;
  saveTax: (input: unknown, mode: StepMode) => Promise<ActionOutcome<unknown>>;
  saveBank: (input: unknown, mode: StepMode) => Promise<ActionOutcome<unknown>>;
  /** FormData: `kind`, `file`, `mode`. */
  uploadDocument: (data: FormData) => Promise<ActionOutcome<{ filename: string }>>;
  /** Completes onboarding; `next` is where to go afterwards. */
  submit: () => Promise<ActionOutcome<{ next: string }>>;
  /** URL of the authenticated document viewer for a KYC file. */
  documentHref: (fileId: string) => string;
}

const KycActionsContext = createContext<KycActions | null>(null);

export function KycActionsProvider({ actions, children }: { actions: KycActions; children: ReactNode }) {
  return <KycActionsContext value={actions}>{children}</KycActionsContext>;
}

export function useKycActions(): KycActions {
  const actions = useContext(KycActionsContext);
  if (!actions) throw new Error("KYC forms need a <KycActionsProvider>");
  return actions;
}
