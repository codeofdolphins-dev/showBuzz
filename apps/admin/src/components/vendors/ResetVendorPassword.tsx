"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { resetVendorPasswordAction } from "@/app/_actions/vendors";

/** Stand-in for the vendor's "forgot password" (no email provider yet): a temporary password, shown once. */
export function ResetVendorPassword({ vendorId, email }: { vendorId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; temporaryPassword: string } | null>(null);

  function reset() {
    setError(null);
    startTransition(async () => {
      const result = await resetVendorPasswordAction(vendorId);
      setOpen(false);
      if (result.success) setIssued(result.data);
      else setError(result.error.message);
    });
  }

  return (
    <div className="space-y-3">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {issued ? (
        <FormMessage tone="success">
          Temporary password for {issued.email}:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-admin-dark select-all">
            {issued.temporaryPassword}
          </code>
          . It is shown only once; the vendor was signed out everywhere and should change it after signing in.
        </FormMessage>
      ) : null}
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <KeyRound className="h-4 w-4" aria-hidden /> Set temporary password
      </Button>
      <ConfirmDialog
        open={open}
        title="Reset the partner password?"
        description={`${email} gets a new temporary password and is signed out on every device.`}
        confirmLabel="Reset password"
        pending={pending}
        onConfirm={reset}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
