/**
 * Creates (and drops stale) indexes for every model. Production runs with autoIndex off, so run
 * this before deploying a change that adds or alters an index:
 *   pnpm db:sync-indexes
 * Reads MONGODB_URI / MONGODB_DB from the environment (falls back to apps/web/.env.local if present).
 */
import { connect, disconnect } from "@showbuzz/db/connect";
import { log } from "@showbuzz/runtime/log";
import { allModels } from "@showbuzz/db/models";

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
