import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountGate } from "@/components/public/account/AccountGate";
import { BookingsList } from "@/components/public/account/BookingsList";
import { requireCustomerPage } from "@/server/auth/current-customer";
import { listBookings } from "@/server/services/booking.service";

export const metadata: Metadata = { title: "My Bookings", robots: { index: false } };

/** Reads the session cookie, so it renders per request inside the page's Suspense boundary. */
async function SignedInBookings() {
  const customer = await requireCustomerPage("/account/bookings");
  // Still every booking in memory: bookings are tied to the signed-in user in batch 1.8.
  const bookings = await listBookings(new Date());
  return (
    <AccountGate customer={customer}>
      <BookingsList bookings={bookings} />
    </AccountGate>
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
