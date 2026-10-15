"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { SelectField, TextField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { GENRE_SCOPE_LABELS, genreInputSchema } from "@showbuzz/schemas/master-data";
import { slugify } from "@showbuzz/utils/text";
import { createGenreAction, updateGenreAction } from "@/app/_actions/master-data";

type Input = z.input<typeof genreInputSchema>;
type Output = z.output<typeof genreInputSchema>;

const SCOPE_OPTIONS = Object.entries(GENRE_SCOPE_LABELS).map(([value, label]) => ({
  value,
  label: value === "movie" ? "Movies (genre)" : `${label} (category)`,
}));
const STATUS_OPTIONS = [
  { value: "active", label: "Active (offered in forms)" },
  { value: "inactive", label: "Inactive (listings keep it)" },
];

/** Prototype genres.html: genre name, slug and category (which forms offer it). */
export function GenreForm({ genreId, defaults }: { genreId?: string; defaults?: Input }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(genreId));
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(genreInputSchema),
    defaultValues: defaults ?? { name: "", slug: "", appliesTo: "movie", status: "active" },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const values = form.getValues();
      const result = genreId ? await updateGenreAction(genreId, values) : await createGenreAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(genreId ? "Genre saved." : "Genre added.");
      router.push(`/genres?scope=${values.appliesTo}`);
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <TextField
        label="Name"
        required
        hint={genreId ? "Renaming updates every listing that uses it." : undefined}
        error={errors.name?.message}
        {...form.register("name", {
          onChange: (event: { target: { value: string } }) => {
            if (!slugTouched) form.setValue("slug", slugify(event.target.value, 64));
          },
        })}
      />
      <TextField
        label="Slug"
        required
        error={errors.slug?.message}
        {...form.register("slug", { onChange: () => setSlugTouched(true) })}
      />
      {/* Fixed once created: shown read-only (a disabled select would still be sent by getValues). */}
      {genreId ? (
        <TextField
          label="Used for"
          readOnly
          value={SCOPE_OPTIONS.find((o) => o.value === defaults?.appliesTo)?.label ?? ""}
          hint="Fixed once created."
        />
      ) : (
        <SelectField
          label="Used for"
          options={SCOPE_OPTIONS}
          hint="Movie genres, or the category list of events, plays, sports or activities."
          error={errors.appliesTo?.message}
          {...form.register("appliesTo")}
        />
      )}
      <SelectField
        label="Status"
        options={STATUS_OPTIONS}
        error={errors.status?.message}
        {...form.register("status")}
      />
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : genreId ? "Save genre" : "Add genre"}
        </Button>
      </div>
    </form>
  );
}
