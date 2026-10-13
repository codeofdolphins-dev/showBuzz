import type { ReactNode } from "react";
import Link from "next/link";
import { Construction, FlaskConical, Lock } from "lucide-react";

/** Breadcrumb + title row used at the top of console pages (prototype profile.html / dashboard.html). */
export function PageHeader({ title, subtitle, crumb, actions }: {
  title: string;
  subtitle?: string;
  crumb?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div>
        {crumb ? (
          <div className="mb-1 flex items-center gap-2 text-xs text-admin-subtle">
            <Link href="/dashboard" className="hover:text-admin-indigo">
              Dashboard
            </Link>
            <span>/</span>
            <span className="font-semibold text-admin-dark">{crumb}</span>
          </div>
        ) : null}
        <h1 className="text-xl font-black tracking-tight text-admin-dark lg:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-admin-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-admin-border bg-white shadow-card ${className}`}>{children}</div>;
}

/** Marks placeholder numbers until real data lands (agreed: dashboard shows labelled sample data). */
export function SampleBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
      <FlaskConical className="h-3 w-3" aria-hidden />
      Sample data
    </span>
  );
}

/** Shared placeholder for menu pages whose screens come in later batches. */
export function ComingSoon({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <PageHeader title={title} crumb={title} />
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-admin-active text-admin-indigo">
          <Construction className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="text-base font-bold text-admin-dark">Coming soon</h2>
        <p className="max-w-md text-xs text-admin-muted">
          This screen is part of a later build phase. The menu, permissions and route are already in place.
        </p>
      </Card>
      {children}
    </>
  );
}

/** Shown when the staff member's role doesn't grant the page (the server decides; the link may still be typed). */
export function NoAccess({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} crumb={title} />
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-admin-danger">
          <Lock className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="text-base font-bold text-admin-dark">You don&apos;t have access to this page</h2>
        <p className="max-w-md text-xs text-admin-muted">Ask a Super Admin if your role should include it.</p>
      </Card>
    </>
  );
}
