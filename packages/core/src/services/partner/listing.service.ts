import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Event, type EventAttrs } from "@showbuzz/db/models/Event";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { LIVE_SHOW_FILTER, Show, type ShowAttrs } from "@showbuzz/db/models/Show";
import { Venue } from "@showbuzz/db/models/Venue";
import { type ClientSession, Types } from "@showbuzz/db/mongoose";
import type { EventKind } from "@showbuzz/schemas/event";
import {
  EVENT_DEFAULT_DURATION_MINUTES,
  type EventInput,
  type ListingStatus,
  eventInputSchema,
} from "@showbuzz/schemas/partner-listing";
import type { TierUsage, VendorEventDetail, VendorEventRow } from "@showbuzz/schemas/types/partner-listing";
import type { Screen } from "@showbuzz/schemas/venue";
import { formatDateShort, formatDuration, formatTime } from "@showbuzz/utils/dates";
import { escapeRegex, slugify } from "@showbuzz/utils/text";
import { AppError } from "../../http/app-error";
import { releaseLapsedOrders } from "../order-release.service";
import { changedKeys, isDuplicateKey, toObjectId } from "./ids";
import { claimScreenTime, requireOwnVenueScreen } from "./show-schedule.service";

/**
 * A vendor's events, plays, sports and activities (one `events` collection, `kind` picks the public section).
 *
 * - Events, plays and activities sell passes: one pass show per listing holds each tier's inventory
 *   (`capacity`, `remaining`, `sold`; reserved = capacity − remaining − sold, i.e. unpaid orders). A capacity change
 *   moves `capacity` and `remaining` by the same amount with one conditional `$inc`, so it composes with orders
 *   reserving at the same time and can never go below what is sold or reserved.
 * - Sports are seated: the listing names a stadium screen and a start time; its tiers are the screen's seat
 *   categories (in layout order, priced here) and saving creates or updates the fixture's one seated show, under
 *   the same screen-overlap rules as movie shows.
 *
 * Once tickets are sold or reserved, the venue, screen and start time are locked and the listing can't be switched
 * off (cancel the bookings first). Every query is filtered by the session's vendor id.
 */

type LeanEvent = EventAttrs & { _id: Types.ObjectId };
type LeanShow = ShowAttrs & { _id: Types.ObjectId };

const NOT_FOUND = () => new AppError("NOT_FOUND", "This listing doesn't exist or isn't yours.", 404);
const fieldError = (field: string, message: string) =>
  new AppError("VALIDATION_FAILED", message, 422, { fieldErrors: { [field]: [message] } });

const vendorObjectId = (vendorId: string) => new Types.ObjectId(vendorId);

async function findOwnEvent(vendorId: string, eventId: string): Promise<LeanEvent | null> {
  const _id = toObjectId(eventId);
  if (!_id) return null;
  await connect();
  return Event.findOne({ _id, vendorId: vendorObjectId(vendorId) }).lean();
}

async function findPassShowOf(eventId: Types.ObjectId, session?: ClientSession): Promise<LeanShow | null> {
  return Show.findOne({ eventId, "inventory.0": { $exists: true } }, null, session ? { session } : {}).lean();
}

async function findFixtureShowOf(eventId: Types.ObjectId, session?: ClientSession): Promise<LeanShow | null> {
  return Show.findOne(
    { eventId, "inventory.0": { $exists: false }, ...LIVE_SHOW_FILTER },
    null,
    session ? { session } : {},
  )
    .sort({ startsAt: -1 })
    .lean();
}

function tierUsage(show: LeanShow | null): TierUsage[] {
  return (show?.inventory ?? []).map((t) => ({
    tierId: t.tierId,
    sold: t.sold,
    reserved: Math.max(0, t.capacity - t.remaining - t.sold),
  }));
}

async function fixtureSeatActivity(show: LeanShow | null): Promise<{ sold: number; held: number }> {
  if (!show) return { sold: 0, held: 0 };
  const [sold, held] = await Promise.all([
    SeatHold.countDocuments({ showId: show._id, status: "sold" }),
    SeatHold.countDocuments({ showId: show._id, status: "held" }),
  ]);
  return { sold, held };
}

