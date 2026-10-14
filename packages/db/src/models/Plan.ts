import "server-only";
import { type Model, Schema, model, models } from "mongoose";

/** A subscription plan for subscription-billed vendors (a monthly invoice, marked paid by hand for now). */
export interface PlanAttrs {
  name: string;
  monthlyFeePaise: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<PlanAttrs>(
  {
    name: { type: String, required: true, trim: true },
    monthlyFeePaise: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

planSchema.index({ name: 1 }, { unique: true });

export const Plan: Model<PlanAttrs> =
  (models.Plan as Model<PlanAttrs> | undefined) ?? model<PlanAttrs>("Plan", planSchema, "plans");
