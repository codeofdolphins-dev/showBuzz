"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { Card } from "@showbuzz/console-ui/PageParts";
import { DateTimeField, MoneyInput, SelectField } from "@showbuzz/console-ui/fields";
import { Button, FieldError, FormMessage, Input, Label } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import {
  BULK_SHOW_MAX_SHOWS,
  SHOW_TURNAROUND_MINUTES,
  bulkShowInputSchema,
  dateKeysBetween,
  showInputSchema,
} from "@showbuzz/schemas/partner-listing";
import type { MovieOption, VenueScreenOption } from "@showbuzz/schemas/types/partner-listing";
import { formatDateShort, formatDuration, formatTime } from "@showbuzz/utils/dates";
import { createShowAction, createShowScheduleAction } from "@/app/_actions/shows";
import { applyActionError } from "@/lib/action-errors";
import { ShowClashes, type ShowClashList } from "./ShowClashes";

interface SchedulerValues {
  venueId: string;
  screenId: string;
  movieId: string;
  format: string;
  language: string;
  prices: { zoneId: string; pricePaise: number }[];
  startsAt: string;
  fromDate: string;
  toDate: string;
  times: string[];
}

/** Prototype show-form quick slots. */
const QUICK_SLOTS = [
  { time: "09:30", label: "Morning" },
  { time: "13:15", label: "Matinee" },
  { time: "17:00", label: "Evening" },
  { time: "20:30", label: "Prime night" },
  { time: "23:30", label: "Late night" },
];

interface ShowSchedulerProps {
  mode: "single" | "bulk";
  /** The vendor's cinemas (with screens). */
  venues: VenueScreenOption[];
  movies: MovieOption[];
  initialMovieId?: string;
  /** Today in IST ("2026-10-14"), for date defaults and limits. */
  todayKey: string;
}

function defaultPrices(venues: VenueScreenOption[], venueId: string, screenId: string) {
  const screen = venues.find((v) => v.id === venueId)?.screens.find((s) => s.id === screenId);
  return screen?.zones.map((z) => ({ zoneId: z.id, pricePaise: z.defaultPricePaise })) ?? [];
}

/**
 * Prototype show-form: movie, cinema and screen, format and language, a price per seat category (pre-filled from the
 * layout), then either one start time or a daily schedule (date range × start times, with a preview). The server
 * refuses overlaps on the screen (running time + 15-minute changeover) and creates all shows or none.
 */
