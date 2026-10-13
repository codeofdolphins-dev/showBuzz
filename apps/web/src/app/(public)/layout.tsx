import { type ReactNode, Suspense } from "react";
import { AuthDeepLink } from "@/components/public/layout/AuthDeepLink";
import { AuthModal } from "@/components/public/layout/AuthModal";
import { CityModal } from "@/components/public/layout/CityModal";
import { SessionBootstrap } from "@/components/public/layout/SessionBootstrap";
import { StoreHydrator } from "@/components/public/layout/StoreHydrator";
import { Toaster } from "@/components/ui/Toaster";
import { listCities } from "@showbuzz/core/services/catalog.service";

/** Shared by every customer page, including the full-screen seat map. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const cities = await listCities();
  return (
    <>
      {children}
      <CityModal cities={cities} />
      <AuthModal />
      <Toaster />
      <StoreHydrator />
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
