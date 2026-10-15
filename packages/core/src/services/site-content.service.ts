import "server-only";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { connect } from "@showbuzz/db/connect";
import { Banner, toPublicBanner } from "@showbuzz/db/models/Banner";
import { Genre } from "@showbuzz/db/models/Genre";
import { Language } from "@showbuzz/db/models/Language";
import { SEO_GLOBAL_KEY, SeoMeta } from "@showbuzz/db/models/SeoMeta";
import { SETTINGS_KEY, Settings } from "@showbuzz/db/models/Settings";
import { SitePage } from "@showbuzz/db/models/SitePage";
import type { PublicBanner } from "@showbuzz/schemas/banner";
import { SETTINGS_DEFAULTS, type PublicSettings, settingsSchema } from "@showbuzz/schemas/settings";
import {
  DEFAULT_PAGES,
  PAGE_CONTENT_SCHEMAS,
  SEO_GLOBAL_DEFAULTS,
  type PageContent,
  type SeoGlobal,
  type SeoOverride,
  type SitePageSlug,
  type SitePageView,
  seoGlobalSchema,
} from "@showbuzz/schemas/site-content";
import { CATALOG_TAGS } from "./catalog-tags";

/**
 * Public reads of the content the super-admin edits (prompt 7): website pages, SEO, home banners, browse chips and
 * the public part of Settings. Cached like the catalogue (`use cache` + tags, refreshed by the consoles through
 * revalidateWeb); anything missing or invalid falls back to the content the site shipped with. Web app only (the
 * consoles don't use Cache Components).
 */

export async function getSitePage<S extends SitePageSlug>(slug: S): Promise<SitePageView<S>> {
  "use cache";
  cacheTag(CATALOG_TAGS.pages);
  cacheLife("hours");
  await connect();
  const doc = await SitePage.findOne({ slug, status: "published" }, { content: 1, updatedAt: 1 }).lean();
  const parsed = doc ? PAGE_CONTENT_SCHEMAS[slug].safeParse(doc.content) : undefined;
  if (!doc || !parsed?.success) return { content: DEFAULT_PAGES[slug] };
  return { content: parsed.data as PageContent<S>, updatedAt: doc.updatedAt.toISOString() };
}

export async function getSeoGlobal(): Promise<SeoGlobal> {
  "use cache";
  cacheTag(CATALOG_TAGS.seo);
  cacheLife("hours");
  await connect();
  const doc = await SeoMeta.findOne({ key: SEO_GLOBAL_KEY }).lean();
  const parsed = seoGlobalSchema.safeParse({ title: doc?.title, description: doc?.description });
  return parsed.success ? parsed.data : SEO_GLOBAL_DEFAULTS;
}

/** The SEO override for a path ("/movies/<slug>"), with empty fields left out. */
export async function getSeoOverride(path: string): Promise<SeoOverride> {
  "use cache";
  cacheTag(CATALOG_TAGS.seo);
  cacheLife("hours");
  await connect();
  const doc = await SeoMeta.findOne({ key: path.toLowerCase() }).lean();
  if (!doc || doc.key === SEO_GLOBAL_KEY) return {};
  return {
    ...(doc.title ? { title: doc.title } : {}),
    ...(doc.description ? { description: doc.description } : {}),
    ...(doc.ogImage ? { ogImage: doc.ogImage } : {}),
    ...(doc.noindex ? { noindex: true } : {}),
  };
}

/** Active home banners in order (dates and city are checked by the carousel in the browser). */
export async function listHomeBanners(): Promise<PublicBanner[]> {
  "use cache";
  cacheTag(CATALOG_TAGS.banners);
  cacheLife("hours");
  await connect();
  const docs = await Banner.find({ placement: "home_hero", active: true }).sort({ sortOrder: 1, _id: 1 }).lean();
  return docs.map(toPublicBanner);
}

/** Support contact and default city for the public pages. */
export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheTag(CATALOG_TAGS.settings);
  cacheLife("hours");
  await connect();
  const doc = await Settings.findOne({ key: SETTINGS_KEY }).lean();
  const parsed = settingsSchema.safeParse({ ...SETTINGS_DEFAULTS, ...doc });
  const settings = parsed.success ? parsed.data : SETTINGS_DEFAULTS;
  return {
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    defaultCityId: settings.defaultCityId,
  };
}

/** "Browse by language / genre" chips on the home page (active master data in order), or null before seeding. */
export async function listBrowseOptions(): Promise<{ languages: string[]; genres: string[] } | null> {
  "use cache";
  cacheTag(CATALOG_TAGS.languages, CATALOG_TAGS.genres);
  cacheLife("hours");
  await connect();
  const [languages, genres] = await Promise.all([
    Language.find({ status: "active" }, { name: 1 }).sort({ sortOrder: 1 }).limit(6).lean(),
    Genre.find({ status: "active", appliesTo: "movie" }, { name: 1 }).sort({ sortOrder: 1 }).limit(5).lean(),
  ]);
  if (languages.length === 0 && genres.length === 0) return null;
  return { languages: languages.map((l) => l.name), genres: genres.map((g) => g.name) };
}

/**
 * A page's metadata with the super-admin's SEO override for `path` merged over it (title as given, without the
 * "| ShowBuzz" template; description; share image; noindex).
 */
export async function withSeoOverride(path: string, base: Metadata): Promise<Metadata> {
  const override = await getSeoOverride(path);
  if (Object.keys(override).length === 0) return base;
  return {
    ...base,
    ...(override.title ? { title: { absolute: override.title } } : {}),
    ...(override.description ? { description: override.description } : {}),
    ...(override.ogImage ? { openGraph: { ...base.openGraph, images: [override.ogImage] } } : {}),
    ...(override.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
