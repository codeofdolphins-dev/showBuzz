"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { Card } from "@showbuzz/console-ui/PageParts";
import {
  DateTimeField,
  ImageUrlField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import {
  MOVIE_CERTIFICATE_OPTIONS,
  MOVIE_FORMAT_OPTIONS,
  MOVIE_GENRE_OPTIONS,
  MOVIE_LANGUAGE_OPTIONS,
  movieInputSchema,
} from "@showbuzz/schemas/partner-listing";
import { slugify } from "@showbuzz/utils/text";
import { addMovieAction, createMovieAction, findDuplicatesAction, updateMovieAction } from "@/app/_actions/movies";
import { applyActionError } from "@/lib/action-errors";
import { OptionChips } from "@/components/listings/OptionChips";
import { PeopleRows, rowErrors } from "@/components/listings/PeopleRows";

type MovieFormInput = z.input<typeof movieInputSchema>;
type MovieFormOutput = z.output<typeof movieInputSchema>;
type Duplicate = { id: string; title: string; year: string; languages: string[] };

const CERTIFICATE_OPTIONS = MOVIE_CERTIFICATE_OPTIONS.map((c) => ({ value: c, label: c }));
const STATUS_OPTIONS = [
  { value: "now-showing", label: "Now showing (bookings open)" },
  { value: "upcoming", label: "Coming soon" },
];

const DUPLICATE_CHECK_DELAY_MS = 500;

interface MovieFormProps {
  /** Editing: the film's id and current values. */
  movie?: { id: string; values: MovieFormInput };
  /** New film: title typed on the search page. */
  initialTitle?: string;
}

/**
 * Prototype movie-form: basic information, visuals & synopsis, cast & crew, booking status. While the title is typed,
 * films with a similar title are listed as possible duplicates (a warning: creating anyway needs one confirmation).
 */
export function MovieForm({ movie, initialTitle = "" }: MovieFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(movie));
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [confirming, setConfirming] = useState<MovieFormOutput | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const form = useForm<MovieFormInput, unknown, MovieFormOutput>({
    resolver: zodResolver(movieInputSchema),
    defaultValues: movie?.values ?? {
      title: initialTitle,
      slug: slugify(initialTitle),
      synopsis: "",
      durationMinutes: 150,
      certificate: "UA 13+",
      languages: [],
      genres: [],
      formats: ["2D"],
      releaseDate: "",
      status: "now-showing",
      poster: "",
      backdrop: "",
      trailerUrl: "",
      director: "",
      cast: [],
      crew: [],
    },
  });
  const errors = form.formState.errors;
  const title = useWatch({ control: form.control, name: "title" });

  // Possible duplicates by title (debounced; the server answers from the whole catalogue).
  useEffect(() => {
    clearTimeout(timer.current);
    const text = (title ?? "").trim();
    if (text.length < 3) return;
    timer.current = setTimeout(async () => {
      const result = await findDuplicatesAction(text, movie?.id);
      if (result.success) setDuplicates(result.data);
    }, DUPLICATE_CHECK_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [title, movie?.id]);
  const shownDuplicates = (title ?? "").trim().length < 3 ? [] : duplicates;

  const nameField = form.register("title", {
    onChange: (event: { target: { value: string } }) => {
      if (!slugTouched) form.setValue("slug", slugify(event.target.value), { shouldValidate: false });
    },
  });

  function save(values: MovieFormOutput) {
    startTransition(async () => {
      setMessage(null);
      setConfirming(null);
      const result = movie ? await updateMovieAction(movie.id, values) : await createMovieAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(movie ? "Film saved." : "Film added to ShowBuzz and to your movies.");
      router.push(`/movies/${result.data.id}`);
      router.refresh();
    });
  }

  const onSubmit = form.handleSubmit((values) => {
    if (!movie && shownDuplicates.length > 0) setConfirming(values);
    else save(values);
  });

  function adoptExisting(id: string) {
    startTransition(async () => {
      const result = await addMovieAction(id);
      if (!result.success) {
        setMessage(result.error.message);
        return;
      }
      toast.success(`${result.data.title} is on your list.`);
      router.push(`/movies/${id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">
          1. Basic movie information
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Movie title"
            required
            placeholder="e.g. Kolkata Chronicles"
            error={errors.title?.message}
            {...nameField}
          />
          <TextField
            label="URL name"
            required
            hint="showbuzz.com/movies/<URL name>. Lowercase letters, numbers and dashes."
            error={errors.slug?.message}
            {...form.register("slug", { onChange: () => setSlugTouched(true) })}
          />
        </div>
        {shownDuplicates.length > 0 ? (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="mb-2 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" aria-hidden /> Possible duplicates already on ShowBuzz
            </p>
            <p className="mb-2">
              {movie
                ? "Another film has a similar title. Make sure this one is a different film."
                : "If your film is one of these, add it to your movies instead of creating it again."}
            </p>
            <ul className="space-y-1.5">
              {shownDuplicates.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/movies/${d.id}`} className="font-semibold underline" target="_blank">
                    {d.title}
                  </Link>
                  <span>
                    · {d.year} · {d.languages.join(", ")}
                  </span>
                  {movie ? null : (
                    <Button type="button" variant="secondary" disabled={pending} onClick={() => adoptExisting(d.id)}>
                      Use this film
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SelectField
            label="Censor certificate"
            required
            options={CERTIFICATE_OPTIONS}
            error={errors.certificate?.message}
            {...form.register("certificate")}
          />
          <NumberField
            label="Running time (minutes)"
            required
            min={30}
            max={400}
            error={errors.durationMinutes?.message}
            {...form.register("durationMinutes", { valueAsNumber: true })}
          />
          <Controller
            control={form.control}
            name="releaseDate"
            render={({ field }) => (
              <DateTimeField
                dateOnly
                label="Release date"
                required
                value={field.value}
                onChange={field.onChange}
                error={errors.releaseDate?.message}
              />
            )}
          />
        </div>
        <Controller
          control={form.control}
          name="languages"
          render={({ field }) => (
            <OptionChips
              label="Languages"
              required
              hint="The audio languages you can screen it in."
              suggestions={MOVIE_LANGUAGE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.languages?.message}
              customPlaceholder="Another language"
            />
          )}
        />
        <Controller
          control={form.control}
          name="genres"
          render={({ field }) => (
            <OptionChips
              label="Genres"
              required
              suggestions={MOVIE_GENRE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.genres?.message}
              customPlaceholder="Another genre"
            />
          )}
        />
        <Controller
          control={form.control}
          name="formats"
          render={({ field }) => (
            <OptionChips
              label="Available cinema formats"
              required
              suggestions={MOVIE_FORMAT_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.formats?.message}
              customPlaceholder="Another format"
            />
          )}
        />
        <TextField
          label="YouTube trailer URL"
          required
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          error={errors.trailerUrl?.message}
          {...form.register("trailerUrl")}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">2. Visuals & synopsis</h2>
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
                label="Landscape hero banner URL"
                required
                value={field.value}
                onChange={field.onChange}
                error={errors.backdrop?.message}
              />
            )}
          />
        </div>
        <TextAreaField
          label="Synopsis"
          required
          rows={5}
          placeholder="An investigative journalist uncovers a centuries-old mystery..."
          error={errors.synopsis?.message}
          {...form.register("synopsis")}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">3. Cast & crew</h2>
        <TextField
          label="Director"
          required
          containerClassName="max-w-md"
          error={errors.director?.message}
          {...form.register("director")}
        />
        <Controller
          control={form.control}
          name="cast"
          render={({ field }) => (
            <PeopleRows
              title="Cast"
              withImage
              rows={field.value}
              onChange={field.onChange}
              errors={rowErrors(errors.cast)}
              addLabel="Add cast member"
              max={30}
            />
          )}
        />
        <Controller
          control={form.control}
          name="crew"
          render={({ field }) => (
            <PeopleRows
              title="Crew"
              withImage={false}
              rows={field.value}
              onChange={(rows) => field.onChange(rows.map(({ name, role }) => ({ name, role })))}
              errors={rowErrors(errors.crew)}
              addLabel="Add crew member"
              max={30}
            />
          )}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">4. Booking status</h2>
        <SelectField
          label="Booking status"
          required
          options={STATUS_OPTIONS}
          containerClassName="max-w-sm"
          hint="Showtimes are sold on showbuzz.com only while the film is Now showing."
          error={errors.status?.message}
          {...form.register("status")}
        />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={movie ? `/movies/${movie.id}` : "/movies"}
          className="rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : movie ? "Save film" : "Add film"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="Create a new film anyway?"
        tone="primary"
        confirmLabel="Yes, it's a different film"
        pending={pending}
        description="ShowBuzz already has films with a similar title. One film should have one page, so only create it if it's really a different film."
        onConfirm={() => confirming && save(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </form>
  );
}
