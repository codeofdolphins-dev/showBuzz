"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowRight, Pencil, ShieldCheck } from "lucide-react";
import { SelectField, TextField } from "@showbuzz/console-ui/fields";
import { Button, FieldError, FormMessage } from "@showbuzz/console-ui/form";
import { vendorSignupSchema } from "@showbuzz/schemas/partner";
import { VENDOR_BUSINESS_TYPE_LABELS } from "@showbuzz/schemas/vendor";
import { sendSignupCodeAction, signupAction } from "@/app/_actions/signup";
import { applyActionError } from "@/lib/action-errors";

type SignupInput = z.input<typeof vendorSignupSchema>;
type SignupOutput = z.output<typeof vendorSignupSchema>;

interface SentCode {
  challengeId: string;
  destination: string;
  devCode?: string;
}

const BUSINESS_TYPES = Object.entries(VENDOR_BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label }));

/**
 * Two steps: the business form (validated with the server's schema), then the code sent to the mobile number.
 * Editing the details after a code was sent goes back to step one.
 */
export function SignupForm({ cities }: { cities: { value: string; label: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<SentCode | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const form = useForm<SignupInput, unknown, SignupOutput>({
    resolver: zodResolver(vendorSignupSchema),
    defaultValues: {
      businessName: "",
      businessType: "event_organiser",
      contactName: "",
      email: "",
      phone: "",
      cityId: "",
      password: "",
      confirmPassword: "",
    },
  });
  const errors = form.formState.errors;

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function requestCode() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendSignupCodeAction({ phone: form.getValues("phone") });
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      setSent(result.data);
      setCode("");
      setCodeError(null);
      setResendIn(result.data.resendAfterSec);
    });
  }

  const onDetails = form.handleSubmit(() => requestCode());

  function createAccount() {
    if (!sent) return;
    setMessage(null);
    setCodeError(null);
    startTransition(async () => {
      const result = await signupAction({ form: form.getValues(), challengeId: sent.challengeId, code: code.trim() });
      if (result.success) {
        // Full navigation: the session cookies were just set by the action.
        window.location.assign(result.data.next);
        return;
      }
      if (["OTP_INVALID", "OTP_EXPIRED"].includes(result.error.code) || result.error.fieldErrors?.code) {
        setCodeError(result.error.fieldErrors?.code?.[0] ?? result.error.message);
        return;
      }
      // A problem with the details themselves: back to the form so it can be fixed.
      const unmatched = applyActionError(form, {
        ...result.error,
        fieldErrors: flattenFormErrors(result.error.fieldErrors),
      });
      setSent(null);
      setMessage(unmatched);
    });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        {message ? <FormMessage tone="error">{message}</FormMessage> : null}
        <div className="flex items-start gap-3 rounded-lg border border-indigo-100 bg-admin-active p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-admin-indigo" aria-hidden />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-admin-dark">Verify your mobile number</p>
            <p className="text-admin-muted">
              Enter the 6-digit code sent to <b className="text-admin-dark">{sent.destination}</b>.
            </p>
            {sent.devCode ? (
              <p className="font-semibold text-amber-700">
                Demo mode (no SMS provider yet): your code is <span className="font-mono">{sent.devCode}</span>
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <TextField
            id="signup-code"
            label="Verification code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            error={codeError ?? undefined}
            className="font-mono tracking-[0.4em]"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setSent(null)} disabled={pending}>
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit details
            </Button>
            <Button type="button" variant="ghost" onClick={requestCode} disabled={pending || resendIn > 0}>
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </Button>
          </div>
          <Button type="button" onClick={createAccount} disabled={pending || code.length !== 6}>
            {pending ? "Creating account…" : "Create partner account"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onDetails} className="space-y-4" noValidate>
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Business / brand name"
          required
          autoComplete="organization"
          containerClassName="sm:col-span-2"
          error={errors.businessName?.message}
          {...form.register("businessName")}
        />
        <SelectField
          label="Business type"
          required
          options={BUSINESS_TYPES}
          error={errors.businessType?.message}
          {...form.register("businessType")}
        />
        <SelectField
          label="City"
          required
          options={cities}
          placeholder="Choose a city"
          error={errors.cityId?.message}
          {...form.register("cityId")}
        />
        <TextField
          label="Contact person"
          required
          autoComplete="name"
          error={errors.contactName?.message}
          {...form.register("contactName")}
        />
        <TextField
          label="Mobile number"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="98765 43210"
          hint="We'll send a code to verify it."
          error={errors.phone?.message}
          {...form.register("phone")}
        />
        <TextField
          label="Business email"
          required
          type="email"
          autoComplete="email"
          hint="You'll sign in with this email."
          containerClassName="sm:col-span-2"
          error={errors.email?.message}
          {...form.register("email")}
        />
        <TextField
          label="Password"
          required
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          error={errors.password?.message}
          {...form.register("password")}
        />
        <TextField
          label="Confirm password"
          required
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />
      </div>
      <Controller
        control={form.control}
        name="acceptTerms"
        render={({ field }) => (
          <div>
            <label className="flex items-start gap-2 text-xs text-admin-text">
              <input
                type="checkbox"
                checked={field.value === true}
                onChange={(event) => field.onChange(event.target.checked ? true : undefined)}
                onBlur={field.onBlur}
                className="mt-0.5 h-4 w-4 rounded border-admin-border accent-admin-indigo"
                aria-invalid={errors.acceptTerms ? true : undefined}
                aria-describedby={errors.acceptTerms ? "accept-terms-error" : undefined}
              />
              <span>
                I agree to the ShowBuzz partner terms and confirm I&apos;m authorised to register this business.
              </span>
            </label>
            <FieldError
              id="accept-terms-error"
              messages={errors.acceptTerms?.message ? [errors.acceptTerms.message] : undefined}
            />
          </div>
        )}
      />
      <Button type="submit" className="w-full py-2.5" disabled={pending}>
        {pending ? "Sending code…" : "Verify mobile & continue"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}

/** Server field errors for `form.x` → `x` (the action validates { form, challengeId, code }). */
function flattenFormErrors(fieldErrors: Record<string, string[]> | undefined): Record<string, string[]> | undefined {
  if (!fieldErrors) return undefined;
  return Object.fromEntries(Object.entries(fieldErrors).map(([key, value]) => [key.replace(/^form\./, ""), value]));
}
