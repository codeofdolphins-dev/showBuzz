import type { Metadata } from "next";
import { ListingSectionPage } from "@/components/public/event/ListingSectionPage";

export const metadata: Metadata = { title: "Activities & Experiences", description: "Go-karting, VR escape rooms and adventure activities near you." };

export default function Page() {
  return <ListingSectionPage section="activity" />;
}
