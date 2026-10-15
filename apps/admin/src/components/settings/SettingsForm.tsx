"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { MoneyInput, NumberField, SelectField, TextField, type Option } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { settingsInputSchema } from "@showbuzz/schemas/admin-platform";
import { updateSettingsAction } from "@/app/_actions/master-data";

type Input = z.input<typeof settingsInputSchema>;
type Output = z.output<typeof settingsInputSchema>;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-admin-border pb-2">
        <h3 className="text-sm font-bold text-admin-dark">{title}</h3>
        {hint ? <p className="text-[11px] text-admin-subtle">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Prototype settings.html, sections kept: platform contact, box office rules, and the defaults new vendors get.
 * Gateway keys stay out of the database (they belong in the environment); theme, currency and timezone are fixed.
 */
export function SettingsForm({ defaults, cities, canWrite }: { defaults: Input; cities: Option[]; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(settingsInputSchema), defaultValues: defaults });
  const errors = form.formState.errors;
  const percent = { valueAsNumber: true } as const;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await updateSettingsAction(form.getValues());
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("Platform settings saved.");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <fieldset disabled={!canWrite} className="space-y-8">
        <Section title="1. Platform contact" hint="Shown on the public contact page, footer and FAQs.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label="Support email"
              type="email"
              required
              error={errors.supportEmail?.message}
              {...form.register("supportEmail")}
            />
            <TextField
              label="Customer helpline"
              required
              error={errors.supportPhone?.message}
              {...form.register("supportPhone")}
            />
            <SelectField
              label="Default city"
              options={cities}
              hint="Where the city picker starts for a new visitor."
              error={errors.defaultCityId?.message}
              {...form.register("defaultCityId")}
            />
          </div>
        </Section>

        <Section title="2. Box office rules" hint="Apply to every new checkout on showbuzz.com.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label="Max tickets per order"
              min={1}
              max={8}
              hint="Up to 8 (the checkout's hard limit)."
              error={errors.maxTicketsPerOrder?.message}
              {...form.register("maxTicketsPerOrder", percent)}
            />
            <NumberField
              label="Seat hold / cart timeout (minutes)"
              min={3}
              max={30}
              error={errors.seatHoldMinutes?.message}
              {...form.register("seatHoldMinutes", percent)}
            />
          </div>
        </Section>

        <Section
          title="3. Defaults for new vendors"
          hint="Copied to each vendor when it signs up or is created; change a vendor's own terms from its Vendors page. Existing vendors and sold tickets are not affected."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label="Convenience fee (%)"
              step="0.01"
              error={errors.convenienceFeePercent?.message}
              {...form.register("convenienceFeePercent", percent)}
            />
            <NumberField
              label="GST on the fee (%)"
              step="0.01"
              error={errors.gstPercent?.message}
              {...form.register("gstPercent", percent)}
            />
            <NumberField
              label="Commission (%)"
              step="0.01"
              hint="For commission-billed vendors."
              error={errors.commissionPercent?.message}
              {...form.register("commissionPercent", percent)}
            />
            <NumberField
              label="Cancellation cutoff (minutes before the show)"
              min={0}
              error={errors.cancellationCutoffMinutes?.message}
              {...form.register("cancellationCutoffMinutes", percent)}
            />
            <Controller
              control={form.control}
              name="cancellationFeePaise"
              render={({ field }) => (
                <MoneyInput
                  label="Cancellation fee"
                  hint="Also used for bookings made before vendor policies existed."
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? Number.NaN)}
                  error={errors.cancellationFeePaise ? "Enter the fee" : undefined}
                />
              )}
            />
          </div>
        </Section>
      </fieldset>
      {canWrite ? (
        <div className="flex justify-end border-t border-admin-border pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
