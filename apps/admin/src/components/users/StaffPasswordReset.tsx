"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { resetStaffPasswordAction } from "@/app/_actions/staff";

/** Stand-in for "forgot password" (no email provider yet): a temporary password for this staff member, shown once. */
export function StaffPasswordReset({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  function reset() {
    setError(null);
    startTransition(async () => {
      const result = await resetStaffPasswordAction({ email });
      setOpen(false);
      if (result.success) setIssued(result.data.temporaryPassword);
      else setError(result.error.message);
    });
  }

  return (
    <div className="space-y-3">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {issued ? (
        <FormMessage tone="success">
          Temporary password for {email}:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-admin-dark select-all">{issued}</code>. It is
          shown only once; they were signed out everywhere and should change it after signing in.
        </FormMessage>
      ) : null}
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <KeyRound className="h-4 w-4" aria-hidden /> Set temporary password
      </Button>
      <ConfirmDialog
        open={open}
        title="Reset this password?"
        description={`${email} gets a new temporary password and is signed out on every device.`}
        confirmLabel="Reset password"
        pending={pending}
        onConfirm={reset}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
