import { NotFoundCard } from "@/components/public/common/NotFoundCard";
import { BrandLogo } from "@/components/public/layout/BrandLogo";

/** Unmatched URLs. notFound() inside the public site renders (public)/(site)/not-found.tsx instead. */
export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="glass-header px-4 py-4 sm:px-6 lg:px-8 xl:px-12">
        <BrandLogo size="sm" />
      </header>
      <main className="flex w-full flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <NotFoundCard />
      </main>
    </div>
  );
}
