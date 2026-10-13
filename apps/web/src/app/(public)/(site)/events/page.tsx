import type { Metadata } from "next";
import { EventBrowser } from "@/components/public/event/EventBrowser";
import { listEvents } from "@showbuzz/core/services/catalog.service";

export const metadata: Metadata = {
  title: "Events & Concerts",
  description: "Music concerts, standup comedy, magic shows and festivals near you.",
};

export default async function EventsPage() {
  const events = await listEvents("event");
  return (
    <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
      <EventBrowser events={events} />
    </main>
  );
}
