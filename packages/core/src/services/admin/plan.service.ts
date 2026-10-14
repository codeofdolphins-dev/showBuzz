import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Plan } from "@showbuzz/db/models/Plan";
import { Vendor } from "@showbuzz/db/models/Vendor";
import type { Types } from "@showbuzz/db/mongoose";
import { planInputSchema } from "@showbuzz/schemas/admin-marketplace";
import type { PlanRow } from "@showbuzz/schemas/types/admin-marketplace";
import { AppError } from "../../http/app-error";
import { changedKeys, idOr404, isDuplicateKey } from "./shared";

/**
 * Subscription plans (a monthly fee, invoiced and marked paid by hand). Plans are never deleted: an inactive plan
 * can't be assigned to more vendors, but vendors already on it keep it (and are invoiced at its fee).
 */

const TAKEN = () =>
  new AppError("CONFLICT", "Another plan already has this name.", 409, {
    fieldErrors: { name: ["Another plan already has this name."] },
  });

export async function listPlans(): Promise<PlanRow[]> {
  await connect();
  const [plans, usage] = await Promise.all([
    Plan.find().sort({ active: -1, monthlyFeePaise: 1 }).lean(),
    Vendor.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { billingModel: "subscription", planId: { $exists: true } } },
      { $group: { _id: "$planId", n: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(usage.map((u) => [u._id.toString(), u.n]));
  return plans.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    monthlyFeePaise: p.monthlyFeePaise,
    active: p.active,
    vendors: counts.get(p._id.toString()) ?? 0,
  }));
}

export async function getPlan(planId: string): Promise<PlanRow | null> {
  const plans = await listPlans();
  return plans.find((p) => p.id === planId) ?? null;
}

/** Active plans for the vendor terms form (plus the vendor's current plan, even if inactive). */
export async function listPlanOptions(currentPlanId?: string): Promise<{ value: string; label: string }[]> {
  const plans = await listPlans();
  return plans
    .filter((p) => p.active || p.id === currentPlanId)
    .map((p) => ({
      value: p.id,
      label: `${p.name} · ₹${(p.monthlyFeePaise / 100).toLocaleString("en-IN")}/mo${p.active ? "" : " (inactive)"}`,
    }));
}

export async function createPlan(input: unknown): Promise<{ id: string; name: string }> {
  const data = planInputSchema.parse(input);
  await connect();
  try {
    const plan = await Plan.create(data);
    return { id: plan.id, name: plan.name };
  } catch (err) {
    if (isDuplicateKey(err)) throw TAKEN();
    throw err;
  }
}

/** A fee change applies to invoices generated afterwards; issued invoices keep their amount. */
export async function updatePlan(planId: string, input: unknown): Promise<{ name: string; changedFields: string[] }> {
  const _id = idOr404(planId, "Plan");
  const data = planInputSchema.parse(input);
  await connect();
  const before = await Plan.findById(_id).lean();
  if (!before) throw new AppError("NOT_FOUND", "Plan not found.", 404);
  try {
    await Plan.updateOne({ _id }, { $set: data });
  } catch (err) {
    if (isDuplicateKey(err)) throw TAKEN();
    throw err;
  }
  return {
    name: data.name,
    changedFields: changedKeys(
      { name: before.name, monthlyFeePaise: before.monthlyFeePaise, active: before.active },
      { ...data },
    ),
  };
}
