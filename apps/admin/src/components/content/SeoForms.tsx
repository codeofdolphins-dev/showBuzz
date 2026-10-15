"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { ImageUrlField, TextAreaField, TextField, Toggle } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { seoEntryInputSchema, seoGlobalSchema } from "@showbuzz/schemas/site-content";
import { createSeoEntryAction, saveSeoGlobalAction, updateSeoEntryAction } from "@/app/_actions/marketing";

type GlobalInput = z.input<typeof seoGlobalSchema>;

/** Prototype seo.html "Global Search Console Directives": the default title and description of every page. */
export function SeoGlobalForm({ defaults, canWrite }: { defaults: GlobalInput; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<GlobalInput>({ resolver: zodResolver(seoGlobalSchema), defaultValues: defaults });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await saveSeoGlobalAction(form.getValues());
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("SEO defaults saved.");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <fieldset disabled={!canWrite} className="space-y-4">
        <TextField
          label="Global title tag"
          required
          hint="The home page title, and the default for pages without their own."
          error={errors.title?.message}
          {...form.register("title")}
        />
        <TextAreaField
          label="Global meta description"
          required
          rows={3}
          error={errors.description?.message}
          {...form.register("description")}
        />
      </fieldset>
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save SEO settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

type EntryInput = z.input<typeof seoEntryInputSchema>;
type EntryOutput = z.output<typeof seoEntryInputSchema>;

/** Overrides for one page or listing; empty fields keep the page's own title, description and image. */
export function SeoEntryForm({ entryId, defaults }: { entryId?: string; defaults?: EntryInput }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<EntryInput, unknown, EntryOutput>({
    resolver: zodResolver(seoEntryInputSchema),
    defaultValues: defaults ?? { path: "", title: "", description: "", ogImage: "", noindex: false },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const values = form.getValues();
      const result = entryId ? await updateSeoEntryAction(entryId, values) : await createSeoEntryAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("SEO settings saved.");
      router.push("/seo");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <TextField
        label="Page path"
        required
        placeholder="/movies/chrono-nexus-origins"
        hint="A path on showbuzz.com: /, /movies, /events, /about, /movies/<slug>, /events/<slug>…"
        error={errors.path?.message}
        {...form.register("path")}
      />
      <TextField
        label="Title"
        hint="Empty = the page's own title. Under 70 characters."
        error={errors.title?.message}
        {...form.register("title")}
      />
      <TextAreaField
        label="Meta description"
        rows={3}
        hint="Empty = the page's own description."
        error={errors.description?.message}
        {...form.register("description")}
      />
      <Controller
        control={form.control}
        name="ogImage"
        render={({ field }) => (
          <ImageUrlField
            label="Share image (Open Graph)"
            hint="Optional https image shown when the link is shared."
            value={field.value}
            onChange={field.onChange}
            error={errors.ogImage?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="noindex"
        render={({ field }) => (
          <Toggle
            label="Hide from search engines (noindex)"
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : entryId ? "Save" : "Add SEO settings"}
        </Button>
      </div>
    </form>
  );
}
