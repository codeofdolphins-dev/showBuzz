import "server-only";
import { ACTIVE_MOVIE_FILTER, Movie } from "./models/Movie";
import { Show } from "./models/Show";
import { Vendor } from "./models/Vendor";
import { ACTIVE_VENUE_FILTER, Venue } from "./models/Venue";

/**
 * Turns each cinema's daily show templates into concrete `shows` documents. Idempotent: every show is an
 * upsert with `$setOnInsert` on the unique key (venue, screen, startsAt, movie), so re-running it (or two
 * servers running it at once) never duplicates a show or changes one that already exists. Each show belongs to
 * its cinema's vendor; a cinema without one (database not re-seeded since the marketplace change) is skipped.
 *
 * Demo only: it runs for the cinemas of vendors flagged `demoShowGeneration` (the seeded demo vendors). Real vendors
 * schedule every show in the partner portal, and their venues have no templates either. A show the vendor cancelled
 * keeps its document, so the insert-only upsert never brings it back.
 */

/** Price steps below a template's (top zone) price, with a floor, as the prototype priced its auditorium. */
const MOVIE_ZONE_STEPS: { minusPaise: number; floorPaise: number }[] = [
  { minusPaise: 0, floorPaise: 0 },
  { minusPaise: 18_000, floorPaise: 18_000 },
  { minusPaise: 30_000, floorPaise: 15_000 },
];

export function movieZonePrice(basePaise: number, zoneIndex: number): number {
  const step = MOVIE_ZONE_STEPS[Math.min(zoneIndex, MOVIE_ZONE_STEPS.length - 1)];
  return !step || zoneIndex === 0 ? basePaise : Math.max(step.floorPaise, basePaise - step.minusPaise);
}

/** `days` consecutive IST date keys ("2026-10-13") starting with today in IST. */
export function istDateKeys(now: Date, days: number): string[] {
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  const start = new Date(`${todayKey}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

/** "2026-10-13" + "18:15" in IST → UTC instant. */
function istInstant(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time}:00+05:30`);
}

/** True when every failure in a bulk write is a duplicate key (a concurrent run inserted the same show). */
function onlyDuplicateKeys(err: unknown): boolean {
  const e = err as { code?: number; writeErrors?: { code?: number }[] };
  if (e.writeErrors && e.writeErrors.length > 0) return e.writeErrors.every((w) => w.code === 11000);
  return e.code === 11000;
}

/** Creates the missing movie shows for the given IST dates. Returns how many were inserted. */
export async function ensureMovieShows(dateKeys: string[]): Promise<number> {
  const demoVendors = await Vendor.find({ demoShowGeneration: true }, { _id: 1 }).lean();
  if (demoVendors.length === 0) return 0;
  const [cinemas, movies] = await Promise.all([
    Venue.find({
      kind: "cinema",
      vendorId: { $in: demoVendors.map((v) => v._id) },
      "showTemplates.0": { $exists: true },
      ...ACTIVE_VENUE_FILTER,
    }).lean(),
    Movie.find({ status: "now-showing", ...ACTIVE_MOVIE_FILTER }, { _id: 1, durationMinutes: 1 }).lean(),
  ]);

  const ops: Parameters<typeof Show.bulkWrite>[0] = [];
  for (const cinema of cinemas) {
    if (!cinema.vendorId) continue;
    for (const template of cinema.showTemplates) {
      const screen = cinema.screens.find((s) => s.name === template.screenName);
      if (!screen) continue;
      const zones = screen.zones.map((zone, i) => ({
        zoneId: zone.id,
        name: zone.name,
        description: zone.description,
        pricePaise: movieZonePrice(template.pricePaise, i),
      }));
      for (const dateKey of dateKeys) {
        const startsAt = istInstant(dateKey, template.time);
        for (const movie of movies) {
          ops.push({
            updateOne: {
              filter: { venueId: cinema._id, screenId: screen.id, startsAt, movieId: movie._id },
              update: {
                $setOnInsert: {
                  vendorId: cinema.vendorId,
                  endsAt: new Date(startsAt.getTime() + movie.durationMinutes * 60_000),
                  status: "scheduled",
                  source: "template",
                  screenName: screen.name,
                  format: template.format,
                  language: template.language,
                  availability: template.availability,
                  pricePaise: template.pricePaise,
                  priceTier: template.priceTier,
                  zones,
                },
              },
              upsert: true,
            },
          });
        }
      }
    }
  }
  if (ops.length === 0) return 0;

  try {
    const result = await Show.bulkWrite(ops, { ordered: false });
    return result.upsertedCount;
  } catch (err) {
    if (onlyDuplicateKeys(err)) return 0;
    throw err;
  }
}
