import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";

interface PageHeaderProps {
  crumb: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  className?: string;
}

/** Breadcrumb, title and helper text used at the top of listing pages. */
export function PageHeader({ crumb, title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-center",
        className,
      )}
    >
      <div>
        <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-400">
          <Link href="/" className="hover:text-rose-600">
            Home
          </Link>
          <ChevronRight className="h-2.5 w-2.5" />
          <span className="font-bold text-slate-700">{crumb}</span>
        </nav>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      {actions}
    </div>
  );
}
