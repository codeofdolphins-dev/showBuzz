"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Card } from "@showbuzz/console-ui/PageParts";
import { MultiSelect, SelectField, TextField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { SCREEN_FORMAT_OPTIONS, screenInputSchema } from "@showbuzz/schemas/partner-venue";
import { addScreenAction, updateScreenAction } from "@/app/_actions/venues";
import { applyActionError } from "@/lib/action-errors";

type ScreenFormInput = z.input<typeof screenInputSchema>;
type ScreenFormOutput = z.output<typeof screenInputSchema>;

const LAYOUT_OPTIONS = [
  { value: "screen", label: "Auditorium (rows facing a screen or stage)" },
  { value: "stadium", label: "Stadium (stands around a pitch)" },
];

interface ScreenFormProps {
  venueId: string;
  /** Editing: the screen id and its current values. */
  screen?: { id: string; values: ScreenFormInput };
}

/** Prototype screens.html columns: name, format, sound system; the seat map comes from the layout designer. */
export function ScreenForm({ venueId, screen }: ScreenFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<ScreenFormInput, unknown, ScreenFormOutput>({
    resolver: zodResolver(screenInputSchema),
    defaultValues: screen?.values ?? { name: "", layoutType: "screen", formats: ["2D"], soundSystem: "" },
  });
  const errors = form.formState.errors;
  const formats = useWatch({ control: form.control, name: "formats" });
  const formatOptions = [...new Set([...SCREEN_FORMAT_OPTIONS, ...formats])].map((f) => ({ value: f, label: f }));

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setMessage(null);
      const result = screen
        ? await updateScreenAction(venueId, screen.id, values)
        : await addScreenAction(venueId, values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      if (screen) {
        toast.success("Screen saved.");
        router.push(`/venues/${venueId}`);
      } else {
        toast.success("Screen added with a starter layout. Shape it to match your auditorium.");
        router.push(`/venues/${venueId}/screens/${result.data.screenId}/layout`);
      }
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card className="max-w-2xl space-y-4 p-6">
        {message ? <FormMessage tone="error">{message}</FormMessage> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Screen / auditorium name"
            required
            placeholder="e.g. Audi 1 (IMAX Laser)"
            error={errors.name?.message}
            {...form.register("name")}
          />
          <SelectField
            label="Layout type"
            required
            options={LAYOUT_OPTIONS}
            error={errors.layoutType?.message}
            {...form.register("layoutType")}
          />
          <TextField
            label="Sound system"
            placeholder="e.g. Dolby Atmos 7.1"
            containerClassName="sm:col-span-2"
            error={errors.soundSystem?.message}
            {...form.register("soundSystem")}
          />
        </div>
        <Controller
          control={form.control}
          name="formats"
          render={({ field }) => (
            <MultiSelect
              label="Formats"
              hint="What this screen can run; shows pick one of these."
              options={formatOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.formats?.message}
            />
          )}
        />
        <div className="flex items-center justify-end gap-3 border-t border-admin-border pt-4">
          <Link
            href={`/venues/${venueId}`}
            className="rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : screen ? "Save screen" : "Add screen"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
