import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

export type LeadType = "contact" | "corporate" | "show_submission";

/** A staff note on a lead (admin list-your-show screen); newest last. */
export interface LeadNote {
  text: string;
  staffId: Types.ObjectId;
  staffName: string;
  at: Date;
}

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
  notes: LeadNote[];
  /** Set when the super-admin created a vendor from this request. */
  vendorId?: Types.ObjectId;
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
    notes: {
      type: [
        new Schema(
          { text: String, staffId: { type: Schema.Types.ObjectId, ref: "Staff" }, staffName: String, at: Date },
          { _id: false },
        ),
      ],
      default: [],
    },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

leadSchema.index({ reference: 1 }, { unique: true });
leadSchema.index({ type: 1, status: 1, createdAt: -1 });

export const Lead: Model<LeadAttrs> =
  (models.Lead as Model<LeadAttrs> | undefined) ?? model<LeadAttrs>("Lead", leadSchema, "leads");
