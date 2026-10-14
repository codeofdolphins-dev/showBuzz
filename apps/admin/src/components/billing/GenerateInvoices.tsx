"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button, Select } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { generateInvoicesAction } from "@/app/_actions/billing";

/**
 * Issues a month's invoices to every subscription vendor not yet invoiced for it. Safe to press again: vendors
 * already invoiced for the month are skipped.
 */
export function GenerateInvoices({
  months,
  defaultMonth,
}: {
  months: { value: string; label: string }[];
  defaultMonth: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [month, setMonth] = useState(defaultMonth);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateInvoicesAction(month);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      const { created, alreadyIssued, withoutPlan } = result.data;
      toast.success(
        `${created} invoice${created === 1 ? "" : "s"} issued for ${month}` +
          (alreadyIssued ? `; ${alreadyIssued} already invoiced` : "") +
          ".",
      );
      if (withoutPlan.length) toast.error(`No plan set for: ${withoutPlan.join(", ")}. Set one, then generate again.`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="invoice-month">
        Billing month
      </label>
      <Select id="invoice-month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36">
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>
      <Button type="button" onClick={generate} disabled={pending} className="shrink-0">
        <FileText className="h-4 w-4" aria-hidden />
        {pending ? "Generating…" : "Generate invoices"}
      </Button>
    </div>
  );
}