function whenLabel(event: Pick<LeanEvent, "schedule">): string {
  const s = event.schedule;
  if (s.type === "daily") return `Daily ${s.opensAt ?? ""}–${s.closesAt ?? ""}`;
  const at = s.startsAt ?? new Date(0);
  return `${formatDateShort(at)}, ${formatTime(at)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Lists

export const EVENT_SORT_FIELDS = ["title", "category", "schedule.startsAt", "updatedAt"] as const;

export interface EventListQuery {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: "asc" | "desc" };
  kind: EventKind;
  status?: ListingStatus;
  venueId?: string;
}

export async function listVendorEvents(
  vendorId: string,
  query: EventListQuery,
): Promise<{ rows: VendorEventRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = { vendorId: vendorObjectId(vendorId), kind: query.kind };
  if (query.status === "inactive") filter.status = "inactive";
  if (query.status === "active") filter.status = { $ne: "inactive" };
  const venueId = query.venueId ? toObjectId(query.venueId) : null;
  if (venueId) filter.venueId = venueId;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ title: pattern }, { category: pattern }, { venueName: pattern }, { slug: pattern }];
  }
  const field = (EVENT_SORT_FIELDS as readonly string[]).includes(query.sort.field) ? query.sort.field : "title";
  const [docs, total] = await Promise.all([
    Event.find(filter, { artists: 0, about: 0 })
      .sort({ [field]: query.sort.direction === "desc" ? -1 : 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Event.countDocuments(filter),
  ]);

  const ids = docs.map((d) => d._id);
  const shows = ids.length ? await Show.find({ eventId: { $in: ids }, ...LIVE_SHOW_FILTER }).lean() : [];
  const fixtureIds = shows.filter((s) => (s.inventory ?? []).length === 0).map((s) => s._id);
  const soldSeats = fixtureIds.length
    ? await SeatHold.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { showId: { $in: fixtureIds }, status: "sold" } },
        { $group: { _id: "$showId", n: { $sum: 1 } } },
      ])
    : [];
  const soldByShow = new Map(soldSeats.map((s) => [s._id.toString(), s.n]));

  return {
    total,
    rows: docs.map((doc) => {
      const own = shows.filter((s) => s.eventId?.toString() === doc._id.toString());
      const pass = own.find((s) => (s.inventory ?? []).length > 0);
      const fixture = own.find((s) => (s.inventory ?? []).length === 0);
      const capacity = pass
        ? pass.inventory.reduce((sum, t) => sum + t.capacity, 0)
        : doc.ticketTiers.reduce((sum, t) => sum + t.available, 0);
      const sold = pass
        ? pass.inventory.reduce((sum, t) => sum + t.sold, 0)
        : (soldByShow.get(fixture?._id.toString() ?? "") ?? 0);
      return {
        id: doc._id.toString(),
        kind: doc.kind,
        slug: doc.slug,
        title: doc.title,
        category: doc.category,
        poster: doc.poster,
        venueName: doc.venueName,
        when: whenLabel(doc),
        fromPaise: Math.min(...doc.ticketTiers.map((t) => t.pricePaise)),
        capacity,
        sold,
        status: doc.status ?? "active",
      };
    }),
  };
}

/** The vendor's sports fixtures (Shows page filter). */
export async function listVendorFixtureOptions(vendorId: string): Promise<{ value: string; label: string }[]> {
  await connect();
  const docs = await Event.find({ vendorId: vendorObjectId(vendorId), kind: "sport" }, { title: 1 })
    .sort({ title: 1 })
    .lean();
  return docs.map((d) => ({ value: d._id.toString(), label: d.title }));
}

// ---------------------------------------------------------------------------------------------------------------
// One listing

function toValues(doc: LeanEvent, fixture: LeanShow | null): EventInput {
  const s = doc.schedule;
  return {
    kind: doc.kind,
    title: doc.title,
    slug: doc.slug,
    category: doc.category,
    about: doc.about,
    language: doc.language ?? "",
    ageLimit: doc.ageLimit ?? "",
    durationMinutes: doc.durationMinutes ?? EVENT_DEFAULT_DURATION_MINUTES,
    venueId: doc.venueId?.toString() ?? "",
    screenId: fixture?.screenId ?? "",
    scheduleType: s.type,
    startsAt: s.type === "once" && s.startsAt ? s.startsAt.toISOString() : "",
    endsAt: s.type === "once" && s.endsAt ? s.endsAt.toISOString() : "",
    opensAt: s.type === "daily" ? (s.opensAt ?? "") : "",
    closesAt: s.type === "daily" ? (s.closesAt ?? "") : "",
    poster: doc.poster,
    backdrop: doc.backdrop ?? "",
    director: doc.director ?? "",
    artists: doc.artists.map((a) => ({ name: a.name, role: a.role, image: a.image })),
    tiers: doc.ticketTiers.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      pricePaise: t.pricePaise,
      capacity: t.available,
    })),
    status: doc.status ?? "active",
  };
}

export async function getVendorEvent(vendorId: string, eventId: string): Promise<VendorEventDetail | null> {
  const doc = await findOwnEvent(vendorId, eventId);
  if (!doc) return null;
  const [pass, fixture] = await Promise.all([findPassShowOf(doc._id), findFixtureShowOf(doc._id)]);
  if (pass) await releaseLapsedOrders(pass._id, new Date());
  const freshPass = pass ? await findPassShowOf(doc._id) : null;
  const usage = tierUsage(freshPass);
  const seats = await fixtureSeatActivity(fixture);
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    slug: doc.slug,
    values: toValues(doc, fixture),
    usage,
    locked: usage.some((u) => u.sold + u.reserved > 0) || seats.sold + seats.held > 0,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Save

interface PreparedTier {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  available: number;
}

/** Tier ids stay stable (orders and inventory point at them); new tiers get a slug of their name. */
function assignTierIds(input: EventInput, currentIds: string[]): PreparedTier[] {
  const used = new Set<string>();
  const known = new Set(currentIds);
  const prepared = input.tiers.map((t) => {
    const id = t.id && known.has(t.id) && !used.has(t.id) ? t.id : "";
    if (id) used.add(id);
    return { ...t, id };
  });
  return prepared.map((t, i) => {
    let id = t.id;
    if (!id) {
      const base = slugify(t.name, 40) || `tier-${i + 1}`;
      id = base;
      for (let n = 2; used.has(id) || (known.has(id) && !prepared.some((p) => p.id === id)); n++) id = `${base}-${n}`;
      used.add(id);
    }
    return { id, name: t.name, description: t.description, pricePaise: t.pricePaise, available: t.capacity };
  });
}

/** Sports: the tiers are the screen's seat categories in layout order (prices from the form). */
function fixtureTiers(input: EventInput, screen: Screen): PreparedTier[] {
  return screen.zones.map((zone, i) => {
    const tier = input.tiers.find((t) => t.id === zone.id) ?? input.tiers[i];
    if (!tier) throw fieldError("tiers", `Enter a price for ${zone.name}`);
    return {
      id: zone.id,
      name: tier.name,
      description: tier.description || zone.description,
      pricePaise: tier.pricePaise,
      available: zone.rows.reduce((sum, r) => sum + r.count - new Set(r.blockedSeats).size, 0),
    };
  });
}

function scheduleOf(input: EventInput) {
  return input.scheduleType === "once"
    ? {
        type: "once" as const,
        startsAt: new Date(input.startsAt),
        ...(input.endsAt ? { endsAt: new Date(input.endsAt) } : {}),
      }
    : { type: "daily" as const, opensAt: input.opensAt, closesAt: input.closesAt };
}

async function assertSlugFree(kind: EventKind, slug: string, exceptId?: Types.ObjectId): Promise<void> {
  if (await Event.exists({ kind, slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })) throw slugTaken();
}

const slugTaken = () =>
  new AppError("CONFLICT", "That URL name is already used by another listing in this section.", 409, {
    fieldErrors: { slug: ["Already used on ShowBuzz: pick another"] },
  });

function listingFields(
  input: EventInput,
  venue: { _id: Types.ObjectId; name: string; cityId: string },
  tiers: PreparedTier[],
) {
  return {
    title: input.title,
    slug: input.slug,
    category: input.category,
    about: input.about,
    language: input.language || undefined,
    ageLimit: input.ageLimit || undefined,
    durationMinutes: input.durationMinutes,
    durationLabel: formatDuration(input.durationMinutes),
    venueId: venue._id,
    venueName: venue.name,
    cityId: venue.cityId,
    schedule: scheduleOf(input),
    poster: input.poster,
    backdrop: input.backdrop || undefined,
    director: input.director || undefined,
    artists: input.artists,
    ticketTiers: tiers,
    status: input.status,
  };
}

/** $set for the given values, $unset for the optional ones left empty. */
function toUpdate(fields: Record<string, unknown>) {
  const entries = Object.entries(fields);
  const unset = Object.fromEntries(entries.filter(([, v]) => v === undefined).map(([k]) => [k, 1]));
  return {
    $set: Object.fromEntries(entries.filter(([, v]) => v !== undefined)),
    ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
  };
}

interface ListingContext {
  input: EventInput;
  venue: { _id: Types.ObjectId; name: string; cityId: string };
  screen?: Screen;
  tiers: PreparedTier[];
}

async function prepare(vendorId: string, raw: unknown, current: LeanEvent | null): Promise<ListingContext> {
  const input = eventInputSchema.parse(raw);
  if (current && input.kind !== current.kind) throw fieldError("kind", "A listing can't move to another section");
  if (input.kind === "sport") {
    const { venue, screen } = await requireOwnVenueScreen(vendorId, input.venueId, input.screenId);
    return { input, venue, screen, tiers: fixtureTiers(input, screen) };
  }
  const _id = toObjectId(input.venueId);
  const venue = _id
    ? await Venue.findOne({ _id, vendorId: vendorObjectId(vendorId) }, { name: 1, cityId: 1 }).lean()
    : null;
  if (!venue) throw fieldError("venueId", "Choose one of your venues");
  return { input, venue, tiers: assignTierIds(input, current?.ticketTiers.map((t) => t.id) ?? []) };
}

function assertFutureStart(input: EventInput, now: Date) {
  if (input.scheduleType === "once" && new Date(input.startsAt) <= now) {
    throw fieldError("startsAt", "Choose a time in the future");
  }
}

/** Creates or updates the fixture's seated show (sports), inside the save transaction. */
async function syncFixtureShow(
  session: ClientSession,
  vendorId: string,
  eventId: Types.ObjectId,
  ctx: ListingContext,
  existing: LeanShow | null,
): Promise<void> {
  const { input, venue, screen, tiers } = ctx;
  if (!screen) return;
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  const zones = tiers.map((t) => ({
    zoneId: t.id,
    name: t.name,
    description: t.description,
    pricePaise: t.pricePaise,
  }));
  const moved =
    !existing ||
    existing.venueId.toString() !== venue._id.toString() ||
    existing.screenId !== screen.id ||
    existing.startsAt?.getTime() !== startsAt.getTime() ||
    existing.endsAt?.getTime() !== endsAt.getTime();
  if (moved) await claimScreenTime(session, venue._id, screen.id, [{ startsAt, endsAt }], existing?._id);
  const fields = {
    venueId: venue._id,
    screenId: screen.id,
    screenName: screen.name,
    startsAt,
    endsAt,
    pricePaise: zones[0]?.pricePaise ?? 0,
    zones,
  };
  if (existing) {
    await Show.updateOne({ _id: existing._id }, { $set: fields }, { session });
    return;
  }
  await Show.create(
    [
      {
        ...fields,
        vendorId: vendorObjectId(vendorId),
        eventId,
        availability: "available",
        inventory: [],
        status: "scheduled",
        source: "manual",
      },
    ],
    { session },
  );
}

/**
 * Creates or updates the pass inventory (events, plays, activities), inside the save transaction. Each capacity
 * change is one conditional `$inc` of capacity and remaining (guarded on the capacity read and on enough remaining),
 * so it can't undercut what customers have bought or are paying for.
 */
async function syncPassShow(
  session: ClientSession,
  vendorId: string,
  eventId: Types.ObjectId,
  ctx: ListingContext,
  existing: LeanShow | null,
): Promise<void> {
  const { input, venue, tiers } = ctx;
  const startsAt = input.scheduleType === "once" ? new Date(input.startsAt) : undefined;
  const pricePaise = Math.min(...tiers.map((t) => t.pricePaise));
  if (!existing) {
    await Show.create(
      [
        {
          vendorId: vendorObjectId(vendorId),
          eventId,
          venueId: venue._id,
          screenId: "passes",
          screenName: "General Admission",
          ...(startsAt ? { startsAt } : {}),
          availability: "available",
          pricePaise,
          zones: [],
          inventory: tiers.map((t) => ({ tierId: t.id, capacity: t.available, remaining: t.available, sold: 0 })),
          status: "scheduled",
          source: "manual",
        },
      ],
      { session },
    );
    return;
  }

  const capacityError = (tier: PreparedTier, index: number, floor: number) =>
    new AppError(
      "CONFLICT",
      `${tier.name}: ${floor} tickets are sold or being paid for, so capacity can't go lower.`,
      409,
      {
        fieldErrors: { [`tiers.${index}.capacity`]: [`At least ${floor} (sold or in checkout)`] },
      },
    );

  for (const current of existing.inventory) {
    if (tiers.some((t) => t.id === current.tierId)) continue;
    const removed = await Show.updateOne(
      {
        _id: existing._id,
        inventory: { $elemMatch: { tierId: current.tierId, capacity: current.capacity, remaining: current.capacity } },
      },
      { $pull: { inventory: { tierId: current.tierId } } },
      { session },
    );
    if (removed.modifiedCount !== 1) {
      throw new AppError("CONFLICT", "A tier with tickets sold or in checkout can't be removed.", 409);
    }
  }
  for (const [index, tier] of tiers.entries()) {
    const current = existing.inventory.find((t) => t.tierId === tier.id);
    if (!current) {
      await Show.updateOne(
        { _id: existing._id },
        { $push: { inventory: { tierId: tier.id, capacity: tier.available, remaining: tier.available, sold: 0 } } },
        { session },
      );
      continue;
    }
    const delta = tier.available - current.capacity;
    if (delta === 0) continue;
    const changed = await Show.updateOne(
      {
        _id: existing._id,
        inventory: {
          $elemMatch: { tierId: tier.id, capacity: current.capacity, remaining: { $gte: Math.max(0, -delta) } },
        },
      },
      { $inc: { "inventory.$.capacity": delta, "inventory.$.remaining": delta } },
      { session },
    );
    if (changed.modifiedCount !== 1) {
      const floor = Math.max(0, current.capacity - current.remaining);
      throw capacityError(tier, index, floor);
    }
  }
  await Show.updateOne(
    { _id: existing._id },
    {
      $set: { venueId: venue._id, pricePaise, ...(startsAt ? { startsAt } : {}) },
      ...(startsAt ? {} : { $unset: { startsAt: 1 } }),
    },
    { session },
  );
}

