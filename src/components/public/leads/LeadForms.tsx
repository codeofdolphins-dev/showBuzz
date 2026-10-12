"use client";

import { useTransition } from "react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import {
  submitContactLeadAction,
  submitCorporateLeadAction,
  submitShowSubmissionAction,
} from "@/app/(public)/_actions/engagement";
import { Field, inputClass } from "@/components/public/form/Field";
import { cn } from "@/lib/cn";
import {
  contactLeadSchema,
  corporateLeadSchema,
  organiserCapacities,
  organiserCategories,
  showSubmissionSchema,
  supportTopics,
  type ContactLeadInput,
  type CorporateLeadInput,
  type ShowSubmissionInput,
} from "@/schemas/lead";
import { toast } from "@/stores/ui";

type ActionResult = { success: true; data: { reference: string } } | { success: false; error: { message: string; fieldErrors?: Record<string, string[]> } };

/** Shared submit flow: server validates again, field errors map back onto the form. */
function useLeadSubmit<T extends FieldValues>(
  form: UseFormReturn<T>,
  action: (values: T) => Promise<ActionResult>,
  successMessage: (reference: string) => string,
) {
  const [isPending, startTransition] = useTransition();
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await action(values);
      if (!result.success) {
        for (const [name, messages] of Object.entries(result.error.fieldErrors ?? {})) {
          form.setError(name as Parameters<typeof form.setError>[0], { message: messages[0] });
        }
        toast(result.error.message, "error");
        return;
      }
      toast(successMessage(result.data.reference), "success");
      form.reset();
    }),
  );
  return { onSubmit, isPending };
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="gradient-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-black text-white shadow-lg shadow-rose-500/20 disabled:opacity-60"
    >
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
}

export function ShowSubmissionForm() {
  const form = useForm<ShowSubmissionInput>({
    resolver: zodResolver(showSubmissionSchema),
    defaultValues: {
      name: "",
      companyName: "",
      email: "",
      phone: "",
      category: organiserCategories[0],
      city: "",
      capacity: organiserCapacities[0],
      overview: "",
    },
  });
  const { onSubmit, isPending } = useLeadSubmit(form, submitShowSubmissionAction, (ref) =>
    `Registration ${ref} submitted! Our partnerships team will contact you shortly.`,
  );
  const e = form.formState.errors;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 text-xs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="lys-name" label="Your Full Name *" error={e.name?.message}>
          <input id="lys-name" placeholder="e.g. Vikram Singhania" {...form.register("name")} className={inputClass} />
        </Field>
        <Field id="lys-company" label="Company / Production Name *" error={e.companyName?.message}>
          <input id="lys-company" placeholder="e.g. Red Carpet Entertainment" {...form.register("companyName")} className={inputClass} />
        </Field>
        <Field id="lys-email" label="Official Email Address *" error={e.email?.message}>
          <input id="lys-email" type="email" placeholder="vikram@redcarpet.com" {...form.register("email")} className={inputClass} />
        </Field>
        <Field id="lys-phone" label="Phone Number *" error={e.phone?.message}>
          <input id="lys-phone" type="tel" placeholder="+91 98765 00000" {...form.register("phone")} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field id="lys-category" label="Event Category *" error={e.category?.message}>
          <select id="lys-category" {...form.register("category")} className={inputClass}>
            {organiserCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field id="lys-city" label="Host City *" error={e.city?.message}>
          <input id="lys-city" placeholder="e.g. Kolkata" {...form.register("city")} className={inputClass} />
        </Field>
        <Field id="lys-capacity" label="Expected Capacity *" error={e.capacity?.message}>
          <select id="lys-capacity" {...form.register("capacity")} className={inputClass}>
            {organiserCapacities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="lys-overview" label="Event Overview & Expected Dates" error={e.overview?.message}>
        <textarea
          id="lys-overview"
          placeholder="Tell us about the artist, venue, ticket pricing tiers, and expected dates..."
          {...form.register("overview")}
          className={cn(inputClass, "h-24 resize-none")}
        />
      </Field>
      <SubmitButton pending={isPending}>Submit Event For Approval &rarr;</SubmitButton>
    </form>
  );
}

export function CorporateEnquiryForm() {
  const form = useForm<CorporateLeadInput>({
    resolver: zodResolver(corporateLeadSchema),
    defaultValues: { companyName: "", contactName: "", email: "", phone: "", requirements: "" },
  });
  const { onSubmit, isPending } = useLeadSubmit(form, submitCorporateLeadAction, (ref) =>
    `Corporate enquiry ${ref} received! Our key accounts manager will respond within 4 hours.`,
  );
  const e = form.formState.errors;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 text-xs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="corp-company" label="Company Name *" error={e.companyName?.message}>
          <input id="corp-company" placeholder="e.g. Tata Consultancy Services" {...form.register("companyName")} className={inputClass} />
        </Field>
        <Field id="corp-contact" label="Contact Person Name *" error={e.contactName?.message}>
          <input id="corp-contact" placeholder="e.g. Rohini Sharma (HR Lead)" {...form.register("contactName")} className={inputClass} />
        </Field>
        <Field id="corp-email" label="Work Email Address *" error={e.email?.message}>
          <input id="corp-email" type="email" placeholder="rohini@company.com" {...form.register("email")} className={inputClass} />
        </Field>
        <Field id="corp-phone" label="Phone Number *" error={e.phone?.message}>
          <input id="corp-phone" type="tel" placeholder="+91 98300 00000" {...form.register("phone")} className={inputClass} />
        </Field>
      </div>
      <Field id="corp-req" label="Requirement Details & Number of Employees" error={e.requirements?.message}>
        <textarea
          id="corp-req"
          placeholder="Specify requirements like screen buyout date, movie/event preference, number of vouchers..."
          {...form.register("requirements")}
          className={cn(inputClass, "h-24 resize-none")}
        />
      </Field>
      <SubmitButton pending={isPending}>Request Customized Corporate Quote &rarr;</SubmitButton>
    </form>
  );
}

