import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { Venue } from "@showbuzz/db/models/Venue";
import { vendorPolicyInputSchema } from "@showbuzz/schemas/partner-box-office";
import type { VendorPolicyView } from "@showbuzz/schemas/types/partner-box-office";
import { AppError } from "../../http/app-error";
import { changedKeys, toObjectId } from "./ids";

/**
 * The vendor's own cancellation policy (allowed, cutoff before the show, fee). It applies to orders placed after the
 * change: every booking keeps the policy it was sold under. A venue can still switch cancellation off for itself
 * (venue form), which wins over the policy.
 */

const NOT_FOUND = () => new AppError("NOT_FOUND", "Vendor not found.", 404);

export async function getVendorPolicy(vendorId: string): Promise<VendorPolicyView> {
  const _id = toObjectId(vendorId);
  if (!_id) throw NOT_FOUND();
  await connect();
  const [vendor, venues] = await Promise.all([
    Vendor.findById(_id, { cancellation: 1 }).lean(),
    Venue.find({ vendorId: _id, "cancellation.allowed": false }, { name: 1 }).sort({ name: 1 }).lean(),
  ]);
  if (!vendor) throw NOT_FOUND();
  return {
    policy: {
      allowed: vendor.cancellation.allowed,
      cutoffMinutes: vendor.cancellation.cutoffMinutes,
      feePaise: vendor.cancellation.feePaise,
    },
    venuesWithoutCancellation: venues.map((v) => v.name),
  };
}

export async function updateVendorPolicy(vendorId: string, raw: unknown): Promise<{ changedFields: string[] }> {
  const policy = vendorPolicyInputSchema.parse(raw);
  const _id = toObjectId(vendorId);
  if (!_id) throw NOT_FOUND();
  await connect();
  const before = await Vendor.findOneAndUpdate(
    { _id },
    { $set: { cancellation: policy } },
    { projection: { cancellation: 1 } },
  ).lean();
  if (!before) throw NOT_FOUND();
  return {
    changedFields: changedKeys(
      {
        allowed: before.cancellation.allowed,
        cutoffMinutes: before.cancellation.cutoffMinutes,
        feePaise: before.cancellation.feePaise,
      },
      policy,
    ).map((k) => `cancellation.${k}`),
  };
}
