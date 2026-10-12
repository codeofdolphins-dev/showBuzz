import Link from "next/link";
import { Ticket } from "lucide-react";
import { cn } from "@/lib/cn";

interface BrandLogoProps {
  size?: "sm" | "md";
  withTagline?: boolean;
  className?: string;
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "gradient-btn flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-md",
        className,
      )}
    >
      <Ticket className="h-4 w-4" />
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-black tracking-tight text-slate-900", className)}>
      Show<span className="text-rose-600">Buzz</span>
    </span>
  );
}

export function BrandLogo({ size = "md", withTagline = false, className }: BrandLogoProps) {
  return (
    <Link href="/" className={cn("group tap-active flex items-center gap-2.5", className)}>
      <BrandMark className={size === "md" ? "h-10 w-10 transition-transform group-hover:scale-105" : undefined} />
      <span>
        <span className="flex items-center">
          <BrandWordmark className={size === "md" ? "text-2xl" : "text-lg"} />
        </span>
        {withTagline && (
          <span className="-mt-1 block text-[9px] font-medium text-slate-400">Movies, Events & Experiences</span>
        )}
      </span>
    </Link>
  );
}
