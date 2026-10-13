import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingDetails } from "@/components/public/event/ListingDetails";
import { getEventBySlug, getShowIdForEvent, listEvents } from "@showbuzz/core/services/catalog.service";

export async function generateStaticParams() {
  return (await listEvents("sport")).map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/sports/[slug]">): Promise<Metadata> {
  const listing = await getEventBySlug("sport", (await params).slug);
  return listing ? { title: `${listing.title} - Book Tickets`, description: listing.about } : { title: "Not found" };
}

export default async function Page({ params }: PageProps<"/sports/[slug]">) {
  const listing = await getEventBySlug("sport", (await params).slug);
  if (!listing) notFound();
  const seatMapShowId = await getShowIdForEvent(listing.id);
  return <ListingDetails listing={listing} section="sport" seatMapShowId={seatMapShowId} />;
}
