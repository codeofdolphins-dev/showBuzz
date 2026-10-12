import Link from "next/link";
import { Clapperboard } from "lucide-react";

/** "Scene Missing" card shared by the root 404 and the in-site 404 (which keeps the header and footer). */
export function NotFoundCard() {
  return (
    <div className="w-full max-w-xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl sm:p-12">
      <div>
        <span className="gradient-text block text-8xl font-black tracking-tighter">404</span>
        <span className="mx-auto -mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-md">
          <Clapperboard className="h-7 w-7" />
        </span>
      </div>
      <div>
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Scene Missing! Page Not Found</h1>
        <p className="mt-1 text-xs text-slate-500">
          Looks like the reel rolled off the projector! The page or showtime you are looking for may have moved or ended.
        </p>
      </div>
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <Link href="/" className="gradient-btn flex-1 rounded-2xl py-3 text-xs font-black text-white shadow-lg shadow-rose-500/20">
          Back to Homepage &rarr;
        </Link>
        <Link href="/movies" className="flex-1 rounded-2xl bg-slate-100 py-3 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-200">
          Explore Movies
        </Link>
      </div>
    </div>
  );
}
