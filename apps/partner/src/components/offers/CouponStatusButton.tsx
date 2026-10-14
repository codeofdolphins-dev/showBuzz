"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { setCouponStatusAction } from "@/app/_actions/menu-offers";

/** Deactivate (stops being accepted at checkout at once) or reactivate a coupon. */
export function CouponStatusButton({ id, code, active }: { id: string; code: string; active: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run() {
    startTransition(async () => {
      const result = await setCouponStatusAction(id, active ? "inactive" : "active");
      setOpen(false);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(active ? `${code} deactivated.` : `${code} is active again.`);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (active ? setOpen(true) : run())}
        disabled={pending}
        className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo disabled:opacity-60"
        aria-label={active ? `Deactivate ${code}` : `Activate ${code}`}
        title={active ? "Deactivate" : "Activate"}
      >
        <Power className="h-4 w-4" aria-hidden />
      </button>
      <ConfirmDialog
        open={open}
        title={`Deactivate ${code}?`}
        description="Checkout stops accepting it at once. Bookings that already used it keep their discount."
        confirmLabel="Deactivate"
        pending={pending}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
