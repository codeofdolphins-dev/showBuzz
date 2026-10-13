import type { Metadata } from "next";
import { BookingSteps } from "@/components/public/booking/BookingSteps";
import { PaymentPanel } from "@/components/public/booking/PaymentPanel";
import { isDemoMode } from "@showbuzz/runtime/env";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default function PaymentPage() {
  return (
    <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <BookingSteps current="Pay" />
      <PaymentPanel demoMode={isDemoMode} />
    </main>
  );
}
