"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus } from "lucide-react";
import { Card } from "@showbuzz/console-ui/PageParts";
import { MultiSelect, SelectField, TextField, Toggle } from "@showbuzz/console-ui/fields";
import { Button, FormMessage, Input } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { VENUE_AMENITY_OPTIONS, VENUE_KIND_LABELS, venueInputSchema } from "@showbuzz/schemas/partner-venue";
import type { LayoutConflictShow } from "@showbuzz/schemas/types/partner-venue";
import { slugify } from "@showbuzz/utils/text";
import { createVenueAction, updateVenueAction } from "@/app/_actions/venues";
import { applyActionError } from "@/lib/action-errors";
import { ConflictShows } from "./ConflictShows";

type VenueFormInput = z.input<typeof venueInputSchema>;
type VenueFormOutput = z.output<typeof venueInputSchema>;

const KIND_OPTIONS = Object.entries(VENUE_KIND_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = [
  { value: "active", label: "Active (listed on ShowBuzz)" },
  { value: "inactive", label: "Inactive (hidden from customers)" },
];

interface VenueFormProps {
  cities: { value: string; label: string }[];
  /** Editing: the venue id and its current values. */
  venue?: { id: string; values: VenueFormInput };
}

/** Prototype cinema-form / venue-form: identity, location, facilities, status. */
export function VenueForm({ cities, venue }: VenueFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<LayoutConflictShow[]>([]);
  // A new venue's URL name follows its name until the vendor edits it.
  const [slugTouched, setSlugTouched] = useState(Boolean(venue));
  const [customAmenity, setCustomAmenity] = useState("");

  const form = useForm<VenueFormInput, unknown, VenueFormOutput>({
    resolver: zodResolver(venueInputSchema),
    defaultValues: venue?.values ?? {
      kind: "cinema",
      name: "",
      slug: "",
      cityId: "",
      address: "",
      phone: "",
      amenities: [],
      cancellationAllowed: true,
      status: "active",
    },
  });
  const errors = form.formState.errors;
  const amenities = useWatch({ control: form.control, name: "amenities" });
  const amenityOptions = [...new Set([...VENUE_AMENITY_OPTIONS, ...amenities])].map((a) => ({ value: a, label: a }));

  const nameField = form.register("name", {
    onChange: (event: { target: { value: string } }) => {
      if (!slugTouched) form.setValue("slug", slugify(event.target.value), { shouldValidate: false });
    },
  });

  function addAmenity() {
    const value = customAmenity.trim();
    if (!value) return;
    if (!amenities.includes(value)) form.setValue("amenities", [...amenities, value], { shouldDirty: true });
    setCustomAmenity("");
  }

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setMessage(null);
      setConflicts([]);
      const result = venue ? await updateVenueAction(venue.id, values) : await createVenueAction(values);
      if (!result.success) {
        setConflicts((result.error.details?.shows as LayoutConflictShow[] | undefined) ?? []);
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(venue ? "Venue saved." : "Venue added. Now add its screens.");
      router.push(`/venues/${result.data.id}`);
      router.refresh();
    }),
  );

  const cancelHref = venue ? `/venues/${venue.id}` : "/venues";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      {conflicts.length > 0 ? <ConflictShows shows={conflicts} /> : null}

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Identity & location</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Venue name"
            required
            placeholder="e.g. PVR INOX South City Mall"
            error={errors.name?.message}
            {...nameField}
          />
          <SelectField
            label="Venue type"
            required
            options={KIND_OPTIONS}
            error={errors.kind?.message}
            {...form.register("kind")}
          />
          <TextField
            label="URL name"
            required
            hint="Used in links on showbuzz.com. Lowercase letters, numbers and dashes."
            error={errors.slug?.message}
            {...form.register("slug", { onChange: () => setSlugTouched(true) })}
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
            label="Full postal address"
            required
            containerClassName="md:col-span-2"
            placeholder="Building, street, area, PIN code"
            error={errors.address?.message}
            {...form.register("address")}
          />
          <TextField
            label="Box office phone"
            type="tel"
            placeholder="+91 33 2422 5600"
            error={errors.phone?.message}
            {...form.register("phone")}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Facilities</h2>
        <Controller
          control={form.control}
          name="amenities"
          render={({ field }) => (
            <MultiSelect
              label="Amenities"
              hint="Shown on the venue's listing. Add your own below."
              options={amenityOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.amenities?.message}
            />
          )}
        />
        <div className="flex max-w-md gap-2">
          <Input
            value={customAmenity}
            onChange={(event) => setCustomAmenity(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addAmenity();
              }
            }}
            placeholder="Another amenity, e.g. Gaming Zone"
            aria-label="Another amenity"
            maxLength={40}
          />
          <Button type="button" variant="secondary" onClick={addAmenity}>
            <Plus className="h-4 w-4" aria-hidden /> Add
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Bookings</h2>
        <Controller
          control={form.control}
          name="cancellationAllowed"
          render={({ field }) => (
            <Toggle
              label="Allow cancellations at this venue"
              hint="When off, tickets here can't be cancelled even if your cancellation policy allows it."
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <SelectField
          label="Status"
          required
          options={STATUS_OPTIONS}
          containerClassName="max-w-sm"
          hint="Inactive venues disappear from showbuzz.com; tickets already sold stay valid."
          error={errors.status?.message}
          {...form.register("status")}
        />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={cancelHref}
          className="rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : venue ? "Save venue" : "Add venue"}
        </Button>
      </div>
    </form>
  );
}
