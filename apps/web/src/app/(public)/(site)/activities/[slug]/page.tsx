import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingDetails } from "@/components/public/event/ListingDetails";
import { slugParams } from "@/lib/static-params";
import { getEventBySlug, listEvents } from "@showbuzz/core/services/catalog.service";
import { withSeoOverride } from "@showbuzz/core/services/site-content.service";

export async function generateStaticParams() {
  return slugParams((await listEvents("activity")).map((l) => l.slug));
}

export async function generateMetadata({ params }: PageProps<"/activities/[slug]">): Promise<Metadata> {
  const listing = await getEventBySlug("activity", (await params).slug);
  if (!listing) return { title: "Not found" };
  return withSeoOverride(`/activities/${listing.slug}`, { title: `${listing.title} - Book Tickets`, description: listing.about });
}

export default async function Page({ params }: PageProps<"/activities/[slug]">) {
  const listing = await getEventBySlug("activity", (await params).slug);
  if (!listing) notFound();
  return <ListingDetails listing={listing} section="activity" />;
}
