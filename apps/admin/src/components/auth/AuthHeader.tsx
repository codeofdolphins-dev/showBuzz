import type { LucideIcon } from "lucide-react";

interface AuthHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export function AuthHeader({ icon: Icon, title, subtitle }: AuthHeaderProps) {
  return (
    <div className="space-y-2 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-admin-indigo text-white shadow-md">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="text-2xl font-black tracking-tight text-admin-dark">{title}</h1>
      <p className="text-xs text-admin-muted">{subtitle}</p>
    </div>
  );
}
