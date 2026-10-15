"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { TextField, Toggle } from "@showbuzz/console-ui/fields";
import { Button } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { formatINR } from "@showbuzz/utils/money";
import { cancelBookingByStaffAction } from "@/app/_actions/operations";

interface CancelBookingButtonProps {
  code: string;
  totalPaise: number;
  feePaise: number;
  withinPolicy: boolean;
}

/**
 * Staff cancel & refund: always with a reason (it may be outside the vendor's policy); the vendor's fee is kept
 * unless waived. The refund goes back to the original payment (gateway, gift card, or recorded at the counter).
 */
export function CancelBookingButton({ code, totalPaise, feePaise, withinPolicy }: CancelBookingButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [waiveFee, setWaiveFee] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const refund = Math.max(0, totalPaise - (waiveFee ? 0 : feePaise));

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await cancelBookingByStaffAction(code, { reason, waiveFee });
      if (!result.success) {
        setError(result.error.fieldErrors?.reason?.[0] ?? result.error.message);
        return;
      }
      setOpen(false);
      toast.success(`${code} cancelled. Refund ${formatINR(result.data.refundPaise)}.`);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Cancel & refund
      </Button>
      <ConfirmDialog
        open={open}
        title={`Cancel ${code}?`}
        description={
          <>
            {withinPolicy
              ? "This booking is inside the vendor's cancellation policy."
              : "This booking is outside the vendor's cancellation policy (after the cutoff or sold as non-cancellable): you are overriding it."}{" "}
            The seats or passes are released. Refund: <b>{formatINR(refund)}</b>.
          </>
        }
        confirmLabel="Cancel booking"
        pending={pending}
        onConfirm={confirm}
        onCancel={() => {
          setOpen(false);
          setError(undefined);
        }}
      >
        <div className="space-y-3">
          <TextField
            label="Reason (kept on the booking and in the activity log)"
            required
            autoFocus
            value={reason}
            maxLength={300}
            error={error}
            onChange={(event) => setReason(event.target.value)}
          />
          {feePaise > 0 ? (
            <Toggle
              label={`Waive the ${formatINR(feePaise)} cancellation fee`}
              hint="Full refund of the amount paid."
              value={waiveFee}
              onChange={setWaiveFee}
            />
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
