import { fileURLToPath } from "node:url";
import { defineShowbuzzVitest } from "@showbuzz/config/vitest";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineShowbuzzVitest({
  projects: ["unit", "unit-dom", "integration"],
  next: true,
  alias: [{ find: /^@\//, replacement: `${src}/` }],
});
