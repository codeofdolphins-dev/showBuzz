"use client";

import { useState } from "react";
import {
  Building,
  Gem,
  Landmark,
  LaptopMinimal,
  LoaderCircle,
  LocateFixed,
  School,
  Search,
  Ship,
  TreePine,
  Umbrella,
  Castle,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@showbuzz/ui/Modal";
import { cn } from "@showbuzz/utils/cn";
import type { City } from "@showbuzz/schemas/city";
import { useCityStore } from "@/stores/city";
import { toast, useUiStore } from "@/stores/ui";

const CITY_ICONS: Record<string, LucideIcon> = {
  kolkata: Landmark,
  mumbai: Building,
  delhi: Castle,
  bengaluru: LaptopMinimal,
  hyderabad: Gem,
  chennai: Umbrella,
  pune: School,
  ahmedabad: Warehouse,
  chandigarh: TreePine,
  kochi: Ship,
};

/** Approximate centres, used to pick the nearest popular city from the browser location. */
const CITY_COORDS: Record<string, [number, number]> = {
  kolkata: [22.5726, 88.3639],
  mumbai: [19.076, 72.8777],
  delhi: [28.6139, 77.209],
  bengaluru: [12.9716, 77.5946],
  hyderabad: [17.385, 78.4867],
  chennai: [13.0827, 80.2707],
  pune: [18.5204, 73.8567],
  ahmedabad: [23.0225, 72.5714],
  chandigarh: [30.7333, 76.7794],
  kochi: [9.9312, 76.2673],
};

function nearestCityId(lat: number, lng: number): string | undefined {
  let best: { id: string; d: number } | undefined;
  for (const [id, [cLat, cLng]] of Object.entries(CITY_COORDS)) {
    const d = (cLat - lat) ** 2 + (cLng - lng) ** 2;
    if (!best || d < best.d) best = { id, d };
  }
  return best?.id;
}

export function CityModal({ cities }: { cities: City[] }) {
  const open = useUiStore((s) => s.cityModalOpen);
  const close = useUiStore((s) => s.closeCityModal);
  const current = useCityStore((s) => s.city);
  const setCity = useCityStore((s) => s.setCity);
  const [query, setQuery] = useState("");
  const [detecting, setDetecting] = useState(false);

  const q = query.toLowerCase().trim();
  const matches = (c: City) => c.name.toLowerCase().includes(q);
  const popular = cities.filter((c) => c.popular && matches(c));
  const others = cities.filter((c) => !c.popular && matches(c));

  const choose = (city: City) => {
    setCity({ id: city.id, name: city.name, state: city.state });
    toast(`Showing entertainment in ${city.name}!`, "success");
    setQuery("");
    close();
  };

  const detect = () => {
    if (!("geolocation" in navigator)) {
      toast("Location is not available in this browser.", "error");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetecting(false);
        const city = cities.find((c) => c.id === nearestCityId(pos.coords.latitude, pos.coords.longitude));
        if (city) choose(city);
      },
      () => {
        setDetecting(false);
        toast("We couldn't detect your location. Please pick a city.", "warning");
      },
      { timeout: 8000 },
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Select Your City"
      description="Explore movies & shows happening near you"
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for your city (e.g. Kolkata, Mumbai)..."
            aria-label="Search city"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-10 text-xs text-slate-800 focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/10 focus:outline-none sm:text-sm"
          />
          <Search className="absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        <button
          type="button"
          onClick={detect}
          disabled={detecting}
          className="tap-active flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100/70 disabled:opacity-60"
        >
          {detecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          <span>{detecting ? "Detecting location..." : "Detect My Current Location"}</span>
        </button>
      </div>

      {popular.length > 0 && (
        <div className="mt-5">
          <p className="mb-2.5 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Popular Cities</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3">
            {popular.map((c) => {
              const Icon = CITY_ICONS[c.id] ?? Building;
              const active = c.id === current.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choose(c)}
                  className={cn(
                    "tap-active flex flex-col items-center justify-center rounded-2xl border p-2.5 transition-all sm:p-3",
                    active
                      ? "border-rose-500 bg-rose-50/50 font-bold text-rose-600 shadow-sm"
                      : "border-slate-200/80 bg-white text-slate-700 hover:border-rose-300",
                  )}
                >
                  <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 sm:h-10 sm:w-10">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="max-w-full truncate text-[11px] font-semibold sm:text-xs">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Other Cities</p>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto p-1">
            {others.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c)}
                className="tap-active rounded-xl bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {popular.length === 0 && others.length === 0 && (
        <p className="mt-6 text-center text-xs text-slate-500">No cities match &ldquo;{query}&rdquo;.</p>
      )}
    </Modal>
  );
}