export async function createEvent(
  vendorId: string,
  raw: unknown,
  now: Date,
): Promise<{ id: string; kind: EventKind; changedFields: string[] }> {
  await connect();
  const ctx = await prepare(vendorId, raw, null);
  assertFutureStart(ctx.input, now);
  await assertSlugFree(ctx.input.kind, ctx.input.slug);
  const fields = listingFields(ctx.input, ctx.venue, ctx.tiers);
  const last = await Event.findOne({ kind: ctx.input.kind }, { sortOrder: 1 }).sort({ sortOrder: -1 }).lean();
  const _id = new Types.ObjectId();
  const mongoose = await connect();
  try {
    await mongoose.connection.transaction(async (session) => {
      await Event.create(
        [
          {
            _id,
            ...fields,
            kind: ctx.input.kind,
            vendorId: vendorObjectId(vendorId),
            sortOrder: (last?.sortOrder ?? 0) + 1,
          },
        ],
        { session },
      );
      if (ctx.input.kind === "sport") await syncFixtureShow(session, vendorId, _id, ctx, null);
      else await syncPassShow(session, vendorId, _id, ctx, null);
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw slugTaken();
    throw err;
  }
  return { id: _id.toString(), kind: ctx.input.kind, changedFields: Object.keys(fields) };
}

export async function updateEvent(
  vendorId: string,
  eventId: string,
  raw: unknown,
  now: Date,
): Promise<{ kind: EventKind; changedFields: string[] }> {
  const current = await findOwnEvent(vendorId, eventId);
  if (!current) throw NOT_FOUND();
  const ctx = await prepare(vendorId, raw, current);
  const { input } = ctx;
  await assertSlugFree(input.kind, input.slug, current._id);

  const pass = input.kind === "sport" ? null : await findPassShowOf(current._id);
  if (pass) await releaseLapsedOrders(pass._id, now);
  const fixture = input.kind === "sport" ? await findFixtureShowOf(current._id) : null;
  const usage = tierUsage(pass ? await findPassShowOf(current._id) : null);
  const seats = await fixtureSeatActivity(fixture);
  const locked = usage.some((u) => u.sold + u.reserved > 0) || seats.sold + seats.held > 0;

  const before = toValues(current, fixture);
  const scheduleChanged =
    before.scheduleType !== input.scheduleType || (input.scheduleType === "once" && before.startsAt !== input.startsAt);
  if (scheduleChanged) assertFutureStart(input, now);
  if (locked) {
    const moved =
      before.venueId !== input.venueId ||
      scheduleChanged ||
      (input.kind === "sport" &&
        (before.screenId !== input.screenId || before.durationMinutes !== input.durationMinutes));
    if (moved) {
      throw new AppError(
        "CONFLICT",
        "Tickets are sold or being paid for, so the venue, screen and start time can't change. Cancel those bookings first.",
        409,
      );
    }
    if (input.status === "inactive" && before.status !== "inactive") {
      throw new AppError(
        "CONFLICT",
        "Tickets are sold or being paid for, so this listing can't be switched off yet. Cancel those bookings first.",
        409,
      );
    }
  }
  // Friendly per-tier floor before the transaction (the conditional updates enforce it again).
  if (input.kind !== "sport") {
    for (const u of usage) {
      const index = ctx.tiers.findIndex((t) => t.id === u.tierId);
      const tier = ctx.tiers[index];
      const floor = u.sold + u.reserved;
      if (!tier && floor > 0) {
        throw new AppError("CONFLICT", "A tier with tickets sold or in checkout can't be removed.", 409);
      }
      if (tier && tier.available < floor) {
        throw new AppError("VALIDATION_FAILED", `${tier.name}: at least ${floor} (sold or in checkout).`, 422, {
          fieldErrors: { [`tiers.${index}.capacity`]: [`At least ${floor} (sold or in checkout)`] },
        });
      }
    }
  }

  const next = listingFields(input, ctx.venue, ctx.tiers);
  const changedFields = changedKeys(
    {
      ...listingFields(
        before,
        { _id: current.venueId ?? new Types.ObjectId(), name: current.venueName, cityId: current.cityId },
        current.ticketTiers,
      ),
      screenId: before.screenId,
    },
    { ...next, screenId: input.screenId },
  );
  if (changedFields.length === 0) return { kind: input.kind, changedFields };

  const mongoose = await connect();
  try {
    await mongoose.connection.transaction(async (session) => {
      const updated = await Event.updateOne({ _id: current._id, vendorId: vendorObjectId(vendorId) }, toUpdate(next), {
        session,
      });
      if (updated.matchedCount !== 1) throw NOT_FOUND();
      if (input.kind === "sport") {
        await syncFixtureShow(session, vendorId, current._id, ctx, await findFixtureShowOf(current._id, session));
      } else {
        await syncPassShow(session, vendorId, current._id, ctx, await findPassShowOf(current._id, session));
      }
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw slugTaken();
    throw err;
  }
  return { kind: input.kind, changedFields };
}
