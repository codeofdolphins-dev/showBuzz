import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingDetails } from "@/components/public/event/ListingDetails";
import { slugParams } from "@/lib/static-params";
import { getEventBySlug, getShowIdForEvent, listEvents } from "@showbuzz/core/services/catalog.service";
import { withSeoOverride } from "@showbuzz/core/services/site-content.service";

export async function generateStaticParams() {
  return slugParams((await listEvents("sport")).map((l) => l.slug));
}

export async function generateMetadata({ params }: PageProps<"/sports/[slug]">): Promise<Metadata> {
  const listing = await getEventBySlug("sport", (await params).slug);
  if (!listing) return { title: "Not found" };
  return withSeoOverride(`/sports/${listing.slug}`, { title: `${listing.title} - Book Tickets`, description: listing.about });
}

export default async function Page({ params }: PageProps<"/sports/[slug]">) {
  const listing = await getEventBySlug("sport", (await params).slug);
  if (!listing) notFound();
  const seatMapShowId = await getShowIdForEvent(listing.id);
  return <ListingDetails listing={listing} section="sport" seatMapShowId={seatMapShowId} />;
}
