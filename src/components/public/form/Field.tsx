import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-medium text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none aria-[invalid=true]:border-rose-400";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ id, label, error, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block font-bold text-slate-700">
        {label}
      </label>
      {children}
      {error && <p className={cn("mt-1 text-[11px] font-medium text-rose-600")}>{error}</p>}
    </div>
  );
}
