import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/**
 * A Media Library image (admin). The bytes live in file storage (GridFS stand-in, `ownerType: "platform"`); this
 * record holds what the library lists. The image is public at `/media/<fileId>` on every app.
 */
export interface MediaAssetAttrs {
  fileId: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
  /** Description for screen readers and search in the library. */
  alt: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

const mediaAssetSchema = new Schema<MediaAssetAttrs>(
  {
    fileId: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true, maxlength: 200 },
    contentType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    alt: { type: String, default: "", maxlength: 200 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

mediaAssetSchema.index({ fileId: 1 }, { unique: true });
mediaAssetSchema.index({ createdAt: -1 });

export const MediaAsset: Model<MediaAssetAttrs> =
  (models.MediaAsset as Model<MediaAssetAttrs> | undefined) ??
  model<MediaAssetAttrs>("MediaAsset", mediaAssetSchema, "mediaAssets");
