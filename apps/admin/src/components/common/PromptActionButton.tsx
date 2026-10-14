"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { TextField } from "@showbuzz/console-ui/fields";
import { Button } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import type { ActionOutcome } from "@showbuzz/console-ui/vendor-kyc/KycActions";

interface PromptActionButtonProps {
  label: ReactNode;
  title: string;
  description?: ReactNode;
  /** The text the action needs (a payment reference, a reason). Omit for a plain confirmation. */
  field?: { name: "reference" | "reason"; label: string; placeholder?: string; hint?: string };
  confirmLabel: string;
  tone?: "danger" | "primary";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** A Server Action bound to the record (`action.bind(null, id)` on the server). */
  action: (input: Record<string, string>) => Promise<ActionOutcome<unknown>>;
  success: string;
  /** Where to go afterwards (default: refresh the page). */
  redirectTo?: string;
}

/**
 * A status change that asks for confirmation and, optionally, one required text (UTR / receipt number or reason).
 * Errors from the server (validation, "already paid") show in the dialog.
 */
export function PromptActionButton({
  label,
  title,
  description,
  field,
  confirmLabel,
  tone = "primary",
  variant = "secondary",
  action,
  success,
  redirectTo,
}: PromptActionButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await action(field ? { [field.name]: value } : {});
      if (!result.success) {
        const fieldError = field ? result.error.fieldErrors?.[field.name]?.[0] : undefined;
        setError(fieldError ?? result.error.message);
        return;
      }
      setOpen(false);
      setValue("");
      toast.success(success);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        tone={tone}
        pending={pending}
        onConfirm={confirm}
        onCancel={() => {
          setOpen(false);
          setError(undefined);
        }}
      >
        {field ? (
          <TextField
            label={field.label}
            required
            autoFocus
            value={value}
            placeholder={field.placeholder}
            hint={field.hint}
            error={error}
            maxLength={300}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : error ? (
          <p role="alert" className="text-xs font-medium text-admin-danger">
            {error}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
