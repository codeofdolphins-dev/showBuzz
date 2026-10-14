"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowRight, KeyRound } from "lucide-react";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { SelectField, TextField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { adminCreateVendorSchema } from "@showbuzz/schemas/admin-marketplace";
import { VENDOR_BUSINESS_TYPE_LABELS } from "@showbuzz/schemas/vendor";
import { createVendorAction } from "@/app/_actions/vendors";

type Input = z.input<typeof adminCreateVendorSchema>;
type Output = z.output<typeof adminCreateVendorSchema>;

const BUSINESS_TYPES = Object.entries(VENDOR_BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label }));

interface CreateVendorFormProps {
  cities: { value: string; label: string }[];
  defaults?: Partial<Input>;
}

/**
 * Creates a vendor and its owner login on the vendor's behalf. The temporary password is shown once; KYC is then
 * filled on the vendor's Onboarding tab (or by the vendor after signing in).
 */
export function CreateVendorForm({ cities, defaults }: CreateVendorFormProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<{ vendorId: string; email: string; temporaryPassword: string } | null>(null);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(adminCreateVendorSchema),
    defaultValues: {
      businessName: "",
      businessType: "event_organiser",
      contactName: "",
      email: "",
      phone: "",
      cityId: "",
      leadId: "",
      ...defaults,
    },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await createVendorAction(form.getValues());
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      setCreated(result.data);
    }),
  );

  if (created) {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">
          Vendor created. Partner login: <b>{created.email}</b>, temporary password{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-admin-dark select-all">
            {created.temporaryPassword}
          </code>
          . It is shown only once: share it privately; the vendor should change it from their profile.
        </FormMessage>
        <Link
          href={`/vendors/${created.vendorId}?tab=onboarding`}
          className="inline-flex items-center gap-1.5 rounded-md border border-admin-indigo bg-admin-indigo px-4 py-2 text-xs font-bold text-white hover:bg-admin-dark"
        >
          Continue to KYC onboarding <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Business / brand name"
          required
          containerClassName="sm:col-span-2"
          error={errors.businessName?.message}
          {...form.register("businessName")}
        />
        <SelectField
          label="Business type"
          required
          options={BUSINESS_TYPES}
          error={errors.businessType?.message}
          {...form.register("businessType")}
        />
        <SelectField
          label="City"
          required
          options={cities}
          placeholder="Choose a city"
          error={errors.cityId?.message}
          {...form.register("cityId")}
        />
        <TextField
          label="Contact person"
          required
          error={errors.contactName?.message}
          {...form.register("contactName")}
        />
        <TextField
          label="Mobile"
          required
          type="tel"
          inputMode="tel"
          error={errors.phone?.message}
          {...form.register("phone")}
        />
        <TextField
          label="Email (partner login)"
          required
          type="email"
          autoComplete="off"
          containerClassName="sm:col-span-2"
          hint="The owner signs in to partner.showbuzz.com with this email and the temporary password."
          error={errors.email?.message}
          {...form.register("email")}
        />
      </div>
      <div className="flex justify-end border-t border-admin-border pt-4">
        <Button type="submit" disabled={pending}>
          <KeyRound className="h-4 w-4" aria-hidden />
          {pending ? "Creating…" : "Create vendor & login"}
        </Button>
      </div>
    </form>
  );
}
