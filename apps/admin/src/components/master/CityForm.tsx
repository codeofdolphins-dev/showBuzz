"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { SelectField, TextField, Toggle } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { CITY_TIERS, cityInputSchema } from "@showbuzz/schemas/master-data";
import { slugify } from "@showbuzz/utils/text";
import { createCityAction, updateCityAction } from "@/app/_actions/master-data";

type Input = z.input<typeof cityInputSchema>;
type Output = z.output<typeof cityInputSchema>;

const STATUS_OPTIONS = [
  { value: "active", label: "Active (in the city picker)" },
  { value: "inactive", label: "Inactive (hidden)" },
];

/** Prototype cities.html: name, state, classification, popular flag, status. The URL name is fixed once created. */
export function CityForm({ cityId, defaults }: { cityId?: string; defaults?: Input }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(cityId));
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(cityInputSchema),
    defaultValues: defaults ?? { name: "", slug: "", state: "", tier: "tier2", popular: false, status: "active" },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const values = form.getValues();
      const result = cityId ? await updateCityAction(cityId, values) : await createCityAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(cityId ? "City saved." : "City added. It shows in the city picker shortly.");
      router.push("/cities");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="City name"
          required
          error={errors.name?.message}
          {...form.register("name", {
            onChange: (event: { target: { value: string } }) => {
              if (!slugTouched) form.setValue("slug", slugify(event.target.value, 64));
            },
          })}
        />
        <TextField
          label="URL name (city id)"
          required
          readOnly={Boolean(cityId)}
          hint={
            cityId
              ? "Fixed: venues, events and saved choices use it."
              : "Lowercase letters, numbers and dashes. Can't change later."
          }
          error={errors.slug?.message}
          {...form.register("slug", { onChange: () => setSlugTouched(true) })}
        />
        <TextField label="State / region" error={errors.state?.message} {...form.register("state")} />
        <SelectField
          label="Classification"
          options={CITY_TIERS}
          error={errors.tier?.message}
          {...form.register("tier")}
        />
        <SelectField
          label="Status"
          options={STATUS_OPTIONS}
          hint="A city with active venues can't be switched off."
          error={errors.status?.message}
          {...form.register("status")}
        />
      </div>
      <Controller
        control={form.control}
        name="popular"
        render={({ field }) => (
          <Toggle
            label="Popular city"
            hint="Listed at the top of the public city picker."
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : cityId ? "Save city" : "Add city"}
        </Button>
      </div>
    </form>
  );
}
