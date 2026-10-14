"use client";

import { useEffect, useId, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./form";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive or irreversible actions (cancel, suspend, delete). */
  tone?: "danger" | "primary";
  /** While the action runs: buttons disabled, label shows progress. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content, e.g. a required reason field. */
  children?: ReactNode;
}

/** "Are you sure?" dialog for status changes and other actions that are hard to undo. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  pending = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !pending && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close"
        onClick={() => !pending && onCancel()}
      />
      <div className="relative w-full max-w-md space-y-4 rounded-2xl border border-admin-border bg-white p-6 shadow-modal">
        <div className="flex gap-3">
          <span
            className={
              tone === "danger"
                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-admin-danger"
                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-admin-active text-admin-indigo"
            }
          >
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 id={titleId} className="text-sm font-bold text-admin-dark">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="text-xs text-admin-muted">
                {description}
              </div>
            ) : null}
          </div>
        </div>
        {children}
        <div className="flex justify-end gap-2 border-t border-admin-border pt-4">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={tone} onClick={onConfirm} disabled={pending} autoFocus>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
