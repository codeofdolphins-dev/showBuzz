"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";

/**
 * Console toasts (no dependency). ConsoleShell includes the provider; pages outside the shell (sign-in, onboarding)
 * wrap themselves in <ToastProvider>. Messages are announced through a polite live region.
 */

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = { success: 4000, info: 4000, error: 7000 } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), DURATION_MS[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 lg:right-6 lg:bottom-6 lg:left-auto lg:items-end"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const;
const TONES = {
  success: "border-emerald-200 text-admin-success",
  error: "border-red-200 text-admin-danger",
  info: "border-indigo-200 text-admin-indigo",
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICONS[toast.tone];
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-white p-3 shadow-dropdown",
        TONES[toast.tone],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1 text-xs font-medium text-admin-text">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-admin-subtle hover:text-admin-dark"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
