"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { FileUpload } from "@showbuzz/console-ui/fields";
import { Button } from "@showbuzz/console-ui/form";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { useToast } from "@showbuzz/console-ui/Toaster";
import type { OnboardingDocumentKind } from "@showbuzz/schemas/partner";
import { KYC_DOCUMENT_LABELS, REQUIRED_KYC_DOCUMENTS, type KycDocument } from "@showbuzz/schemas/vendor";
import { uploadKycDocumentAction } from "@/app/_actions/onboarding";

const KINDS: { kind: OnboardingDocumentKind; hint: string }[] = [
  { kind: "gst_certificate", hint: "GST REG-06 registration certificate (all pages)." },
  { kind: "pan_card", hint: "The business's PAN card (the proprietor's for a proprietorship)." },
  { kind: "cancelled_cheque", hint: "A cancelled cheque or bank letter showing the payout account and IFSC." },
  {
    kind: "business_registration",
    hint: "Optional: certificate of incorporation, partnership deed or shop & establishment licence.",
  },
];

/** One upload per document kind; each file is stored as soon as it is chosen (replacing the earlier one). */
export function DocumentsStep({
  documents,
  missing,
  onContinue,
}: {
  documents: KycDocument[];
  missing: OnboardingDocumentKind[];
  onContinue: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<OnboardingDocumentKind | null>(null);
  const [errors, setErrors] = useState<Partial<Record<OnboardingDocumentKind, string>>>({});

  function upload(kind: OnboardingDocumentKind, file: File | null) {
    if (!file) return;
    setUploading(kind);
    setErrors((e) => ({ ...e, [kind]: undefined }));
    startTransition(async () => {
      const data = new FormData();
      data.set("kind", kind);
      data.set("file", file);
      const result = await uploadKycDocumentAction(data);
      setUploading(null);
      if (!result.success) {
        setErrors((e) => ({ ...e, [kind]: result.error.message }));
        return;
      }
      toast.success(`${KYC_DOCUMENT_LABELS[kind]} uploaded.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="border-b border-admin-border pb-4">
        <h2 className="text-base font-bold text-admin-dark">KYC documents</h2>
        <p className="text-xs text-admin-muted">
          Upload clear scans or photos (PDF, JPEG or PNG, up to 4 MB each). Files are private: only you and the ShowBuzz
          team can open them.
        </p>
      </div>
      <ul className="space-y-4">
        {KINDS.map(({ kind, hint }) => {
          const current = documents.find((d) => d.kind === kind);
          const required = (REQUIRED_KYC_DOCUMENTS as readonly string[]).includes(kind);
          return (
            <li key={kind} className="space-y-1">
              <div className="flex items-center gap-2">
                {current ? (
                  <CheckCircle2 className="h-4 w-4 text-admin-success" aria-label="Uploaded" />
                ) : uploading === kind ? (
                  <Loader2 className="h-4 w-4 animate-spin text-admin-indigo" aria-label="Uploading" />
                ) : null}
                <StatusBadge tone={required ? (current ? "success" : "warning") : "neutral"}>
                  {required ? (current ? "Uploaded" : "Required") : "Optional"}
                </StatusBadge>
              </div>
              <FileUpload
                label={KYC_DOCUMENT_LABELS[kind]}
                required={required}
                hint={hint}
                disabled={pending && uploading === kind}
                current={
                  current
                    ? { filename: current.filename, href: `/api/v1/partner/documents/${current.fileId}` }
                    : undefined
                }
                error={errors[kind]}
                onFileChange={(file) => upload(kind, file)}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 border-t border-admin-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-admin-muted">
          {missing.length === 0
            ? "All required documents are uploaded."
            : `Still needed: ${missing.map((k) => KYC_DOCUMENT_LABELS[k]).join(", ")}.`}
        </p>
        <Button type="button" onClick={onContinue} disabled={pending}>
          Continue to review
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
