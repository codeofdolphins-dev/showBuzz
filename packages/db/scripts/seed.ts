/**
 * Loads the catalogue (./seed-data.ts) into MongoDB:
 *   pnpm db:seed
 * Idempotent: every record is upserted by its slug or code, so re-running it updates content in place and
 * never drops, deletes or duplicates anything. Then it creates the shows for the bookable date window.
 * Reads MONGODB_URI / MONGODB_DB from the environment (falls back to apps/web/.env.local if present).
 */
import { SHOW_DATE_WINDOW_DAYS } from "@showbuzz/schemas/constants";
import { SETTINGS_DEFAULTS } from "@showbuzz/schemas/settings";
import type { EventListing } from "@showbuzz/schemas/event";
import type { Screen, SeatZone, VenueKind } from "@showbuzz/schemas/venue";
import { connect, disconnect } from "@showbuzz/db/connect";
import { City } from "@showbuzz/db/models/City";
import { Coupon } from "@showbuzz/db/models/Coupon";
import { Event } from "@showbuzz/db/models/Event";
import { FoodItem } from "@showbuzz/db/models/FoodItem";
import { GiftCardDesign } from "@showbuzz/db/models/GiftCardDesign";
import { Movie } from "@showbuzz/db/models/Movie";
import { SETTINGS_KEY, Settings } from "@showbuzz/db/models/Settings";
import { Show } from "@showbuzz/db/models/Show";
import { StreamTitle } from "@showbuzz/db/models/StreamTitle";
import { Venue, screenIdFor } from "@showbuzz/db/models/Venue";
import type { Types } from "@showbuzz/db/mongoose";
import { ensureMovieShows, istDateKeys } from "@showbuzz/db/shows";
import { log } from "@showbuzz/runtime/log";
import { cinemas, cities, coupons, events, foodItems, giftCardDesigns, movies, streamTitles } from "./seed-data";

/** The prototype's auditorium (rows A-G, three price zones); every seeded screen and stand uses it. */
function standardZones(names: [string, string, string], recliner: boolean): SeatZone[] {
  const accents: SeatZone["accent"][] = ["rose", "amber", "blue"];
  const rows: { row: string; count: number }[][] = [
    [
      { row: "A", count: 8 },
      { row: "B", count: 8 },
    ],
    [
      { row: "C", count: 12 },
      { row: "D", count: 12 },
      { row: "E", count: 12 },
    ],
    [
      { row: "F", count: 12 },
      { row: "G", count: 12 },
    ],
  ];
  return names.map((name, i) => ({
    id: ["zone-1", "zone-2", "zone-3"][i] ?? `zone-${i + 1}`,
    name,
    description: name,
    accent: accents[i] ?? "blue",
    recliner: recliner && i === 0,
    rows: (rows[i] ?? []).map((r) => ({
      ...r,
      aisleAfter: r.count > 8 ? r.count / 2 : undefined,
      accessibleSeats: r.row === "C" ? [1, r.count] : [],
    })),
  }));
}

function cinemaScreen(name: string): Screen {
  return {
    id: screenIdFor(name),
    name,
    layoutType: "screen",
    zones: standardZones(["Royal Recliner", "Prime Gold", "Classic Silver"], true),
  };
}

const STADIUM_SCREEN: Screen = {
  id: "stadium",
  name: "Stadium",
  layoutType: "stadium",
  zones: standardZones(["Premium Stand", "Lower Stand", "Upper Stand"], false),
};

const STADIUM_BLOCKS = [
  "Purple Outer & Teal Blocks • G1/F1/D1/C1/K1/H/L",
  "Hot Pink Pavilion • Block C/K & Club House",
  "Gray Stand Blocks • G/F/D/B/H1/L1/B1",
];

function slugify(text: string, max = 80): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max)
    .replace(/-$/, "");
}

function withoutId<T extends { id: string }>(record: T): Omit<T, "id"> {
  const copy: Partial<T> = { ...record };
  delete copy.id;
  return copy as Omit<T, "id">;
}

async function upsertBy<T>(
  label: string,
  items: T[],
  upsert: (item: T, sortOrder: number) => Promise<unknown>,
): Promise<void> {
  for (const [i, item] of items.entries()) await upsert(item, i);
  log.info("Seeded", { collection: label, count: items.length });
}

async function seedEventVenue(event: EventListing, sortOrder: number) {
  const kind: VenueKind = event.kind === "sport" ? "stadium" : "venue";
  return Venue.findOneAndUpdate(
    { slug: slugify(event.venueName) },
    {
      $set: {
        kind,
        name: event.venueName,
        cityId: event.cityId,
        address: event.venueName,
        screens: kind === "stadium" ? [STADIUM_SCREEN] : [],
        sortOrder: 100 + sortOrder,
      },
    },
    { upsert: true, returnDocument: "after", lean: true },
  );
}

