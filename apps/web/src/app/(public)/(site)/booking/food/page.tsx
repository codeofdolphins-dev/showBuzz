import type { Metadata } from "next";
import { BookingSteps } from "@/components/public/booking/BookingSteps";
import { HoldCountdown } from "@/components/public/booking/HoldCountdown";
import { FoodSelector } from "@/components/public/booking/FoodSelector";
import { listFoodItems } from "@showbuzz/core/services/catalog.service";

export const metadata: Metadata = { title: "Add Snacks", robots: { index: false } };

export default async function FoodPage() {
  const items = await listFoodItems();
  return (
    <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <BookingSteps current="Food" />
      <HoldCountdown />
      <FoodSelector items={items} />
    </main>
  );
}
