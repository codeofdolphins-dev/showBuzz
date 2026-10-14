import "server-only";
import { Readable } from "node:stream";
import { mongo } from "mongoose";
import { connect } from "../connect";

/**
 * Private file storage (KYC documents today). Callers only see this interface, so the GridFS stand-in can move to
 * S3 / Vercel Blob once a media provider is chosen without touching them. Files are never public: whoever serves
 * one checks that the reader may see the owner's records (`metadata.ownerType` / `ownerId`) first.
 */

export const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];

/** Vercel rejects request bodies above ~4.5 MB, so uploads stay under 4 MB. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export interface FileOwner {
  ownerType: "vendor";
  ownerId: string;
}

export interface StoredFileInfo {
  fileId: string;
  filename: string;
  contentType: AllowedFileType;
  size: number;
  uploadedAt: Date;
  owner: FileOwner;
}

export interface FileStorage {
  put(input: { filename: string; data: Uint8Array; owner: FileOwner }): Promise<StoredFileInfo>;
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
  return undefined;
}

/** Throws FileRejectedError (customer-facing message) unless it is a PDF, JPEG or PNG of at most 4 MB. */
export function assertAllowedFile(data: Uint8Array): AllowedFileType {
  if (data.byteLength === 0) throw new FileRejectedError("The file is empty.");
  if (data.byteLength > MAX_FILE_BYTES) throw new FileRejectedError("Files can be at most 4 MB.");
  const type = sniffFileType(data);
  if (!type) throw new FileRejectedError("Upload a PDF, JPEG or PNG file.");
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

  async put({ filename, data, owner }: { filename: string; data: Uint8Array; owner: FileOwner }) {
    const contentType = assertAllowedFile(data);
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
