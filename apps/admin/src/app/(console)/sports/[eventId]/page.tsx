import type { Metadata } from "next";
import { LISTING_SECTIONS } from "@showbuzz/schemas/admin-catalog";
import { ListingDetail } from "@/components/catalog/ListingDetail";

export const metadata: Metadata = { title: LISTING_SECTIONS.sport.one };

export default async function SportsDetailPage({ params }: PageProps<"/sports/[eventId]">) {
  const { eventId } = await params;
  return <ListingDetail kind="sport" id={eventId} />;
}
