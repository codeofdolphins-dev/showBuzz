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
import { languageInputSchema } from "@showbuzz/schemas/master-data";
import { createLanguageAction, updateLanguageAction } from "@/app/_actions/master-data";

type Input = z.input<typeof languageInputSchema>;
type Output = z.output<typeof languageInputSchema>;

const STATUS_OPTIONS = [
  { value: "active", label: "Active (offered in movie forms)" },
  { value: "inactive", label: "Inactive (films keep it)" },
];

/** Prototype languages.html: language and native script. Renaming updates every film, event and show using it. */
export function LanguageForm({ languageId, defaults }: { languageId?: string; defaults?: Input }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(languageInputSchema),
    defaultValues: defaults ?? { name: "", nativeName: "", status: "active" },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const values = form.getValues();
      const result = languageId ? await updateLanguageAction(languageId, values) : await createLanguageAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(languageId ? "Language saved." : "Language added.");
      router.push("/languages");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <TextField
        label="Language"
        required
        hint={languageId ? "Renaming updates every film, event and show that uses it." : undefined}
        error={errors.name?.message}
        {...form.register("name")}
      />
      <TextField
        label="Native script"
        placeholder="e.g. বাংলা"
        error={errors.nativeName?.message}
        {...form.register("nativeName")}
      />
      <SelectField
        label="Status"
        options={STATUS_OPTIONS}
        error={errors.status?.message}
        {...form.register("status")}
      />
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : languageId ? "Save language" : "Add language"}
        </Button>
      </div>
    </form>
  );
}
