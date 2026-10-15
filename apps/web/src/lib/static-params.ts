/**
 * Cache Components refuses a `generateStaticParams` that returns nothing, so an empty catalogue read breaks
 * `next build` — which a data change alone can cause (every vendor of a section suspended, a section not seeded
 * yet, a fresh database). The placeholder never matches a slug, so its page prerenders as the 404 these routes
 * already render for unknown slugs, and a deployment never depends on the catalogue having rows.
 *
 * https://nextjs.org/docs/messages/empty-generate-static-params
 */
const PLACEHOLDER_SLUG = "__none";

export function slugParams(slugs: string[]): { slug: string }[] {
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: PLACEHOLDER_SLUG }];
}
