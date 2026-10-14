import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@showbuzz/utils/cn";

/** A link styled like the console Button (primary / secondary). */
export function LinkButton({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-xs font-bold transition-colors sm:min-h-0",
        variant === "primary"
          ? "border-admin-indigo bg-admin-indigo text-white hover:bg-admin-dark"
          : "border-admin-border bg-white text-admin-text hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      {children}
    </Link>
  );
}
