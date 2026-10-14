import { z } from "zod";
import { imageUrlSchema, isoDateTimeSchema, objectIdSchema, paiseSchema, wallClockTimeSchema } from "./common";
import { eventKindSchema, type EventKind } from "./event";
import { movieStatusSchema } from "./movie";

/**
 * Partner portal: the vendor's movies (shared catalogue), events / plays / sports / activities and show schedule.
 * The same schemas validate the forms (React Hook Form) and the Server Actions; the vendor always comes from the
 * session, never from these inputs.
 */

/** Cleaning / changeover time kept free between two shows on one screen. */
export const SHOW_TURNAROUND_MINUTES = 15;
/** Running time assumed for a fixture or event without one (keeps the screen free). */
export const EVENT_DEFAULT_DURATION_MINUTES = 180;
/** Bulk scheduling limits: one batch covers at most this many days and creates at most this many shows. */
export const BULK_SHOW_MAX_DAYS = 31;
export const BULK_SHOW_MAX_SHOWS = 200;

export const MOVIE_CERTIFICATE_OPTIONS = ["U", "UA", "UA 7+", "UA 13+", "UA 16+", "A", "S"] as const;
/** Suggestions (from the seeded catalogue and the prototype forms); vendors may type their own. */
export const MOVIE_LANGUAGE_OPTIONS = [
  "Hindi",
  "English",
  "Bengali",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Kannada",
  "Marathi",
  "Punjabi",
  "Gujarati",
] as const;
export const MOVIE_GENRE_OPTIONS = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Horror",
  "Music",
  "Mystery",
  "Mythology",
  "Romance",
  "Sci-Fi",
  "Sports",
  "Thriller",
] as const;
export const MOVIE_FORMAT_OPTIONS = ["2D", "3D", "IMAX 2D", "IMAX 3D", "4DX", "ScreenX", "Dolby Cinema"] as const;

export const EVENT_KIND_LABELS: Record<EventKind, { one: string; many: string }> = {
  event: { one: "Event", many: "Events" },
  play: { one: "Play", many: "Plays" },
  sport: { one: "Sport", many: "Sports" },
  activity: { one: "Activity", many: "Activities" },
};

/** Category suggestions per kind (seeded listings + prototype event-form); free text allowed. */
export const EVENT_CATEGORY_OPTIONS: Record<EventKind, readonly string[]> = {
  event: [
    "Music Concert",
    "Standup Comedy",
    "Festivals & Carnivals",
    "Workshops & Masterclasses",
    "Conferences & Talks",
    "Food & Drinks",
    "Magic & Illusion",
  ],
  play: ["Social Drama", "Shakespearean Drama", "Musical", "Comedy", "Children's Theatre"],
  sport: ["Cricket", "Football", "Kabaddi", "Badminton", "Tennis", "Hockey"],
  activity: ["Adventure & Thrill", "Gaming & VR", "Amusement Park", "Workshops", "Tours"],
};

const LISTING_SLUG = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Enter a URL name")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes");

const optionList = (label: string, max: number) =>
  z.array(z.string().trim().min(1).max(40)).min(1, `Choose at least one ${label}`).max(max, `Up to ${max}`);

const personName = z.string().trim().min(1, "Enter a name").max(80);
const personRole = z.string().trim().min(1, "Enter the role").max(80);

// ---------------------------------------------------------------------------------------------------------------
// Movies

