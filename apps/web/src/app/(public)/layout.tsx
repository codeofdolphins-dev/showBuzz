import { type ReactNode, Suspense } from "react";
import { AuthDeepLink } from "@/components/public/layout/AuthDeepLink";
import { AuthModal } from "@/components/public/layout/AuthModal";
import { CityModal } from "@/components/public/layout/CityModal";
import { SessionBootstrap } from "@/components/public/layout/SessionBootstrap";
import { StoreHydrator } from "@/components/public/layout/StoreHydrator";
import { WishlistSync } from "@/components/public/layout/WishlistSync";
import { Toaster } from "@/components/ui/Toaster";
import { listCities } from "@showbuzz/core/services/catalog.service";
import { getPublicSettings } from "@showbuzz/core/services/site-content.service";

/** Shared by every customer page, including the full-screen seat map. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [cities, settings] = await Promise.all([listCities(), getPublicSettings()]);
  const defaultCity = cities.find((c) => c.id === settings.defaultCityId);
  return (
    <>
      {children}
      <CityModal cities={cities} />
      <AuthModal />
      <Toaster />
      <StoreHydrator
        {...(defaultCity
          ? { defaultCity: { id: defaultCity.id, name: defaultCity.name, ...(defaultCity.state ? { state: defaultCity.state } : {}) } }
          : {})}
      />
      <WishlistSync />
      {/* Per-request parts stream in after the static shell (Cache Components). */}
      <Suspense fallback={null}>
        <SessionBootstrap />
      </Suspense>
      <Suspense fallback={null}>
        <AuthDeepLink />
      </Suspense>
    </>
  );
}
