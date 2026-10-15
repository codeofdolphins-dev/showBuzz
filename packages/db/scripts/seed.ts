/**
 * Loads the catalogue (./seed-data.ts) into MongoDB:
 *   pnpm db:seed
 * Idempotent: every record is upserted by its slug or code, so re-running it updates content in place and
 * never deletes or duplicates anything. Then it creates the shows for the bookable date window.
 * Marketplace: creates the demo plan and vendors (KYC included), assigns every venue, event, show and food menu to
 * a vendor and backfills vendorId + settlement on older bookings, payments and refunds. The one index it drops is
 * the old unique `code_1` on foodItems (food codes are now unique per vendor).
 * Partner listings: the demo vendors are flagged `demoShowGeneration` (only their cinemas get template shows),
 * events are written on first insert only (the organiser edits them in the partner portal), shows get `endsAt` /
 * `status`, and each demo vendor's "My movies" list is filled from the films it already shows.
 * Prompt 7: cities are written on first insert only (the super-admin edits them) and get a tier and status; languages,
 * genres (movie genres + event categories) and the website pages are seeded on first insert only.
 * Reads MONGODB_URI / MONGODB_DB from the environment (falls back to apps/web/.env.local if present).
 */
import { SHOW_DATE_WINDOW_DAYS } from "@showbuzz/schemas/constants";
import { SETTINGS_DEFAULTS } from "@showbuzz/schemas/settings";
import { computeSettlement } from "@showbuzz/schemas/settlement";
import { vendorKycSchema } from "@showbuzz/schemas/vendor";
import {
  EVENT_CATEGORY_OPTIONS,
  EVENT_DEFAULT_DURATION_MINUTES,
  MOVIE_GENRE_OPTIONS,
  MOVIE_LANGUAGE_OPTIONS,
} from "@showbuzz/schemas/partner-listing";
import type { GenreScope } from "@showbuzz/schemas/master-data";
import { DEFAULT_PAGES, SITE_PAGE_SLUGS } from "@showbuzz/schemas/site-content";
import type { EventListing } from "@showbuzz/schemas/event";
import type { Screen, SeatZone, ShowTemplate, VenueKind } from "@showbuzz/schemas/venue";
import { connect, disconnect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { City } from "@showbuzz/db/models/City";
import { Coupon } from "@showbuzz/db/models/Coupon";
import { Event } from "@showbuzz/db/models/Event";
import { FoodItem } from "@showbuzz/db/models/FoodItem";
import { GiftCard } from "@showbuzz/db/models/GiftCard";
import { GiftCardDesign } from "@showbuzz/db/models/GiftCardDesign";
import { Genre } from "@showbuzz/db/models/Genre";
import { Language } from "@showbuzz/db/models/Language";
import { Lead } from "@showbuzz/db/models/Lead";
import { Movie } from "@showbuzz/db/models/Movie";
import { Payment } from "@showbuzz/db/models/Payment";
import { Plan } from "@showbuzz/db/models/Plan";
import { Refund } from "@showbuzz/db/models/Refund";
import { Review } from "@showbuzz/db/models/Review";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { SETTINGS_KEY, Settings } from "@showbuzz/db/models/Settings";
import { Show } from "@showbuzz/db/models/Show";
import { SitePage } from "@showbuzz/db/models/SitePage";
import { StreamTitle } from "@showbuzz/db/models/StreamTitle";
import { type StoredKycDocument, Vendor } from "@showbuzz/db/models/Vendor";
import { VendorMovie } from "@showbuzz/db/models/VendorMovie";
import { VendorUser } from "@showbuzz/db/models/VendorUser";
import { Venue, screenIdFor, toScreen } from "@showbuzz/db/models/Venue";
import { WishlistItem } from "@showbuzz/db/models/WishlistItem";
import { Types } from "@showbuzz/db/mongoose";
import { getFileStorage } from "@showbuzz/db/storage/file-storage";
import { ensureMovieShows, istDateKeys, movieZonePrice } from "@showbuzz/db/shows";
import { log } from "@showbuzz/runtime/log";
import {
  DEMO_PLAN,
  EVENT_ORGANISER,
  FOOD_MENU_VENDORS,
  type SeedVendorKey,
  cinemaOperators,
  cinemas,
  cities,
  coupons,
  events,
  foodItems,
  giftCardDesigns,
  movies,
  streamTitles,
  vendors,
} from "./seed-data";

/** The home page's browse chips before prompt 7, seeded first so they stay the chips. */
const HOME_LANGUAGES = ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Malayalam"];
const HOME_GENRES = ["Action", "Sci-Fi", "Romance", "Animation", "Mythology"];
const NATIVE_SCRIPTS: Record<string, string> = {
  English: "English",
  Hindi: "हिन्दी",
  Bengali: "বাংলা",
  Tamil: "தமிழ்",
  Telugu: "తెలుగు",
  Malayalam: "മലയാളം",
  Kannada: "ಕನ್ನಡ",
  Marathi: "मराठी",
  Punjabi: "ਪੰਜਾਬੀ",
  Gujarati: "ગુજરાતી",
};

/** The prototype's auditorium (rows A-G, three price zones); every seeded screen and stand uses it. */
function standardZones(names: [string, string, string], recliner: boolean, topPricePaise: number): SeatZone[] {
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
    defaultPricePaise: movieZonePrice(topPricePaise, i),
    rows: (rows[i] ?? []).map((r) => ({
      ...r,
      aislesAfter: r.count > 8 ? [r.count / 2] : [],
      accessibleSeats: r.row === "C" ? [1, r.count] : [],
      blockedSeats: [],
    })),
  }));
}

