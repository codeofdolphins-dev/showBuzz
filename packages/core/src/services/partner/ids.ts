import "server-only";
import { Types } from "@showbuzz/db/mongoose";

/** A 24-hex id from a URL or form as an ObjectId; anything else is null (callers answer 404). */
export function toObjectId(id: string): Types.ObjectId | null {
  return /^[0-9a-f]{24}$/.test(id) ? new Types.ObjectId(id) : null;
}

export function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number }).code === 11000;
}

/** Names of the fields whose value differs (for the activity log: names only, never values). */
export function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
