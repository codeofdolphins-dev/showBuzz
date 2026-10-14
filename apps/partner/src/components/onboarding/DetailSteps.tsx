"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowRight } from "lucide-react";
import { SelectField, TextField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { onboardingBankSchema, onboardingBusinessSchema, onboardingTaxSchema } from "@showbuzz/schemas/partner";
import type { VendorKycView, VendorSummary } from "@showbuzz/schemas/types/vendor";
import { VENDOR_BUSINESS_TYPE_LABELS } from "@showbuzz/schemas/vendor";
import { saveBankAccountAction, saveBusinessDetailsAction, saveTaxIdsAction } from "@/app/_actions/onboarding";
import { applyActionError } from "@/lib/action-errors";

const BUSINESS_TYPES = Object.entries(VENDOR_BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label }));

function StepHeader({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="mb-5 border-b border-admin-border pb-4">
      <h2 className="text-base font-bold text-admin-dark">{title}</h2>
      <p className="text-xs text-admin-muted">{description}</p>
    </div>
  );
}

/** Onboarding wizard steps, also used by Business Profile (`mode="profile"`) once onboarding is complete. */
export type StepMode = "onboarding" | "profile";

function SaveBar({ pending, mode }: { pending: boolean; mode: StepMode }) {
  return (
    <div className="flex justify-end border-t border-admin-border pt-4">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "profile" ? "Save changes" : "Save & continue"}
        {mode === "onboarding" ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
      </Button>
    </div>
  );
}

/** Indian numbers are stored as +91XXXXXXXXXX; the form shows the 10 digits. */
const nationalPhone = (phone: string) => phone.replace(/^\+91/, "");

type BusinessInput = z.input<typeof onboardingBusinessSchema>;
type BusinessOutput = z.output<typeof onboardingBusinessSchema>;

export function BusinessStep({
  vendor,
  cities,
  onSaved,
  mode = "onboarding",
}: {
  vendor: VendorSummary;
  cities: { value: string; label: string }[];
  onSaved: () => void;
  mode?: StepMode;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<BusinessInput, unknown, BusinessOutput>({
    resolver: zodResolver(onboardingBusinessSchema),
    defaultValues: {
      businessName: vendor.businessName,
      businessType: vendor.businessType,
      contact: { name: vendor.contact.name, email: vendor.contact.email, phone: nationalPhone(vendor.contact.phone) },
      address: { line: vendor.address.line, cityId: vendor.address.cityId, pincode: vendor.address.pincode },
    },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await saveBusinessDetailsAction(form.getValues(), mode);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("Business details saved.");
      onSaved();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <StepHeader title="Business details" description="How customers and ShowBuzz will know your business." />
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Business / brand name"
          required
          containerClassName="sm:col-span-2"
          hint="Shown to customers on your cinema and event pages."
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
        <TextField
          label="Contact person"
          required
          error={errors.contact?.name?.message}
          {...form.register("contact.name")}
        />
        <TextField
          label="Contact email"
          required
          type="email"
          error={errors.contact?.email?.message}
          {...form.register("contact.email")}
        />
        <TextField
          label="Contact mobile"
          required
          type="tel"
          inputMode="tel"
          error={errors.contact?.phone?.message}
          {...form.register("contact.phone")}
        />
        <TextField
          label="Registered address"
          required
          containerClassName="sm:col-span-2"
          placeholder="Building, street, area"
          error={errors.address?.line?.message}
          {...form.register("address.line")}
        />
        <SelectField
          label="City"
          required
          options={cities}
          placeholder="Choose a city"
          error={errors.address?.cityId?.message}
          {...form.register("address.cityId")}
        />
        <TextField
          label="PIN code"
          required
          inputMode="numeric"
          maxLength={6}
          error={errors.address?.pincode?.message}
          {...form.register("address.pincode")}
        />
      </div>
      <SaveBar pending={pending} mode={mode} />
    </form>
  );
}

type TaxInput = z.input<typeof onboardingTaxSchema>;
type TaxOutput = z.output<typeof onboardingTaxSchema>;

export function TaxStep({
  kyc,
  onSaved,
  mode = "onboarding",
}: {
  kyc: VendorKycView;
  onSaved: () => void;
  mode?: StepMode;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<TaxInput, unknown, TaxOutput>({
    resolver: zodResolver(onboardingTaxSchema),
    defaultValues: { gstin: kyc.gstin, pan: kyc.pan },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await saveTaxIdsAction(form.getValues(), mode);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("GSTIN and PAN saved.");
      onSaved();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <StepHeader
        title="GSTIN & PAN"
        description="Your business's GST registration and PAN. The PAN must match the one inside your GSTIN."
      />
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="GSTIN"
          required
          maxLength={15}
          autoComplete="off"
          placeholder="22AAAAA0000A1Z5"
          className="font-mono uppercase"
          hint="15 characters, from your GST registration certificate."
          error={errors.gstin?.message}
          {...form.register("gstin")}
        />
        <TextField
          label="PAN"
          required
          maxLength={10}
          autoComplete="off"
          placeholder="AAAAA0000A"
          className="font-mono uppercase"
          hint="10 characters (characters 3 to 12 of the GSTIN)."
          error={errors.pan?.message}
          {...form.register("pan")}
        />
      </div>
      <SaveBar pending={pending} mode={mode} />
    </form>
  );
}

type BankInput = z.input<typeof onboardingBankSchema>;
type BankOutput = z.output<typeof onboardingBankSchema>;

export function BankStep({
  kyc,
  onSaved,
  mode = "onboarding",
}: {
  kyc: VendorKycView;
  onSaved: () => void;
  mode?: StepMode;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<BankInput, unknown, BankOutput>({
    resolver: zodResolver(onboardingBankSchema),
    defaultValues: {
      holderName: kyc.bankAccount.holderName,
      accountNumber: kyc.bankAccount.accountNumber,
      confirmAccountNumber: kyc.bankAccount.accountNumber,
      ifsc: kyc.bankAccount.ifsc,
    },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await saveBankAccountAction(form.getValues(), mode);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success("Bank account saved.");
      onSaved();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <StepHeader
        title="Payout bank account"
        description="Your share of ticket sales is paid to this account. It should be in the business's name."
      />
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Account holder name"
          required
          containerClassName="sm:col-span-2"
          error={errors.holderName?.message}
          {...form.register("holderName")}
        />
        <TextField
          label="Account number"
          required
          inputMode="numeric"
          autoComplete="off"
          className="font-mono"
          error={errors.accountNumber?.message}
          {...form.register("accountNumber")}
        />
        <TextField
          label="Confirm account number"
          required
          inputMode="numeric"
          autoComplete="off"
          className="font-mono"
          onPaste={(event) => event.preventDefault()}
          error={errors.confirmAccountNumber?.message}
          {...form.register("confirmAccountNumber")}
        />
        <TextField
          label="IFSC"
          required
          maxLength={11}
          autoComplete="off"
          placeholder="HDFC0001234"
          className="font-mono uppercase"
          hint="11 characters, printed on your cheque book."
          error={errors.ifsc?.message}
          {...form.register("ifsc")}
        />
      </div>
      <SaveBar pending={pending} mode={mode} />
    </form>
  );
}
