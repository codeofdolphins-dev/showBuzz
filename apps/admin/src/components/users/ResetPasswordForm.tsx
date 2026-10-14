"use client";

import { useState, useTransition, type FormEvent } from "react";
import { resetStaffPasswordAction } from "@/app/_actions/staff";
import { Button, FieldError, FormMessage, Input, Label } from "@showbuzz/console-ui/form";

export function ResetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [issued, setIssued] = useState<{ email: string; temporaryPassword: string } | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    setIssued(null);
    startTransition(async () => {
      const result = await resetStaffPasswordAction({ email });
      if (result.success) {
        setIssued(result.data);
        setError(null);
        setFieldErrors({});
      } else {
        setError(result.error.message);
        setFieldErrors(result.error.fieldErrors ?? {});
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {issued ? (
        <FormMessage tone="success">
          Temporary password for {issued.email}:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-admin-dark select-all">
            {issued.temporaryPassword}
          </code>
          . It is shown only once.
        </FormMessage>
      ) : null}
      <div>
        <Label htmlFor="reset-email" required>
          Staff email
        </Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "reset-email-error" : undefined}
        />
        <FieldError id="reset-email-error" messages={fieldErrors.email} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Resetting…" : "Set temporary password"}
      </Button>
    </form>
  );
}
