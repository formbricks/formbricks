import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

// Regex patterns as constants for consistency
// NUMBER_PATTERN: requires digits after decimal if present (e.g., "123", "-45.67")
const NUMBER_PATTERN = "^-?[0-9]+(\\.[0-9]+)?$";
// ISO_DATE_PATTERN: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
const ISO_DATE_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{3})?Z?)?$";

interface KeyTypeAnalysis {
  id: string;
  key: string;
  detected_type: "number" | "date" | "string";
  non_empty_count: bigint;
}

interface MigrationStats {
  totalKeys: number;
  defaultKeys: number;
  customKeys: number;
  processedKeys: number;
  numberTypeKeys: number;
  dateTypeKeys: number;
  stringTypeKeys: number;
  skippedEmptyKeys: number;
  totalAttributeRows: number;
  valueBackfillSkipped: boolean;
  numberRowsBackfilled: number;
  dateRowsBackfilled: number;
}

export const addedAttributesDataTypes: MigrationScript = {
  type: "data",
  id: "jdxclvxcwfh7031hmvwy3pe2",
  name: "20260205033241_added_attributes_data_types",
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
      totalAttributeRows: 0,
      valueBackfillSkipped: false,
      numberRowsBackfilled: 0,
      dateRowsBackfilled: 0,
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

    // ============================================================
    // STEP 5: Conditional value backfill
    // For small datasets (< 1M rows), backfill valueNumber and valueDate inline.
    // For large datasets (>= 1M rows), skip and point to the standalone script.
    // ============================================================
    const BACKFILL_THRESHOLD = 1_000_000;

    const totalAttributeCount = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "ContactAttribute"
    `;

    stats.totalAttributeRows = Number(totalAttributeCount[0].count);

    logger.info(
      `Step 5: Total ContactAttribute rows: ${stats.totalAttributeRows.toString()} (threshold: ${BACKFILL_THRESHOLD.toString()})`
    );

    if (stats.totalAttributeRows < BACKFILL_THRESHOLD) {
      // ============================================================
      // STEP 5a: Inline value backfill for number attributes
      // ============================================================
      if (numberKeys.length > 0) {
        logger.info(
          `Step 5a: Backfilling valueNumber for ${stats.numberTypeKeys.toString()} number-type keys...`
        );

        const VALUE_BATCH_SIZE = 10;
        for (let i = 0; i < numberKeys.length; i += VALUE_BATCH_SIZE) {
          const batch = numberKeys.slice(i, i + VALUE_BATCH_SIZE);

          const batchResult = await tx.$executeRawUnsafe(
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

          stats.numberRowsBackfilled += batchResult;
          logger.info(
            `Number backfill progress: ${Math.min(i + VALUE_BATCH_SIZE, numberKeys.length).toString()}/${numberKeys.length.toString()} keys (${stats.numberRowsBackfilled.toString()} rows updated)`
          );
        }

        logger.info(`Step 5a complete: ${stats.numberRowsBackfilled.toString()} number rows backfilled`);
      } else {
        logger.info("Step 5a: No number keys to backfill, skipping");
      }

      // ============================================================
      // STEP 5b: Inline value backfill for date attributes
      // ============================================================
      if (dateKeys.length > 0) {
        logger.info(`Step 5b: Backfilling valueDate for ${stats.dateTypeKeys.toString()} date-type keys...`);

        const VALUE_BATCH_SIZE = 10;
        for (let i = 0; i < dateKeys.length; i += VALUE_BATCH_SIZE) {
          const batch = dateKeys.slice(i, i + VALUE_BATCH_SIZE);

          const batchResult = await tx.$executeRawUnsafe(
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

          stats.dateRowsBackfilled += batchResult;
          logger.info(
            `Date backfill progress: ${Math.min(i + VALUE_BATCH_SIZE, dateKeys.length).toString()}/${dateKeys.length.toString()} keys (${stats.dateRowsBackfilled.toString()} rows updated)`
          );
        }

        logger.info(`Step 5b complete: ${stats.dateRowsBackfilled.toString()} date rows backfilled`);
      } else {
        logger.info("Step 5b: No date keys to backfill, skipping");
      }
    } else {
      stats.valueBackfillSkipped = true;
      logger.info(
        `Step 5: Skipping value backfill (${stats.totalAttributeRows.toString()} rows >= ${BACKFILL_THRESHOLD.toString()} threshold)`
      );
      logger.info("Value backfill must be run separately after deploy using the standalone script:");
      logger.info(
        "  docker exec <container> node packages/database/dist/scripts/backfill-attribute-values.js"
      );
    }

    // ============================================================
    // FINAL: Log summary
    // ============================================================
    const backfillStatus = stats.valueBackfillSkipped
      ? `Value backfill: SKIPPED (${stats.totalAttributeRows.toString()} rows >= ${BACKFILL_THRESHOLD.toString()} threshold)
  Run after deploy: docker exec <container> node packages/database/dist/scripts/backfill-attribute-values.js`
      : `Value backfill: COMPLETED inline
    - valueNumber rows updated: ${stats.numberRowsBackfilled.toString()}
    - valueDate rows updated: ${stats.dateRowsBackfilled.toString()}`;

    logger.info(
      `
========================================
Migration Complete!
========================================
Total attribute keys: ${stats.totalKeys.toString()}
  - Default keys (skipped): ${stats.defaultKeys.toString()}
  - Custom keys: ${stats.customKeys.toString()}
    - Number type: ${stats.numberTypeKeys.toString()}
    - Date type: ${stats.dateTypeKeys.toString()}
    - String type: ${stats.stringTypeKeys.toString()}
    - Empty (skipped): ${stats.skippedEmptyKeys.toString()}
Total attribute rows: ${stats.totalAttributeRows.toString()}
${backfillStatus}
========================================`
    );
  },
};
