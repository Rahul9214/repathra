import { drizzle } from "drizzle-orm/postgres-js";

import { productCapabilities } from "@/features/registry";
import { PLATFORM_RELEASE_ID, PRODUCT } from "@/shared/contracts/product";
import { createPostgresClient } from "@/shared/db/connection";
import { readPgCode } from "@/shared/db/postgres-error";
import { capability, platformRelease } from "@/shared/db/schema";

export type SeedResult =
  | { ok: true; version: string; capabilityCount: number }
  | { ok: false; message: string };

export async function seedProductContract(connectionString: string): Promise<SeedResult> {
  const client = createPostgresClient(connectionString);
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(platformRelease)
        .values({
          id: PLATFORM_RELEASE_ID,
          productName: PRODUCT.name,
          productVersion: PRODUCT.version,
          tagline: PRODUCT.tagline,
        })
        .onConflictDoUpdate({
          target: platformRelease.id,
          set: {
            productName: PRODUCT.name,
            productVersion: PRODUCT.version,
            tagline: PRODUCT.tagline,
          },
        });

      for (const [index, item] of productCapabilities.entries()) {
        await tx
          .insert(capability)
          .values({
            id: item.id,
            name: item.name,
            summary: item.summary,
            status: item.status,
            sortOrder: index,
          })
          .onConflictDoUpdate({
            target: capability.id,
            set: {
              name: item.name,
              summary: item.summary,
              status: item.status,
              sortOrder: index,
            },
          });
      }
    });

    return {
      ok: true,
      version: PRODUCT.version,
      capabilityCount: productCapabilities.length,
    };
  } catch (error) {
    if (readPgCode(error) === "42P01") {
      return {
        ok: false,
        message:
          "The database schema is not migrated. Run pnpm db:migrate before seeding. The product contract was not committed.",
      };
    }
    return {
      ok: false,
      message: "Seeding the product contract failed. The product contract was not committed.",
    };
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}
