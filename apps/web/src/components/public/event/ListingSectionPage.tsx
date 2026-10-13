import { CalendarDays } from "lucide-react";
import { ListingCard } from "@/components/public/cards/ListingCard";
import { CityName } from "@/components/public/common/CityName";
import { EmptyState } from "@/components/public/common/EmptyState";
import { PageHeader } from "@/components/public/common/PageHeader";
import { listEvents } from "@showbuzz/core/services/catalog.service";
import { LISTING_SECTIONS, type ListingSection } from "./sections";

/** /plays, /sports and /activities share this listing. */
export async function ListingSectionPage({ section }: { section: ListingSection }) {
  const config = LISTING_SECTIONS[section];
  const listings = await listEvents(section);

  return (
    <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 xl:px-12">
      <PageHeader
        crumb={config.crumb}
        title={
          <>
            {config.titlePrefix} <CityName className="text-rose-600" />
          </>
        }
        description={config.description}
      />
      {listings.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={CalendarDays} title="Nothing scheduled yet" description="New listings are added every week." />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              href={`${config.path}/${l.slug}`}
              accent={config.accent}
              priceCaption={config.priceCaption}
              ctaLabel={config.ctaLabel}
              wideImage={config.wideImage}
              showLanguage={config.showLanguage}
            />
          ))}
        </div>
      )}
    </main>
  );
}
