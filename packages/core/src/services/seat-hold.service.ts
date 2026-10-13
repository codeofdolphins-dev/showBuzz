import "server-only";
import { connect } from "@showbuzz/db/connect";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { AppError } from "../http/app-error";

/**
 * Seat holds (`seatHolds`, unique `{ showId, seatId }`). Holding is an insert, so two browsers can never hold
 * or buy the same seat: the second insert fails on the unique index. Expired holds may outlive their
 * `expiresAt` by up to a minute (TTL monitor), so every query here treats `expiresAt <= now` as free.
 */

export interface SeatState {
  /** Sold, or held by another browser. */
  unavailable: Set<string>;
  /** Held by this browser (still valid). */
  mine: string[];
  myExpiresAt?: Date;
}

/** Who holds what on a show right now, from this browser's point of view. */
export async function getSeatState(showId: string, holderKey: string | undefined, now: Date): Promise<SeatState> {
  await connect();
  const docs = await SeatHold.find(
    { showId, $or: [{ status: "sold" }, { status: "held", expiresAt: { $gt: now } }] },
    { seatId: 1, status: 1, holderKey: 1, expiresAt: 1 },
  ).lean();

  const state: SeatState = { unavailable: new Set(), mine: [] };
  for (const doc of docs) {
    if (doc.status === "held" && holderKey && doc.holderKey === holderKey) {
      state.mine.push(doc.seatId);
      if (doc.expiresAt && (!state.myExpiresAt || doc.expiresAt < state.myExpiresAt)) state.myExpiresAt = doc.expiresAt;
    } else {
      state.unavailable.add(doc.seatId);
    }
  }
  return state;
}

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number; writeErrors?: { code?: number }[] };
  return e.code === 11000 || (e.writeErrors?.some((w) => w.code === 11000) ?? false);
}

/**
 * Holds exactly `seatIds` on `showId` for this browser until `expiresAt`. Its other holds (other seats or shows)
 * are released, seats it already holds are refreshed, the rest are inserted. If any insert hits the unique index,
 * this request's inserts are removed again and the taken seats are reported (409).
 */
export async function holdSeats(
  showId: string,
  seatIds: string[],
  holderKey: string,
  now: Date,
  expiresAt: Date,
): Promise<{ expiresAt: Date }> {
  await connect();

  // A hold whose time ran out but that the TTL monitor hasn't removed yet must not block the seat.
  await SeatHold.deleteMany({ showId, seatId: { $in: seatIds }, status: "held", expiresAt: { $lte: now } });
  // Changing the selection (or the show) releases this browser's previous holds.
  await SeatHold.deleteMany({ holderKey, status: "held", $nor: [{ showId, seatId: { $in: seatIds } }] });

  const kept = await SeatHold.find(
    { holderKey, showId, seatId: { $in: seatIds }, status: "held" },
    { seatId: 1 },
  ).lean();
  const keptIds = new Set(kept.map((h) => h.seatId));
  if (keptIds.size > 0) {
    // Unlinking the old order means an abandoned pending order can never release these seats later.
    await SeatHold.updateMany(
      { holderKey, showId, seatId: { $in: [...keptIds] }, status: "held" },
      { $set: { expiresAt }, $unset: { bookingId: 1 } },
    );
  }

  const toInsert = seatIds.filter((id) => !keptIds.has(id));
  if (toInsert.length === 0) return { expiresAt };

  try {
    await SeatHold.insertMany(
      toInsert.map((seatId) => ({ showId, seatId, holderKey, status: "held", expiresAt })),
      { ordered: false },
    );
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const inserted = await SeatHold.find(
      { holderKey, showId, seatId: { $in: toInsert }, status: "held" },
      { seatId: 1 },
    ).lean();
    const insertedIds = new Set(inserted.map((h) => h.seatId));
    const taken = toInsert.filter((id) => !insertedIds.has(id));
    await SeatHold.deleteMany({ holderKey, showId, seatId: { $in: [...insertedIds] }, status: "held" });
    throw new AppError(
      "SEAT_UNAVAILABLE",
      `${taken.length === 1 ? `Seat ${taken[0]} was` : `Seats ${taken.join(", ")} were`} just taken by someone else. Please pick again.`,
      409,
      { seats: taken },
    );
  }
  return { expiresAt };
}

/** Releases every seat this browser holds (not sold seats). */
export async function releaseHolds(holderKey: string): Promise<void> {
  await connect();
  await SeatHold.deleteMany({ holderKey, status: "held" });
}