export const movieInputSchema = z.object({
  title: z.string().trim().min(1, "Enter the title").max(150),
  slug: LISTING_SLUG,
  synopsis: z.string().trim().min(20, "Write at least a couple of sentences").max(3000),
  durationMinutes: z
    .number({ error: "Enter the running time in minutes" })
    .int("Whole minutes")
    .min(30, "At least 30 minutes")
    .max(400, "At most 400 minutes"),
  certificate: z.enum(MOVIE_CERTIFICATE_OPTIONS, { error: "Choose a certificate" }),
  languages: optionList("language", 10),
  genres: optionList("genre", 6),
  formats: optionList("format", 8),
  releaseDate: z.iso.date({ error: "Choose the release date" }),
  status: movieStatusSchema,
  poster: imageUrlSchema.or(z.literal("")).refine((v) => v !== "", "Paste an https image URL"),
  backdrop: imageUrlSchema.or(z.literal("")).refine((v) => v !== "", "Paste an https image URL"),
  trailerUrl: z.url({ protocol: /^https$/, error: "Paste an https link (YouTube)" }),
  director: personName,
  cast: z
    .array(z.object({ name: personName, role: personRole, image: imageUrlSchema }))
    .max(30, "Up to 30 cast members"),
  crew: z.array(z.object({ name: personName, role: personRole })).max(30, "Up to 30 crew members"),
});

export const movieSearchSchema = z.object({
  q: z.string().trim().max(80).default(""),
  language: z.string().trim().max(40).default(""),
  year: z
    .string()
    .trim()
    .regex(/^(\d{4})?$/)
    .default(""),
});

export type MovieInput = z.infer<typeof movieInputSchema>;
export type MovieSearchInput = z.infer<typeof movieSearchSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Events, plays, sports, activities

export const listingStatusSchema = z.enum(["active", "inactive"]);

export const ticketTierInputSchema = z.object({
  /** Kept when editing (bookings and the pass inventory point at it); new tiers get one on the server. */
  id: z.string().trim().max(64).default(""),
  name: z.string().trim().min(1, "Name the tier").max(60),
  description: z.string().trim().max(200),
  pricePaise: paiseSchema.refine((v) => v > 0, "Enter a price"),
  /** Passes on sale (events, plays, activities). Sports ignore it: seats come from the stadium layout. */
  capacity: z.int().min(0).max(100_000),
});

export const eventInputSchema = z
  .object({
    kind: eventKindSchema,
    title: z.string().trim().min(2, "Enter the title").max(150),
    slug: LISTING_SLUG,
    category: z.string().trim().min(2, "Choose or type a category").max(60),
    about: z.string().trim().min(20, "Describe the listing in a couple of sentences").max(5000),
    language: z.string().trim().max(40),
    ageLimit: z.string().trim().max(40),
    durationMinutes: z
      .number({ error: "Enter the duration in minutes" })
      .int()
      .min(15, "At least 15 minutes")
      .max(1440, "At most 24 hours"),
    venueId: objectIdSchema.or(z.literal("")).refine((v) => v !== "", "Choose one of your venues"),
    /** Sports only: the stadium screen (seat layout) the fixture is played on. */
    screenId: z.string().trim().max(64),
    scheduleType: z.enum(["once", "daily"]),
    /** UTC ISO (entered in IST); "once" only. */
    startsAt: isoDateTimeSchema.or(z.literal("")),
    endsAt: isoDateTimeSchema.or(z.literal("")),
    /** "daily" only (activities): opening hours in IST. */
    opensAt: wallClockTimeSchema.or(z.literal("")),
    closesAt: wallClockTimeSchema.or(z.literal("")),
    poster: imageUrlSchema.or(z.literal("")).refine((v) => v !== "", "Paste an https image URL"),
    backdrop: imageUrlSchema.or(z.literal("")),
    director: z.string().trim().max(80),
    artists: z
      .array(z.object({ name: personName, role: personRole, image: imageUrlSchema }))
      .max(20, "Up to 20 artists"),
    tiers: z.array(ticketTierInputSchema).min(1, "Add at least one ticket tier").max(10, "Up to 10 tiers"),
    status: listingStatusSchema,
  })
  .superRefine((input, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (input.scheduleType === "once") {
      if (!input.startsAt) issue("startsAt", "Choose the start date and time");
      if (input.startsAt && input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
        issue("endsAt", "Must be after the start");
      }
    } else {
      if (input.kind === "sport") issue("scheduleType", "A fixture has one start time");
      if (!input.opensAt) issue("opensAt", "Choose the opening time");
      if (!input.closesAt) issue("closesAt", "Choose the closing time");
      if (input.opensAt && input.closesAt && input.closesAt <= input.opensAt)
        issue("closesAt", "Must be after opening");
    }
    if (input.kind === "sport" && !input.screenId) issue("screenId", "Choose the stadium layout");
    if (input.kind !== "sport") {
      input.tiers.forEach((tier, i) => {
        if (tier.capacity < 1) ctx.addIssue({ code: "custom", path: ["tiers", i, "capacity"], message: "At least 1" });
      });
    }
    const names = input.tiers.map((t) => t.name.toLowerCase());
    names.forEach((name, i) => {
      if (names.indexOf(name) !== i) ctx.addIssue({ code: "custom", path: ["tiers", i, "name"], message: "Duplicate" });
    });
  });

