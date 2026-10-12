"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, Mail, Phone, ShieldCheck, X } from "lucide-react";
import { requestOtpAction, verifyOtpAction } from "@/app/(public)/_actions/auth";
import { Modal } from "@/components/ui/Modal";
import { AUTH } from "@/config/constants";
import { cn } from "@/lib/cn";
import { otpRequestSchema, type OtpRequestInput } from "@/schemas/auth";
import { useAuthStore } from "@/stores/auth";
import { toast, useUiStore } from "@/stores/ui";
import { BrandMark, BrandWordmark } from "./BrandLogo";

const CODE_LENGTH = AUTH.otpLength;
const emptyDigits = () => Array<string>(CODE_LENGTH).fill("");

interface PendingCode {
  challengeId: string;
  /** Masked by the server, e.g. "98******10". */
  destination: string;
  devCode?: string;
  /** Epoch ms. */
  expiresAt: number;
  resendAt: number;
}

interface Notice {
  text: string;
  tone: "error" | "info";
}

/** "m:ss" for a number of seconds. */
function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function secondsUntil(epochMs: number, now: number) {
  return Math.max(0, Math.ceil((epochMs - now) / 1000));
}

export function AuthModal() {
  const router = useRouter();
  const open = useUiStore((s) => s.authModalOpen);
  const authNext = useUiStore((s) => s.authNext);
  const closeModal = useUiStore((s) => s.closeAuthModal);
  const setSession = useAuthStore((s) => s.setSession);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState<PendingCode | null>(null);
  const [lastRequest, setLastRequest] = useState<OtpRequestInput | null>(null);
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  // Clock for the countdowns: set when a code arrives, then ticks every second while the code step is open.
  // Starts at 0 (no clock reads while prerendering); send() sets it the moment a code arrives.
  const [now, setNow] = useState(0);
  const hasCode = pending !== null;
  useEffect(() => {
    if (!hasCode) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasCode]);
  const expiresIn = pending ? secondsUntil(pending.expiresAt, now) : 0;
  const resendIn = pending ? secondsUntil(pending.resendAt, now) : 0;

  const form = useForm<OtpRequestInput>({
    // raw: validate here, but submit what was typed; the server parses it into { channel, phone | email }.
    resolver: zodResolver(otpRequestSchema, undefined, { raw: true }),
    defaultValues: { identifier: "", name: undefined },
  });
  const identifier = useWatch({ control: form.control, name: "identifier" }) ?? "";

  const close = () => {
    closeModal();
    setPending(null);
    setLastRequest(null);
    setDigits(emptyDigits());
    setNotice(null);
    form.reset();
  };

  // Focus the identifier when the modal opens, and the first code box once a code has been sent.
  const challengeId = pending?.challengeId;
  useEffect(() => {
    if (!open) return;
    if (challengeId) boxes.current[0]?.focus();
    else form.setFocus("identifier");
  }, [open, challengeId, form]);

  const send = (request: OtpRequestInput, sentNotice?: string) =>
    startTransition(async () => {
      setNotice(null);
      const result = await requestOtpAction(request);
      if (!result.success) {
        // Includes the server's "Try again in N seconds" for rate limits.
        setNotice({ text: result.error.message, tone: "error" });
        return;
      }
      const sentAt = Date.now();
      setNow(sentAt);
      setLastRequest(request);
      setDigits(emptyDigits());
      setPending({
        challengeId: result.data.challengeId,
        destination: result.data.destination,
        devCode: result.data.devCode,
        expiresAt: sentAt + result.data.expiresInSec * 1000,
        resendAt: sentAt + result.data.resendAfterSec * 1000,
      });
      if (sentNotice) setNotice({ text: sentNotice, tone: "info" });
    });

  const sendCode = form.handleSubmit((values) =>
    send({ identifier: values.identifier, name: mode === "register" ? values.name : undefined }),
  );

  const resend = () => {
    if (!lastRequest || resendIn > 0) return;
    send(lastRequest, "We sent you a new code.");
  };

  const verify = (code: string) => {
    if (!pending || isPending) return;
    if (code.length !== CODE_LENGTH) {
      setNotice({ text: `Enter the ${CODE_LENGTH}-digit code`, tone: "error" });
      return;
    }
    startTransition(async () => {
      setNotice(null);
      const result = await verifyOtpAction({ challengeId: pending.challengeId, code });
      if (!result.success) {
        const { code: errorCode, message, details } = result.error;
        if (errorCode === "OTP_INVALID") {
          const left = typeof details?.remainingAttempts === "number" ? details.remainingAttempts : undefined;
          const attempts =
            left === undefined
              ? ""
              : left === 0
                ? " No attempts left, please request a new code."
                : ` ${left} attempt${left === 1 ? "" : "s"} left.`;
          setNotice({ text: `${message}${attempts}`, tone: "error" });
          setDigits(emptyDigits());
          boxes.current[0]?.focus();
          return;
        }
        if (errorCode === "OTP_EXPIRED" || errorCode === "RATE_LIMITED") setPending(null);
        setNotice({ text: message, tone: "error" });
        return;
      }
      const next = authNext;
      setSession(result.data.user, result.data.accessExpiresAt);
      toast(`Welcome to ShowBuzz, ${result.data.user.name}!`, "success");
      close();
      // Server components re-render with the session; a protected page the visitor came from comes back.
      if (next) router.replace(next);
      else router.refresh();
    });
  };

  const fill = (next: string[]) => {
    setDigits(next);
    setNotice(null);
    if (next.every(Boolean)) verify(next.join(""));
  };

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasting a full code fills every box.
      const pasted = clean.slice(0, CODE_LENGTH).split("");
      boxes.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
      fill([...pasted, ...Array<string>(CODE_LENGTH - pasted.length).fill("")]);
      return;
    }
    if (clean && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
    fill(digits.map((x, i) => (i === index ? clean : x)));
  };

  const IdentifierIcon = identifier.includes("@") ? Mail : Phone;

  const liveRegion = (
    <p
      role="alert"
      aria-live="assertive"
      className={cn(
        "min-h-4 text-[11px] font-medium",
        notice?.tone === "info" ? "text-emerald-600" : "text-rose-600",
      )}
    >
      {notice?.text}
    </p>
  );

  return (
    <Modal open={open} onClose={close}>
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <BrandMark />
          <BrandWordmark className="text-lg" />
        </div>
        <button
          type="button"
          onClick={close}
          className="tap-active flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 mb-5 flex border-b border-slate-100">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setPending(null);
              setNotice(null);
            }}
            className={cn(
              "flex-1 border-b-2 pb-2.5 text-xs font-bold sm:text-sm",
              mode === m ? "border-rose-600 text-rose-600" : "border-transparent text-slate-400 hover:text-slate-600",
            )}
          >
            {m === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      {!pending ? (
        <form onSubmit={sendCode} className="space-y-3.5" noValidate>
          <div>
            <label htmlFor="auth-identifier" className="mb-1 block text-[11px] font-bold text-slate-700">
              Mobile Number or Email
            </label>
            <div className="relative">
              <input
                id="auth-identifier"
                {...form.register("identifier")}
                placeholder="e.g. 9876543210 or user@example.com"
                autoComplete="username"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-10 text-xs font-semibold text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none sm:text-sm"
              />
              <IdentifierIcon className="absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
            {form.formState.errors.identifier ? (
              <p className="mt-1 text-[11px] font-medium text-rose-600">{form.formState.errors.identifier.message}</p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">We will send a {CODE_LENGTH}-digit verification code</p>
            )}
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="auth-name" className="mb-1 block text-[11px] font-bold text-slate-700">
                Your Full Name
              </label>
              <input
                id="auth-name"
                {...form.register("name", { setValueAs: (v: string) => (v?.trim() ? v : undefined) })}
                placeholder="e.g. Aarav Roy"
                autoComplete="name"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 focus:border-rose-500 focus:outline-none sm:text-sm"
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-[11px] font-medium text-rose-600">{form.formState.errors.name.message}</p>
              )}
            </div>
          )}

          {liveRegion}

          <button
            type="submit"
            disabled={isPending}
            className="gradient-btn tap-active flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold text-white shadow-md shadow-rose-500/20 disabled:opacity-60 sm:text-sm"
          >
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            <span>Continue & Get OTP</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          <div className="relative my-3 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <span className="relative bg-white px-3 text-[10px] font-bold text-slate-400 uppercase">Or connect via</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {["Google", "Apple"].map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => toast(`${provider} sign-in is coming soon.`, "info")}
                className="tap-active flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                {provider}
              </button>
            ))}
          </div>
        </form>
      ) : (
        <div className="space-y-3.5 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h4 className="text-base font-extrabold text-slate-900">Enter {CODE_LENGTH}-Digit Code</h4>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Sent to <strong className="text-slate-800">{pending.destination}</strong>
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {expiresIn > 0 ? `Code expires in ${clock(expiresIn)}` : "This code has expired. Request a new one."}
            </p>
            {pending.devCode && (
              <p className="mt-1.5 inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                Development only, no SMS provider yet: <span className="font-mono tracking-widest">{pending.devCode}</span>
              </p>
            )}
          </div>
          <div className="flex justify-center gap-2 py-1">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus();
                  if (e.key === "Enter") verify(digits.join(""));
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1}`}
                className="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 text-center text-lg font-black focus:border-rose-500 focus:outline-none sm:h-12 sm:w-12"
              />
            ))}
          </div>
          {liveRegion}
          <button
            type="button"
            onClick={() => verify(digits.join(""))}
            disabled={isPending}
            className="gradient-btn tap-active flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold text-white shadow-md disabled:opacity-60 sm:text-sm"
          >
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Verify & Sign In
          </button>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setNotice(null);
              }}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
            >
              Use a different number or email
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={resendIn > 0 || isPending}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 disabled:text-slate-400"
            >
              {resendIn > 0 ? `Resend code in ${clock(resendIn)}` : "Resend code"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
