import type { Metadata } from "next";
import { AccountGate } from "@/components/public/account/AccountGate";
import { ProfileDashboard } from "@/components/public/account/ProfileDashboard";
import { listEvents, listMovies } from "@/server/services/catalog.service";

export const metadata: Metadata = { title: "My Profile", robots: { index: false } };

export default async function ProfilePage() {
  const [movies, ...eventGroups] = await Promise.all([
    listMovies(),
    listEvents("event"),
    listEvents("play"),
    listEvents("sport"),
    listEvents("activity"),
  ]);
  return (
    <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <AccountGate>
        <ProfileDashboard movies={movies} events={eventGroups.flat()} />
      </AccountGate>
    </main>
  );
}
