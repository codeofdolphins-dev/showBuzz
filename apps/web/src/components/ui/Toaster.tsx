"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { useUiStore, type ToastTone } from "@/stores/ui";

const TONES: Record<ToastTone, { icon: typeof Info; className: string; iconClass: string }> = {
  success: { icon: CircleCheck, className: "border-emerald-500 shadow-emerald-500/15", iconClass: "text-emerald-500" },
  error: { icon: CircleAlert, className: "border-rose-500 shadow-rose-500/15", iconClass: "text-rose-500" },
  warning: { icon: TriangleAlert, className: "border-amber-500 shadow-amber-500/15", iconClass: "text-amber-500" },
  info: { icon: Info, className: "border-blue-500 shadow-blue-500/15", iconClass: "text-blue-500" },
};

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 left-1/2 z-[2000] flex w-full max-w-xs -translate-x-1/2 flex-col gap-2 px-4 sm:top-auto sm:right-5 sm:bottom-5 sm:left-auto sm:max-w-sm sm:translate-x-0 sm:px-0"
    >
      {toasts.map((t) => {
        const tone = TONES[t.tone];
        const Icon = tone.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex animate-fade-in items-start gap-3 rounded-2xl border bg-white p-3.5 text-slate-800 shadow-2xl sm:p-4",
              tone.className,
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", tone.iconClass)} />
            <div className="flex-1">
              {t.title && <h4 className="text-xs font-bold text-slate-900 sm:text-sm">{t.title}</h4>}
              <p className="text-xs leading-relaxed font-medium text-slate-600">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="p-1 text-slate-400 transition-colors hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
