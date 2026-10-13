import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingsList } from "@/components/public/account/BookingsList";
import { requireCustomerPage } from "@showbuzz/core/auth/current-customer";
import { listBookings } from "@showbuzz/core/services/booking.service";
import { getSettings } from "@showbuzz/core/services/settings.service";

export const metadata: Metadata = { title: "My Bookings", robots: { index: false } };

/** Reads the session cookie, so it renders per request inside the page's Suspense boundary. */
async function SignedInBookings() {
  const customer = await requireCustomerPage("/account/bookings");
  const [bookings, settings] = await Promise.all([listBookings(customer.id, new Date()), getSettings()]);
  return (
    <BookingsList
      bookings={bookings}
      cancellation={{ feePaise: settings.cancellationFeePaise, cutoffMinutes: settings.cancellationCutoffMinutes }}
    />
  );
}

export default function BookingsPage() {
  return (
    <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <Suspense fallback={<div className="h-64 skeleton" />}>
        <SignedInBookings />
      </Suspense>
    </main>
  );
}
