import type { Metadata } from "next";
import { LISTING_SECTIONS } from "@showbuzz/schemas/admin-catalog";
import { ListingDetail } from "@/components/catalog/ListingDetail";

export const metadata: Metadata = { title: LISTING_SECTIONS.activity.one };

export default async function ActivitiesDetailPage({ params }: PageProps<"/activities/[eventId]">) {
  const { eventId } = await params;
  return <ListingDetail kind="activity" id={eventId} />;
}
