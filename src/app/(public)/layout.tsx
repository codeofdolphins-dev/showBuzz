import type { ReactNode } from "react";
import { AuthModal } from "@/components/public/layout/AuthModal";
import { CityModal } from "@/components/public/layout/CityModal";
import { StoreHydrator } from "@/components/public/layout/StoreHydrator";
import { Toaster } from "@/components/ui/Toaster";
import { listCities } from "@/server/services/catalog.service";

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
    </>
  );
}
