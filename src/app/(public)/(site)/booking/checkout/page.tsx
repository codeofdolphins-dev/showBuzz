import type { Metadata } from "next";
import { BookingSteps } from "@/components/public/booking/BookingSteps";
import { CheckoutForm } from "@/components/public/booking/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <BookingSteps current="Checkout" />
      <CheckoutForm />
    </main>
  );
}
