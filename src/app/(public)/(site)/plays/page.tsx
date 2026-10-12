import type { Metadata } from "next";
import { ListingSectionPage } from "@/components/public/event/ListingSectionPage";

export const metadata: Metadata = { title: "Plays & Theatre", description: "Live stage drama, classics and musicals near you." };

export default function Page() {
  return <ListingSectionPage section="play" />;
}
