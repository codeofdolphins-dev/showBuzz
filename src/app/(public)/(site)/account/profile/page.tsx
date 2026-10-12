import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileDashboard } from "@/components/public/account/ProfileDashboard";
import { requireCustomerPage } from "@/server/auth/current-customer";
import { listEvents, listMovies } from "@/server/services/catalog.service";

export const metadata: Metadata = { title: "My Profile", robots: { index: false } };

/** Reads the session cookie, so it renders per request inside the page's Suspense boundary. */
async function SignedInProfile() {
  const customer = await requireCustomerPage("/account/profile");
  const [movies, ...eventGroups] = await Promise.all([
    listMovies(),
    listEvents("event"),
    listEvents("play"),
    listEvents("sport"),
    listEvents("activity"),
  ]);
  return <ProfileDashboard user={customer} movies={movies} events={eventGroups.flat()} />;
}

export default function ProfilePage() {
  return (
    <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <Suspense fallback={<div className="h-64 skeleton" />}>
        <SignedInProfile />
      </Suspense>
    </main>
  );
}
