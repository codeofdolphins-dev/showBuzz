"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { NumberField, SelectField, Toggle } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { vendorTermsSchema } from "@showbuzz/schemas/admin-marketplace";
import { updateVendorTermsAction } from "@/app/_actions/vendors";

type Input = z.input<typeof vendorTermsSchema>;
type Output = z.output<typeof vendorTermsSchema>;

interface VendorTermsFormProps {
  vendorId: string;
  defaults: Input;
  plans: { value: string; label: string }[];
  canWrite: boolean;
}

/**
 * Billing model (subscription or commission, never both), plan, rates and customer-contact sharing. Booked orders
 * keep the split frozen at purchase; the next quote uses the new terms.
 */
export function VendorTermsForm({ vendorId, defaults, plans, canWrite }: VendorTermsFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(vendorTermsSchema), defaultValues: defaults });
  const errors = form.formState.errors;
  const billingModel = useWatch({ control: form.control, name: "billingModel" });

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await updateVendorTermsAction(vendorId, form.getValues());
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("Terms saved. They apply to new orders.");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <fieldset disabled={!canWrite} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Billing model"
          required
          options={[
            { value: "commission", label: "Commission on each sale" },
            { value: "subscription", label: "Monthly subscription" },
          ]}
          hint="One or the other, never both."
          error={errors.billingModel?.message}
          {...form.register("billingModel")}
        />
        {billingModel === "subscription" ? (
          <SelectField
            label="Plan"
            required
            options={plans}
            placeholder={plans.length ? "Choose a plan" : "No active plans: create one under Plans"}
            error={errors.planId?.message}
            {...form.register("planId")}
          />
        ) : (
          <NumberField
            label="Commission (%)"
            required
            step="0.01"
            min={0}
            max={50}
            hint="Of ticket + food sales after discounts."
            error={errors.commissionPercent?.message}
            {...form.register("commissionPercent", { valueAsNumber: true })}
          />
        )}
        <NumberField
          label="Convenience fee (%)"
          required
          step="0.01"
          min={0}
          max={30}
          hint="Charged to customers on online orders; kept by ShowBuzz."
          error={errors.convenienceFeePercent?.message}
          {...form.register("convenienceFeePercent", { valueAsNumber: true })}
        />
        <NumberField
          label="GST on the fee (%)"
          required
          step="0.01"
          min={0}
          max={28}
          error={errors.gstPercent?.message}
          {...form.register("gstPercent", { valueAsNumber: true })}
        />
        <Controller
          control={form.control}
          name="shareCustomerContact"
          render={({ field }) => (
            <Toggle
              label="Share customer contact details"
              hint="Off: the vendor sees booking code, seats and amount only. On: also the customer's name, phone and email."
              value={field.value}
              onChange={field.onChange}
              containerClassName="sm:col-span-2"
            />
          )}
        />
      </fieldset>
      {canWrite ? (
        <div className="flex justify-end border-t border-admin-border pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save terms"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
