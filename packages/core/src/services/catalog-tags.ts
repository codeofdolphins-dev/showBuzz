/**
 * Cache tags of the public catalogue (one per collection). Kept apart from catalog.service (which holds the
 * "use cache" reads) so the consoles can name tags for revalidateWeb without importing cached functions.
 */
export const CATALOG_TAGS = {
  cities: "catalog:cities",
  movies: "catalog:movies",
  venues: "catalog:venues",
  events: "catalog:events",
  streamTitles: "catalog:stream-titles",
  coupons: "catalog:coupons",
  foodItems: "catalog:food-items",
  giftCardDesigns: "catalog:gift-card-designs",
  shows: "catalog:shows",
  vendors: "catalog:vendors",
} as const;

export type CatalogTag = (typeof CATALOG_TAGS)[keyof typeof CATALOG_TAGS];
