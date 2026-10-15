"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useToast } from "@showbuzz/console-ui/Toaster";
import type { ActionOutcome } from "@showbuzz/console-ui/vendor-kyc/KycActions";

interface MoveButtonsProps {
  id: string;
  label: string;
  first: boolean;
  last: boolean;
  action: (input: { id: string; direction: "up" | "down" }) => Promise<ActionOutcome<{ moved: boolean }>>;
}

/** Up / down ordering for small ordered lists (cities, languages, genres, banners). */
export function MoveButtons({ id, label, first, last, action }: MoveButtonsProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const result = await action({ id, direction });
      if (!result.success) toast.error(result.error.message);
      else router.refresh();
    });
  }

  const button =
    "rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo disabled:pointer-events-none disabled:opacity-30";
  return (
    <span className="inline-flex">
      <button type="button" className={button} disabled={first || pending} onClick={() => move("up")} aria-label={`Move ${label} up`}>
        <ArrowUp className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className={button} disabled={last || pending} onClick={() => move("down")} aria-label={`Move ${label} down`}>
        <ArrowDown className="h-4 w-4" aria-hidden />
      </button>
    </span>
  );
}
