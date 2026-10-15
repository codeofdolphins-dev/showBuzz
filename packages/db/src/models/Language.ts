import "server-only";
import { type Model, Schema, model, models } from "mongoose";
import type { MasterStatus } from "@showbuzz/schemas/master-data";
import { sortOrderField } from "./transforms";

/**
 * An audio language (prompt 7 master data). Movies and events store the name as text; the movie forms in both
 * consoles offer the active languages. Renaming one updates every movie and event that uses it.
 */
export interface LanguageAttrs {
  name: string;
  nativeName: string;
  status: MasterStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const languageSchema = new Schema<LanguageAttrs>(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    nativeName: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    sortOrder: sortOrderField,
  },
  { timestamps: true, versionKey: false },
);

// Case-insensitive uniqueness: "Hindi" and "hindi" are the same language.
languageSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
languageSchema.index({ sortOrder: 1 });

export const Language: Model<LanguageAttrs> =
  (models.Language as Model<LanguageAttrs> | undefined) ??
  model<LanguageAttrs>("Language", languageSchema, "languages");
