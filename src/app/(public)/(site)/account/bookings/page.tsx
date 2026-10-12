import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountGate } from "@/components/public/account/AccountGate";
import { BookingsList } from "@/components/public/account/BookingsList";
import { listBookings } from "@/server/services/booking.service";

export const metadata: Metadata = { title: "My Bookings", robots: { index: false } };

async function Bookings() {
  await connection();
  const bookings = await listBookings(new Date());
  return <BookingsList bookings={bookings} />;
}

export default function BookingsPage() {
  return (
    <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <AccountGate>
        <Suspense fallback={<div className="h-64 skeleton" />}>
          <Bookings />
        </Suspense>
      </AccountGate>
    </main>
  );
}
