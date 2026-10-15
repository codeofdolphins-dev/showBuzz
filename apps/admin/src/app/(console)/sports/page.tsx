import type { Metadata } from "next";
import { LISTING_SECTIONS } from "@showbuzz/schemas/admin-catalog";
import { ListingsList } from "@/components/catalog/ListingsList";

export const metadata: Metadata = { title: LISTING_SECTIONS.sport.many };

/** Every vendor's sports (oversight; vendors edit them in the partner portal). */
export default async function SportsPage({ searchParams }: PageProps<"/sports">) {
  return <ListingsList kind="sport" sp={await searchParams} />;
}
