import "server-only";
import mongoose from "mongoose";
import { env, isProduction } from "@/config/env";
import { log } from "@/server/log";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Cached on globalThis so dev hot reloads and warm serverless invocations reuse one connection pool
// instead of opening a new one per module load (which exhausts Atlas connection limits).
const globalCache = globalThis as typeof globalThis & { _mongoose?: MongooseCache };
const cache = (globalCache._mongoose ??= { conn: null, promise: null });

/** Returns the shared Mongoose connection, opening it on first use. Concurrent callers share one attempt. */
export async function connect(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB,
    // Fail fast instead of queueing queries while disconnected.
    bufferCommands: false,
    // Indexes are built by `npm run db:sync-indexes` in production, not on every cold start.
    autoIndex: !isProduction,
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize: 10,
  });
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Let the next call retry rather than reusing a failed attempt.
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}

/** Closes the shared connection (scripts and tests). */
export async function disconnect(): Promise<void> {
  cache.conn = null;
  cache.promise = null;
  await mongoose.disconnect();
}

/** Pings the database within `timeoutMs`; never throws. */
export async function pingDatabase(timeoutMs = 2_000): Promise<"up" | "down"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Database ping timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    await Promise.race([
      (async () => {
        const { connection } = await connect();
        if (!connection.db) throw new Error("Database handle unavailable");
        await connection.db.admin().ping();
      })(),
      timeout,
    ]);
    return "up";
  } catch (err) {
    log.warn("Database ping failed", { err });
    return "down";
  } finally {
    clearTimeout(timer);
  }
}
