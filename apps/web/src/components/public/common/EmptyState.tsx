import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xs sm:p-12">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
