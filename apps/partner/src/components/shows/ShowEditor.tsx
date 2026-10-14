"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Ban } from "lucide-react";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { Card } from "@showbuzz/console-ui/PageParts";
import { MoneyInput, SelectField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { showUpdateSchema } from "@showbuzz/schemas/partner-listing";
import type { VendorShowDetail } from "@showbuzz/schemas/types/partner-listing";
import { cancelShowAction, updateShowAction } from "@/app/_actions/shows";
import { applyActionError } from "@/lib/action-errors";

type ShowUpdateInput = z.input<typeof showUpdateSchema>;

/** Price per seat category and format of a show that hasn't started (orders already placed keep their price). */
export function ShowEditor({ show }: { show: VendorShowDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const editable = show.status === "scheduled";

  const form = useForm<ShowUpdateInput>({
    resolver: zodResolver(showUpdateSchema),
    defaultValues: {
      format: show.format,
      prices: show.zones.map((z) => ({ zoneId: z.zoneId, pricePaise: z.pricePaise })),
    },
  });
  const prices = useWatch({ control: form.control, name: "prices" });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setMessage(null);
      const result = await updateShowAction(show.id, values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("Show updated. New bookings use the new prices.");
      router.refresh();
    }),
  );

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Prices & format</h2>
        {message ? <FormMessage tone="error">{message}</FormMessage> : null}
        {show.kind === "movie" ? (
          <SelectField
            label="Screen format"
            required
            disabled={!editable}
            containerClassName="max-w-xs"
            options={show.formatOptions.map((f) => ({ value: f, label: f }))}
            error={form.formState.errors.format?.message}
            {...form.register("format")}
          />
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {show.zones.map((zone, index) => (
            <MoneyInput
              key={zone.zoneId}
              label={zone.name}
              required
              disabled={!editable}
              value={prices[index]?.pricePaise || undefined}
              onChange={(v) =>
                form.setValue(
                  "prices",
                  prices.map((p, i) => (i === index ? { ...p, pricePaise: v ?? 0 } : p)),
                  { shouldDirty: true },
                )
              }
              error={form.formState.errors.prices?.[index]?.pricePaise?.message}
            />
          ))}
        </div>
        {editable ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-admin-subtle">
            {show.status === "cancelled" ? "This show was cancelled." : "This show has started; it can't be changed."}
          </p>
        )}
      </form>
    </Card>
  );
}

/** Cancels a show with no sold seats (the server checks again and explains when bookings must go first). */
export function CancelShowButton({ show }: { show: VendorShowDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  if (show.status !== "scheduled") return null;

  function cancel() {
    startTransition(async () => {
      const result = await cancelShowAction(show.id);
      setOpen(false);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Show cancelled. It's no longer on sale.");
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="danger" disabled={pending} onClick={() => setOpen(true)}>
        <Ban className="h-4 w-4" aria-hidden /> Cancel show
      </Button>
      <ConfirmDialog
        open={open}
        title="Cancel this show?"
        description={
          show.sold > 0
            ? `${show.sold} seats are sold. Cancel those bookings first (they are refunded), then cancel the show.`
            : "It disappears from ShowBuzz at once. Seats in checkout are released and those payments are refunded. This can't be undone."
        }
        confirmLabel="Cancel show"
        cancelLabel="Keep it"
        pending={pending}
        onConfirm={cancel}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
