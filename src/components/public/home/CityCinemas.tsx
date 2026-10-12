"use client";

import Link from "next/link";
import { Building, CircleCheck } from "lucide-react";
import { EmptyState } from "@/components/public/common/EmptyState";
import type { Cinema } from "@/schemas/venue";
import { useCityStore } from "@/stores/city";

/** Popular cinemas in the selected city (the city is a client-side preference). */
export function CityCinemas({ cinemas }: { cinemas: Cinema[] }) {
  const cityId = useCityStore((s) => s.city.id);
  const cityName = useCityStore((s) => s.city.name);
  const inCity = cinemas.filter((c) => c.cityId === cityId).slice(0, 4);

  if (inCity.length === 0) {
    return (
      <EmptyState
        icon={Building}
        title={`No cinemas listed in ${cityName} yet`}
        description="We're onboarding multiplexes in your city. Try another city from the location picker."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {inCity.map((c) => (
        <div
          key={c.id}
          className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:border-blue-300 sm:p-5"
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 transition-colors hover:text-blue-600 sm:text-sm">
                  <Link href={`/cinemas?cinema=${c.slug}`}>{c.name}</Link>
                </h4>
                <p className="mt-0.5 text-[11px] text-slate-500">{c.address}</p>
              </div>
              <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                {c.distanceLabel}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {c.amenities.slice(0, 3).map((a) => (
                <span key={a} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600">
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
            {c.cancellation.allowed ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <CircleCheck className="h-3 w-3" /> Free Cancellation
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate-400">Non-Cancellable</span>
            )}
            <Link href={`/cinemas?cinema=${c.slug}`} className="font-bold text-blue-600 hover:text-blue-700">
              Showtimes &rarr;
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
