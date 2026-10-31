import { defineConfig } from "drizzle-kit";

import { loadProjectEnv } from "./src/shared/config/load-env";
import { resolveDrizzleCredentials } from "./src/shared/db/drizzle-credentials";

loadProjectEnv();

const credentials = resolveDrizzleCredentials({
  argv: process.argv,
  env: process.env,
});

export default defineConfig({
  schema: "./src/shared/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: credentials.url,
  },
  strict: true,
  verbose: false,
});
