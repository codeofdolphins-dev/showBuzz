import { fileURLToPath } from "node:url";

/**
 * Keep one mongod download for the whole repo (node_modules/.cache at the root) instead of one per package.
 * An explicit MONGOMS_DOWNLOAD_DIR (e.g. a CI cache) still wins.
 */
export function shareMongoBinaryDir() {
  process.env.MONGOMS_DOWNLOAD_DIR ??= fileURLToPath(
    new URL("../../../node_modules/.cache/mongodb-binaries", import.meta.url),
  );
}
