import type { Metadata } from "next";
import { OfferBrowser } from "@/components/public/offer/OfferBrowser";
import { listOffers } from "@showbuzz/core/services/catalog.service";
import { withSeoOverride } from "@showbuzz/core/services/site-content.service";

const META: Metadata = {
  title: "Offers & Promo Codes",
  description: "Save on movies, concerts, food combos and sports tickets.",
};

/** SEO overrides from the admin console (prompt 7) apply over this. */
export function generateMetadata(): Promise<Metadata> {
  return withSeoOverride("/offers", META);
}

export default async function OffersPage() {
  const offers = await listOffers();
  return (
    <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
      <div className="mb-8 flex flex-col items-center justify-between gap-6 rounded-3xl bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-700 p-8 text-white shadow-xl md:flex-row">
        <div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold tracking-wider uppercase">
            Verified Rewards
          </span>
          <h1 className="mt-2 text-3xl font-black">Exclusive Deals & Promo Codes</h1>
          <p className="mt-1 text-xs text-rose-100 sm:text-sm">
            Unlock massive savings on movies, concerts, dining combos and sports matches.
          </p>
        </div>
        <span className="rounded-2xl bg-white px-4 py-2 text-xs font-extrabold text-rose-600 shadow-md">
          Up to 50% Off
        </span>
      </div>
      <OfferBrowser offers={offers} />
    </main>
  );
}
