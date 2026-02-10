/**
 * Standalone backfill script for populating valueNumber and valueDate columns
 * on ContactAttribute rows where they are currently NULL.
 *
 * This script is intended to be run AFTER the keys-only data migration
 * (20260203033241_added_attributes_data_types) has completed.
 *
 * Usage (Docker):
 *   docker exec <container> node packages/database/dist/scripts/backfill-attribute-values.js
 *
 * Usage (Development):
 *   npx tsx packages/database/src/scripts/backfill-attribute-values.ts
 *
 * Key characteristics:
 * - Uses PrismaClient directly (no transaction wrapping, no 30-min timeout)
 * - Processes in batches of keys (configurable via KEY_BATCH_SIZE)
 * - Idempotent: only updates rows where valueNumber/valueDate IS NULL
 * - Can be stopped and resumed safely (each batch commits independently)
 * - Logs progress throughout
 */
import { PrismaClient } from "@prisma/client";

// Regex patterns matching those used in the migration for consistency
const NUMBER_PATTERN = "^-?[0-9]+(\\.[0-9]+)?$";
const ISO_DATE_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{3})?Z?)?$";

// How many attribute keys to process in a single batch
const KEY_BATCH_SIZE = 10;

const prisma = new PrismaClient();

const backfillNumberAttributes = async (): Promise<number> => {
  console.log("Fetching number-type attribute keys...");

  const numberKeys = await prisma.$queryRaw<{ id: string; key: string }[]>`
    SELECT id, key FROM "ContactAttributeKey"
    WHERE "dataType" = 'number'::"ContactAttributeDataType"
  `;

  if (numberKeys.length === 0) {
    console.log("No number-type attribute keys found. Skipping.");
    return 0;
  }

  console.log(`Found ${numberKeys.length.toString()} number-type keys. Backfilling valueNumber...`);

  let totalUpdated = 0;
  const keyIds = numberKeys.map((k) => k.id);

  for (let i = 0; i < keyIds.length; i += KEY_BATCH_SIZE) {
    const batch = keyIds.slice(i, i + KEY_BATCH_SIZE);

    const batchResult = await prisma.$executeRawUnsafe(
      `
      UPDATE "ContactAttribute"
      SET "valueNumber" = value::DOUBLE PRECISION
      WHERE "attributeKeyId" = ANY($1)
        AND "valueNumber" IS NULL
        AND TRIM(value) != ''
        AND value ~ $2
      `,
      batch,
      NUMBER_PATTERN
    );

    totalUpdated += batchResult;
    console.log(
      `  Number backfill progress: ${Math.min(i + KEY_BATCH_SIZE, keyIds.length).toString()}/${keyIds.length.toString()} keys (${totalUpdated.toString()} rows updated)`
    );
  }

  return totalUpdated;
};

const backfillDateAttributes = async (): Promise<number> => {
  console.log("Fetching date-type attribute keys...");

  const dateKeys = await prisma.$queryRaw<{ id: string; key: string }[]>`
    SELECT id, key FROM "ContactAttributeKey"
    WHERE "dataType" = 'date'::"ContactAttributeDataType"
  `;

  if (dateKeys.length === 0) {
    console.log("No date-type attribute keys found. Skipping.");
    return 0;
  }

  console.log(`Found ${dateKeys.length.toString()} date-type keys. Backfilling valueDate...`);

  let totalUpdated = 0;
  const keyIds = dateKeys.map((k) => k.id);

  for (let i = 0; i < keyIds.length; i += KEY_BATCH_SIZE) {
    const batch = keyIds.slice(i, i + KEY_BATCH_SIZE);

    const batchResult = await prisma.$executeRawUnsafe(
      `
      UPDATE "ContactAttribute"
      SET "valueDate" = value::TIMESTAMP
      WHERE "attributeKeyId" = ANY($1)
        AND "valueDate" IS NULL
        AND TRIM(value) != ''
        AND value ~ $2
      `,
      batch,
      ISO_DATE_PATTERN
    );

    totalUpdated += batchResult;
    console.log(
      `  Date backfill progress: ${Math.min(i + KEY_BATCH_SIZE, keyIds.length).toString()}/${keyIds.length.toString()} keys (${totalUpdated.toString()} rows updated)`
    );
  }

  return totalUpdated;
};

const main = async (): Promise<void> => {
  console.log("========================================");
  console.log("Attribute Value Backfill Script");
  console.log("========================================");
  console.log("");

  const startTime = Date.now();

  const numberRowsUpdated = await backfillNumberAttributes();
  console.log("");
  const dateRowsUpdated = await backfillDateAttributes();

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(1);

  console.log("");
  console.log("========================================");
  console.log("Backfill Complete!");
  console.log("========================================");
  console.log(`  valueNumber rows updated: ${numberRowsUpdated.toString()}`);
  console.log(`  valueDate rows updated:   ${dateRowsUpdated.toString()}`);
  console.log(`  Duration: ${durationSec}s`);
  console.log("========================================");
};

main()
  .catch((error: unknown) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
