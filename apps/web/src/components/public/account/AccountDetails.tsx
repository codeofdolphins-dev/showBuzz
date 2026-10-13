"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, LoaderCircle } from "lucide-react";
import {
  confirmContactChangeAction,
  confirmReauthAction,
  removeContactAction,
  startContactChangeAction,
  startReauthAction,
  updateProfileAction,
} from "@/app/(public)/_actions/account";
import { Field, inputClass } from "@/components/public/form/Field";
import { withAuthRetry } from "@/hooks/use-session-keep-alive";
import { cn } from "@showbuzz/utils/cn";
import { updateProfileSchema, type UpdateProfileInput } from "@showbuzz/schemas/account";
import type { CustomerSnapshot } from "@showbuzz/schemas/user";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/ui";
import type { AccountProfile } from "@showbuzz/schemas/types/account";
import { CodeConfirm, type SentCode } from "./CodeConfirm";

type Channel = "sms" | "email";

/** Name form plus verified email/phone rows (Account Details tab). */
export function AccountDetails({ profile }: { profile: AccountProfile }) {
  const router = useRouter();
  const updateUser = useAuthStore((s) => s.updateUser);
  const [isSaving, startSaving] = useTransition();
  const { user } = profile;
  const stepUp = useStepUp();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name },
  });

  const applied = (next: CustomerSnapshot, message: string) => {
    updateUser(next);
    toast(message, "success");
    router.refresh();
  };

  const save = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await withAuthRetry(() => updateProfileAction(values));
      if (!result.success) {
        const nameError = result.error.fieldErrors?.name?.[0];
        if (nameError) form.setError("name", { message: nameError });
        else toast(result.error.message, "error");
        return;
      }
      form.reset({ name: result.data.name });
      applied(result.data, "Profile details saved.");
    }),
  );

  return (
    <div className="max-w-xl space-y-6 rounded-3xl border border-slate-200/80 bg-white p-5 text-xs shadow-xs sm:p-8">
      <form onSubmit={save} noValidate className="space-y-4">
        <h3 className="border-b border-slate-100 pb-3 text-base font-extrabold text-slate-900">Personal Information</h3>
        <Field id="p-name" label="Full Name" error={form.formState.errors.name?.message}>
          <input
            id="p-name"
            autoComplete="name"
            aria-invalid={!!form.formState.errors.name}
            {...form.register("name")}
            className={inputClass}
          />
        </Field>
        <button
          type="submit"
          disabled={isSaving || !form.formState.isDirty}
          className="gradient-btn tap-active flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-60"
        >
          {isSaving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
          Save Changes
        </button>
      </form>

      <div className="space-y-4 border-t border-slate-100 pt-5">
        <h4 className="text-sm font-extrabold text-slate-900">Sign-in details</h4>
        {stepUp.panel}
        <ContactRow
          channel="email"
          label="Email Address"
          value={user.email}
          verified={profile.emailVerified}
          canRemove={!!user.email && !!user.phone}
          onApplied={applied}
          onStepUp={stepUp.require}
        />
        <ContactRow
          channel="sms"
          label="Mobile Number"
          value={user.phone}
          verified={profile.phoneVerified}
          canRemove={!!user.email && !!user.phone}
          onApplied={applied}
          onStepUp={stepUp.require}
        />
      </div>
    </div>
  );
}

interface ContactRowProps {
  channel: Channel;
  label: string;
  value?: string;
  verified: boolean;
  canRemove: boolean;
  onApplied: (user: CustomerSnapshot, message: string) => void;
  /** Called when the server wants a fresh "confirm it's you"; `retry` re-runs the blocked step afterwards. */
  onStepUp: (retry: () => void) => void;
}

