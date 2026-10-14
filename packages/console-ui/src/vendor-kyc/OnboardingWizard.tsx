"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { OnboardingState, OnboardingStepId } from "@showbuzz/schemas/types/vendor";
import { cn } from "@showbuzz/utils/cn";
import { Card } from "../PageParts";
import { BankStep, BusinessStep, TaxStep } from "./DetailSteps";
import { DocumentsStep } from "./DocumentsStep";
import { ReviewStep } from "./ReviewStep";

interface OnboardingWizardProps {
  state: OnboardingState;
  cities: { value: string; label: string }[];
}

const ORDER: OnboardingStepId[] = ["business", "tax", "bank", "documents", "review"];

/**
 * Stepper over the onboarding forms. Each step saves on the server, then the page data is refreshed (progress is
 * derived from what was saved) and the next step opens. Any step can be revisited until the vendor submits.
 */
export function OnboardingWizard({ state, cities }: OnboardingWizardProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<OnboardingStepId>(state.nextStep);
  const index = ORDER.indexOf(current);

  const advance = () => {
    router.refresh();
    const next = ORDER[index + 1];
    if (next) setCurrent(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <nav aria-label="Onboarding steps" className="lg:col-span-1">
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {state.steps.map((step, i) => {
            const active = step.id === current;
            return (
              <li key={step.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrent(step.id)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors",
                    active
                      ? "border-admin-indigo bg-admin-active text-admin-indigo"
                      : "border-admin-border bg-white text-admin-text hover:border-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                      step.done
                        ? "bg-admin-success text-white"
                        : active
                          ? "bg-admin-indigo text-white"
                          : "bg-slate-100 text-admin-muted",
                    )}
                  >
                    {step.done ? <Check className="h-3.5 w-3.5" aria-label="Done" /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="p-5 sm:p-6 lg:col-span-3">
        {current === "business" ? <BusinessStep vendor={state.vendor} cities={cities} onSaved={advance} /> : null}
        {current === "tax" ? <TaxStep kyc={state.kyc} onSaved={advance} /> : null}
        {current === "bank" ? <BankStep kyc={state.kyc} onSaved={advance} /> : null}
        {current === "documents" ? (
          <DocumentsStep
            documents={state.kyc.documents}
            missing={state.missingDocuments}
            onContinue={() => {
              setCurrent("review");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        ) : null}
        {current === "review" ? <ReviewStep state={state} cities={cities} onEdit={setCurrent} /> : null}
      </Card>
    </div>
  );
}
