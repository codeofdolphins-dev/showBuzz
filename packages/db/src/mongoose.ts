import "server-only";

/** Mongoose values and types for other packages, so mongoose stays a dependency of @showbuzz/db only (one copy). */
export { Types } from "mongoose";
export type { ClientSession, Model } from "mongoose";