export function ShowScheduler({ mode, venues, movies, initialMovieId, todayKey }: ShowSchedulerProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [clashes, setClashes] = useState<ShowClashList | null>(null);
  const [customTime, setCustomTime] = useState("");

  const firstVenue = venues[0];
  const firstScreen = firstVenue?.screens[0];
  const firstMovie = movies.find((m) => m.id === initialMovieId) ?? movies[0];
  const form = useForm<SchedulerValues>({
    resolver: (mode === "bulk"
      ? zodResolver(bulkShowInputSchema)
      : zodResolver(showInputSchema)) as unknown as Resolver<SchedulerValues>,
    defaultValues: {
      venueId: firstVenue?.id ?? "",
      screenId: firstScreen?.id ?? "",
      movieId: firstMovie?.id ?? "",
      format: firstScreen?.formats.find((f) => firstMovie?.formats.includes(f)) ?? firstScreen?.formats[0] ?? "",
      language: firstMovie?.languages[0] ?? "",
      prices: firstVenue && firstScreen ? defaultPrices(venues, firstVenue.id, firstScreen.id) : [],
      startsAt: "",
      fromDate: todayKey,
      toDate: todayKey,
      times: [],
    },
  });
  const errors = form.formState.errors;
  const [venueId, screenId, movieId, prices, startsAt, fromDate, toDate, times] = useWatch({
    control: form.control,
    name: ["venueId", "screenId", "movieId", "prices", "startsAt", "fromDate", "toDate", "times"],
  });
  const venue = venues.find((v) => v.id === venueId);
  const screen = venue?.screens.find((s) => s.id === screenId);
  const movie = movies.find((m) => m.id === movieId);
  const formatOptions = screen && screen.formats.length > 0 ? screen.formats : (movie?.formats ?? []);

  function chooseScreen(nextVenueId: string, nextScreenId: string) {
    form.setValue("screenId", nextScreenId);
    form.setValue("prices", defaultPrices(venues, nextVenueId, nextScreenId));
    const nextScreen = venues.find((v) => v.id === nextVenueId)?.screens.find((s) => s.id === nextScreenId);
    const current = form.getValues("format");
    if (nextScreen && nextScreen.formats.length > 0 && !nextScreen.formats.includes(current)) {
      form.setValue(
        "format",
        nextScreen.formats.find((f) => movie?.formats.includes(f)) ?? nextScreen.formats[0] ?? "",
      );
    }
  }

  function addTime(time: string) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || times.includes(time)) return;
    form.setValue("times", [...times, time].sort(), { shouldValidate: form.formState.isSubmitted });
  }

  const dates = fromDate && toDate && toDate >= fromDate ? dateKeysBetween(fromDate, toDate) : [];
  const batchSize = dates.length * times.length;
  const endsLabel =
    mode === "single" && startsAt && movie
      ? formatTime(new Date(Date.parse(startsAt) + movie.durationMinutes * 60_000))
      : null;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setMessage(null);
      setClashes(null);
      const result = mode === "bulk" ? await createShowScheduleAction(values) : await createShowAction(values);
      if (!result.success) {
        const details = result.error.details as { clashes?: ShowClashList["clashes"]; clashCount?: number } | undefined;
        if (details?.clashes)
          setClashes({ clashes: details.clashes, total: details.clashCount ?? details.clashes.length });
        setMessage(applyActionError(form, result.error));
        return;
      }
      const replaced = result.data.replacedDemoShows;
      const created = "created" in result.data ? result.data.created : 1;
      toast.success(
        `${created} show${created === 1 ? "" : "s"} scheduled.${
          replaced > 0
            ? ` ${replaced} unsold demo show${replaced === 1 ? " was" : "s were"} cancelled to free the screen.`
            : ""
        }`,
      );
      const day =
        mode === "bulk"
          ? values.fromDate
          : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(values.startsAt));
      router.push(`/shows?date=${day}&venue=${values.venueId}`);
      router.refresh();
    }),
  );

  if (venues.length === 0 || movies.length === 0) {
    return (
      <Card className="space-y-2 p-6 text-xs text-admin-muted">
        {venues.length === 0 ? (
          <p>
            Add a cinema with a screen first in{" "}
            <Link href="/venues" className="text-admin-indigo underline">
              Venues & Screens
            </Link>
            .
          </p>
        ) : null}
        {movies.length === 0 ? (
          <p>
            Add the films you screen in{" "}
            <Link href="/movies/add" className="text-admin-indigo underline">
              Movies
            </Link>{" "}
            first.
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      {clashes ? <ShowClashes {...clashes} /> : null}

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">
          1. Movie, cinema & screen
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Movie"
            required
            options={movies.map((m) => ({ value: m.id, label: `${m.title} (${formatDuration(m.durationMinutes)})` }))}
            error={errors.movieId?.message}
            {...form.register("movieId", {
              onChange: (e: { target: { value: string } }) => {
                const next = movies.find((m) => m.id === e.target.value);
                if (next && !next.languages.includes(form.getValues("language"))) {
                  form.setValue("language", next.languages[0] ?? "");
                }
              },
            })}
          />
          <SelectField
            label="Cinema"
            required
            options={venues.map((v) => ({
              value: v.id,
              label: v.status === "inactive" ? `${v.name} (inactive)` : v.name,
            }))}
            error={errors.venueId?.message}
            {...form.register("venueId", {
              onChange: (e: { target: { value: string } }) => {
                const nextVenue = venues.find((v) => v.id === e.target.value);
                chooseScreen(e.target.value, nextVenue?.screens[0]?.id ?? "");
              },
            })}
          />
          <SelectField
            label="Auditorium / screen"
            required
            options={(venue?.screens ?? []).map((s) => ({ value: s.id, label: s.name }))}
            placeholder={venue && venue.screens.length === 0 ? "This cinema has no screens yet" : undefined}
            error={errors.screenId?.message}
            value={screenId}
            onChange={(e) => chooseScreen(venueId, e.target.value)}
          />
          <SelectField
            label="Screen format"
            required
            options={formatOptions.map((f) => ({ value: f, label: f }))}
            placeholder={formatOptions.length === 0 ? "No formats" : undefined}
            error={errors.format?.message}
            {...form.register("format")}
          />
          <SelectField
            label="Audio language"
            required
            options={(movie?.languages ?? []).map((l) => ({ value: l, label: l }))}
            error={errors.language?.message}
            {...form.register("language")}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">
          2. Price per seat category
        </h2>
        <p className="text-[11px] text-admin-subtle">
          Pre-filled from the screen&apos;s layout. Applies to every show below.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(screen?.zones ?? []).map((zone) => {
            const index = prices.findIndex((p) => p.zoneId === zone.id);
            return (
              <MoneyInput
                key={zone.id}
                label={`${zone.name} (${zone.seats} seats)`}
                required
                value={prices[index]?.pricePaise || undefined}
                onChange={(v) =>
                  form.setValue(
                    "prices",
                    prices.map((p) => (p.zoneId === zone.id ? { ...p, pricePaise: v ?? 0 } : p)),
                  )
                }
                error={
                  (errors.prices?.[index] as { pricePaise?: { message?: string } } | undefined)?.pricePaise?.message
                }
              />
            );
          })}
        </div>
        {errors.prices?.message ? <p className="text-[11px] text-admin-danger">{errors.prices.message}</p> : null}
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">
          3. {mode === "bulk" ? "Daily schedule" : "Date & time"}
        </h2>
        {mode === "single" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Controller
              control={form.control}
              name="startsAt"
              render={({ field }) => (
                <DateTimeField
                  label="Show starts"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.startsAt?.message}
                />
              )}
            />
            {endsLabel ? (
              <p className="self-center text-xs text-admin-muted">
                Ends about {endsLabel}; the screen is free again {SHOW_TURNAROUND_MINUTES} minutes later.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Controller
                control={form.control}
                name="fromDate"
                render={({ field }) => (
                  <DateTimeField
                    dateOnly
                    label="First date"
                    required
                    min={todayKey}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.fromDate?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="toDate"
                render={({ field }) => (
                  <DateTimeField
                    dateOnly
                    label="Last date"
                    required
                    min={fromDate || todayKey}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.toDate?.message}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Daily start times (IST)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-admin-subtle">Quick slots:</span>
                {QUICK_SLOTS.map((slot) => (
                  <Button key={slot.time} type="button" variant="secondary" onClick={() => addTime(slot.time)}>
                    + {slot.time} {slot.label}
                  </Button>
                ))}
              </div>
              <div className="flex max-w-xs gap-2">
                <Input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  aria-label="Another start time"
                />
                <Button type="button" variant="secondary" onClick={() => addTime(customTime)}>
                  <Plus className="h-4 w-4" aria-hidden /> Add
                </Button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {times.map((time) => (
                  <li
                    key={time}
                    className="inline-flex items-center gap-1 rounded-full bg-admin-active px-3 py-1 text-xs font-bold text-admin-indigo"
                  >
                    {time}
                    <button
                      type="button"
                      onClick={() =>
                        form.setValue(
                          "times",
                          times.filter((t) => t !== time),
                        )
                      }
                      aria-label={`Remove ${time}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <FieldError id="times-error" messages={errors.times?.message ? [errors.times.message] : undefined} />
            </div>
            <div className="rounded-lg border border-admin-border bg-slate-50 p-3 text-xs">
              <p className="font-bold text-admin-dark">
                {dates.length} date{dates.length === 1 ? "" : "s"} × {times.length} slot{times.length === 1 ? "" : "s"}{" "}
                = {batchSize} show{batchSize === 1 ? "" : "s"}
                {batchSize > BULK_SHOW_MAX_SHOWS ? ` (max ${BULK_SHOW_MAX_SHOWS})` : ""}
              </p>
              {batchSize > 0 && batchSize <= 60 ? (
                <ul className="mt-2 grid grid-cols-2 gap-1 text-admin-muted sm:grid-cols-3 lg:grid-cols-4">
                  {dates.map((d) => (
                    <li key={d}>
                      {formatDateShort(new Date(`${d}T12:00:00+05:30`))}: {times.join(", ")}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </>
        )}
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/shows"
          className="rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Scheduling…"
            : mode === "bulk"
              ? `Schedule ${batchSize} show${batchSize === 1 ? "" : "s"}`
              : "Schedule show"}
        </Button>
      </div>
    </form>
  );
}
