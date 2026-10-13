/**
 * Downloads the mongod binary once, before the test tasks start. Several packages run integration tests in
 * parallel; if each started the first download itself they would race on the download lock.
 */
import { MongoBinary } from "mongodb-memory-server";
import { shareMongoBinaryDir } from "./mongo-binary.ts";

shareMongoBinaryDir();
await MongoBinary.getPath();
