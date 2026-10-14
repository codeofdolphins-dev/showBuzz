"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Popcorn, Tags } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { formatDateShort } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { Card } from "@showbuzz/console-ui/PageParts";
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
import { useToast } from "@showbuzz/console-ui/Toaster";
import {
  COUPON_GRADIENTS,
  type VendorCouponInput,
  type VendorCouponValues,
  vendorCouponInputSchema,
} from "@showbuzz/schemas/partner-box-office";
import { createCouponAction, updateCouponAction } from "@/app/_actions/menu-offers";
import { applyActionError } from "@/lib/action-errors";

interface ScopeOptions {
  venues: { value: string; label: string }[];
  movies: { value: string; label: string }[];
  events: { value: string; label: string }[];
}

interface CouponFormProps {
  scope: ScopeOptions;
  vendorName: string;
  coupon?: { id: string; usedCount: number; values: VendorCouponInput };
  /** New coupons start now and run for 30 days. */
  defaults: { validFrom: string; validUntil: string };
}

const KIND_OPTIONS = [
  { value: "percent", label: "Percentage off" },
  { value: "flat", label: "Flat amount off" },
];
const APPLIES_OPTIONS = [
  { value: "tickets", label: "Ticket value" },
  { value: "food", label: "Food & beverages" },
];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive (not accepted)" },
];
const GRADIENT_OPTIONS = COUPON_GRADIENTS.map((g) => ({ value: g.value, label: g.label }));

/** Empty text box → undefined; otherwise a number (whole numbers checked by the schema). */
const optionalNumber = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : Number(value);

/**
 * Prototype coupons.html "Create Promo Code" (code, discount, minimum order) plus what checkout enforces: maximum
 * discount, validity, usage limits, and which of the vendor's venues, films or listings it is valid for.
 */