/** A stadium fixture is one Show at the stadium, with the stands priced and named from the event's tiers. */
async function seedFixtureShow(event: EventListing, eventId: Types.ObjectId, venueId: Types.ObjectId) {
  if (event.kind !== "sport" || event.schedule.type !== "once") return;
  const tiers = event.ticketTiers.slice(0, STADIUM_SCREEN.zones.length);
  const zones = STADIUM_SCREEN.zones.slice(0, tiers.length).map((zone, i) => ({
    zoneId: zone.id,
    name: tiers[i]?.name ?? zone.name,
    description: STADIUM_BLOCKS[i] ?? tiers[i]?.description ?? "",
    pricePaise: tiers[i]?.pricePaise ?? 0,
  }));
  await Show.updateOne(
    { venueId, screenId: STADIUM_SCREEN.id, startsAt: new Date(event.schedule.startsAt), eventId },
    {
      $set: {
        screenName: STADIUM_SCREEN.name,
        availability: "fast-filling",
        pricePaise: zones[0]?.pricePaise ?? 0,
        zones,
      },
    },
    { upsert: true },
  );
}

async function main() {
  await connect();
  const catalogueModels = [City, Movie, Venue, Event, StreamTitle, Coupon, FoodItem, GiftCardDesign, Show, Settings];
  // The unique indexes are what make upserts by slug/code safe; createIndexes never drops anything.
  for (const model of catalogueModels) await model.createIndexes();

  await Settings.updateOne({ key: SETTINGS_KEY }, { $setOnInsert: { ...SETTINGS_DEFAULTS } }, { upsert: true });
  log.info("Seeded", { collection: "settings", note: "defaults on first run only; later edits are kept" });

  await upsertBy("cities", cities, (c, sortOrder) =>
    City.updateOne(
      { slug: c.id },
      { $set: { name: c.name, state: c.state, popular: c.popular, sortOrder } },
      { upsert: true },
    ),
  );

  await upsertBy("movies", movies, (m, sortOrder) =>
    Movie.updateOne(
      { slug: m.slug },
      {
        $set: {
          ...withoutId(m),
          reviews: m.reviews.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })),
          sortOrder,
        },
      },
      { upsert: true },
    ),
  );

  await upsertBy("venues (cinemas)", cinemas, (c, sortOrder) => {
    const screenNames = [...new Set(c.showTemplates.map((t) => t.screenName))];
    return Venue.updateOne(
      { slug: c.slug },
      { $set: { ...withoutId(c), kind: "cinema", screens: screenNames.map(cinemaScreen), sortOrder } },
      { upsert: true },
    );
  });

  await upsertBy("events (+ venues, fixture shows)", events, async (e, sortOrder) => {
    const venue = await seedEventVenue(e, sortOrder);
    const schedule =
      e.schedule.type === "once"
        ? {
            type: "once",
            startsAt: new Date(e.schedule.startsAt),
            ...(e.schedule.endsAt ? { endsAt: new Date(e.schedule.endsAt) } : {}),
          }
        : e.schedule;
    const saved = await Event.findOneAndUpdate(
      { kind: e.kind, slug: e.slug },
      { $set: { ...withoutId(e), schedule, venueId: venue?._id, sortOrder } },
      { upsert: true, returnDocument: "after", lean: true },
    );
    if (saved && venue) await seedFixtureShow(e, saved._id, venue._id);
  });

  await upsertBy("streamTitles", streamTitles, (s, sortOrder) =>
    StreamTitle.updateOne({ slug: s.slug }, { $set: { ...withoutId(s), sortOrder } }, { upsert: true }),
  );

  await upsertBy("coupons", coupons, (c, sortOrder) =>
    Coupon.updateOne(
      { code: c.code },
      { $set: { ...withoutId(c), validUntil: new Date(c.validUntil), sortOrder } },
      { upsert: true },
    ),
  );

  await upsertBy("foodItems", foodItems, (f, sortOrder) =>
    FoodItem.updateOne({ code: f.id }, { $set: { ...withoutId(f), sortOrder } }, { upsert: true }),
  );

  await upsertBy("giftCardDesigns", giftCardDesigns, (g, sortOrder) =>
    GiftCardDesign.updateOne({ code: g.id }, { $set: { ...withoutId(g), sortOrder } }, { upsert: true }),
  );

  const inserted = await ensureMovieShows(istDateKeys(new Date(), SHOW_DATE_WINDOW_DAYS));
  log.info("Seeded", { collection: "shows", inserted, days: SHOW_DATE_WINDOW_DAYS });
}

main()
  .catch((err: unknown) => {
    log.error("Seed failed", { err });
    process.exitCode = 1;
  })
  .finally(() => disconnect());
