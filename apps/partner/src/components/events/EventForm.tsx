"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Lock, Plus, Trash2 } from "lucide-react";
import { Card } from "@showbuzz/console-ui/PageParts";
import {
  DateTimeField,
  ImageUrlField,
  MoneyInput,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from "@showbuzz/console-ui/fields";
import { Button, FieldError, FormMessage, Input } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import type { EventKind } from "@showbuzz/schemas/event";
import { EVENT_CATEGORY_OPTIONS, EVENT_KIND_LABELS, eventInputSchema } from "@showbuzz/schemas/partner-listing";
import type { TierUsage, VenueScreenOption } from "@showbuzz/schemas/types/partner-listing";
import { slugify } from "@showbuzz/utils/text";
import { createEventAction, updateEventAction } from "@/app/_actions/events";
import { applyActionError } from "@/lib/action-errors";
import { PeopleRows, rowErrors } from "@/components/listings/PeopleRows";
import { ShowClashes, type ShowClashList } from "@/components/shows/ShowClashes";

type EventFormInput = z.input<typeof eventInputSchema>;
type EventFormOutput = z.output<typeof eventInputSchema>;
type TierValue = EventFormInput["tiers"][number];

const STATUS_OPTIONS = [
  { value: "active", label: "Active (on sale on ShowBuzz)" },
  { value: "inactive", label: "Inactive (hidden from customers)" },
];
const SCHEDULE_OPTIONS = [
  { value: "once", label: "One date and time" },
  { value: "daily", label: "Open daily (opening hours)" },
];

interface EventFormProps {
  kind: EventKind;
  venues: VenueScreenOption[];
  /** Editing: the listing, its tier usage and whether sales lock the schedule. */
  event?: { id: string; values: EventFormInput; usage: TierUsage[]; locked: boolean };
}

/** Sports tiers are the stadium screen's seat categories (layout order), keeping prices already entered. */
function tiersForScreen(venues: VenueScreenOption[], venueId: string, screenId: string, current: TierValue[]) {
  const screen = venues.find((v) => v.id === venueId)?.screens.find((s) => s.id === screenId);
  if (!screen) return [];
  return screen.zones.map((zone, i) => {
    // Older (seeded) fixtures named their tiers by position, not by seat category.
    const existing = current.find((t) => t.id === zone.id) ?? current[i];
    return {
      id: zone.id,
      name: existing?.name ?? zone.name,
      description: existing?.description ?? "",
      pricePaise: existing?.pricePaise ?? zone.defaultPricePaise,
      capacity: zone.seats,
    };
  });
}

/**
 * Prototype event-form for every non-movie kind: overview, venue & schedule (IST), media and artists, ticket tiers
 * and status. Events, plays and activities sell passes per tier (capacity can't go below what's sold or in
 * checkout); sports pick a stadium screen and price its seat categories.
 */
export function EventForm({ kind, venues, event }: EventFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [clashes, setClashes] = useState<ShowClashList | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(event));
  const labels = EVENT_KIND_LABELS[kind];
  const isSport = kind === "sport";
  const locked = event?.locked ?? false;

  const venueChoices = venues.filter((v) => !isSport || v.screens.length > 0);
  const form = useForm<EventFormInput, unknown, EventFormOutput>({
    resolver: zodResolver(eventInputSchema),
    defaultValues: event
      ? isSport
        ? { ...event.values, tiers: tiersForScreen(venues, event.values.venueId, event.values.screenId, event.values.tiers) }
        : event.values
      : {
      kind,
      title: "",
      slug: "",
      category: "",
      about: "",
      language: "",
      ageLimit: "",
      durationMinutes: isSport ? 180 : 120,
      venueId: "",
      screenId: "",
      scheduleType: "once",
      startsAt: "",
      endsAt: "",
      opensAt: "",
      closesAt: "",
      poster: "",
      backdrop: "",
      director: "",
      artists: [],
      tiers: isSport ? [] : [{ id: "", name: "General Admission", description: "", pricePaise: 0, capacity: 100 }],
      status: "active",
    },
  });
  const errors = form.formState.errors;
  const [venueId, screenId, scheduleType, tiers] = useWatch({
    control: form.control,
    name: ["venueId", "screenId", "scheduleType", "tiers"],
  });
  const screens = venues.find((v) => v.id === venueId)?.screens ?? [];
  const tierErrors = rowErrors(errors.tiers);
  const usageOf = (id: string | undefined) => event?.usage.find((u) => u.tierId === id);

  const titleField = form.register("title", {
    onChange: (e: { target: { value: string } }) => {
      if (!slugTouched) form.setValue("slug", slugify(e.target.value), { shouldValidate: false });
    },
  });

  function chooseScreen(nextVenueId: string, nextScreenId: string) {
    form.setValue("screenId", nextScreenId, { shouldDirty: true });
    form.setValue("tiers", tiersForScreen(venues, nextVenueId, nextScreenId, form.getValues("tiers")), {
      shouldDirty: true,
    });
  }

  function setTier(index: number, patch: Partial<TierValue>) {
    form.setValue(
      "tiers",
      tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)),
      { shouldDirty: true },
    );
  }

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setMessage(null);
      setClashes(null);
      const result = event ? await updateEventAction(event.id, values) : await createEventAction(values);
      if (!result.success) {
        const details = result.error.details as { clashes?: ShowClashList["clashes"]; clashCount?: number } | undefined;
        if (details?.clashes)
          setClashes({ clashes: details.clashes, total: details.clashCount ?? details.clashes.length });
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(event ? `${labels.one} saved.` : `${labels.one} added. It's on sale on ShowBuzz now.`);
      router.push(`/events?kind=${kind}`);
      router.refresh();
    }),
  );

  const categories = EVENT_CATEGORY_OPTIONS[kind];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      {clashes ? <ShowClashes {...clashes} /> : null}
      {locked ? (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <Lock className="h-4 w-4" aria-hidden /> Tickets are sold or being paid for: the venue
          {isSport ? ", screen" : ""} and start time are locked, and the listing can&apos;t be switched off. Prices,
          text and images can still change.
        </p>
      ) : null}

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">
          1. {labels.one} overview & category
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label={`${labels.one} title`}
            required
            placeholder={isSport ? "e.g. Kolkata Thunder vs Mumbai Blasters" : "e.g. Arijit Singh Live in Concert"}
            error={errors.title?.message}
            {...titleField}
          />
          <TextField
            label="URL name"
            required
            hint="Lowercase letters, numbers and dashes."
            error={errors.slug?.message}
            {...form.register("slug", { onChange: () => setSlugTouched(true) })}
          />
          <TextField
            label="Category"
            required
            list="event-categories"
            placeholder={categories[0]}
            error={errors.category?.message}
            {...form.register("category")}
          />
          <datalist id="event-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <NumberField
            label="Duration (minutes)"
            required
            min={15}
            max={1440}
            hint={isSport ? "Keeps the stadium screen free for the fixture." : undefined}
            error={errors.durationMinutes?.message}
            {...form.register("durationMinutes", { valueAsNumber: true })}
          />
          <TextField
            label="Language"
            placeholder="e.g. Hindi, English"
            error={errors.language?.message}
            {...form.register("language")}
          />
          <TextField
            label="Age limit"
            placeholder="e.g. 16+ Yrs"
            error={errors.ageLimit?.message}
            {...form.register("ageLimit")}
          />
        </div>
        <TextAreaField label="About" required rows={5} error={errors.about?.message} {...form.register("about")} />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">2. Venue & schedule</h2>
        {venueChoices.length === 0 ? (
          <p className="text-xs text-admin-muted">
            {isSport ? "Add a stadium with a seat layout first" : "Add a venue first"} in{" "}
            <Link href="/venues" className="text-admin-indigo underline">
              Venues & Screens
            </Link>
            .
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Venue"
            required
            disabled={locked}
            options={venueChoices.map((v) => ({
              value: v.id,
              label: v.status === "inactive" ? `${v.name} (inactive)` : v.name,
            }))}
            placeholder="Choose one of your venues"
            error={errors.venueId?.message}
            {...form.register("venueId", {
              onChange: (e: { target: { value: string } }) => {
                if (isSport) chooseScreen(e.target.value, "");
              },
            })}
          />
          {isSport ? (
            <SelectField
              label="Stadium layout (screen)"
              required
              disabled={locked || !venueId}
              options={screens.map((s) => ({ value: s.id, label: s.name }))}
              placeholder={venueId ? "Choose the layout" : "Choose a venue first"}
              error={errors.screenId?.message}
              value={screenId}
              onChange={(e) => chooseScreen(venueId, e.target.value)}
            />
          ) : (
            <SelectField
              label="Schedule"
              required
              disabled={locked}
              options={SCHEDULE_OPTIONS}
              error={errors.scheduleType?.message}
              {...form.register("scheduleType")}
            />
          )}
          {scheduleType === "once" ? (
            <>
              <Controller
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <DateTimeField
                    label="Starts"
                    required
                    disabled={locked}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.startsAt?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <DateTimeField
                    label="Ends (optional)"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.endsAt?.message}
                  />
                )}
              />
            </>
          ) : (
            <>
              <TextField
                label="Opens at (IST)"
                type="time"
                required
                error={errors.opensAt?.message}
                {...form.register("opensAt")}
              />
              <TextField
                label="Closes at (IST)"
                type="time"
                required
                error={errors.closesAt?.message}
                {...form.register("closesAt")}
              />
            </>
          )}
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">3. Media & people</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Controller
            control={form.control}
            name="poster"
            render={({ field }) => (
              <ImageUrlField
                label="Vertical poster URL"
                required
                aspect="aspect-[2/3]"
                value={field.value}
                onChange={field.onChange}
                error={errors.poster?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="backdrop"
            render={({ field }) => (
              <ImageUrlField
                label="Landscape banner URL"
                value={field.value}
                onChange={field.onChange}
                error={errors.backdrop?.message}
              />
            )}
          />
        </div>
        {kind === "play" ? (
          <TextField
            label="Director"
            containerClassName="max-w-md"
            error={errors.director?.message}
            {...form.register("director")}
          />
        ) : null}
        <Controller
          control={form.control}
          name="artists"
          render={({ field }) => (
            <PeopleRows
              title={isSport ? "Teams & players" : "Performing artists"}
              withImage
              rows={field.value}
              onChange={field.onChange}
              errors={rowErrors(errors.artists)}
              addLabel={isSport ? "Add team or player" : "Add artist"}
              max={20}
            />
          )}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">
          4. {isSport ? "Seat categories & prices" : "Ticket tiers"}
        </h2>
        <p className="text-[11px] text-admin-subtle">
          {isSport
            ? "Each seat category of the stadium layout is one ticket type. Seat counts come from the layout."
            : "Capacity is the number of passes on sale. It can't go below what's sold or in checkout."}
        </p>
        {isSport && tiers.length === 0 ? (
          <p className="text-xs text-admin-muted">Choose the stadium layout above.</p>
        ) : null}
        <div className="space-y-2">
          {tiers.map((tier, index) => {
            const usage = usageOf(tier.id);
            const floor = (usage?.sold ?? 0) + (usage?.reserved ?? 0);
            return (
              <div
                key={tier.id || `new-${index}`}
                className="grid grid-cols-1 gap-2 rounded-lg border border-admin-border bg-slate-50/60 p-3 md:grid-cols-[1.2fr_1.5fr_1fr_1fr_auto]"
              >
                <div>
                  <Input
                    value={tier.name}
                    onChange={(e) => setTier(index, { name: e.target.value })}
                    placeholder="Tier name, e.g. Gold"
                    aria-label={`Tier ${index + 1} name`}
                    maxLength={60}
                  />
                  <FieldError
                    id={`tier-${index}-name`}
                    messages={tierErrors[`${index}.name`] ? [tierErrors[`${index}.name`] ?? ""] : undefined}
                  />
                </div>
                <div>
                  <Input
                    value={tier.description}
                    onChange={(e) => setTier(index, { description: e.target.value })}
                    placeholder="What's included"
                    aria-label={`Tier ${index + 1} description`}
                    maxLength={200}
                  />
                </div>
                <MoneyInput
                  label="Price"
                  value={tier.pricePaise || undefined}
                  onChange={(v) => setTier(index, { pricePaise: v ?? 0 })}
                  error={tierErrors[`${index}.pricePaise`]}
                />
                {isSport ? (
                  <div>
                    <p className="mb-1 text-[13px] font-semibold text-admin-text">Seats</p>
                    <p className="py-2 text-xs font-bold">{tier.capacity.toLocaleString("en-IN")}</p>
                  </div>
                ) : (
                  <NumberField
                    label="Capacity"
                    min={Math.max(1, floor)}
                    value={Number.isFinite(tier.capacity) ? tier.capacity : ""}
                    onChange={(e) => setTier(index, { capacity: e.target.valueAsNumber })}
                    hint={usage ? `${usage.sold} sold · ${usage.reserved} in checkout` : undefined}
                    error={tierErrors[`${index}.capacity`]}
                  />
                )}
                {isSport ? (
                  <span />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="self-center"
                    disabled={floor > 0 || tiers.length <= 1}
                    title={floor > 0 ? "Tickets sold or in checkout" : undefined}
                    onClick={() =>
                      form.setValue(
                        "tiers",
                        tiers.filter((_, i) => i !== index),
                        { shouldDirty: true },
                      )
                    }
                    aria-label={`Remove tier ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {errors.tiers?.message ? <p className="text-[11px] text-admin-danger">{errors.tiers.message}</p> : null}
        {!isSport && tiers.length < 10 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              form.setValue("tiers", [...tiers, { id: "", name: "", description: "", pricePaise: 0, capacity: 100 }], {
                shouldDirty: true,
              })
            }
          >
            <Plus className="h-4 w-4" aria-hidden /> Add tier
          </Button>
        ) : null}
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">5. Status</h2>
        <SelectField
          label="Status"
          required
          options={STATUS_OPTIONS}
          containerClassName="max-w-sm"
          error={errors.status?.message}
          {...form.register("status")}
        />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={`/events?kind=${kind}`}
          className="rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : event ? `Save ${labels.one.toLowerCase()}` : `Add ${labels.one.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
