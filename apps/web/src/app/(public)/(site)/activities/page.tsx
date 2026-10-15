import type { Metadata } from "next";
import { ListingSectionPage } from "@/components/public/event/ListingSectionPage";
import { withSeoOverride } from "@showbuzz/core/services/site-content.service";

const META: Metadata = {
  title: "Activities & Experiences",
  description: "Go-karting, VR escape rooms and adventure activities near you.",
};

/** SEO overrides from the admin console (prompt 7) apply over this. */
export function generateMetadata(): Promise<Metadata> {
  return withSeoOverride("/activities", META);
}

export default function Page() {
  return <ListingSectionPage section="activity" />;
}
