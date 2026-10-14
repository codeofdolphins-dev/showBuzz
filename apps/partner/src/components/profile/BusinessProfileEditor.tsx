"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Landmark, Receipt } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { Card } from "@showbuzz/console-ui/PageParts";
import type { OnboardingDocumentKind } from "@showbuzz/schemas/partner";
import type { VendorKycView, VendorSummary } from "@showbuzz/schemas/types/vendor";
import { BankStep, BusinessStep, TaxStep } from "@showbuzz/console-ui/vendor-kyc/DetailSteps";
import { DocumentsStep } from "@showbuzz/console-ui/vendor-kyc/DocumentsStep";
import { PartnerKycActions } from "@/components/onboarding/PartnerKycActions";

type Section = "business" | "tax" | "bank" | "documents";

const SECTIONS: { id: Section; label: string; icon: typeof Building2 }[] = [
  { id: "business", label: "Business details", icon: Building2 },
  { id: "tax", label: "GSTIN & PAN", icon: Receipt },
  { id: "bank", label: "Bank account", icon: Landmark },
  { id: "documents", label: "Documents", icon: FileText },
];

interface BusinessProfileEditorProps {
  vendor: VendorSummary;
  kyc: VendorKycView;
  cities: { value: string; label: string }[];
  missingDocuments: OnboardingDocumentKind[];
}

/** Business Profile: the onboarding forms again, in profile mode (same validation; bank changes are logged). */
export function BusinessProfileEditor({ vendor, kyc, cities, missingDocuments }: BusinessProfileEditorProps) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("business");
  const saved = () => router.refresh();

  return (
    <PartnerKycActions>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Profile sections" className="flex gap-2 overflow-x-auto lg:flex-col">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors",
                section === id ? "bg-admin-active text-admin-indigo" : "text-admin-muted hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </nav>
        <Card className="p-6">
          {section === "business" ? (
            <BusinessStep vendor={vendor} cities={cities} onSaved={saved} mode="profile" />
          ) : null}
          {section === "tax" ? <TaxStep kyc={kyc} onSaved={saved} mode="profile" /> : null}
          {section === "bank" ? (
            <>
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                Payouts go to this account. Changes are recorded in the activity log and ShowBuzz may verify them before
                the next payout.
              </p>
              <BankStep kyc={kyc} onSaved={saved} mode="profile" />
            </>
          ) : null}
          {section === "documents" ? (
            <DocumentsStep documents={kyc.documents} missing={missingDocuments} mode="profile" />
          ) : null}
        </Card>
      </div>
    </PartnerKycActions>
  );
}
