import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingDetails } from "@/components/public/event/ListingDetails";
import { getEventBySlug, listEvents } from "@/server/services/catalog.service";


export async function generateStaticParams() {
  return (await listEvents("activity")).map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/activities/[slug]">): Promise<Metadata> {
  const listing = await getEventBySlug("activity", (await params).slug);
  return listing ? { title: `${listing.title} - Book Tickets`, description: listing.about } : { title: "Not found" };
}

export default async function Page({ params }: PageProps<"/activities/[slug]">) {
  const listing = await getEventBySlug("activity", (await params).slug);
  if (!listing) notFound();
  return <ListingDetails listing={listing} section="activity" />;
}
