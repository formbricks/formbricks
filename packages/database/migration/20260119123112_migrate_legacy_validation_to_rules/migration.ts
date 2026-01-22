import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import type { MigrationStats, SurveyRecord } from "./types";
import { migrateSurveyBlocks } from "./utils";

export const migrateLegacyValidationToRules: MigrationScript = {
  type: "data",
  id: "clx8k9m2n0001l508xyz12345",
  name: "20260119123112_migrate_legacy_validation_to_rules",
  run: async ({ tx }) => {
    // Initialize migration statistics
    const stats: MigrationStats = {
      totalSurveys: 0,
      surveysProcessed: 0,
      surveysSkipped: 0,
      openTextElementsMigrated: 0,
      fileUploadElementsMigrated: 0,
      errors: 0,
    };

    // Query to find surveys with elements that have legacy validation fields
    // This includes ALL elements with charLimit or allowedFileExtensions keys,
    // regardless of enabled status or array length, to ensure complete cleanup
    const surveysFindQuery = `
      SELECT s.id, s.blocks
      FROM "Survey" AS s 
      WHERE EXISTS (
        SELECT 1 
        FROM unnest(s.blocks) AS block 
        CROSS JOIN jsonb_array_elements(block->'elements') AS element 
        WHERE (
          -- Open Text elements with any charLimit field (enabled, disabled, or any value)
          (element->>'type' = 'openText' 
           AND element ? 'charLimit')
          OR
          -- File Upload elements with any allowedFileExtensions field (even empty array)
          (element->>'type' = 'fileUpload' 
           AND element ? 'allowedFileExtensions')
        )
      )
    `;

    const surveysNeedingMigration: SurveyRecord[] = await tx.$queryRaw`${Prisma.raw(surveysFindQuery)}`;

    stats.totalSurveys = surveysNeedingMigration.length;

    if (surveysNeedingMigration.length === 0) {
      logger.info("No surveys found that need migration");
      return;
    }

    logger.info(`Found ${surveysNeedingMigration.length.toString()} surveys to migrate`);

    // Process surveys in batches
    const SURVEY_BATCH_SIZE = 1000;
    const updates: { id: string; blocks: SurveyRecord["blocks"] }[] = [];

    for (const survey of surveysNeedingMigration) {
      // Deep clone blocks to avoid mutating original
      const blocksCopy = JSON.parse(JSON.stringify(survey.blocks)) as SurveyRecord["blocks"];

      // Migrate blocks - if this fails, the entire transaction will roll back
      try {
        migrateSurveyBlocks(blocksCopy);
      } catch (error) {
        logger.error(error, `Failed to migrate survey ${survey.id}`);
        throw new Error(
          `Migration failed for survey ${survey.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      updates.push({
        id: survey.id,
        blocks: blocksCopy,
      });
      stats.surveysProcessed++;
    }

    logger.info(
      `Processed ${updates.length.toString()} surveys: ${stats.surveysProcessed.toString()} modified`
    );

    // Update surveys in batches using UNNEST for performance
    if (updates.length === 0) {
      logger.info("No surveys needed updating (all already migrated)");
      return;
    }

    {
      let updatedCount = 0;

      for (let i = 0; i < updates.length; i += SURVEY_BATCH_SIZE) {
        const batch = updates.slice(i, i + SURVEY_BATCH_SIZE);

        try {
          // Build arrays for batch update
          const ids = batch.map((u) => u.id);
          const blocksJsonStrings = batch.map((u) => JSON.stringify(u.blocks));

          // Use UNNEST to update multiple surveys in a single query
          await tx.$executeRawUnsafe(
            `UPDATE "Survey" AS s
             SET 
               blocks = (
                 SELECT array_agg(elem)
                 FROM jsonb_array_elements(data.blocks_json::jsonb) AS elem
               )
             FROM (
               SELECT 
                 unnest($1::text[]) AS id,
                 unnest($2::text[]) AS blocks_json
             ) AS data
             WHERE s.id = data.id`,
            ids,
            blocksJsonStrings
          );

          updatedCount += batch.length;

          // Log progress
          logger.info(`Progress: ${updatedCount.toString()}/${updates.length.toString()} surveys updated`);
        } catch (error) {
          logger.error(error, `Failed to update survey batch starting at index ${i.toString()}`);
          throw new Error(
            `Database batch update failed at index ${i.toString()}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      logger.info(`Migration complete: ${updatedCount.toString()} surveys migrated`);
    }

    // Log final statistics
    logger.info(
      `Migration complete: ${stats.totalSurveys.toString()} total surveys, ${stats.surveysProcessed.toString()} processed`
    );
  },
};
