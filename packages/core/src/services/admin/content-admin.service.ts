import "server-only";
import { z } from "zod";
import { connect } from "@showbuzz/db/connect";
import { SEO_GLOBAL_KEY, SeoMeta } from "@showbuzz/db/models/SeoMeta";
import { SitePage } from "@showbuzz/db/models/SitePage";
import { Types } from "@showbuzz/db/mongoose";
import {
  DEFAULT_PAGES,
  PAGE_CONTENT_SCHEMAS,
  SEO_GLOBAL_DEFAULTS,
  SITE_PAGE_META,
  SITE_PAGE_SLUGS,
  type PageContent,
  type PageStatus,
  type SeoGlobal,
  type SitePageSlug,
  pageStatusSchema,
  seoEntryInputSchema,
  seoGlobalSchema,
} from "@showbuzz/schemas/site-content";
import type { SeoRow, SitePageRow } from "@showbuzz/schemas/types/admin-platform";
import { AppError } from "../../http/app-error";
import { type AdminListQuery, changedKeys, idOr404, isDuplicateKey, searchPattern } from "./shared";

/**
 * Website pages and SEO (prompt 7). Page content is validated with the page's own schema on save; the public site
 * validates again on read and falls back to DEFAULT_PAGES, so a bad document can never break a page. SEO entries
 * override a path's title/description/image; the global entry is the site-wide default.
 */

// ---------------------------------------------------------------------------------------------------------------
// Pages

export async function listSitePages(): Promise<SitePageRow[]> {
  await connect();
  const docs = await SitePage.find({}, { slug: 1, status: 1, updatedAt: 1 }).lean();
  const bySlug = new Map(docs.map((d) => [d.slug, d]));
  return SITE_PAGE_SLUGS.map((slug) => {
    const doc = bySlug.get(slug);
    return {
      slug,
      name: SITE_PAGE_META[slug].name,
      path: SITE_PAGE_META[slug].path,
      status: doc?.status ?? "published",
      usingDefault: !doc,
      ...(doc ? { updatedAt: doc.updatedAt.toISOString() } : {}),
    };
  });
}

export async function getSitePageForm<S extends SitePageSlug>(
  slug: S,
): Promise<{ status: PageStatus; content: PageContent<S>; usingDefault: boolean; updatedAt?: string }> {
  await connect();
  const doc = await SitePage.findOne({ slug }).lean();
  const parsed = doc ? PAGE_CONTENT_SCHEMAS[slug].safeParse(doc.content) : undefined;
  return {
    status: doc?.status ?? "published",
    content: (parsed?.success ? parsed.data : DEFAULT_PAGES[slug]) as PageContent<S>,
    usingDefault: !doc,
    ...(doc ? { updatedAt: doc.updatedAt.toISOString() } : {}),
  };
}

const savePageSchema = z.object({ status: pageStatusSchema, content: z.unknown() });

