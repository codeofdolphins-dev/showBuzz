"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button, FieldError, FormMessage, Input, Label } from "@showbuzz/console-ui/form";
import { changePasswordAction } from "@/app/_actions/account";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== form.get("confirmPassword")) {
      setFieldErrors({ confirmPassword: ["The new passwords don't match."] });
      setMessage(null);
      return;
    }
    startTransition(async () => {
      const result = await changePasswordAction({ currentPassword: form.get("currentPassword"), newPassword });
      if (result.success) {
        formRef.current?.reset();
        setFieldErrors({});
        setMessage({ tone: "success", text: "Password changed. Other devices have been signed out." });
      } else {
        setFieldErrors(
          result.error.fieldErrors ?? (result.error.details?.fieldErrors as Record<string, string[]> | undefined) ?? {},
        );
        setMessage({ tone: "error", text: result.error.message });
      }
    });
  }

  const field = (name: string, label: string, autoComplete: string) => (
    <div>
      <Label htmlFor={name} required>
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        aria-invalid={fieldErrors[name] ? true : undefined}
        aria-describedby={fieldErrors[name] ? `${name}-error` : undefined}
      />
      <FieldError id={`${name}-error`} messages={fieldErrors[name]} />
    </div>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      {field("currentPassword", "Current Password", "current-password")}
      {field("newPassword", "New Password", "new-password")}
      {field("confirmPassword", "Confirm New Password", "new-password")}
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Update Password"}
        </Button>
      </div>
    </form>
  );
}
