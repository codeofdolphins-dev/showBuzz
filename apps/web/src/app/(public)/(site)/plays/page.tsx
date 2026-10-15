import type { Metadata } from "next";
import { ListingSectionPage } from "@/components/public/event/ListingSectionPage";
import { withSeoOverride } from "@showbuzz/core/services/site-content.service";

const META: Metadata = {
  title: "Plays & Theatre",
  description: "Live stage drama, classics and musicals near you.",
};

/** SEO overrides from the admin console (prompt 7) apply over this. */
export function generateMetadata(): Promise<Metadata> {
  return withSeoOverride("/plays", META);
}

export default function Page() {
  return <ListingSectionPage section="play" />;
}
