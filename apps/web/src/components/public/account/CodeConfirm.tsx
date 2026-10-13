"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { AUTH } from "@showbuzz/schemas/constants";
import { cn } from "@showbuzz/utils/cn";

export interface SentCode {
  challengeId: string;
  destination: string;
  resendAfterSec: number;
  devCode?: string;
  /** Epoch ms the code was sent (set by the caller when the action returns). */
  sentAt: number;
}

interface CodeConfirmProps {
  sent: SentCode;
  /** Shown on the confirm button, e.g. "Verify & Save" or "Delete my account". */
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  error?: string;
  onConfirm: (code: string) => void;
  onResend: () => void;
  onCancel: () => void;
}

/** One-time code step for account changes: code field, resend countdown and the dev-only code banner. */
export function CodeConfirm(props: CodeConfirmProps) {
  const { sent, confirmLabel, danger, pending, error, onConfirm, onResend, onCancel } = props;
  const [code, setCode] = useState("");
  const [now, setNow] = useState(sent.sentAt);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sent.sentAt]);

  const resendIn = Math.max(0, Math.ceil((sent.sentAt + sent.resendAfterSec * 1000 - now) / 1000));
  const submit = () => onConfirm(code);

  return (
    <div className="mt-3 space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] text-slate-600">
        Enter the {AUTH.otpLength}-digit code sent to <strong className="text-slate-800">{sent.destination}</strong>
      </p>
      {sent.devCode && (
        <p className="inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
          Development only, no SMS provider yet: <span className="font-mono tracking-widest">{sent.devCode}</span>
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, AUTH.otpLength);
            setCode(digits);
            if (digits.length === AUTH.otpLength) onConfirm(digits);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Verification code"
          className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center font-mono text-sm font-black tracking-[0.3em] focus:border-rose-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={cn(
            "tap-active flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-60",
            danger ? "bg-rose-600 hover:bg-rose-700" : "gradient-btn",
          )}
        >
          {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
      <p role="alert" aria-live="assertive" className="min-h-4 text-[11px] font-medium text-rose-600">
        {error}
      </p>
      <div className="flex items-center gap-4 text-[11px] font-bold">
        <button
          type="button"
          onClick={onResend}
          disabled={resendIn > 0 || pending}
          className="text-rose-600 hover:text-rose-700 disabled:text-slate-400"
        >
          {resendIn > 0 ? `Resend code in 0:${String(resendIn).padStart(2, "0")}` : "Resend code"}
        </button>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
