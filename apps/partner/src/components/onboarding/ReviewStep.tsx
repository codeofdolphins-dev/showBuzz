"use client";

import { useState, useTransition, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Pencil, Rocket } from "lucide-react";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import type { OnboardingState, OnboardingStepId } from "@showbuzz/core/services/partner/onboarding.service";
import { KYC_DOCUMENT_LABELS, VENDOR_BUSINESS_TYPE_LABELS, maskAccountNumber } from "@showbuzz/schemas/vendor";
import { submitOnboardingAction } from "@/app/_actions/onboarding";

/** Everything entered so far, with "Edit" per section, then the final submit (listings go live, no approval). */
export function ReviewStep({
  state,
  cities,
  onEdit,
}: {
  state: OnboardingState;
  cities: { value: string; label: string }[];
  onEdit: (step: OnboardingStepId) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const { vendor, kyc, steps } = state;
  const done = (id: OnboardingStepId) => steps.find((s) => s.id === id)?.done ?? false;
  const ready = (["business", "tax", "bank", "documents"] as const).every(done);
  const city = cities.find((c) => c.value === vendor.address.cityId)?.label ?? vendor.address.cityId;

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await submitOnboardingAction();
      if (result.success) {
        window.location.assign(result.data.next);
        return;
      }
      setMessage(result.error.message);
    });
  }

  return (
    <div className="space-y-5">
      <div className="border-b border-admin-border pb-4">
        <h2 className="text-base font-bold text-admin-dark">Review & submit</h2>
        <p className="text-xs text-admin-muted">
          Check your details. Once you submit, your partner account is active and you can start adding venues and shows.
        </p>
      </div>
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}

      <Section title="Business details" done={done("business")} onEdit={() => onEdit("business")}>
        <Row label="Business name" value={vendor.businessName} />
        <Row label="Type" value={VENDOR_BUSINESS_TYPE_LABELS[vendor.businessType]} />
        <Row label="Contact" value={`${vendor.contact.name} · ${vendor.contact.phone} · ${vendor.contact.email}`} />
        <Row label="Address" value={[vendor.address.line, city, vendor.address.pincode].filter(Boolean).join(", ")} />
      </Section>
      <Section title="GSTIN & PAN" done={done("tax")} onEdit={() => onEdit("tax")}>
        <Row label="GSTIN" value={kyc.gstin} mono />
        <Row label="PAN" value={kyc.pan} mono />
      </Section>
      <Section title="Bank account" done={done("bank")} onEdit={() => onEdit("bank")}>
        <Row label="Holder" value={kyc.bankAccount.holderName} />
        <Row
          label="Account"
          value={kyc.bankAccount.accountNumber ? maskAccountNumber(kyc.bankAccount.accountNumber) : ""}
          mono
        />
        <Row label="IFSC" value={kyc.bankAccount.ifsc} mono />
      </Section>
      <Section title="Documents" done={done("documents")} onEdit={() => onEdit("documents")}>
        {kyc.documents.length === 0 ? <Row label="Uploaded" value="" /> : null}
        {kyc.documents.map((d) => (
          <Row key={d.fileId} label={KYC_DOCUMENT_LABELS[d.kind]} value={d.filename} />
        ))}
      </Section>

      <div className="flex flex-col gap-3 rounded-xl border border-admin-border bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-admin-muted">
          You&apos;ll be billed on commission at the platform&apos;s standard rates; ShowBuzz will confirm your plan. By
          submitting you confirm these details are correct.
        </p>
        <Button type="button" onClick={submit} disabled={!ready || pending} className="shrink-0">
          <Rocket className="h-4 w-4" aria-hidden />
          {pending ? "Submitting…" : "Submit & go live"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  done,
  onEdit,
  children,
}: {
  title: string;
  done: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-admin-border">
      <header className="flex items-center justify-between border-b border-admin-border bg-slate-50/60 px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-xs font-bold text-admin-dark">
          {done ? (
            <CheckCircle2 className="h-4 w-4 text-admin-success" aria-label="Complete" />
          ) : (
            <CircleAlert className="h-4 w-4 text-admin-warning" aria-label="Incomplete" />
          )}
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-admin-indigo hover:underline"
        >
          <Pencil className="h-3 w-3" aria-hidden /> Edit
        </button>
      </header>
      <dl className="divide-y divide-slate-100 px-4">{children}</dl>
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 text-xs sm:flex-row sm:gap-4">
      <dt className="w-32 shrink-0 text-admin-muted">{label}</dt>
      <dd className={value ? `font-semibold text-admin-dark ${mono ? "font-mono" : ""}` : "text-admin-subtle italic"}>
        {value || "Not provided yet"}
      </dd>
    </div>
  );
}
