/**
 * Creates (and drops stale) indexes for every model. Production runs with autoIndex off, so run
 * this before deploying a change that adds or alters an index:
 *   npm run db:sync-indexes
 * Reads MONGODB_URI / MONGODB_DB from the environment (falls back to .env.local if present).
 */
import { connect, disconnect } from "@/server/db/connect";
import { log } from "@/server/log";
import { allModels } from "@/server/models";

async function main() {
  await connect();
  for (const model of allModels) {
    const dropped = await model.syncIndexes();
    log.info("Indexes synced", { model: model.modelName, dropped });
  }
}

main()
  .catch((err: unknown) => {
    log.error("Index sync failed", { err });
    process.exitCode = 1;
  })
  .finally(() => disconnect());
