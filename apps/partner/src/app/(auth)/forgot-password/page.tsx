import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AuthHeader } from "@/components/auth/AuthHeader";

export const metadata: Metadata = { title: "Forgot password" };

/**
 * Stand-in until an email provider exists (CLAUDE.md §12): no reset link can be sent, so ShowBuzz support sets a
 * temporary password from the admin console (vendor password reset, back-office prompt 6).
 */
export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-admin-border bg-white p-8 shadow-modal">
      <AuthHeader icon={KeyRound} title="Forgot your password?" subtitle="We can't email reset links yet" />
      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        <p className="font-bold">Contact ShowBuzz partner support</p>
        <p>
          Ask your ShowBuzz account manager to reset your password. You&apos;ll get a temporary password; change it from
          My Profile after signing in.
        </p>
      </div>
      <Link href="/login" className="block text-center text-xs font-bold text-admin-indigo hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
