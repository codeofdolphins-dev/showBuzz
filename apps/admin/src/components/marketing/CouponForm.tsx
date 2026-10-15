"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import {
  DateTimeField,
  MoneyInput,
  MultiSelect,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  Toggle,
} from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { Card } from "@showbuzz/console-ui/PageParts";
import { useToast } from "@showbuzz/console-ui/Toaster";
import {
  OFFER_ICON_LABELS,
  PLATFORM_COUPON_GRADIENTS,
  platformCouponInputSchema,
} from "@showbuzz/schemas/admin-platform";
import { MOVIE_FORMAT_OPTIONS } from "@showbuzz/schemas/partner-listing";
import { createCouponAction, updateCouponAction } from "@/app/_actions/marketing";

type Input = z.input<typeof platformCouponInputSchema>;
type Output = z.output<typeof platformCouponInputSchema>;

const optionalNumber = (value: unknown) =>
  value === "" || value === null || value === undefined || Number.isNaN(value) ? undefined : Number(value);

const KIND_OPTIONS = [
  { value: "percent", label: "Percentage off" },
  { value: "flat", label: "Flat amount off" },
  { value: "bogo", label: "Buy 1 get 1 (cheapest ticket free)" },
];
const APPLIES_OPTIONS = [
  { value: "tickets", label: "Ticket value" },
  { value: "food", label: "Food & beverages" },
];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive (never accepted)" },
];
const ICON_OPTIONS = Object.entries(OFFER_ICON_LABELS).map(([value, label]) => ({ value, label }));
const FORMAT_OPTIONS = MOVIE_FORMAT_OPTIONS.map((f) => ({ value: f, label: f }));

/**
 * Prototype coupons.html "Create Promo Code", with everything checkout enforces: discount, cap, minimum order,
 * validity, usage limits, eligible formats, weekend-only and minimum tickets, plus the /offers card (category,
 * icon, colour, terms). Platform coupons apply on every vendor's shows.
 */
export function CouponForm({ couponId, defaults, used = 0 }: { couponId?: string; defaults?: Input; used?: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(platformCouponInputSchema),
    defaultValues: defaults ?? {
      code: "",
      title: "",
      category: "",
      description: "",
      kind: "percent",
      percentOff: 10,
      minOrderPaise: 0,
      appliesTo: "tickets",
      eligibleFormats: [],
      weekendOnly: false,
      bank: "",
      validFrom: "",
      validUntil: "",
      icon: "tags",
      gradient: PLATFORM_COUPON_GRADIENTS[0].value,
      terms: [],
      status: "active",
    },
  });
  const errors = form.formState.errors;
  const kind = useWatch({ control: form.control, name: "kind" });

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const values = form.getValues();
      const result = couponId ? await updateCouponAction(couponId, values) : await createCouponAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(couponId ? "Coupon saved." : "Coupon created. It's on /offers shortly.");
      router.push("/coupons");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">1. Code & discount</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TextField
            label="Coupon code"
            required
            readOnly={used > 0}
            hint={used > 0 ? `Used ${used} time(s): the code can't change.` : "3–20 letters or digits, upper case."}
            className="font-mono uppercase"
            error={errors.code?.message}
            {...form.register("code", { setValueAs: (v: string) => v.toUpperCase().trim() })}
          />
          <SelectField label="Discount type" options={KIND_OPTIONS} {...form.register("kind")} />
          <SelectField
            label="Applies to"
            options={APPLIES_OPTIONS}
            error={errors.appliesTo?.message}
            {...form.register("appliesTo")}
          />
          {kind === "percent" ? (
            <NumberField
              label="Percent off"
              step="0.01"
              error={errors.percentOff?.message}
              {...form.register("percentOff", { setValueAs: optionalNumber })}
            />
          ) : null}
          {kind === "flat" ? (
            <Controller
              control={form.control}
              name="flatPaise"
              render={({ field }) => (
                <MoneyInput
                  label="Amount off"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.flatPaise?.message}
                />
              )}
            />
          ) : null}
          {kind !== "flat" ? (
            <Controller
              control={form.control}
              name="maxDiscountPaise"
              render={({ field }) => (
                <MoneyInput
                  label="Maximum discount"
                  hint="Empty = no cap."
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.maxDiscountPaise?.message}
                />
              )}
            />
          ) : null}
          <Controller
            control={form.control}
            name="minOrderPaise"
            render={({ field }) => (
              <MoneyInput
                label="Minimum order amount"
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
                error={errors.minOrderPaise?.message}
              />
            )}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">2. Validity & limits</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Controller
            control={form.control}
            name="validFrom"
            render={({ field }) => (
              <DateTimeField
                label="Valid from"
                hint="Optional. IST."
                value={field.value}
                onChange={field.onChange}
                error={errors.validFrom?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="validUntil"
            render={({ field }) => (
              <DateTimeField
                label="Valid until"
                required
                value={field.value}
                onChange={field.onChange}
                error={errors.validUntil?.message}
              />
            )}
          />
          <NumberField
            label="Total uses allowed"
            hint="Empty = unlimited. Counted when bookings are confirmed."
            error={errors.usageLimit?.message}
            {...form.register("usageLimit", { setValueAs: optionalNumber })}
          />
          <NumberField
            label="Uses per customer"
            hint="Empty = unlimited."
            error={errors.perCustomerLimit?.message}
            {...form.register("perCustomerLimit", { setValueAs: optionalNumber })}
          />
          <NumberField
            label="Minimum tickets"
            hint="Optional."
            error={errors.minTickets?.message}
            {...form.register("minTickets", { setValueAs: optionalNumber })}
          />
          <TextField
            label="Bank / card (label only)"
            placeholder="e.g. HDFC Bank Credit Cards"
            error={errors.bank?.message}
            {...form.register("bank")}
          />
        </div>
        <Controller
          control={form.control}
          name="eligibleFormats"
          render={({ field }) => (
            <MultiSelect
              label="Only these formats"
              hint="None selected = every format."
              options={FORMAT_OPTIONS}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="weekendOnly"
          render={({ field }) => (
            <Toggle
              label="Weekend showtimes only"
              hint="Friday to Sunday shows."
              value={field.value ?? false}
              onChange={field.onChange}
            />
          )}
        />
        <SelectField
          label="Status"
          options={STATUS_OPTIONS}
          containerClassName="max-w-xs"
          {...form.register("status")}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">3. Offer card on /offers</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Title" required error={errors.title?.message} {...form.register("title")} />
          <TextField
            label="Category"
            required
            placeholder="e.g. UPI, Credit Cards, First Time Users"
            error={errors.category?.message}
            {...form.register("category")}
          />
          <SelectField label="Icon" options={ICON_OPTIONS} {...form.register("icon")} />
          <SelectField label="Card colour" options={PLATFORM_COUPON_GRADIENTS} {...form.register("gradient")} />
        </div>
        <TextAreaField
          label="Description"
          required
          rows={2}
          error={errors.description?.message}
          {...form.register("description")}
        />
        <Controller
          control={form.control}
          name="terms"
          render={({ field }) => (
            <TextAreaField
              label="Terms & conditions"
              hint="One per line (up to 10)."
              value={(field.value ?? []).join("\n")}
              onChange={(e) =>
                field.onChange(
                  e.target.value
                    .split("\n")
                    .map((t) => t.trimStart())
                    .slice(0, 10),
                )
              }
              onBlur={() => field.onChange((field.value ?? []).map((t) => t.trim()).filter(Boolean))}
              error={errors.terms?.message}
            />
          )}
        />
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : couponId ? "Save coupon" : "Create coupon"}
        </Button>
      </div>
    </form>
  );
}
