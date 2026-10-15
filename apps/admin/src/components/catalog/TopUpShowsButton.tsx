"use client";

import { useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { topUpDemoShowsAction } from "@/app/_actions/catalog-tools";

/** Generates the next 7 days of showtimes for the seeded demo cinemas (safe to press again). */
export function TopUpShowsButton() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await topUpDemoShowsAction();
          if (!result.success) toast.error(result.error.message);
          else
            toast.success(
              result.data.created
                ? `${result.data.created} demo shows added for the next 7 days.`
                : "Demo shows were already in place for the next 7 days.",
            );
        })
      }
    >
      <CalendarPlus className="h-4 w-4" aria-hidden /> {pending ? "Generating…" : "Top up demo shows"}
    </Button>
  );
}
