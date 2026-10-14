import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Lead, type LeadAttrs } from "@showbuzz/db/models/Lead";
import { Vendor } from "@showbuzz/db/models/Vendor";
import type { LeanDoc } from "@showbuzz/db/models/transforms";
import { Types } from "@showbuzz/db/mongoose";
import { leadNoteSchema, leadStatusSchema, type LeadStatus } from "@showbuzz/schemas/admin-marketplace";
import type { ShowRequestDetail, ShowRequestRow } from "@showbuzz/schemas/types/admin-marketplace";
import { AppError } from "../../http/app-error";
import { type AdminListQuery, idOr404, optionalId, searchPattern, sortSpec } from "./shared";

/**
 * List-your-show requests (`leads` of type `show_submission`, from showbuzz.com/list-your-show): status, staff notes
 * and the link to the vendor created from one ("Create vendor" pre-fills the vendor form).
 */

export const SHOW_REQUEST_SORT_FIELDS = ["createdAt", "name"] as const;

export interface ShowRequestListQuery extends AdminListQuery {
  status?: LeadStatus;
}

type LeanLead = LeanDoc<LeadAttrs>;

const text = (fields: Record<string, unknown>, key: string) => {
  const value = fields[key];
  return typeof value === "string" ? value : "";
};

function toRow(doc: LeanLead): ShowRequestRow {
  return {
    id: doc._id.toString(),
    reference: doc.reference,
    name: doc.name,
    companyName: text(doc.fields, "companyName"),
    email: doc.email,
    phone: doc.phone ?? text(doc.fields, "phone"),
    category: text(doc.fields, "category"),
    city: text(doc.fields, "city"),
    capacity: text(doc.fields, "capacity"),
    status: doc.status,
    ...(doc.vendorId ? { vendorId: doc.vendorId.toString() } : {}),
    notes: doc.notes?.length ?? 0,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listShowRequests(
  query: ShowRequestListQuery,
): Promise<{ rows: ShowRequestRow[]; total: number }> {
  const filter: Record<string, unknown> = { type: "show_submission" };
  if (query.status) filter.status = query.status;
  if (query.q.trim()) {
    const pattern = searchPattern(query.q);
    filter.$or = [
      { reference: pattern },
      { name: pattern },
      { email: pattern },
      { "fields.companyName": pattern },
      { "fields.city": pattern },
    ];
  }
  await connect();
  const [docs, total] = await Promise.all([
    Lead.find(filter)
      .sort(sortSpec(query, SHOW_REQUEST_SORT_FIELDS, "createdAt"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);
  return { rows: docs.map(toRow), total };
}

export async function getShowRequest(id: string): Promise<ShowRequestDetail | null> {
  const _id = optionalId(id);
  if (!_id) return null;
  await connect();
  const doc = await Lead.findOne({ _id, type: "show_submission" }).lean();
  if (!doc) return null;
  const vendor = doc.vendorId ? await Vendor.findById(doc.vendorId, { businessName: 1 }).lean() : null;
  return {
    ...toRow(doc),
    overview: text(doc.fields, "overview"),
    ...(vendor ? { vendorName: vendor.businessName } : {}),
    notesList: (doc.notes ?? []).map((n) => ({ text: n.text, staffName: n.staffName, at: n.at.toISOString() })),
  };
}

export async function setShowRequestStatus(id: string, status: unknown): Promise<{ reference: string }> {
  const _id = idOr404(id, "Request");
  const next = leadStatusSchema.parse(status);
  await connect();
  const doc = await Lead.findOneAndUpdate(
    { _id, type: "show_submission" },
    { $set: { status: next } },
    { projection: { reference: 1 } },
  ).lean();
  if (!doc) throw new AppError("NOT_FOUND", "Request not found.", 404);
  return { reference: doc.reference };
}

export async function addShowRequestNote(
  id: string,
  input: unknown,
  staff: { id: string; name: string },
  now: Date,
): Promise<{ reference: string }> {
  const _id = idOr404(id, "Request");
  const { text: note } = leadNoteSchema.parse(input);
  await connect();
  const doc = await Lead.findOneAndUpdate(
    { _id, type: "show_submission" },
    { $push: { notes: { text: note, staffId: new Types.ObjectId(staff.id), staffName: staff.name, at: now } } },
    { projection: { reference: 1 } },
  ).lean();
  if (!doc) throw new AppError("NOT_FOUND", "Request not found.", 404);
  return { reference: doc.reference };
}

/** Values for the vendor form when creating a vendor from a request. */
export async function vendorPrefillFromRequest(id: string) {
  const request = await getShowRequest(id);
  if (!request || request.vendorId) return null;
  return {
    leadId: request.id,
    reference: request.reference,
    businessName: request.companyName,
    businessType: "event_organiser" as const,
    contactName: request.name,
    email: request.email,
    phone: request.phone.replace(/^\+91/, ""),
    city: request.city,
  };
}
