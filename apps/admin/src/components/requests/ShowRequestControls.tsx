"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { TextAreaField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage, Label, Select } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { leadNoteSchema } from "@showbuzz/schemas/admin-marketplace";
import { addShowRequestNoteAction, setShowRequestStatusAction } from "@/app/_actions/catalog";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "Under review" },
  { value: "closed", label: "Closed" },
];

export function ShowRequestStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    startTransition(async () => {
      const result = await setShowRequestStatusAction(id, next);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Status updated.");
      router.refresh();
    });
  }

  return (
    <div>
      <Label htmlFor="request-status">Status</Label>
      <Select id="request-status" value={status} disabled={pending} onChange={(e) => change(e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

type NoteInput = z.input<typeof leadNoteSchema>;

export function AddShowRequestNote({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<NoteInput>({ resolver: zodResolver(leadNoteSchema), defaultValues: { text: "" } });

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await addShowRequestNoteAction(id, form.getValues());
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      form.reset({ text: "" });
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <TextAreaField
        label="Add a note"
        placeholder="Called the organiser; sending partner terms…"
        error={form.formState.errors.text?.message}
        {...form.register("text")}
      />
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
