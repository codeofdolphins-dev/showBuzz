import "server-only";
import { connect } from "@showbuzz/db/connect";
import { ActivityLog } from "@showbuzz/db/models/ActivityLog";
import { Staff } from "@showbuzz/db/models/Staff";
import { VendorUser } from "@showbuzz/db/models/VendorUser";
import type { ActivityActorType } from "@showbuzz/schemas/activity-log";
import type { ActivityRow, Option } from "@showbuzz/schemas/types/admin-platform";
import { addDaysToKey, istDateTime } from "@showbuzz/utils/dates";
import { type AdminListQuery, optionalId, searchPattern, vendorNames } from "./shared";

/** The audit trail (prompt 7): every back-office change by staff and vendors, newest first. Read-only. */

export interface ActivityListQuery extends AdminListQuery {
  actorType?: ActivityActorType;
  vendorId?: string;
  resource?: string;
  /** IST dates, inclusive. */
  fromDate?: string;
  toDate?: string;
}

export async function listActivity(query: ActivityListQuery): Promise<{ rows: ActivityRow[]; total: number }> {
  await connect();
  const filter: Record<string, unknown> = {};
  if (query.actorType) filter.actorType = query.actorType;
  const vendorId = optionalId(query.vendorId);
  if (vendorId) filter.vendorId = vendorId;
  if (query.resource) filter.resource = query.resource;
  const createdAt: Record<string, Date> = {};
  if (query.fromDate) createdAt.$gte = istDateTime(query.fromDate, "00:00");
  if (query.toDate) createdAt.$lt = istDateTime(addDaysToKey(query.toDate, 1), "00:00");
  if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;
  if (query.q.trim()) filter.$or = [{ summary: searchPattern(query.q) }, { action: searchPattern(query.q) }];

  const [docs, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: query.sort.direction === "asc" ? 1 : -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  const staffIds = docs.filter((d) => d.actorType === "staff").map((d) => d.actorId);
  const vendorUserIds = docs.filter((d) => d.actorType === "vendor").map((d) => d.actorId);
  const [staff, vendorUsers, vendors] = await Promise.all([
    Staff.find({ _id: { $in: staffIds } }, { name: 1 }).lean(),
    VendorUser.find({ _id: { $in: vendorUserIds } }, { name: 1 }).lean(),
    vendorNames(docs.map((d) => d.vendorId)),
  ]);
  const names = new Map<string, string>([
    ...staff.map((s) => [s._id.toString(), s.name] as [string, string]),
    ...vendorUsers.map((v) => [v._id.toString(), v.name] as [string, string]),
  ]);

  return {
    rows: docs.map((d) => {
      const vendorName = d.vendorId ? vendors.get(d.vendorId.toString()) : undefined;
      return {
        id: d._id.toString(),
        createdAt: d.createdAt.toISOString(),
        actorType: d.actorType,
        actorName: names.get(d.actorId.toString()) ?? (d.actorType === "staff" ? "Former staff" : "Former vendor login"),
        ...(vendorName ? { vendorName } : {}),
        action: d.action,
        resource: d.resource,
        ...(d.resourceId ? { resourceId: d.resourceId } : {}),
        summary: d.summary,
        changedFields: [...d.changedFields],
        ...(d.ipPrefix ? { ipPrefix: d.ipPrefix } : {}),
      };
    }),
    total,
  };
}

/** Resources that appear in the log (filter dropdown). */
export async function listActivityResources(): Promise<Option[]> {
  await connect();
  const resources = (await ActivityLog.distinct("resource")) as string[];
  return resources.sort().map((r) => ({ value: r, label: r.replace(/[_-]/g, " ") }));
}

