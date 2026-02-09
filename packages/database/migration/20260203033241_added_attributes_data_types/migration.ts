import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

// Regex patterns as constants for consistency
// NUMBER_PATTERN: requires digits after decimal if present (e.g., "123", "-45.67")
const NUMBER_PATTERN = "^-?[0-9]+(\\.[0-9]+)?$";
// ISO_DATE_PATTERN: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
const ISO_DATE_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{3})?Z?)?$";

type KeyTypeAnalysis = {
  id: string;
  key: string;
  detected_type: "number" | "date" | "string";
  non_empty_count: bigint;
};

type MigrationStats = {
  totalKeys: number;
  defaultKeys: number;
  customKeys: number;
  processedKeys: number;
  numberTypeKeys: number;
  dateTypeKeys: number;
  stringTypeKeys: number;
  skippedEmptyKeys: number;
};

export const addedAttributesDataTypes: MigrationScript = {
  type: "data",
  id: "jdxclvxcwfh7031hmvwy3pe2",
  name: "20260203033241_added_attributes_data_types",
  run: async ({ tx }) => {
    const stats: MigrationStats = {
      totalKeys: 0,
      defaultKeys: 0,
      customKeys: 0,
      processedKeys: 0,
      numberTypeKeys: 0,
      dateTypeKeys: 0,
      stringTypeKeys: 0,
      skippedEmptyKeys: 0,
    };

    // ============================================================
    // STEP 1: Get overall counts for logging
    // ============================================================
    logger.info("Step 1: Gathering statistics...");

    const countsResult = await tx.$queryRaw<{ total: bigint; default_keys: bigint; custom_keys: bigint }[]>`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE type = 'default') as default_keys,
        COUNT(*) FILTER (WHERE type = 'custom') as custom_keys
      FROM "ContactAttributeKey"
    `;

    stats.totalKeys = Number(countsResult[0].total);
    stats.defaultKeys = Number(countsResult[0].default_keys);
    stats.customKeys = Number(countsResult[0].custom_keys);

    logger.info(
      `Found ${stats.totalKeys.toString()} total keys (${stats.defaultKeys.toString()} default, ${stats.customKeys.toString()} custom)`
    );

    // ============================================================
    // STEP 2: Analyze ALL custom keys in ONE query to determine their types
    // This replaces thousands of individual queries with a single bulk analysis
    // ============================================================
    logger.info("Step 2: Analyzing custom keys to detect data types (bulk query)...");

    const keyTypeAnalysis = await tx.$queryRawUnsafe<KeyTypeAnalysis[]>(
      `
      WITH key_analysis AS (
        SELECT 
          cak.id,
          cak.key,
          COUNT(*) FILTER (WHERE TRIM(ca.value) != '') as non_empty_count,
          COUNT(*) FILTER (WHERE TRIM(ca.value) != '' AND ca.value !~ $1) as non_number_count,
          COUNT(*) FILTER (WHERE TRIM(ca.value) != '' AND ca.value !~ $2) as non_date_count
        FROM "ContactAttributeKey" cak
        LEFT JOIN "ContactAttribute" ca ON ca."attributeKeyId" = cak.id
        WHERE cak.type = 'custom'
        GROUP BY cak.id, cak.key
      )
      SELECT 
        id,
        key,
        non_empty_count,
        CASE 
          WHEN non_empty_count = 0 THEN 'string'
          WHEN non_number_count = 0 THEN 'number'
          WHEN non_date_count = 0 THEN 'date'
          ELSE 'string'
        END as detected_type
      FROM key_analysis
      `,
      NUMBER_PATTERN,
      ISO_DATE_PATTERN
    );

    // Categorize keys by detected type
    const numberKeys: string[] = [];
    const dateKeys: string[] = [];

    for (const analysis of keyTypeAnalysis) {
      if (Number(analysis.non_empty_count) === 0) {
        stats.skippedEmptyKeys++;
      } else if (analysis.detected_type === "number") {
        numberKeys.push(analysis.id);
        stats.numberTypeKeys++;
      } else if (analysis.detected_type === "date") {
        dateKeys.push(analysis.id);
        stats.dateTypeKeys++;
      } else {
        stats.stringTypeKeys++;
      }
    }

    stats.processedKeys = stats.numberTypeKeys + stats.dateTypeKeys + stats.stringTypeKeys;

    logger.info(
      `Analysis complete: ${stats.numberTypeKeys.toString()} number, ${stats.dateTypeKeys.toString()} date, ${stats.stringTypeKeys.toString()} string, ${stats.skippedEmptyKeys.toString()} empty (skipped)`
    );

    // ============================================================
    // STEP 3: Update dataType for number keys (in batches)
    // ============================================================
    if (numberKeys.length > 0) {
      logger.info(`Step 3: Updating ${numberKeys.length.toString()} keys to 'number' type...`);

      const KEY_BATCH_SIZE = 100;
      for (let i = 0; i < numberKeys.length; i += KEY_BATCH_SIZE) {
        const batch = numberKeys.slice(i, i + KEY_BATCH_SIZE);
        logger.info(`Step 3: Updating batch ${Math.floor(i / KEY_BATCH_SIZE + 1).toString()}...`);

        await tx.$executeRaw`
          UPDATE "ContactAttributeKey"
          SET "dataType" = 'number'::"ContactAttributeDataType"
          WHERE id = ANY(${batch})
        `;
      }

      logger.info("Step 3 complete: dataType updated for number keys");
    } else {
      logger.info("Step 3: No number keys to update, skipping");
    }

    // NOTE: Value backfill for number attributes (populating valueNumber) is handled
    // by a separate post-deploy script: packages/database/src/scripts/backfill-attribute-values.ts
    // The transition code in prisma-query.ts handles queries correctly during the backfill window.

    // ============================================================
    // STEP 4: Update dataType for date keys (in batches)
    // ============================================================
    if (dateKeys.length > 0) {
      logger.info(`Step 4: Updating ${dateKeys.length.toString()} keys to 'date' type...`);

      const DATE_KEY_BATCH_SIZE = 100;
      for (let i = 0; i < dateKeys.length; i += DATE_KEY_BATCH_SIZE) {
        const batch = dateKeys.slice(i, i + DATE_KEY_BATCH_SIZE);
        logger.info(`Step 4: Updating batch ${Math.floor(i / DATE_KEY_BATCH_SIZE + 1).toString()}...`);

        await tx.$executeRaw`
          UPDATE "ContactAttributeKey"
          SET "dataType" = 'date'::"ContactAttributeDataType"
          WHERE id = ANY(${batch})
        `;
      }

      logger.info("Step 4 complete: dataType updated for date keys");
    } else {
      logger.info("Step 4: No date keys to update, skipping");
    }

    // NOTE: Value backfill for date attributes (populating valueDate) is handled
    // by a separate post-deploy script: packages/database/src/scripts/backfill-attribute-values.ts
    // The transition code in prisma-query.ts handles queries correctly during the backfill window.

    // ============================================================
    // FINAL: Log summary
    // ============================================================
    logger.info(
      `
========================================
Migration Complete (keys-only)!
========================================
Total attribute keys: ${stats.totalKeys.toString()}
  - Default keys (skipped): ${stats.defaultKeys.toString()}
  - Custom keys: ${stats.customKeys.toString()}
    - Number type: ${stats.numberTypeKeys.toString()}
    - Date type: ${stats.dateTypeKeys.toString()}
    - String type: ${stats.stringTypeKeys.toString()}
    - Empty (skipped): ${stats.skippedEmptyKeys.toString()}

NOTE: Value backfill (valueNumber/valueDate) is deferred.
Run the backfill script after deploy for large datasets:
  npx tsx packages/database/src/scripts/backfill-attribute-values.ts
========================================`
    );
  },
};
