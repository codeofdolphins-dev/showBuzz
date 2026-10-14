import type { ComponentProps, ReactNode } from "react";
import { cn } from "@showbuzz/utils/cn";

/** Form primitives in the prototype's style (admin.css .form-label / .form-input / .btn). */

export function Label({ className, children, required, ...props }: ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label className={cn("mb-1 block text-[13px] font-semibold text-admin-text", className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-admin-danger">*</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-admin-border bg-white px-3 py-2 text-base text-admin-text placeholder:text-admin-subtle focus:border-admin-indigo focus:ring-3 focus:ring-admin-indigo/15 focus:outline-none sm:text-xs",
        "read-only:bg-slate-50 aria-invalid:border-admin-danger",
        className,
      )}
      {...props}
    />
  );
}

const controlClass =
  "w-full rounded-md border border-admin-border bg-white px-3 py-2 text-base text-admin-text placeholder:text-admin-subtle focus:border-admin-indigo focus:ring-3 focus:ring-admin-indigo/15 focus:outline-none disabled:bg-slate-50 disabled:text-admin-muted aria-invalid:border-admin-danger sm:text-xs";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClass, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-24 read-only:bg-slate-50", className)} {...props} />;
}

export function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="mt-1 text-[11px] font-medium text-admin-danger">
      {messages[0]}
    </p>
  );
}

const buttonStyles = {
  primary: "border-admin-indigo bg-admin-indigo text-white hover:border-admin-indigo-hover hover:bg-admin-indigo-hover",
  secondary: "border-admin-border bg-white text-admin-text hover:border-slate-300 hover:bg-slate-50",
  danger: "border-admin-danger bg-admin-danger text-white hover:border-red-700 hover:bg-red-700",
  ghost: "border-transparent bg-transparent text-admin-muted hover:bg-slate-100 hover:text-admin-dark",
} as const;

export function Button({
  className,
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0",
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Inline error/success message with a live region, so screen readers announce it. */
export function FormMessage({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-xs font-medium",
        tone === "error"
          ? "border-red-200 bg-red-50 text-admin-danger"
          : "border-emerald-200 bg-emerald-50 text-admin-success",
      )}
    >
      {children}
    </div>
  );
}
