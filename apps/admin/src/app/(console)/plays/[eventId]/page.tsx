import type { Metadata } from "next";
import { LISTING_SECTIONS } from "@showbuzz/schemas/admin-catalog";
import { ListingDetail } from "@/components/catalog/ListingDetail";

export const metadata: Metadata = { title: LISTING_SECTIONS.play.one };

export default async function PlaysDetailPage({ params }: PageProps<"/plays/[eventId]">) {
  const { eventId } = await params;
  return <ListingDetail kind="play" id={eventId} />;
}
