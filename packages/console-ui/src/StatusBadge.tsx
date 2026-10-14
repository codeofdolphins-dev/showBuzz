import type { ReactNode } from "react";
import { cn } from "@showbuzz/utils/cn";

/** Pill badges in the prototype's colours (admin.css .badge-*). */

export type StatusTone = "success" | "warning" | "danger" | "info" | "indigo" | "neutral";

const TONES: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-admin-success",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-admin-danger",
  info: "bg-sky-50 text-admin-teal",
  indigo: "bg-admin-active text-admin-indigo",
  neutral: "bg-slate-100 text-admin-muted",
};

/** Common record statuses → tone; anything unknown is neutral. */
const STATUS_TONES: Record<string, StatusTone> = {
  active: "success",
  confirmed: "success",
  complete: "success",
  completed: "success",
  paid: "success",
  published: "success",
  processed: "success",
  succeeded: "success",
  pending: "warning",
  pending_payment: "warning",
  processing: "warning",
  incomplete: "warning",
  draft: "warning",
  suspended: "danger",
  disabled: "danger",
  cancelled: "danger",
  failed: "danger",
  payment_failed: "danger",
  blocked: "danger",
  overdue: "danger",
  expired: "neutral",
  archived: "neutral",
  inactive: "neutral",
  hidden: "neutral",
};

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status] ?? "neutral";
}

/** "pending_payment" → "Pending payment". */
export function statusLabel(status: string): string {
  const text = status.replace(/[_-]+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface StatusBadgeProps {
  /** A record status; tone and label are derived from it unless given. */
  status?: string;
  tone?: StatusTone;
  children?: ReactNode;
  className?: string;
}

export function StatusBadge({ status = "", tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
        TONES[tone ?? statusTone(status)],
        className,
      )}
    >
      {children ?? statusLabel(status)}
    </span>
  );
}
