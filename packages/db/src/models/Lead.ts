import "server-only";
import { type Model, Schema, model, models } from "mongoose";

export type LeadType = "contact" | "corporate" | "show_submission";

/**
 * An inbound enquiry from the contact, corporate or list-your-show form. `fields` is the form payload as
 * validated by its Zod schema (packages/schemas/src/lead.ts); name/email/phone are copied out for searching.
 */
export interface LeadAttrs {
  type: LeadType;
  /** Shown to the visitor, e.g. "TKT-4821". */
  reference: string;
  name: string;
  email: string;
  phone?: string;
  fields: Record<string, unknown>;
  status: "new" | "in_progress" | "closed";
  /** IP /24 (or /48) prefix only, for spam review. */
  ipPrefix?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<LeadAttrs>(
  {
    type: { type: String, enum: ["contact", "corporate", "show_submission"], required: true },
    reference: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: String,
    fields: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["new", "in_progress", "closed"], required: true, default: "new" },
    ipPrefix: String,
  },
  { timestamps: true, versionKey: false, minimize: false },
);

leadSchema.index({ reference: 1 }, { unique: true });
leadSchema.index({ type: 1, status: 1, createdAt: -1 });

export const Lead: Model<LeadAttrs> =
  (models.Lead as Model<LeadAttrs> | undefined) ?? model<LeadAttrs>("Lead", leadSchema, "leads");
