"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import {
  DateTimeField,
  ImageUrlField,
  SelectField,
  TextAreaField,
  TextField,
  Toggle,
  type Option,
} from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { BANNER_ICONS, BANNER_PLACEMENTS, BANNER_TONES, bannerInputSchema } from "@showbuzz/schemas/banner";
import { createBannerAction, updateBannerAction } from "@/app/_actions/marketing";

type Input = z.input<typeof bannerInputSchema>;
type Output = z.output<typeof bannerInputSchema>;

/** Prototype banners.html: a home hero slide with target city, dates, CTA and look. */
export function BannerForm({ bannerId, defaults, cities }: { bannerId?: string; defaults?: Input; cities: Option[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(bannerInputSchema),
    defaultValues: defaults ?? {
      title: "",
      blurb: "",
      badge: "",
      icon: "zap",
      tone: "rose",
      imageUrl: "",
      ctaLabel: "Book Now",
      linkUrl: "/movies",
      placement: "home_hero",
      cityId: "",
      startsAt: "",
      endsAt: "",
      active: true,
    },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const values = form.getValues();
      const result = bannerId ? await updateBannerAction(bannerId, values) : await createBannerAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(bannerId ? "Banner saved." : "Banner added to the home page.");
      router.push("/banners");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Headline" required error={errors.title?.message} {...form.register("title")} />
        <TextField
          label="Badge"
          placeholder="e.g. Blockbuster • IMAX 3D"
          error={errors.badge?.message}
          {...form.register("badge")}
        />
      </div>
      <TextAreaField label="Blurb" rows={2} error={errors.blurb?.message} {...form.register("blurb")} />
      <Controller
        control={form.control}
        name="imageUrl"
        render={({ field }) => (
          <ImageUrlField
            label="Wide image URL"
            required
            hint="images.unsplash.com for now (media storage isn't set up yet). Wide, at least 1600 px."
            value={field.value}
            onChange={field.onChange}
            error={errors.imageUrl?.message}
          />
        )}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Button text"
          required
          error={errors.ctaLabel?.message}
          {...form.register("ctaLabel")}
        />
        <TextField
          label="Button link"
          required
          placeholder="/movies/chrono-nexus-origins"
          hint="A path on showbuzz.com, or an https link."
          error={errors.linkUrl?.message}
          {...form.register("linkUrl")}
        />
        <SelectField label="Badge icon" options={BANNER_ICONS} {...form.register("icon")} />
        <SelectField label="Colour" options={BANNER_TONES} {...form.register("tone")} />
        <SelectField label="Placement" options={BANNER_PLACEMENTS} {...form.register("placement")} />
        <SelectField
          label="Target city"
          options={[{ value: "", label: "All cities" }, ...cities]}
          error={errors.cityId?.message}
          {...form.register("cityId")}
        />
        <Controller
          control={form.control}
          name="startsAt"
          render={({ field }) => (
            <DateTimeField
              label="Show from"
              hint="Optional. IST."
              value={field.value}
              onChange={field.onChange}
              error={errors.startsAt?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="endsAt"
          render={({ field }) => (
            <DateTimeField
              label="Show until"
              hint="Optional. IST."
              value={field.value}
              onChange={field.onChange}
              error={errors.endsAt?.message}
            />
          )}
        />
      </div>
      <Controller
        control={form.control}
        name="active"
        render={({ field }) => (
          <Toggle
            label="Active"
            hint="Switched-off banners stay here but never show on the home page."
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : bannerId ? "Save banner" : "Add banner"}
        </Button>
      </div>
    </form>
  );
}
