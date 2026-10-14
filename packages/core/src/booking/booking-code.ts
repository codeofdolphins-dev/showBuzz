import "server-only";
import { randomInt } from "node:crypto";
import { Booking, type BookingAttrs } from "@showbuzz/db/models/Booking";
import type { Types } from "@showbuzz/db/mongoose";
import { AppError } from "../http/app-error";

/**
 * Booking codes ("SB-123456"), shown to customers and on tickets. Unique by index: an insert that collides is
 * retried with a new code. Shared by online orders and counter sales.
 */

export const MAX_CODE_ATTEMPTS = 5;

export function newBookingCode(): string {
  return `SB-${randomInt(100_000, 1_000_000)}`;
}

export function isDuplicateKeyOn(err: unknown, field: string): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  return e.code === 11000 && !!e.keyPattern && field in e.keyPattern;
}

/** Inserts the booking under a fresh unique code and returns the code. */
export async function insertWithUniqueCode(
  doc: Omit<BookingAttrs, "code" | "createdAt" | "updatedAt"> & { _id: Types.ObjectId },
): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = newBookingCode();
    try {
      await Booking.create({ ...doc, code });
      return code;
    } catch (err) {
      if (!isDuplicateKeyOn(err, "code")) throw err;
    }
  }
  throw new AppError("INTERNAL", "We couldn't create the booking. Please try again.", 500);
}
