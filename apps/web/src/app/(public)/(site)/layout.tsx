import type { ReactNode } from "react";
import { MobileTabBar } from "@/components/public/layout/MobileTabBar";
import { SiteFooter } from "@/components/public/layout/SiteFooter";
import { SiteHeader } from "@/components/public/layout/SiteHeader";
import { getSearchIndex } from "@showbuzz/core/services/catalog.service";

/** Header, footer and the mobile tab bar for every public page except the seat map. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const searchIndex = await getSearchIndex();
  return (
    <div className="flex flex-1 flex-col pb-[calc(56px+env(safe-area-inset-bottom))] sm:pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
      <SiteHeader searchIndex={searchIndex} />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
