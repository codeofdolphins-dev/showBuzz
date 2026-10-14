"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { cn } from "@showbuzz/utils/cn";
import { formatINR } from "@showbuzz/utils/money";
import { Card } from "@showbuzz/console-ui/PageParts";
import { MoneyInput, NumberField, Toggle } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { CUTOFF_PRESETS, vendorPolicyInputSchema } from "@showbuzz/schemas/partner-box-office";
import { describeCutoff } from "@showbuzz/schemas/vendor";
import { updatePolicyAction } from "@/app/_actions/menu-offers";
import { applyActionError } from "@/lib/action-errors";

type PolicyInput = z.input<typeof vendorPolicyInputSchema>;
type PolicyOutput = z.output<typeof vendorPolicyInputSchema>;

/** The vendor's cancellation policy: allowed or not, cutoff before the show, fee kept. Applies to new bookings. */
export function PolicyForm({ policy }: { policy: PolicyInput }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<PolicyInput, unknown, PolicyOutput>({
    resolver: zodResolver(vendorPolicyInputSchema),
    defaultValues: policy,
  });
  const errors = form.formState.errors;
  const values = useWatch({ control: form.control });

  const onSubmit = form.handleSubmit((data) =>
    startTransition(async () => {
      setMessage(null);
      const result = await updatePolicyAction(data);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("Cancellation policy saved. It applies to bookings made from now on.");
      form.reset(data);
      router.refresh();
    }),
  );

  const preview = values.allowed
    ? `Cancellable ${describeCutoff(values.cutoffMinutes ?? 0)}. A fee of ${formatINR(values.feePaise ?? 0)} per booking is kept.`
    : "Non-cancellable. Tickets can't be cancelled by customers.";

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="space-y-5 p-6 lg:col-span-2">
        {message ? <FormMessage tone="error">{message}</FormMessage> : null}
        <Controller
          control={form.control}
          name="allowed"
          render={({ field }) => (
            <Toggle
              label="Customers can cancel"
              hint="Off = every new booking of yours is non-cancellable."
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <fieldset disabled={!values.allowed} className="space-y-5 disabled:opacity-60">
          <div>
            <p className="mb-1 text-[13px] font-semibold text-admin-text">Cutoff before the show</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {CUTOFF_PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  type="button"
                  onClick={() => form.setValue("cutoffMinutes", p.minutes, { shouldDirty: true, shouldValidate: true })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold",
                    values.cutoffMinutes === p.minutes
                      ? "border-admin-indigo bg-admin-active text-admin-indigo"
                      : "border-admin-border text-admin-muted hover:border-slate-300",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <NumberField
              label="Minutes before the show"
              min={0}
              step={5}
              containerClassName="max-w-xs"
              hint="0 = until the show starts. Up to 7 days (10080)."
              error={errors.cutoffMinutes?.message}
              {...form.register("cutoffMinutes", { valueAsNumber: true })}
            />
          </div>
          <Controller
            control={form.control}
            name="feePaise"
            render={({ field }) => (
              <MoneyInput
                label="Cancellation fee per booking"
                hint="Kept from the refund. ₹0 = full refund."
                containerClassName="max-w-xs"
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
                error={errors.feePaise?.message}
              />
            )}
          />
        </fieldset>
        <div className="flex justify-end border-t border-admin-border pt-4">
          <Button type="submit" disabled={pending || !form.formState.isDirty}>
            {pending ? "Saving…" : "Save policy"}
          </Button>
        </div>
      </Card>
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-bold tracking-wider text-admin-subtle uppercase">Customers see</p>
        <p className="text-sm font-semibold text-admin-dark">{preview}</p>
        <p className="text-[11px] text-admin-muted">
          Shown on your cinema and event pages, at checkout and on tickets. Bookings already made keep the policy they
          were sold under.
        </p>
      </Card>
    </form>
  );
}
