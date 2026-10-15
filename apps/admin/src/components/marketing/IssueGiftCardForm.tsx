"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { MoneyInput, SelectField, TextField, type Option } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { issueGiftCardSchema } from "@showbuzz/schemas/admin-platform";
import { issueGiftCardAction } from "@/app/_actions/marketing";

type Input = z.input<typeof issueGiftCardSchema>;
type Output = z.output<typeof issueGiftCardSchema>;

/**
 * A complimentary gift card (goodwill, contest prize). No delivery provider yet: the code is shown here and staff
 * pass it on. Valid 12 months like every card.
 */
export function IssueGiftCardForm({ designs }: { designs: Option[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ id: string; code: string } | null>(null);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(issueGiftCardSchema),
    defaultValues: {
      amountPaise: 50_000,
      designId: designs[0]?.value ?? "",
      recipientName: "",
      recipientContact: "",
      message: "",
      reason: "",
    },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await issueGiftCardAction(form.getValues());
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("Gift card issued.");
      setIssued(result.data);
    }),
  );

  if (issued) {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">
          Gift card issued. Code:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-admin-dark select-all">{issued.code}</code>.
          Send it to the recipient yourself (no email/SMS provider yet). It is also on the card&apos;s page.
        </FormMessage>
        <div className="flex gap-2">
          <Link
            href={`/gift-cards/${issued.id}`}
            className="rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
          >
            Open the card
          </Link>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setIssued(null);
              form.reset();
            }}
          >
            Issue another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="amountPaise"
          render={({ field }) => (
            <MoneyInput
              label="Amount"
              required
              hint="₹250 to ₹10,000."
              value={field.value}
              onChange={(v) => field.onChange(v ?? Number.NaN)}
              error={errors.amountPaise?.message}
            />
          )}
        />
        <SelectField label="Design" options={designs} error={errors.designId?.message} {...form.register("designId")} />
        <TextField
          label="Recipient name"
          required
          error={errors.recipientName?.message}
          {...form.register("recipientName")}
        />
        <TextField
          label="Recipient email or mobile"
          required
          error={errors.recipientContact?.message}
          {...form.register("recipientContact")}
        />
      </div>
      <TextField label="Message (optional)" maxLength={200} error={errors.message?.message} {...form.register("message")} />
      <TextField
        label="Reason (internal)"
        required
        placeholder="e.g. Goodwill for a cancelled show"
        error={errors.reason?.message}
        {...form.register("reason")}
      />
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Issuing…" : "Issue gift card"}
        </Button>
      </div>
    </form>
  );
}
