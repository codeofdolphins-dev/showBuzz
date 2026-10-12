"use client";

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

interface PendingRequest {
  challengeId: string;
  destination: string;
  devCode?: string;
}

export function AuthModal() {
  const open = useUiStore((s) => s.authModalOpen);
  const closeModal = useUiStore((s) => s.closeAuthModal);
  const signIn = useAuthStore((s) => s.signIn);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [otpError, setOtpError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const form = useForm<OtpRequestInput>({
    // raw: validate here, but submit what was typed; the server parses it into { channel, phone | email }.
    resolver: zodResolver(otpRequestSchema, undefined, { raw: true }),
    defaultValues: { identifier: "", name: undefined },
  });
  const identifier = useWatch({ control: form.control, name: "identifier" }) ?? "";

  const close = () => {
    closeModal();
    setPending(null);
    setDigits(Array(CODE_LENGTH).fill(""));
    setOtpError(undefined);
    form.reset();
  };

  // Move focus to the first OTP box once a code has been sent.
  const challengeId = pending?.challengeId;
  useEffect(() => {
    if (challengeId) boxes.current[0]?.focus();
  }, [challengeId]);

  const sendCode = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await requestOtpAction({
        identifier: values.identifier,
        name: mode === "register" ? values.name : undefined,
      });
      if (!result.success) {
        toast(result.error.message, "error");
        return;
      }
      setPending(result.data);
    });
  });

  const verify = () => {
    if (!pending) return;
    const code = digits.join("");
    if (code.length !== CODE_LENGTH) {
      setOtpError(`Enter the ${CODE_LENGTH}-digit code`);
      return;
    }
    startTransition(async () => {
      const result = await verifyOtpAction({ challengeId: pending.challengeId, code });
      if (!result.success) {
        setOtpError(result.error.message);
        if (result.error.code === "OTP_EXPIRED" || result.error.code === "RATE_LIMITED") setPending(null);
        return;
      }
      signIn(result.data.user);
      toast(`Welcome to ShowBuzz, ${result.data.user.name}!`, "success");
      close();
    });
  };

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasting a full code fills every box.
      const next = clean.slice(0, CODE_LENGTH).split("");
      setDigits([...next, ...Array(CODE_LENGTH - next.length).fill("")]);
      boxes.current[Math.min(next.length, CODE_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((d) => d.map((x, i) => (i === index ? clean : x)));
    setOtpError(undefined);
    if (clean && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
  };

  const IdentifierIcon = identifier.includes("@") ? Mail : Phone;

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
                  if (e.key === "Enter") verify();
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1}`}
                className="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 text-center text-lg font-black focus:border-rose-500 focus:outline-none sm:h-12 sm:w-12"
              />
            ))}
          </div>
          {otpError && <p className="text-[11px] font-medium text-rose-600">{otpError}</p>}
          <button
            type="button"
            onClick={verify}
            disabled={isPending}
            className="gradient-btn tap-active flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold text-white shadow-md disabled:opacity-60 sm:text-sm"
          >
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Verify & Sign In
          </button>
          <button
            type="button"
            onClick={() => setPending(null)}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
          >
            Use a different number or email
          </button>
        </div>
      )}
    </Modal>
  );
}
