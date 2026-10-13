import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingsList } from "@/components/public/account/BookingsList";
import { requireCustomerPage } from "@showbuzz/core/auth/current-customer";
import { listBookings } from "@showbuzz/core/services/booking.service";

export const metadata: Metadata = { title: "My Bookings", robots: { index: false } };

/** Reads the session cookie, so it renders per request inside the page's Suspense boundary. */
async function SignedInBookings() {
  const customer = await requireCustomerPage("/account/bookings");
  const bookings = await listBookings(customer.id, new Date());
  return <BookingsList bookings={bookings} />;
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
