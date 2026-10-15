import type { Metadata } from "next";
import { LISTING_SECTIONS } from "@showbuzz/schemas/admin-catalog";
import { ListingsList } from "@/components/catalog/ListingsList";

export const metadata: Metadata = { title: LISTING_SECTIONS.play.many };

/** Every vendor's plays (oversight; vendors edit them in the partner portal). */
export default async function PlaysPage({ searchParams }: PageProps<"/plays">) {
  return <ListingsList kind="play" sp={await searchParams} />;
}
