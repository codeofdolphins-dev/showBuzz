"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { createSettlementAction } from "@/app/_actions/billing";

interface CreateSettlementButtonProps {
  range: { vendorId: string; fromDate: string; toDate: string };
  /** What the admin is looking at: the save fails if the bookings changed since. */
  expected: { bookings: number; clawbacks: number; netPayoutPaise: number };
}

export function CreateSettlementButton({ range, expected }: CreateSettlementButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createSettlementAction(range, expected);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      toast.success(`Payout ${result.data.code} created. Mark it paid once the transfer is done.`);
      router.push(`/settlements/${result.data.id}`);
    });
  }

  return (
    <div className="space-y-2">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="button" onClick={create} disabled={pending}>
        <Wallet className="h-4 w-4" aria-hidden />
        {pending ? "Creating…" : "Create payout"}
      </Button>
    </div>
  );
}
