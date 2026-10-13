import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";
import { shareMongoBinaryDir } from "./mongo-binary";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/**
 * Starts one single-node replica set for the integration run (a replica set, so transactions work)
 * and hands its URI to the test workers. The first run downloads the mongod binary.
 */
export default async function setup(project: TestProject) {
  shareMongoBinaryDir();
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  project.provide("mongoUri", replSet.getUri());

  return async () => {
    await replSet.stop();
  };
}
