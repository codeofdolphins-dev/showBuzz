import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingSteps } from "@/components/public/booking/BookingSteps";
import { HoldCountdown } from "@/components/public/booking/HoldCountdown";
import { FoodSelector } from "@/components/public/booking/FoodSelector";
import { getFoodMenuForShow } from "@showbuzz/core/services/show.service";

export const metadata: Metadata = { title: "Add Snacks", robots: { index: false } };

/** The menu of the show's vendor and cinema (`?show=`), read per request inside the page's Suspense boundary. */
async function Menu({ searchParams }: { searchParams: PageProps<"/booking/food">["searchParams"] }) {
  const { show } = await searchParams;
  const items = typeof show === "string" ? await getFoodMenuForShow(show) : [];
  return <FoodSelector items={items} />;
}

export default function FoodPage({ searchParams }: PageProps<"/booking/food">) {
  return (
    <main className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
      <BookingSteps current="Food" />
      <HoldCountdown />
      <Suspense fallback={<div className="h-64 skeleton" />}>
        <Menu searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
