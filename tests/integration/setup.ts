import { inject } from "vitest";

const uri = inject("mongoUri");

// Integration tests must only ever reach the in-memory server, never a real cluster from .env files.
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) {
  throw new Error("Integration tests expected a local mongodb-memory-server URI");
}

process.env.MONGODB_URI = uri;
process.env.MONGODB_DB = "showbuzz_test";
