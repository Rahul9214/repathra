import { seedProductContract } from "@/platform/seed-contract";
import { loadConfig } from "@/shared/config/env";
import { loadProjectEnv } from "@/shared/config/load-env";

loadProjectEnv();

async function main(): Promise<void> {
  const loaded = loadConfig(process.env);
  if (!loaded.ok) {
    console.error(loaded.issues.join("\n"));
    process.exit(1);
  }

  if (!loaded.config.database.configured) {
    console.error(
      "DATABASE_URL is not set. No database was contacted. Add a cloud PostgreSQL connection string to .env.local and run this command again.",
    );
    process.exit(1);
  }

  const result = await seedProductContract(loaded.config.database.connectionString);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }

  console.log(`Recorded REPATHRA ${result.version} and ${result.capabilityCount} registered capabilities.`);
}

main().catch(() => {
  console.error("Seeding failed before the product contract could be confirmed.");
  process.exit(1);
});
