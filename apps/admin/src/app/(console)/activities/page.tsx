import type { Metadata } from "next";
import { LISTING_SECTIONS } from "@showbuzz/schemas/admin-catalog";
import { ListingsList } from "@/components/catalog/ListingsList";

export const metadata: Metadata = { title: LISTING_SECTIONS.activity.many };

/** Every vendor's activities (oversight; vendors edit them in the partner portal). */
export default async function ActivitiesPage({ searchParams }: PageProps<"/activities">) {
  return <ListingsList kind="activity" sp={await searchParams} />;
}
