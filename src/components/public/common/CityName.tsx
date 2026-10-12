"use client";

import { useCityStore } from "@/stores/city";

/** The selected city lives on the client; render it as a small island inside server pages. */
export function CityName({ className }: { className?: string }) {
  const name = useCityStore((s) => s.city.name);
  return <span className={className}>{name}</span>;
}
