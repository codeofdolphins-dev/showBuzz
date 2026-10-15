import type { Metadata } from "next";
import { LISTING_SECTIONS } from "@showbuzz/schemas/admin-catalog";
import { ListingsList } from "@/components/catalog/ListingsList";

export const metadata: Metadata = { title: LISTING_SECTIONS.event.many };

/** Every vendor's events (oversight; vendors edit them in the partner portal). */
export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  return <ListingsList kind="event" sp={await searchParams} />;
}
