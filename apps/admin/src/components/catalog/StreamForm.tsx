"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import {
  ImageUrlField,
  MoneyInput,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  Toggle,
} from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { STREAM_CATEGORIES, streamTitleInputSchema } from "@showbuzz/schemas/admin-catalog";
import { createStreamAction, updateStreamAction } from "@/app/_actions/catalog-tools";

type Input = z.input<typeof streamTitleInputSchema>;
type Output = z.output<typeof streamTitleInputSchema>;

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const EMPTY: Input = {
  title: "",
  slug: "",
  category: "Movie",
  badge: "",
  rentPricePaise: 14_900,
  buyPricePaise: 49_900,
  durationMinutes: 120,
  rating: 0,
  poster: "",
  description: "",
  featured: false,
  status: "active",
};

/** Prototype streaming.html, with the fields /stream shows: rent and buy prices, running time, poster, badge. */
export function StreamForm({ streamId, defaults }: { streamId?: string; defaults?: Input }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(streamTitleInputSchema),
    defaultValues: defaults ?? EMPTY,
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setMessage(null);
      const result = streamId ? await updateStreamAction(streamId, values) : await createStreamAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(streamId ? "Title saved." : "Title added to /stream.");
      router.push("/streaming");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Title"
          required
          error={errors.title?.message}
          {...form.register("title", {
            onBlur: (e: { target: { value: string } }) => {
              if (!form.getValues("slug")) form.setValue("slug", slugify(e.target.value));
            },
          })}
        />
        <TextField
          label="Slug"
          required
          hint="Lowercase words and dashes, unique."
          error={errors.slug?.message}
          {...form.register("slug")}
        />
        <SelectField
          label="Category"
          options={STREAM_CATEGORIES.map((c) => ({ value: c, label: c }))}
          error={errors.category?.message}
          {...form.register("category")}
        />
        <TextField
          label="Badge"
          placeholder="e.g. New, 4K HDR"
          error={errors.badge?.message}
          {...form.register("badge")}
        />
        <Controller
          control={form.control}
          name="rentPricePaise"
          render={({ field }) => (
            <MoneyInput
              label="Rent price (30 days)"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.rentPricePaise?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="buyPricePaise"
          render={({ field }) => (
            <MoneyInput
              label="Buy price"
              hint="₹0 = rent only."
              value={field.value}
              onChange={field.onChange}
              error={errors.buyPricePaise?.message}
            />
          )}
        />
        <NumberField
          label="Running time (minutes)"
          required
          min={1}
          error={errors.durationMinutes?.message}
          {...form.register("durationMinutes", { valueAsNumber: true })}
        />
        <NumberField
          label="Rating (out of 10)"
          min={0}
          max={10}
          step={0.1}
          error={errors.rating?.message}
          {...form.register("rating", { valueAsNumber: true })}
        />
      </div>
      <Controller
        control={form.control}
        name="poster"
        render={({ field }) => (
          <ImageUrlField
            label="Poster"
            required
            aspect="aspect-[2/3]"
            hint="An images.unsplash.com URL, or Copy URL in the Media Library."
            value={field.value}
            onChange={field.onChange}
            error={errors.poster?.message}
          />
        )}
      />
      <TextAreaField
        label="Description"
        required
        rows={4}
        error={errors.description?.message}
        {...form.register("description")}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Controller
          control={form.control}
          name="featured"
          render={({ field }) => (
            <Toggle
              label="Featured"
              hint="Shown as the large hero at the top of /stream."
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Toggle
              label="Active"
              hint="Switched-off titles stay here but are hidden on /stream."
              value={field.value === "active"}
              onChange={(on) => field.onChange(on ? "active" : "inactive")}
            />
          )}
        />
      </div>
      <p className="text-[11px] text-admin-subtle">
        Streaming checkout isn&apos;t built yet: the Rent and Buy buttons on /stream show &ldquo;coming soon&rdquo;.
      </p>
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : streamId ? "Save title" : "Add title"}
        </Button>
      </div>
    </form>
  );
}
