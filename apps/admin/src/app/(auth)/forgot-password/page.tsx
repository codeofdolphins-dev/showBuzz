import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { AuthHeader } from "@/components/auth/AuthHeader";

export const metadata: Metadata = { title: "Forgot password" };

/**
 * Stand-in (CLAUDE.md §12): there is no email provider yet, so recovery links can't be sent. A Super Admin
 * resets the password from Staff & Operators and hands over a temporary one.
 */
export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeader
        icon={KeyRound}
        title="Forgot Password"
        subtitle="Password recovery by email isn't available yet."
      />
      <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-admin-active/80 p-4 text-xs">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-admin-indigo" aria-hidden />
        <div className="space-y-1">
          <p className="font-bold text-admin-dark">Ask a Super Admin to reset your password.</p>
          <p className="text-admin-muted">
            They can set a temporary password for your account from Staff &amp; Operators. Sign in with it, then
            choose a new password from your profile.
          </p>
        </div>
      </div>
      <div className="text-center">
        <Link
          href="/login"
          className="flex items-center justify-center gap-1 text-xs font-bold text-admin-indigo hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </>
  );
}