/** One sign-in identifier: shows it, and changes/adds it only after the new one is verified by code. */
function ContactRow({ channel, label, value, verified, canRemove, onApplied, onStepUp }: ContactRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<SentCode | null>(null);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const noun = channel === "sms" ? "mobile number" : "email";

  const reset = () => {
    setEditing(false);
    setDraft("");
    setSent(null);
    setError(undefined);
  };

  const sendCode = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await withAuthRetry(() => startContactChangeAction({ identifier: draft }));
      if (!result.success && result.error.code === "STEP_UP_REQUIRED") {
        onStepUp(sendCode);
        return;
      }
      if (!result.success) {
        setError(result.error.fieldErrors?.identifier?.[0] ?? result.error.message);
        return;
      }
      setSent({ ...result.data, sentAt: Date.now() });
    });

  const confirm = (code: string) =>
    startTransition(async () => {
      if (!sent) return;
      setError(undefined);
      const result = await withAuthRetry(() => confirmContactChangeAction({ challengeId: sent.challengeId, code }));
      if (!result.success) {
        setError(result.error.message);
        if (result.error.code === "OTP_EXPIRED" || result.error.code === "RATE_LIMITED") setSent(null);
        return;
      }
      reset();
      onApplied(result.data, `Your ${noun} is verified and saved.`);
    });

  const remove = () =>
    startTransition(async () => {
      const result = await withAuthRetry(() => removeContactAction({ channel }));
      if (!result.success && result.error.code === "STEP_UP_REQUIRED") {
        onStepUp(remove);
        return;
      }
      if (!result.success) {
        toast(result.error.message, "error");
        return;
      }
      onApplied(result.data, `Your ${noun} was removed.`);
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-slate-700">{label}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-slate-600">
            {value ?? <span className="text-slate-400">Not added yet</span>}
            {value && verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                <BadgeCheck className="h-3 w-3" /> Verified
              </span>
            )}
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="tap-active rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
            >
              {value ? "Change" : "Add"}
            </button>
            {value && canRemove && (
              <button
                type="button"
                onClick={remove}
                disabled={isPending}
                className="tap-active rounded-lg px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {editing && !sent && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
              type={channel === "email" ? "email" : "tel"}
              placeholder={channel === "email" ? "you@example.com" : "98765 43210"}
              aria-label={`New ${noun}`}
              className={cn(inputClass, "flex-1")}
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={isPending || !draft.trim()}
              className="gradient-btn tap-active flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {isPending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              Send code
            </button>
          </div>
          <p role="alert" aria-live="assertive" className="min-h-4 text-[11px] font-medium text-rose-600">
            {error}
          </p>
          <button type="button" onClick={reset} className="text-[11px] font-bold text-slate-500 hover:text-slate-700">
            Cancel
          </button>
        </div>
      )}

      {sent && (
        <CodeConfirm
          key={sent.challengeId}
          sent={sent}
          confirmLabel="Verify & Save"
          pending={isPending}
          error={error}
          onConfirm={confirm}
          onResend={sendCode}
          onCancel={reset}
        />
      )}
    </div>
  );
}

/**
 * "Confirm it's you" for sensitive changes: sends a code to the customer's own phone/email, and once it is
 * confirmed re-runs the step that the server blocked.
 */
function useStepUp() {
  const [sent, setSent] = useState<SentCode | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await withAuthRetry(() => startReauthAction());
      if (!result.success) {
        toast(result.error.message, "error");
        return;
      }
      setSent({ ...result.data, sentAt: Date.now() });
    });

  const require = (next: () => void) => {
    setRetry(() => next);
    send();
  };

  const confirm = (code: string) =>
    startTransition(async () => {
      if (!sent) return;
      setError(undefined);
      const result = await withAuthRetry(() => confirmReauthAction({ challengeId: sent.challengeId, code }));
      if (!result.success) {
        setError(result.error.message);
        if (result.error.code === "OTP_EXPIRED" || result.error.code === "RATE_LIMITED") setSent(null);
        return;
      }
      setSent(null);
      toast("Thanks, that's confirmed.", "success");
      retry?.();
      setRetry(null);
    });

  const panel = sent ? (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-xs font-bold text-slate-800">Confirm it&apos;s you</p>
      <p className="mt-0.5 text-[11px] text-slate-600">
        For your security, changing sign-in details needs a quick check with a code sent to your current number or
        email.
      </p>
      <CodeConfirm
        key={sent.challengeId}
        sent={sent}
        confirmLabel="Confirm"
        pending={isPending}
        error={error}
        onConfirm={confirm}
        onResend={send}
        onCancel={() => {
          setSent(null);
          setRetry(null);
          setError(undefined);
        }}
      />
    </div>
  ) : null;

  return { require, panel };
}
