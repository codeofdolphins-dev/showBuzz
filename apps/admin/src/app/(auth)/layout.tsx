import type { ReactNode } from "react";

/** Sign-in pages: one centred card, no console chrome (prototype login.html / forgot-password.html). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-admin-surface p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-admin-border bg-white p-8 shadow-modal">
        {children}
      </div>
    </main>
  );
}
