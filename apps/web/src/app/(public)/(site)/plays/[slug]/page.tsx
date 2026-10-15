import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingDetails } from "@/components/public/event/ListingDetails";
import { getEventBySlug, listEvents } from "@showbuzz/core/services/catalog.service";
import { withSeoOverride } from "@showbuzz/core/services/site-content.service";

export async function generateStaticParams() {
  return (await listEvents("play")).map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/plays/[slug]">): Promise<Metadata> {
  const listing = await getEventBySlug("play", (await params).slug);
  if (!listing) return { title: "Not found" };
  return withSeoOverride(`/plays/${listing.slug}`, { title: `${listing.title} - Book Tickets`, description: listing.about });
}

export default async function Page({ params }: PageProps<"/plays/[slug]">) {
  const listing = await getEventBySlug("play", (await params).slug);
  if (!listing) notFound();
  return <ListingDetails listing={listing} section="play" />;
}
