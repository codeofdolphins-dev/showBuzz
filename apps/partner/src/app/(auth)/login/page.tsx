import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { safeNextPath } from "@showbuzz/utils/safe-next";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-admin-border bg-white p-8 shadow-modal">
      <AuthHeader icon={Store} title="ShowBuzz Partner" subtitle="Manage your venues, shows, bookings and earnings" />
      <LoginForm next={safeNextPath(next, "/dashboard")} />
      <div className="space-y-1 border-t border-slate-100 pt-3 text-center text-xs text-admin-muted">
        <p>
          New to ShowBuzz?{" "}
          <Link href="/signup" className="font-bold text-admin-indigo hover:underline">
            Become a partner
          </Link>
        </p>
        <p className="text-[11px] text-admin-subtle">Partner-only portal. Every sign-in is logged.</p>
      </div>
    </div>
  );
}
