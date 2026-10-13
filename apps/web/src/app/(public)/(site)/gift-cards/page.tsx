import type { Metadata } from "next";
import { GiftCardDesigner } from "@/components/public/gift-card/GiftCardDesigner";
import { listGiftCardDesigns } from "@showbuzz/core/services/catalog.service";

export const metadata: Metadata = {
  title: "E-Gift Cards",
  description: "Gift movies, concerts, comedy nights and plays to your loved ones.",
};

export default async function GiftCardsPage() {
  const designs = await listGiftCardDesigns();
  return (
    <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
      <div className="mx-auto mb-10 max-w-xl text-center">
        <span className="text-xs font-black tracking-widest text-rose-600 uppercase">The Ultimate Present</span>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">ShowBuzz E-Gift Cards</h1>
        <p className="mt-2 text-xs text-slate-500 sm:text-sm">
          Gift endless movies, electrifying concerts, comedy nights and plays to your loved ones.
        </p>
      </div>
      <GiftCardDesigner designs={designs} />
    </main>
  );
}
