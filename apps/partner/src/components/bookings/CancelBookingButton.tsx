"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { TextAreaField, Toggle } from "@showbuzz/console-ui/fields";
import { Button } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { OVERRIDE_REASON_MIN } from "@showbuzz/schemas/partner-box-office";
import { describeCutoff } from "@showbuzz/schemas/vendor";
import { formatINR } from "@showbuzz/utils/money";
import { cancelBookingAction } from "@/app/_actions/box-office";

interface CancelBookingButtonProps {
  code: string;
  /** What was paid in all (gateway + gift card, or the counter amount). */
  totalPaise: number;
  policy: { allowed: boolean; cutoffMinutes: number; feePaise: number };
  withinPolicy: boolean;
}

/**
 * Prototype booking-details "Initiate Refund": cancel a booking and refund it. Inside the vendor's own policy the
 * policy fee is kept unless waived; outside it (after the cutoff, or sold as non-cancellable) a reason is required
 * and the fee is waived by default, since that is usually the vendor's side (e.g. a cancelled screening).
 */
export function CancelBookingButton({ code, totalPaise, policy, withinPolicy }: CancelBookingButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [waiveFee, setWaiveFee] = useState(!withinPolicy);
  const [error, setError] = useState<string | null>(null);

  const fee = waiveFee ? 0 : Math.min(policy.feePaise, totalPaise);
  const refund = Math.max(0, totalPaise - fee);
  const needsReason = !withinPolicy;

  function confirm() {
    if (needsReason && reason.trim().length < OVERRIDE_REASON_MIN) {
      setError("Give a reason (at least 5 characters).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelBookingAction({ code, reason: reason.trim(), waiveFee });
      if (!result.success) {
        setError(result.error.fieldErrors?.reason?.[0] ?? result.error.message);
        return;
      }
      setOpen(false);
      toast.success(`Booking ${code} cancelled. Refund ${formatINR(result.data.refundPaise, { exact: true })}.`);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4" aria-hidden /> Cancel & refund
      </Button>
      <ConfirmDialog
        open={open}
        title={`Cancel booking ${code}?`}
        description={
          withinPolicy
            ? `Inside your policy (cancellable ${describeCutoff(policy.cutoffMinutes)}). The seats go back on sale.`
            : policy.allowed
              ? "This booking is past your cancellation cutoff. You can still cancel it, with a reason."
              : "This booking was sold as non-cancellable. You can still cancel it, with a reason."
        }
        confirmLabel={pending ? "Cancelling…" : `Cancel & refund ${formatINR(refund, { exact: true })}`}
        pending={pending}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      >
        <div className="space-y-3">
          <Toggle
            label="Waive the cancellation fee (full refund)"
            hint={`Your policy fee is ${formatINR(policy.feePaise, { exact: true })}.`}
            value={waiveFee}
            onChange={setWaiveFee}
          />
          <TextAreaField
            label={needsReason ? "Reason (required)" : "Reason (optional)"}
            required={needsReason}
            value={reason}
            maxLength={300}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Screening cancelled: projector failure"
            error={error ?? undefined}
          />
          <p className="text-[11px] text-admin-muted">
            Refund {formatINR(refund, { exact: true })} of {formatINR(totalPaise, { exact: true })}. Online payments are
            refunded to the customer&apos;s payment method; counter sales are paid back at your counter.
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