export async function saveSitePage(
  slug: SitePageSlug,
  input: unknown,
  staffId: string,
): Promise<{ changedFields: string[] }> {
  const { status, content: raw } = savePageSchema.parse(input);
  const content = PAGE_CONTENT_SCHEMAS[slug].parse(raw);
  await connect();
  const before = await SitePage.findOne({ slug }, { status: 1, content: 1 }).lean();
  await SitePage.updateOne(
    { slug },
    { $set: { status, content, updatedByStaffId: new Types.ObjectId(staffId) }, $setOnInsert: { slug } },
    { upsert: true },
  );
  const previous = (before?.content ?? DEFAULT_PAGES[slug]) as Record<string, unknown>;
  return {
    changedFields: [
      ...(before?.status !== status ? ["status"] : []),
      ...changedKeys(previous, content as Record<string, unknown>).map((k) => `content.${k}`),
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// SEO

export async function getSeoGlobalForm(): Promise<SeoGlobal> {
  await connect();
  const doc = await SeoMeta.findOne({ key: SEO_GLOBAL_KEY }).lean();
  const parsed = seoGlobalSchema.safeParse({ title: doc?.title, description: doc?.description });
  return parsed.success ? parsed.data : SEO_GLOBAL_DEFAULTS;
}

export async function saveSeoGlobal(input: unknown): Promise<{ changedFields: string[] }> {
  const data = seoGlobalSchema.parse(input);
  const before = await getSeoGlobalForm();
  await SeoMeta.updateOne(
    { key: SEO_GLOBAL_KEY },
    { $set: { title: data.title, description: data.description }, $setOnInsert: { key: SEO_GLOBAL_KEY } },
    { upsert: true },
  );
  return { changedFields: changedKeys({ ...before }, { ...data }) };
}

export async function listSeoEntries(query: AdminListQuery): Promise<{ rows: SeoRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = { key: { $ne: SEO_GLOBAL_KEY } };
  if (query.q.trim()) {
    filter.$or = [{ key: searchPattern(query.q) }, { title: searchPattern(query.q) }];
  }
  const [docs, total] = await Promise.all([
    SeoMeta.find(filter)
      .sort({ key: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    SeoMeta.countDocuments(filter),
  ]);
  return {
    rows: docs.map((d) => ({
      id: d._id.toString(),
      path: d.key,
      title: d.title,
      description: d.description,
      ogImage: d.ogImage,
      noindex: d.noindex,
      updatedAt: d.updatedAt.toISOString(),
    })),
    total,
  };
}

const pathTaken = () =>
  new AppError("CONFLICT", "This path already has SEO settings: edit those instead.", 409, {
    fieldErrors: { path: ["This path already has SEO settings."] },
  });

function entryFields(input: unknown) {
  const data = seoEntryInputSchema.parse(input);
  if (!data.title && !data.description && !data.ogImage && !data.noindex) {
    throw new AppError("VALIDATION_FAILED", "Fill in at least one field to override.", 422, {
      fieldErrors: { title: ["Fill in at least one field to override."] },
    });
  }
  return { data, set: { key: data.path, title: data.title, description: data.description, ogImage: data.ogImage, noindex: data.noindex } };
}

export async function createSeoEntry(input: unknown): Promise<{ id: string; path: string }> {
  const { set } = entryFields(input);
  await connect();
  try {
    const doc = await SeoMeta.create(set);
    return { id: doc._id.toString(), path: doc.key };
  } catch (err) {
    if (isDuplicateKey(err)) throw pathTaken();
    throw err;
  }
}

export async function updateSeoEntry(entryId: string, input: unknown): Promise<{ path: string; changedFields: string[] }> {
  const _id = idOr404(entryId, "SEO entry");
  const { data, set } = entryFields(input);
  await connect();
  const before = await SeoMeta.findOne({ _id, key: { $ne: SEO_GLOBAL_KEY } }).lean();
  if (!before) throw new AppError("NOT_FOUND", "SEO entry not found.", 404);
  try {
    await SeoMeta.updateOne({ _id }, { $set: set });
  } catch (err) {
    if (isDuplicateKey(err)) throw pathTaken();
    throw err;
  }
  return {
    path: data.path,
    changedFields: changedKeys(
      { path: before.key, title: before.title, description: before.description, ogImage: before.ogImage, noindex: before.noindex },
      { ...data },
    ),
  };
}

export async function deleteSeoEntry(entryId: string): Promise<{ path: string }> {
  const _id = idOr404(entryId, "SEO entry");
  await connect();
  const doc = await SeoMeta.findOneAndDelete({ _id, key: { $ne: SEO_GLOBAL_KEY } }, { projection: { key: 1 } }).lean();
  if (!doc) throw new AppError("NOT_FOUND", "SEO entry not found.", 404);
  return { path: doc.key };
}

export async function getSeoEntry(entryId: string): Promise<SeoRow | null> {
  const _id = idOr404(entryId, "SEO entry");
  await connect();
  const d = await SeoMeta.findOne({ _id, key: { $ne: SEO_GLOBAL_KEY } }).lean();
  if (!d) return null;
  return {
    id: d._id.toString(),
    path: d.key,
    title: d.title,
    description: d.description,
    ogImage: d.ogImage,
    noindex: d.noindex,
    updatedAt: d.updatedAt.toISOString(),
  };
}
