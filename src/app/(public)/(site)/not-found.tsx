import { NotFoundCard } from "@/components/public/common/NotFoundCard";

/** Unknown movie/event slugs render here, inside the site header, footer and tab bar. */
export default function SiteNotFound() {
  return (
    <main className="flex w-full flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <NotFoundCard />
    </main>
  );
}