export function CouponForm({ scope, vendorName, coupon, defaults }: CouponFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<VendorCouponInput, unknown, VendorCouponValues>({
    resolver: zodResolver(vendorCouponInputSchema),
    defaultValues: coupon?.values ?? {
      code: "",
      title: "",
      description: "",
      kind: "percent",
      percentOff: 10,
      minOrderPaise: 0,
      appliesTo: "tickets",
      validFrom: defaults.validFrom,
      validUntil: defaults.validUntil,
      venueIds: [],
      movieIds: [],
      eventIds: [],
      showOnOffersPage: true,
      gradient: COUPON_GRADIENTS[0].value,
      terms: [],
      status: "active",
    },
  });
  const errors = form.formState.errors;
  const values = useWatch({ control: form.control });
  const percent = values.kind === "percent";

  const onSubmit = form.handleSubmit((data) =>
    startTransition(async () => {
      setMessage(null);
      const result = coupon ? await updateCouponAction(coupon.id, data) : await createCouponAction(data);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(coupon ? "Coupon saved." : "Coupon created.");
      router.push("/offers");
      router.refresh();
    }),
  );

  const discountLabel = percent
    ? `${values.percentOff ?? 0}% off${values.maxDiscountPaise ? ` up to ${formatINR(values.maxDiscountPaise)}` : ""}`
    : `${formatINR(values.flatPaise ?? 0)} off`;

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        {message ? <FormMessage tone="error">{message}</FormMessage> : null}
        <Card className="space-y-4 p-6">
          <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Code & discount</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Coupon code"
              required
              maxLength={20}
              className="font-mono uppercase"
              placeholder="e.g. QUEST20"
              hint={
                coupon && coupon.usedCount > 0
                  ? "Used already, so the code can't change."
                  : "3–20 letters or digits, unique on ShowBuzz."
              }
              readOnly={!!coupon && coupon.usedCount > 0}
              error={errors.code?.message}
              {...form.register("code", { setValueAs: (v: string) => v.toUpperCase().replace(/\s/g, "") })}
            />
            <SelectField
              label="Status"
              required
              options={STATUS_OPTIONS}
              error={errors.status?.message}
              {...form.register("status")}
            />
            <TextField
              label="Title"
              required
              containerClassName="md:col-span-2"
              placeholder="e.g. 20% off weekday shows at Quest Mall"
              error={errors.title?.message}
              {...form.register("title")}
            />
            <TextAreaField
              label="Description"
              required
              containerClassName="md:col-span-2"
              maxLength={240}
              error={errors.description?.message}
              {...form.register("description")}
            />
            <SelectField label="Discount type" required options={KIND_OPTIONS} {...form.register("kind")} />
            <SelectField label="Applies to" required options={APPLIES_OPTIONS} {...form.register("appliesTo")} />
            {percent ? (
              <>
                <NumberField
                  label="Percent off"
                  required
                  step="0.01"
                  min={0.01}
                  max={100}
                  error={errors.percentOff?.message}
                  {...form.register("percentOff", { setValueAs: optionalNumber })}
                />
                <Controller
                  control={form.control}
                  name="maxDiscountPaise"
                  render={({ field }) => (
                    <MoneyInput
                      label="Maximum discount"
                      hint="Leave empty for no cap."
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.maxDiscountPaise?.message}
                    />
                  )}
                />
              </>
            ) : (
              <Controller
                control={form.control}
                name="flatPaise"
                render={({ field }) => (
                  <MoneyInput
                    label="Amount off"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.flatPaise?.message}
                  />
                )}
              />
            )}
            <Controller
              control={form.control}
              name="minOrderPaise"
              render={({ field }) => (
                <MoneyInput
                  label="Minimum order"
                  hint={values.appliesTo === "food" ? "Food order value." : "Ticket value (before fees)."}
                  value={field.value || undefined}
                  onChange={(v) => field.onChange(v ?? 0)}
                  error={errors.minOrderPaise?.message}
                />
              )}
            />
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Validity & limits</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Controller
              control={form.control}
              name="validFrom"
              render={({ field }) => (
                <DateTimeField
                  label="Valid from"
                  required
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
              label="Total uses"
              min={1}
              step={1}
              hint={coupon ? `Used ${coupon.usedCount} time(s) so far. Empty = unlimited.` : "Empty = unlimited."}
              error={errors.usageLimit?.message}
              {...form.register("usageLimit", { setValueAs: optionalNumber })}
            />
            <NumberField
              label="Uses per customer"
              min={1}
              step={1}
              hint="Empty = unlimited. Customers must be signed in (checkout always is)."
              error={errors.perCustomerLimit?.message}
              {...form.register("perCustomerLimit", { setValueAs: optionalNumber })}
            />
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Where it applies</h2>
          <p className="text-[11px] text-admin-muted">
            Your coupons only ever work on your own shows. Narrow it further below, or leave a list empty for all.
          </p>
          <Controller
            control={form.control}
            name="venueIds"
            render={({ field }) => (
              <MultiSelect
                label="Venues"
                options={scope.venues}
                value={field.value ?? []}
                onChange={field.onChange}
                error={errors.venueIds?.message}
              />
            )}
          />
          {scope.movies.length > 0 ? (
            <Controller
              control={form.control}
              name="movieIds"
              render={({ field }) => (
                <MultiSelect
                  label="Movies"
                  options={scope.movies}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  error={errors.movieIds?.message}
                />
              )}
            />
          ) : null}
          {scope.events.length > 0 ? (
            <Controller
              control={form.control}
              name="eventIds"
              render={({ field }) => (
                <MultiSelect
                  label="Events, plays, sports & activities"
                  options={scope.events}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  error={errors.eventIds?.message}
                />
              )}
            />
          ) : null}
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Offers page</h2>
          <Controller
            control={form.control}
            name="showOnOffersPage"
            render={({ field }) => (
              <Toggle
                label="List on showbuzz.com/offers"
                hint={`Shown "by ${vendorName}". Off = the code still works at checkout for anyone who has it.`}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <SelectField
            label="Card colour"
            options={GRADIENT_OPTIONS}
            containerClassName="max-w-xs"
            {...form.register("gradient")}
          />
          <Controller
            control={form.control}
            name="terms"
            render={({ field }) => (
              <TextAreaField
                label="Terms & conditions"
                hint="One per line (up to 10). Empty = standard terms are written for you."
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

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/offers"
            className="rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : coupon ? "Save coupon" : "Create coupon"}
          </Button>
        </div>
      </div>

      <div>
        <div className="space-y-2 xl:sticky xl:top-20">
          <p className="text-[11px] font-bold tracking-wider text-admin-subtle uppercase">Preview on /offers</p>
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr text-white",
                  values.gradient,
                )}
              >
                {values.appliesTo === "food" ? (
                  <Popcorn className="h-5 w-5" aria-hidden />
                ) : (
                  <Tags className="h-5 w-5" aria-hidden />
                )}
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-slate-600 uppercase">
                {values.appliesTo === "food" ? "Food & Beverages" : "Tickets"}
              </span>
            </div>
            <h3 className="text-base leading-snug font-black text-slate-900">{values.title || "Your offer title"}</h3>
            <p className="mt-0.5 text-[11px] font-bold text-rose-600">by {vendorName} · valid on their shows only</p>
            <p className="mt-1 text-xs text-slate-500">{values.description || "Describe the offer for customers."}</p>
            <p className="mt-2 text-[11px] font-medium text-slate-400">
              {discountLabel}
              {values.validUntil ? ` · Valid till ${formatDateShort(new Date(values.validUntil))}` : ""}
            </p>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-black tracking-wider text-slate-800">
              {values.code || "CODE"}
            </div>
          </article>
          {!values.showOnOffersPage ? (
            <p className="text-[11px] text-admin-muted">Not listed on /offers: share the code yourself.</p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
