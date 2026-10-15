import "server-only";
import { Readable } from "node:stream";
import { mongo } from "mongoose";
import { connect } from "../connect";

/**
 * File storage: private KYC documents (`ownerType: "vendor"`) and public Media Library images (`ownerType:
 * "platform"`). Callers only see this interface, so the GridFS stand-in can move to S3 / Vercel Blob once a media
 * provider is chosen without touching them. Whoever serves a file checks its owner first: vendor files only to that
 * vendor or staff, and only `platform` files at the public `/media/<id>` route.
 */

export const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];

/** KYC documents. */
export type DocumentFileType = "application/pdf" | "image/jpeg" | "image/png";
export const DOCUMENT_FILE_TYPES: readonly DocumentFileType[] = ["application/pdf", "image/jpeg", "image/png"];
/** Media Library images (no SVG: it can carry script). */
export const IMAGE_FILE_TYPES: readonly AllowedFileType[] = ["image/jpeg", "image/png", "image/webp"];

/** Vercel rejects request bodies above ~4.5 MB, so uploads stay under 4 MB. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export interface FileOwner {
  /** "platform" = a Media Library image (public); "vendor" = a vendor's private KYC document. */
  ownerType: "vendor" | "platform";
  ownerId: string;
}

export interface StoredFileInfo<T extends AllowedFileType = AllowedFileType> {
  fileId: string;
  filename: string;
  contentType: T;
  size: number;
  uploadedAt: Date;
  owner: FileOwner;
}

export interface FileStorage {
  put<T extends AllowedFileType = DocumentFileType>(input: {
    filename: string;
    data: Uint8Array;
    owner: FileOwner;
    /** Defaults to DOCUMENT_FILE_TYPES. */
    allowed?: readonly T[];
  }): Promise<StoredFileInfo<T>>;
  /** undefined when the file doesn't exist. */
  get(fileId: string): Promise<{ info: StoredFileInfo; data: Buffer } | undefined>;
  /** Deleting a missing file is not an error. */
  delete(fileId: string): Promise<void>;
}

export class FileRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileRejectedError";
  }
}

const startsWith = (data: Uint8Array, bytes: number[]) => bytes.every((b, i) => data[i] === b);

/** The real type from the file's first bytes (the client's declared type and extension are not trusted). */
export function sniffFileType(data: Uint8Array): AllowedFileType | undefined {
  if (startsWith(data, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(data, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && [0x57, 0x45, 0x42, 0x50].every((b, i) => data[8 + i] === b)) {
    return "image/webp";
  }
  return undefined;
}

/** Throws FileRejectedError (customer-facing message) unless the file is one of `allowed` and at most 4 MB. */
export function assertAllowedFile(
  data: Uint8Array,
  allowed: readonly AllowedFileType[] = DOCUMENT_FILE_TYPES,
): AllowedFileType {
  if (data.byteLength === 0) throw new FileRejectedError("The file is empty.");
  if (data.byteLength > MAX_FILE_BYTES) throw new FileRejectedError("Files can be at most 4 MB.");
  const type = sniffFileType(data);
  if (!type || !allowed.includes(type)) {
    throw new FileRejectedError(
      allowed.includes("application/pdf") ? "Upload a PDF, JPEG or PNG file." : "Upload a JPEG, PNG or WebP image.",
    );
  }
  return type;
}

/** Keeps a display name safe for headers and listings: no paths, no control characters, at most 200 chars. */
function cleanFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[^\w.\- ()]/g, "_").trim();
  return (clean || "document").slice(0, 200);
}

const BUCKET = "files";

interface GridFsMetadata {
  contentType: AllowedFileType;
  ownerType: FileOwner["ownerType"];
  ownerId: string;
}

/** MongoDB GridFS (`files.files` / `files.chunks`), using the driver that ships with Mongoose. */
class GridFsStorage implements FileStorage {
  private async bucket(): Promise<mongo.GridFSBucket> {
    const { connection } = await connect();
    if (!connection.db) throw new Error("Database handle unavailable");
    return new mongo.GridFSBucket(connection.db, { bucketName: BUCKET });
  }

  async put<T extends AllowedFileType = DocumentFileType>({
    filename,
    data,
    owner,
    allowed,
  }: {
    filename: string;
    data: Uint8Array;
    owner: FileOwner;
    allowed?: readonly T[];
  }): Promise<StoredFileInfo<T>> {
    // Without `allowed` the default list is DocumentFileType, so the default T holds.
    const contentType = assertAllowedFile(data, allowed) as T;
    const bucket = await this.bucket();
    const name = cleanFilename(filename);
    const metadata: GridFsMetadata = { contentType, ownerType: owner.ownerType, ownerId: owner.ownerId };
    const upload = bucket.openUploadStream(name, { metadata });
    await new Promise<void>((resolve, reject) => {
      Readable.from(Buffer.from(data)).pipe(upload).on("finish", resolve).on("error", reject);
    });
    return {
      fileId: upload.id.toString(),
      filename: name,
      contentType,
      size: data.byteLength,
      uploadedAt: new Date(),
      owner,
    };
  }

  async get(fileId: string) {
    if (!mongo.ObjectId.isValid(fileId)) return undefined;
    const bucket = await this.bucket();
    const id = new mongo.ObjectId(fileId);
    const [file] = await bucket.find({ _id: id }).limit(1).toArray();
    if (!file) return undefined;
    const meta = file.metadata as GridFsMetadata | undefined;
    if (!meta) return undefined;
    const chunks: Buffer[] = [];
    for await (const chunk of bucket.openDownloadStream(id)) chunks.push(chunk as Buffer);
    return {
      info: {
        fileId,
        filename: file.filename,
        contentType: meta.contentType,
        size: file.length,
        uploadedAt: file.uploadDate,
        owner: { ownerType: meta.ownerType, ownerId: meta.ownerId },
      },
      data: Buffer.concat(chunks),
    };
  }

  async delete(fileId: string) {
    if (!mongo.ObjectId.isValid(fileId)) return;
    const bucket = await this.bucket();
    try {
      await bucket.delete(new mongo.ObjectId(fileId));
    } catch (err) {
      // GridFS throws when the file is already gone; deleting twice is fine.
      if (!(err instanceof Error && /not found/i.test(err.message))) throw err;
    }
  }
}

let storage: FileStorage | undefined;

/** The configured storage (GridFS until a media storage provider is chosen). */
export function getFileStorage(): FileStorage {
  storage ??= new GridFsStorage();
  return storage;
}
