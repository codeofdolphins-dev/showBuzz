import type { Metadata } from "next";
import { ListingSectionPage } from "@/components/public/event/ListingSectionPage";
import { withSeoOverride } from "@showbuzz/core/services/site-content.service";

const META: Metadata = {
  title: "Sports Matches",
  description: "Cricket, football and stadium tickets near you.",
};

/** SEO overrides from the admin console (prompt 7) apply over this. */
export function generateMetadata(): Promise<Metadata> {
  return withSeoOverride("/sports", META);
}

export default function Page() {
  return <ListingSectionPage section="sport" />;
}
