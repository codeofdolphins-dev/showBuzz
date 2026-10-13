"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button, FieldError, FormMessage, Input, Label } from "@/components/ui/form";

interface LoginFormProps {
  /** Already validated by the page (safeNextPath). */
  next: string;
}

interface ApiFailure {
  success: false;
  error: { message: string; details?: { fieldErrors?: Record<string, string[]> } };
}

/** Email + password form; posts to /api/v1/admin/auth/login, which sets the session cookies. */
export function LoginForm({ next }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/v1/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (response.ok) {
        // Full navigation so every server component renders with the new session.
        window.location.assign(next);
        return;
      }
      const body = (await response.json().catch(() => null)) as ApiFailure | null;
      setError(body?.error.message ?? "Sign-in failed. Please try again.");
      setFieldErrors(body?.error.details?.fieldErrors ?? {});
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div>
        <Label htmlFor="email" required>
          Staff Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@showbuzz.com"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" messages={fieldErrors.email} />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label htmlFor="password" required className="mb-0">
            Password
          </Label>
          <Link href="/forgot-password" className="text-xs font-semibold text-admin-indigo hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-10"
            placeholder="••••••••"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-2.5 right-3 text-admin-subtle hover:text-admin-indigo"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FieldError id="password-error" messages={fieldErrors.password} />
      </div>
      <Button type="submit" className="w-full py-2.5 shadow-sm" disabled={pending}>
        <span>{pending ? "Signing in…" : "Sign In to ShowBuzz Admin"}</span>
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}
