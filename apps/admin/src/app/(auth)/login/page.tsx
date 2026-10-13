import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { safeNextPath } from "@showbuzz/utils/safe-next";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <AuthHeader icon={Ticket} title="ShowBuzz Admin" subtitle="Multi-City Entertainment Ticketing Operating Console" />
      <LoginForm next={safeNextPath(next, "/dashboard")} />
      <div className="border-t border-slate-100 pt-2 text-center text-[11px] text-admin-subtle">
        Staff-only portal. Every sign-in is logged.
      </div>
    </>
  );
}