export type EventInput = z.infer<typeof eventInputSchema>;
export type ListingStatus = z.infer<typeof listingStatusSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Shows

export const zonePriceInputSchema = z.object({
  zoneId: z.string().trim().min(1).max(64),
  pricePaise: paiseSchema.refine((v) => v > 0, "Enter a price"),
});

const showBaseFields = {
  venueId: objectIdSchema.or(z.literal("")).refine((v) => v !== "", "Choose a venue"),
  screenId: z.string().trim().min(1, "Choose a screen").max(64),
  movieId: objectIdSchema.or(z.literal("")).refine((v) => v !== "", "Choose a movie"),
  format: z.string().trim().min(1, "Choose a format").max(40),
  language: z.string().trim().min(1, "Choose a language").max(40),
  prices: z.array(zonePriceInputSchema).min(1, "Price every seat category").max(20),
};

export const showInputSchema = z.object({
  ...showBaseFields,
  startsAt: isoDateTimeSchema.or(z.literal("")).refine((v) => v !== "", "Choose the date and start time"),
});

const dateKeySchema = z.iso.date({ error: "Choose a date" });

export const bulkShowInputSchema = z
  .object({
    ...showBaseFields,
    fromDate: dateKeySchema,
    toDate: dateKeySchema,
    /** Daily start times in IST ("18:15"). */
    times: z.array(wallClockTimeSchema).min(1, "Add at least one start time").max(12, "Up to 12 shows a day"),
  })
  .superRefine((input, ctx) => {
    if (input.toDate < input.fromDate) {
      ctx.addIssue({ code: "custom", path: ["toDate"], message: "Must be on or after the first date" });
      return;
    }
    const days = Math.round((Date.parse(input.toDate) - Date.parse(input.fromDate)) / 86_400_000) + 1;
    if (days > BULK_SHOW_MAX_DAYS) {
      ctx.addIssue({ code: "custom", path: ["toDate"], message: `At most ${BULK_SHOW_MAX_DAYS} days at a time` });
    }
    if (new Set(input.times).size !== input.times.length) {
      ctx.addIssue({ code: "custom", path: ["times"], message: "Each start time once" });
    }
    if (days * input.times.length > BULK_SHOW_MAX_SHOWS) {
      ctx.addIssue({ code: "custom", path: ["times"], message: `At most ${BULK_SHOW_MAX_SHOWS} shows per batch` });
    }
  });

export const showUpdateSchema = z.object({
  /** Required for movie shows (the service checks); fixtures have none. */
  format: z.string().trim().max(40),
  prices: z.array(zonePriceInputSchema).min(1).max(20),
});

export type ShowInput = z.infer<typeof showInputSchema>;
export type BulkShowInput = z.infer<typeof bulkShowInputSchema>;
export type ShowUpdateInput = z.infer<typeof showUpdateSchema>;

/** Every IST date key from `from` to `to` inclusive. */
export function dateKeysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    keys.push(new Date(t).toISOString().slice(0, 10));
  }
  return keys;
}
