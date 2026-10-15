import "server-only";
import { connect } from "@showbuzz/db/connect";
import { ensureMovieShows } from "@showbuzz/db/shows";
import { addDaysToKey, istDateKey } from "@showbuzz/utils/dates";

/**
 * Backup page (Super Admin): a JSON export for records and audits, and a demo helper. There is deliberately no
 * restore or factory reset here: overwriting live data from an uploaded file is too risky; restores use MongoDB Atlas
 * backups, and `pnpm db:seed` refreshes the demo catalogue without deleting anything.
 *
 * Left out of the export (security): staff and vendor logins, every password hash and session, OTPs and rate
 * limits, KYC bank account numbers and documents, gift card codes, and customers' phone/email (name and status only).
 */

/** Collection → projection (fields removed). Order = order in the file. */
const EXPORT_COLLECTIONS: [string, Record<string, 0>][] = [
  ["settings", {}],
  ["cities", {}],
  ["languages", {}],
  ["genres", {}],
  ["plans", {}],
  ["vendors", { "kyc.bankAccount.accountNumber": 0, "kyc.documents": 0 }],
  ["movies", {}],
  ["vendorMovies", {}],
  ["venues", {}],
  ["events", {}],
  ["shows", {}],
  ["streamTitles", {}],
  ["coupons", {}],
  ["foodItems", {}],
  ["giftCardDesigns", {}],
  ["banners", {}],
  ["pages", {}],
  ["seoMeta", {}],
  ["users", { sessions: 0, phone: 0, email: 0, phoneVerifiedAt: 0, emailVerifiedAt: 0 }],
  ["bookings", { contact: 0 }],
  ["payments", {}],
  ["refunds", {}],
  ["giftCards", { code: 0, recipientContact: 0 }],
  ["settlements", {}],
  ["subscriptionInvoices", {}],
  ["reviews", {}],
  ["leads", { ipPrefix: 0 }],
];

export const BACKUP_COLLECTIONS = EXPORT_COLLECTIONS.map(([name]) => name);

/** The export as JSON text chunks, read collection by collection through cursors (never all in memory). */
export async function* backupJsonChunks(now: Date): AsyncGenerator<string> {
  const mongoose = await connect();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database handle unavailable");
  yield `{"format":"showbuzz-backup","version":1,"exportedAt":${JSON.stringify(now.toISOString())},"collections":{`;
  for (const [i, [name, projection]] of EXPORT_COLLECTIONS.entries()) {
    yield `${i ? "," : ""}${JSON.stringify(name)}:[`;
    let first = true;
    for await (const doc of db.collection(name).find({}, { projection }).sort({ _id: 1 })) {
      yield `${first ? "" : ","}${JSON.stringify(doc)}`;
      first = false;
    }
    yield "]";
  }
  yield "}}";
}

/** Generates the next 7 days of template shows for the demo vendors (idempotent; real vendors are never touched). */
export async function topUpDemoShows(now: Date): Promise<{ created: number }> {
  await connect();
  const today = istDateKey(now);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i));
  return { created: await ensureMovieShows(days) };
}