export function ContactForm() {
  const form = useForm<ContactLeadInput>({
    resolver: zodResolver(contactLeadSchema),
    defaultValues: { name: "", email: "", phone: "", bookingCode: "", topic: supportTopics[0], message: "" },
  });
  const { onSubmit, isPending } = useLeadSubmit(form, submitContactLeadAction, (ref) =>
    `Your support ticket #${ref} has been registered. We will reply within 30 minutes!`,
  );
  const e = form.formState.errors;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 text-xs">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="ct-name" label="Your Full Name *" error={e.name?.message}>
          <input id="ct-name" autoComplete="name" placeholder="Aarav Roy" {...form.register("name")} className={inputClass} />
        </Field>
        <Field id="ct-email" label="Email Address *" error={e.email?.message}>
          <input id="ct-email" type="email" autoComplete="email" placeholder="aarav@example.com" {...form.register("email")} className={inputClass} />
        </Field>
        <Field id="ct-phone" label="Phone Number" error={e.phone?.message}>
          <input id="ct-phone" type="tel" autoComplete="tel" placeholder="+91 98765 00000" {...form.register("phone")} className={inputClass} />
        </Field>
        <Field id="ct-booking" label="Booking ID (If Applicable)" error={e.bookingCode?.message}>
          <input id="ct-booking" placeholder="e.g. SB-883921" {...form.register("bookingCode")} className={inputClass} />
        </Field>
      </div>
      <Field id="ct-topic" label="Subject / Query Topic *" error={e.topic?.message}>
        <select id="ct-topic" {...form.register("topic")} className={inputClass}>
          {supportTopics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field id="ct-message" label="Message Description *" error={e.message?.message}>
        <textarea
          id="ct-message"
          placeholder="Please describe your query in detail..."
          {...form.register("message")}
          className={cn(inputClass, "h-28 resize-none")}
        />
      </Field>
      <SubmitButton pending={isPending}>Submit Support Request &rarr;</SubmitButton>
    </form>
  );
}
