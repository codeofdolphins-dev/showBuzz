import { z } from "zod";
import { objectIdSchema } from "./common";
import { eventKindSchema } from "./event";

/**
 * Master data the super-admin maintains (prompt 7): cities (the public city picker), languages and genres (option
 * lists of the movie and event forms in both consoles). Movies and events store the names as text, so renaming one
 * updates every listing that uses it.
 */

export const masterStatusSchema = z.enum(["active", "inactive"]);
export type MasterStatus = z.infer<typeof masterStatusSchema>;

const SLUG = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Enter a URL name")
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes");

// ---------------------------------------------------------------------------------------------------------------
// Cities

/** Prototype cities.html classification. */
export const CITY_TIERS = [
  { value: "metro", label: "Tier 1 Metro" },
  { value: "tier2", label: "Tier 2 Hub" },
  { value: "other", label: "Other" },
] as const;
export const cityTierSchema = z.enum(["metro", "tier2", "other"]);
export type CityTier = z.infer<typeof cityTierSchema>;

export const cityInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the city name").max(60),
  /** The city's public id (venues, events and the city picker use it); fixed once created. */
  slug: SLUG,
  state: z.string().trim().max(60),
  tier: cityTierSchema,
  /** Listed under "Popular cities" in the picker. */
  popular: z.boolean(),
  status: masterStatusSchema,
});
export type CityInput = z.input<typeof cityInputSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Languages

export const languageInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the language").max(40),
  /** Prototype "Native Script", e.g. বাংলা. */
  nativeName: z.string().trim().max(40),
  status: masterStatusSchema,
});
export type LanguageInput = z.input<typeof languageInputSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Genres

/** Which forms a genre appears in: movie genres, or the category of an event / play / sport / activity. */
export const genreScopeSchema = z.enum(["movie", ...eventKindSchema.options]);
export type GenreScope = z.infer<typeof genreScopeSchema>;

export const GENRE_SCOPE_LABELS: Record<GenreScope, string> = {
  movie: "Movies",
  event: "Events",
  play: "Plays",
  sport: "Sports",
  activity: "Activities",
};

export const genreInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the genre").max(60),
  slug: SLUG,
  appliesTo: genreScopeSchema,
  status: masterStatusSchema,
});
export type GenreInput = z.input<typeof genreInputSchema>;

// ---------------------------------------------------------------------------------------------------------------

/** Up/down ordering on master-data and banner lists. */
export const reorderSchema = z.object({ id: objectIdSchema, direction: z.enum(["up", "down"]) });

/** Option lists the movie and event forms use (active master data, in display order). */
export interface MasterOptions {
  languages: string[];
  movieGenres: string[];
  eventCategories: Record<z.infer<typeof eventKindSchema>, string[]>;
}
