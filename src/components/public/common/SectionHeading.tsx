import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface SectionHeadingProps {
  eyebrow: string;
  eyebrowClassName?: string;
  title: string;
  href?: string;
  linkLabel?: string;
}

export function SectionHeading({ eyebrow, eyebrowClassName, title, href, linkLabel = "See All" }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-end justify-between sm:mb-6">
      <div>
        <span className={cn("text-[10px] font-extrabold tracking-wider text-rose-600 uppercase sm:text-xs", eyebrowClassName)}>
          {eyebrow}
        </span>
        <h3 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{title}</h3>
      </div>
      {href && (
        <Link
          href={href}
          className="tap-active flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
        >
          {linkLabel} <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
