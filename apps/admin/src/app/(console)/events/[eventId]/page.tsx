import type { Metadata } from "next";
import { LISTING_SECTIONS } from "@showbuzz/schemas/admin-catalog";
import { ListingDetail } from "@/components/catalog/ListingDetail";

export const metadata: Metadata = { title: LISTING_SECTIONS.event.one };

export default async function EventsDetailPage({ params }: PageProps<"/events/[eventId]">) {
  const { eventId } = await params;
  return <ListingDetail kind="event" id={eventId} />;
}
