"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { MoneyInput, TextField, Toggle } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { planInputSchema } from "@showbuzz/schemas/admin-marketplace";
import { createPlanAction, updatePlanAction } from "@/app/_actions/billing";

type Input = z.input<typeof planInputSchema>;
type Output = z.output<typeof planInputSchema>;

/** Subscription plan: name, monthly fee (₹ → paise) and whether it can be assigned to vendors. */
export function PlanForm({ planId, defaults }: { planId?: string; defaults?: Input }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(planInputSchema),
    defaultValues: defaults ?? { name: "", monthlyFeePaise: 0, active: true },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const values = form.getValues();
      const result = planId ? await updatePlanAction(planId, values) : await createPlanAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(planId ? "Plan saved." : "Plan created.");
      router.push("/plans");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <TextField label="Plan name" required error={errors.name?.message} {...form.register("name")} />
      <Controller
        control={form.control}
        name="monthlyFeePaise"
        render={({ field }) => (
          <MoneyInput
            label="Monthly fee"
            required
            hint="Invoiced each month to vendors on this plan (new invoices only; issued ones keep their amount)."
            value={field.value}
            onChange={(v) => field.onChange(v ?? Number.NaN)}
            error={errors.monthlyFeePaise ? "Enter the monthly fee" : undefined}
          />
        )}
      />
      <Controller
        control={form.control}
        name="active"
        render={({ field }) => (
          <Toggle
            label="Active"
            hint="Inactive plans can't be assigned to more vendors; vendors already on them keep them."
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : planId ? "Save plan" : "Create plan"}
        </Button>
      </div>
    </form>
  );
}
