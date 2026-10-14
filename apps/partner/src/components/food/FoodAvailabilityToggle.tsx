"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@showbuzz/utils/cn";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { setFoodAvailabilityAction } from "@/app/_actions/menu-offers";

/** In-list on/off switch: an item that runs out comes off the public food step at once. */
export function FoodAvailabilityToggle({ id, name, available }: { id: string; name: string; available: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setFoodAvailabilityAction(id, !available);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(result.data.available ? `${name} is available again.` : `${name} is off the menu.`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={available}
      aria-label={`${name} available`}
      disabled={pending}
      onClick={toggle}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
        available ? "bg-admin-success" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
          available ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
