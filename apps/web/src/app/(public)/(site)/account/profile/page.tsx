import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileDashboard } from "@/components/public/account/ProfileDashboard";
import { requireCustomerPage, requireCustomerSession } from "@showbuzz/core/auth/current-customer";
import { getAccountProfile } from "@showbuzz/core/services/account.service";
import { listEvents, listMovies } from "@showbuzz/core/services/catalog.service";

export const metadata: Metadata = { title: "My Profile", robots: { index: false } };

/** Reads the session cookie, so it renders per request inside the page's Suspense boundary. */
async function SignedInProfile() {
  await requireCustomerPage("/account/profile");
  // Same cached lookup: adds the session id so the device list can mark "this device".
  const { user, sid } = await requireCustomerSession();
  const [profile, movies, ...eventGroups] = await Promise.all([
    getAccountProfile(user.id, sid, new Date()),
    listMovies(),
    listEvents("event"),
    listEvents("play"),
    listEvents("sport"),
    listEvents("activity"),
  ]);
  return <ProfileDashboard profile={profile} movies={movies} events={eventGroups.flat()} />;
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
