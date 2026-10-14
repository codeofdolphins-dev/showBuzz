import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Plan } from "@showbuzz/db/models/Plan";
import { Types } from "@showbuzz/db/mongoose";

/** The vendor's own account summaries for the partner portal (scoped by the session's vendor). */

export interface PlanSummary {
  name: string;
  monthlyFeePaise: number;
}

/** The subscription plan behind a vendor's `planId` (subscription vendors), or null. */
export async function getPlanSummary(planId: string | undefined): Promise<PlanSummary | null> {
  if (!planId || !Types.ObjectId.isValid(planId)) return null;
  await connect();
  const plan = await Plan.findById(planId, { name: 1, monthlyFeePaise: 1 }).lean();
  return plan ? { name: plan.name, monthlyFeePaise: plan.monthlyFeePaise } : null;
}
