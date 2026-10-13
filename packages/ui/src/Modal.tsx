"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Bottom sheet on phones, centred dialog from `sm` up. */
  sheetOnMobile?: boolean;
  className?: string;
  tone?: "light" | "dark";
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  sheetOnMobile = true,
  className,
  tone = "light",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[1000] flex animate-fade-in justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4",
        sheetOnMobile ? "items-end" : "items-center p-4",
      )}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-2xl sm:rounded-3xl sm:p-8",
          sheetOnMobile ? "animate-slide-up rounded-t-3xl sm:animate-fade-in" : "rounded-3xl",
          tone === "dark" ? "bg-slate-900 text-white" : "bg-white",
          className,
        )}
      >
        {sheetOnMobile && <div className="bottom-sheet-handle sm:hidden" />}
        {(title || description) && (
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              {title && <h3 className="text-lg font-black text-slate-900 sm:text-xl">{title}</h3>}
              {description && <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 tap-active items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
