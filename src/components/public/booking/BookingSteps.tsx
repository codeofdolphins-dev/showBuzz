import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

const STEPS = ["Seats", "Food", "Checkout", "Pay"] as const;
export type BookingStep = (typeof STEPS)[number];

export function BookingSteps({ current }: { current: BookingStep }) {
  const currentIndex = STEPS.indexOf(current);
  return (
    <ol className="mx-auto mb-6 flex max-w-xl items-center justify-between text-[11px] font-bold text-slate-400 sm:text-xs">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <Fragment key={step}>
            {i > 0 && <li aria-hidden className={cn("h-0.5 w-8 sm:w-12", i <= currentIndex ? "bg-emerald-500" : "bg-slate-200")} />}
            <li
              aria-current={active ? "step" : undefined}
              className={cn("flex items-center gap-1.5", done && "text-emerald-600", active && "text-rose-600")}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                  done ? "bg-emerald-100" : active ? "bg-rose-100 text-rose-600" : "bg-slate-100",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span>{step}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