/** A seeded cinema screen, priced from its most expensive template and offering the templates' formats. */
function cinemaScreen(name: string, templates: ShowTemplate[]): Screen {
  const own = templates.filter((t) => t.screenName === name);
  return {
    id: screenIdFor(name),
    name,
    layoutType: "screen",
    formats: [...new Set(own.map((t) => t.format))],
    zones: standardZones(
      ["Royal Recliner", "Prime Gold", "Classic Silver"],
      true,
      Math.max(0, ...own.map((t) => t.pricePaise)),
    ),
  };
}

const STADIUM_SCREEN: Screen = {
  id: "stadium",
  name: "Stadium",
  layoutType: "stadium",
  formats: ["Live Event"],
  zones: standardZones(["Premium Stand", "Lower Stand", "Upper Stand"], false, 150_000),
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

async function seedEventVenue(event: EventListing, sortOrder: number, vendorId: Types.ObjectId) {
  const kind: VenueKind = event.kind === "sport" ? "stadium" : "venue";
  return Venue.findOneAndUpdate(
    { slug: slugify(event.venueName) },
    {
      $set: { vendorId, kind, sortOrder: 100 + sortOrder },
      // The vendor edits these in the partner portal; re-seeding must not undo that.
      $setOnInsert: {
        name: event.venueName,
        cityId: event.cityId,
        address: event.venueName,
        screens: kind === "stadium" ? [STADIUM_SCREEN] : [],
      },
    },
    { upsert: true, returnDocument: "after", lean: true },
  );
}

/** A stadium fixture is one Show at the stadium, with the stands priced and named from the event's tiers. */
async function seedFixtureShow(
  event: EventListing,
  eventId: Types.ObjectId,
  venueId: Types.ObjectId,
  vendorId: Types.ObjectId,
) {
  if (event.kind !== "sport" || event.schedule.type !== "once") return;
  const tiers = event.ticketTiers.slice(0, STADIUM_SCREEN.zones.length);
  const zones = STADIUM_SCREEN.zones.slice(0, tiers.length).map((zone, i) => ({
    zoneId: zone.id,
    name: tiers[i]?.name ?? zone.name,
    description: STADIUM_BLOCKS[i] ?? tiers[i]?.description ?? "",
    pricePaise: tiers[i]?.pricePaise ?? 0,
  }));
  const startsAt = new Date(event.schedule.startsAt);
  await Show.updateOne(
    { venueId, screenId: STADIUM_SCREEN.id, startsAt, eventId },
    {
      $set: { vendorId },
      // Prices and stands are the organiser's to edit in the partner portal; re-seeding must not undo that.
      $setOnInsert: {
        screenName: STADIUM_SCREEN.name,
        endsAt: new Date(startsAt.getTime() + EVENT_DEFAULT_DURATION_MINUTES * 60_000),
        status: "scheduled",
        source: "manual",
        pricePaise: zones[0]?.pricePaise ?? 0,
        zones,
      },
    },
    { upsert: true },
  );
}

/**
 * Events, plays and activities sell passes by quantity: one Show per listing holds each tier's capacity.
 * `$setOnInsert` only, so re-seeding never resets what has been sold. Daily activities have no start time.
 */
async function seedPassShow(
  event: EventListing,
  eventId: Types.ObjectId,
  venueId: Types.ObjectId,
  vendorId: Types.ObjectId,
) {
  if (event.kind === "sport") return;
  const startsAt = event.schedule.type === "once" ? new Date(event.schedule.startsAt) : null;
  await Show.updateOne(
    { venueId, screenId: "passes", startsAt, eventId },
    {
      $set: { vendorId },
      $setOnInsert: {
        screenName: "General Admission",
        status: "scheduled",
        source: "manual",
        pricePaise: Math.min(...event.ticketTiers.map((t) => t.pricePaise)),
        inventory: event.ticketTiers.map((t) => ({
          tierId: t.id,
          capacity: t.available,
          remaining: t.available,
          sold: 0,
        })),
      },
    },
    { upsert: true },
  );
}

/** A one-page PDF reading "DEMO DOCUMENT" for seeded KYC (generated here, so nothing is downloaded). */
function demoPdf(label: string): Uint8Array {
  const text = `DEMO DOCUMENT - ${label} - not a real KYC record`.replace(/[()\\]/g, "");
  const stream = `BT /F1 16 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

const DEMO_KYC_DOCUMENTS = ["gst_certificate", "pan_card", "cancelled_cheque"] as const;

/**
 * The demo plan and vendors. Rates, policy, status and KYC are set on first insert only, so changes made later in
 * the back office survive a re-seed. Demo KYC documents are uploaded once (only while the vendor has none).
 */
async function seedVendors(): Promise<Map<SeedVendorKey, Types.ObjectId>> {
  const plan = await Plan.findOneAndUpdate(
    { name: DEMO_PLAN.name },
    { $setOnInsert: DEMO_PLAN },
    { upsert: true, returnDocument: "after", lean: true },
  );
  const ids = new Map<SeedVendorKey, Types.ObjectId>();
  const kycSchema = vendorKycSchema.omit({ documents: true });
  for (const v of vendors) {
    const kyc = kycSchema.parse(v.kyc);
    const vendor = await Vendor.findOneAndUpdate(
      { slug: v.key },
      {
        $setOnInsert: {
          businessName: v.businessName,
          businessType: v.businessType,
          contact: v.contact,
          address: v.address,
          kyc: { ...kyc, documents: [] },
          onboardingStatus: "complete",
          status: "active",
          billingModel: v.billingModel,
          ...(v.planName && plan ? { planId: plan._id } : {}),
          commissionBps: v.commissionBps,
          convenienceFeeBps: v.convenienceFeeBps,
          gstBps: v.gstBps,
          cancellation: v.cancellation,
          shareCustomerContact: false,
        },
        // Only the seeded demo vendors get shows from their cinemas' templates (see ensureMovieShows).
        $set: { demoShowGeneration: true },
      },
      { upsert: true, returnDocument: "after", lean: true },
    );
    if (!vendor) throw new Error(`Vendor ${v.key} was not saved`);
    if (vendor.kyc.documents.length === 0) {
      const storage = getFileStorage();
      const documents: StoredKycDocument[] = [];
      for (const kind of DEMO_KYC_DOCUMENTS) {
        const file = await storage.put({
          filename: `${v.key}-${kind}.pdf`,
          data: demoPdf(`${v.businessName} ${kind}`),
          owner: { ownerType: "vendor", ownerId: vendor._id.toString() },
        });
        documents.push({
          fileId: new Types.ObjectId(file.fileId),
          kind,
          filename: file.filename,
          contentType: file.contentType,
          size: file.size,
          uploadedAt: file.uploadedAt,
        });
      }
      await Vendor.updateOne(
        { _id: vendor._id, "kyc.documents.0": { $exists: false } },
        { $set: { "kyc.documents": documents } },
      );
    }
    ids.set(v.key, vendor._id);
  }
  log.info("Seeded", { collection: "vendors", count: vendors.length, plans: 1 });
  return ids;
}

function vendorIdFor(ids: Map<SeedVendorKey, Types.ObjectId>, key: SeedVendorKey): Types.ObjectId {
  const id = ids.get(key);
  if (!id) throw new Error(`Unknown seed vendor ${key}`);
  return id;
}

/** Food codes used to be unique on their own; each vendor now has its own copy of a menu. */
async function dropLegacyFoodIndex(): Promise<void> {
  const indexes = await FoodItem.collection.indexes().catch(() => []);
  if (indexes.some((i) => i.name === "code_1")) await FoodItem.collection.dropIndex("code_1");
}

/**
 * Gives records from before the marketplace change their vendor: shows from their venue, bookings from their
 * show (with a settlement rebuilt from the stored amounts: fees at the Settings rates they were charged, the
 * vendor's commission), payments and refunds from their booking. Gift card purchases stay platform sales. Only
 * fills missing fields, so re-running changes nothing. Older bookings keep the Settings cancellation terms.
 */
async function backfillOwnership(): Promise<void> {
  let shows = 0;
  for (const venue of await Venue.find({}, { vendorId: 1 }).lean()) {
    if (!venue.vendorId) continue;
    const result = await Show.updateMany(
      { venueId: venue._id, vendorId: { $exists: false } },
      { $set: { vendorId: venue.vendorId } },
    );
    shows += result.modifiedCount;
  }

  const settings = await Settings.findOne({ key: SETTINGS_KEY }).lean();
  const charged = {
    convenienceFeeBps: settings?.convenienceFeeBps ?? SETTINGS_DEFAULTS.convenienceFeeBps,
    gstBps: settings?.gstBps ?? SETTINGS_DEFAULTS.gstBps,
  };
  const vendorById = new Map((await Vendor.find().lean()).map((v) => [v._id.toString(), v]));
  const bookings = await Booking.find({
    vendorId: { $exists: false },
    kind: { $ne: "gift-card" },
    showId: { $exists: true },
  }).lean();
  const showVendor = new Map(
    (await Show.find({ _id: { $in: bookings.map((b) => b.showId) } }, { vendorId: 1 }).lean()).map((s) => [
      s._id.toString(),
      s.vendorId,
    ]),
  );
  let backfilled = 0;
  for (const booking of bookings) {
    const vendorId = booking.showId ? showVendor.get(booking.showId.toString()) : undefined;
    const vendor = vendorId ? vendorById.get(vendorId.toString()) : undefined;
    if (!vendorId || !vendor) continue;
    const a = booking.amounts;
    const settlement = computeSettlement({
      billingModel: vendor.billingModel,
      commissionBps: vendor.commissionBps,
      ...charged,
      ticketsPaise: a.ticketsPaise,
      foodPaise: a.foodPaise,
      discountPaise: a.discountPaise,
      convenienceFeePaise: a.convenienceFeePaise,
      gstPaise: a.gstPaise,
      totalPaise: a.totalPaise,
    });
    const result = await Booking.updateOne(
      { _id: booking._id, vendorId: { $exists: false } },
      { $set: { vendorId, settlement } },
    );
    backfilled += result.modifiedCount;
  }

  let payments = 0;
  let refunds = 0;
  for (const booking of await Booking.find({ vendorId: { $exists: true } }, { vendorId: 1 }).lean()) {
    const filter = { bookingId: booking._id, vendorId: { $exists: false } };
    const update = { $set: { vendorId: booking.vendorId } };
    payments += (await Payment.updateMany(filter, update)).modifiedCount;
    refunds += (await Refund.updateMany(filter, update)).modifiedCount;
  }
  log.info("Backfilled vendor ownership", { shows, bookings: backfilled, payments, refunds });
}

/**
 * Brings venues stored before the layout designer up to its shape: status, a list of aisles instead of one,
 * blocked seats, screen formats and a default price per category (from the screen's templates, like the shows).
 * Only touches venues that still miss something, so it never overwrites a vendor's own layout.
 */
async function backfillLayouts(): Promise<void> {
  let updated = 0;
  for (const venue of await Venue.find({}).lean()) {
    const outdated =
      !venue.status ||
      venue.screens.some(
        (s) =>
          !s.formats ||
          s.zones.some(
            (z) => z.defaultPricePaise === undefined || z.rows.some((r) => !r.aislesAfter || !r.blockedSeats),
          ),
      );
    if (!outdated) continue;
    const screens = venue.screens.map((stored) => {
      const screen = toScreen(stored);
      const own = venue.showTemplates.filter((t) => t.screenName === screen.name);
      const top = Math.max(0, ...own.map((t) => t.pricePaise));
      return {
        ...screen,
        formats: stored.formats ?? [...new Set(own.map((t) => t.format))],
        zones: screen.zones.map((zone, i) => ({
          ...zone,
          defaultPricePaise: stored.zones[i]?.defaultPricePaise ?? movieZonePrice(top, i),
        })),
      };
    });
    await Venue.updateOne({ _id: venue._id }, { $set: { status: venue.status ?? "active", screens } });
    updated += 1;
  }
  log.info("Backfilled venue layouts", { venues: updated });
}

/**
 * Shows from before the partner scheduler: status, the end time (start + the film's running time, or the default
 * fixture length) and, for the demo cinemas' movie shows, the `template` source. Only fills missing fields.
 */
async function backfillShows(): Promise<void> {
  const statuses = await Show.updateMany({ status: { $exists: false } }, { $set: { status: "scheduled" } });
  let ends = 0;
  for (const movie of await Movie.find({}, { durationMinutes: 1 }).lean()) {
    const result = await Show.updateMany(
      { movieId: movie._id, startsAt: { $type: "date" }, endsAt: { $exists: false } },
      [{ $set: { endsAt: { $add: ["$startsAt", movie.durationMinutes * 60_000] } } }],
      { updatePipeline: true },
    );
    ends += result.modifiedCount;
  }
  const fixtures = await Show.updateMany(
    {
      eventId: { $exists: true },
      screenId: { $ne: "passes" },
      startsAt: { $type: "date" },
      endsAt: { $exists: false },
    },
    [{ $set: { endsAt: { $add: ["$startsAt", EVENT_DEFAULT_DURATION_MINUTES * 60_000] } } }],
    { updatePipeline: true },
  );
  const templated = await Show.updateMany(
    { movieId: { $exists: true }, source: { $exists: false } },
    { $set: { source: "template" } },
  );
  log.info("Backfilled shows", {
    status: statuses.modifiedCount,
    endsAt: ends + fixtures.modifiedCount,
    source: templated.modifiedCount,
  });
}

/** Each demo vendor's "My movies": every film it has a show for (idempotent upserts on the unique link). */
async function seedVendorMovies(vendorIds: Types.ObjectId[]): Promise<void> {
  let links = 0;
  for (const vendorId of vendorIds) {
    const movieIds = await Show.distinct("movieId", { vendorId, movieId: { $exists: true } });
    if (movieIds.length === 0) continue;
    const result = await VendorMovie.bulkWrite(
      movieIds.map((movieId) => ({
        updateOne: { filter: { vendorId, movieId }, update: { $setOnInsert: { vendorId, movieId } }, upsert: true },
      })),
    );
    links += result.upsertedCount;
  }
  log.info("Seeded", { collection: "vendorMovies", added: links });
}

/** Cities from before prompt 7 get a tier (popular = metro) and an explicit status. */
async function backfillCities(): Promise<void> {
  const tiers = await City.updateMany(
    { tier: { $exists: false } },
    [{ $set: { tier: { $cond: ["$popular", "metro", "tier2"] } } }],
    { updatePipeline: true },
  );
  const statuses = await City.updateMany({ status: { $exists: false } }, { $set: { status: "active" } });
  log.info("Backfilled", { collection: "cities", tier: tiers.modifiedCount, status: statuses.modifiedCount });
}

/**
 * Languages and genres (prompt 7 master data), first insert only: the lists the forms used before (home page chips
 * first, so they keep their order), plus every value movies and events already use.
 */
async function seedMasterData(): Promise<void> {
  const usedLanguages = (await Movie.distinct("languages")) as string[];
  const languageNames = [...new Set([...HOME_LANGUAGES, ...MOVIE_LANGUAGE_OPTIONS, ...usedLanguages])];
  let languages = 0;
  for (const [i, name] of languageNames.entries()) {
    const result = await Language.updateOne(
      { name },
      { $setOnInsert: { name, nativeName: NATIVE_SCRIPTS[name] ?? "", status: "active", sortOrder: i + 1 } },
      { upsert: true, collation: { locale: "en", strength: 2 } },
    );
    languages += result.upsertedCount;
  }

  const usedGenres = (await Movie.distinct("genres")) as string[];
  const scopes: [GenreScope, string[]][] = [
    ["movie", [...new Set([...HOME_GENRES, ...MOVIE_GENRE_OPTIONS, ...usedGenres])]],
  ];
  for (const kind of ["event", "play", "sport", "activity"] as const) {
    const used = (await Event.distinct("category", { kind })) as string[];
    scopes.push([kind, [...new Set([...EVENT_CATEGORY_OPTIONS[kind], ...used])]]);
  }
  let genres = 0;
  for (const [appliesTo, names] of scopes) {
    for (const [i, name] of names.entries()) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const result = await Genre.updateOne(
        { appliesTo, slug },
        { $setOnInsert: { name, slug, appliesTo, status: "active", sortOrder: i + 1 } },
        { upsert: true },
      );
      genres += result.upsertedCount;
    }
  }
  log.info("Seeded", { collection: "languages + genres", languages, genres, note: "first insert only" });
}

/** Website pages with the built-in text, first insert only (staff edit them in the console). */
async function seedSitePages(): Promise<void> {
  let inserted = 0;
  for (const slug of SITE_PAGE_SLUGS) {
    const result = await SitePage.updateOne(
      { slug },
      { $setOnInsert: { slug, status: "published", content: DEFAULT_PAGES[slug] } },
      { upsert: true },
    );
    inserted += result.upsertedCount;
  }
  log.info("Seeded", { collection: "pages", inserted, note: "first insert only" });
}

async function main() {
  await connect();
  await dropLegacyFoodIndex();
  const seededModels = [
    Plan,
    Vendor,
    City,
    Movie,
    Venue,
    Event,
    StreamTitle,
    Coupon,
    FoodItem,
    GiftCardDesign,
    Show,
    Settings,
    Language,
    Genre,
    SitePage,
  ];
  // The unique indexes are what make upserts by slug/code safe (and, for seatHolds/bookings, what prevents double
  // booking in production, where autoIndex is off); createIndexes never drops anything.
  const otherModels = [
    VendorUser,
    VendorMovie,
    SeatHold,
    Booking,
    Payment,
    Refund,
    Review,
    Lead,
    WishlistItem,
    GiftCard,
  ];
  for (const model of [...seededModels, ...otherModels]) await model.createIndexes();

  await Settings.updateOne({ key: SETTINGS_KEY }, { $setOnInsert: { ...SETTINGS_DEFAULTS } }, { upsert: true });
  log.info("Seeded", { collection: "settings", note: "defaults on first run only; later edits are kept" });

  const vendorIds = await seedVendors();
  const organiserId = vendorIdFor(vendorIds, EVENT_ORGANISER);

  // First insert only since prompt 7: the super-admin edits cities (name, order, status) in the console.
  await upsertBy("cities", cities, (c, sortOrder) =>
    City.updateOne(
      { slug: c.id },
      {
        $setOnInsert: {
          name: c.name,
          state: c.state,
          popular: c.popular,
          tier: c.popular ? "metro" : "tier2",
          status: "active",
          sortOrder,
        },
      },
      { upsert: true },
    ),
  );
  await backfillCities();
  await seedMasterData();
  await seedSitePages();

  await upsertBy("movies", movies, (m, sortOrder) =>
    Movie.updateOne(
      { slug: m.slug },
      {
        $set: {
          ...withoutId(m),
          reviews: m.reviews.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })),
          sortOrder,
        },
        // Seeded films are the platform catalogue; vendors add their own later.
        $setOnInsert: { createdByVendorId: null },
      },
      { upsert: true },
    ),
  );

  await upsertBy("venues (cinemas)", cinemas, (c, sortOrder) => {
    const screenNames = [...new Set(c.showTemplates.map((t) => t.screenName))];
    const { showTemplates, ...profile } = withoutId(c);
    return Venue.updateOne(
      { slug: c.slug },
      {
        $set: {
          vendorId: vendorIdFor(vendorIds, cinemaOperators[c.slug] ?? "kolkata-screens"),
          kind: "cinema",
          showTemplates,
          sortOrder,
        },
        // Profile and screens are the vendor's to edit in the partner portal; re-seeding must not undo that.
        $setOnInsert: {
          ...profile,
          status: "active",
          screens: screenNames.map((name) => cinemaScreen(name, showTemplates)),
        },
      },
      { upsert: true },
    );
  });

  await upsertBy("events (+ venues, fixture and pass shows)", events, async (e, sortOrder) => {
    const venue = await seedEventVenue(e, sortOrder, organiserId);
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
      {
        $set: { vendorId: organiserId, sortOrder },
        // The organiser edits listings in the partner portal; re-seeding must not undo that.
        $setOnInsert: { ...withoutId(e), schedule, venueId: venue?._id, status: "active" },
      },
      { upsert: true, returnDocument: "after", lean: true },
    );
    if (saved && venue) {
      await seedFixtureShow(e, saved._id, venue._id, organiserId);
      await seedPassShow(e, saved._id, venue._id, organiserId);
    }
  });

  await upsertBy("streamTitles", streamTitles, (s, sortOrder) =>
    StreamTitle.updateOne({ slug: s.slug }, { $set: { ...withoutId(s), sortOrder } }, { upsert: true }),
  );

  await upsertBy("coupons", coupons, (c, sortOrder) =>
    Coupon.updateOne(
      { code: c.code },
      { $set: { ...withoutId(c), vendorId: null, validUntil: new Date(c.validUntil), sortOrder } },
      { upsert: true },
    ),
  );

  // Menus from before the marketplace change go to the first chain (keeping their ids), then each chain gets its
  // own copy of the menu, available at all of its cinemas.
  const [firstMenuVendor] = FOOD_MENU_VENDORS;
  if (firstMenuVendor) {
    await FoodItem.updateMany(
      { vendorId: { $exists: false } },
      { $set: { vendorId: vendorIdFor(vendorIds, firstMenuVendor) } },
    );
  }
  for (const key of FOOD_MENU_VENDORS) {
    const vendorId = vendorIdFor(vendorIds, key);
    await upsertBy(`foodItems (${key})`, foodItems, (f, sortOrder) =>
      FoodItem.updateOne(
        { vendorId, code: f.id },
        { $set: { ...withoutId(f), sortOrder }, $setOnInsert: { venueIds: [] } },
        { upsert: true },
      ),
    );
  }

  await upsertBy("giftCardDesigns", giftCardDesigns, (g, sortOrder) =>
    GiftCardDesign.updateOne({ code: g.id }, { $set: { ...withoutId(g), sortOrder } }, { upsert: true }),
  );

  await backfillLayouts();
  await backfillOwnership();

  const inserted = await ensureMovieShows(istDateKeys(new Date(), SHOW_DATE_WINDOW_DAYS));
  log.info("Seeded", { collection: "shows", inserted, days: SHOW_DATE_WINDOW_DAYS });
  await backfillShows();
  await seedVendorMovies([...vendorIds.values()]);
}

main()
  .catch((err: unknown) => {
    log.error("Seed failed", { err });
    process.exitCode = 1;
  })
  .finally(() => disconnect());
