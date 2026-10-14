import type { ReactNode } from "react";

/** Sign-in and signup pages: centred, no portal chrome. Each page sets its own card width. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-admin-surface p-4 py-10">{children}</main>;
}
