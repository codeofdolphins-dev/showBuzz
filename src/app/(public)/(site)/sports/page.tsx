import type { Metadata } from "next";
import { ListingSectionPage } from "@/components/public/event/ListingSectionPage";

export const metadata: Metadata = { title: "Sports Matches", description: "Cricket, football and stadium tickets near you." };

export default function Page() {
  return <ListingSectionPage section="sport" />;
}
