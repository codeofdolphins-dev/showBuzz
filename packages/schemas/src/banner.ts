import { z } from "zod";
import { imageUrlSchema, isoDateTimeSchema } from "./common";

/**
 * Home banners (prompt 7): the public home hero carousel. A banner targets one city or all of them and may have a
 * start and end; the carousel filters by the visitor's city and the current time in the browser, so the home page
 * stays a cached page. With no banner to show, the home page falls back to its built-in slides.
 */

export const BANNER_PLACEMENTS = [{ value: "home_hero", label: "Home hero carousel" }] as const;
export const bannerPlacementSchema = z.enum(["home_hero"]);

export const BANNER_TONES = [
  { value: "rose", label: "Rose" },
  { value: "purple", label: "Purple" },
  { value: "emerald", label: "Emerald" },
] as const;
export const BANNER_ICONS = [
  { value: "zap", label: "Lightning (movies)" },
  { value: "music", label: "Music (concerts)" },
  { value: "trophy", label: "Trophy (sports)" },
] as const;

/** Where the CTA goes: a path on showbuzz.com ("/movies/…") or an https link. */
const linkSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => /^\/(?!\/)\S*$/.test(v) || /^https:\/\/\S+$/.test(v), "Use a site path like /movies/… or an https link");

export const bannerInputSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a headline").max(80),
    blurb: z.string().trim().max(200),
    badge: z.string().trim().max(40),
    icon: z.enum(["zap", "music", "trophy"]),
    tone: z.enum(["rose", "purple", "emerald"]),
    /** Wide image (next/image only allows images.unsplash.com until media storage exists). */
    imageUrl: imageUrlSchema
      .or(z.literal(""))
      .refine((v) => v !== "", "Paste an https image URL")
      .refine((v) => v === "" || v.startsWith("https://images.unsplash.com/"), "Use an images.unsplash.com URL for now"),
    ctaLabel: z.string().trim().min(2, "Enter the button text").max(30),
    linkUrl: linkSchema,
    placement: bannerPlacementSchema,
    /** City slug, or "" for every city. */
    cityId: z.string().trim().max(64),
    startsAt: isoDateTimeSchema.or(z.literal("")),
    endsAt: isoDateTimeSchema.or(z.literal("")),
    active: z.boolean(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || Date.parse(v.endsAt) > Date.parse(v.startsAt), {
    path: ["endsAt"],
    message: "Must be after the start",
  });
export type BannerInput = z.input<typeof bannerInputSchema>;

/** A banner as the public home page gets it (active ones only; dates checked in the browser). */
export interface PublicBanner {
  id: string;
  title: string;
  blurb: string;
  badge: string;
  icon: "zap" | "music" | "trophy";
  tone: "rose" | "purple" | "emerald";
  imageUrl: string;
  ctaLabel: string;
  linkUrl: string;
  cityId?: string;
  startsAt?: string;
  endsAt?: string;
}
