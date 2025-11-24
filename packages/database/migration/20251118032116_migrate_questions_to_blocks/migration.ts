import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import type { Block, CTAMigrationStats, SurveyRecord } from "./types";
import { migrateQuestionsSurveyToBlocks } from "./utils";

export const migrateQuestionsToBlocks: MigrationScript = {
  type: "data",
  id: "wsm6h7c8jt086g96ob7wda14",
  name: "20251118032116_migrate_questions_to_blocks",
  run: async ({ tx }) => {
    // Initialize CTA statistics tracker
    const ctaStats: CTAMigrationStats = {
      totalCTAElements: 0,
      ctaWithExternalLink: 0,
      ctaWithoutExternalLink: 0,
    };

    // 1. Query surveys with questions (also fetch endings for validation)
    const surveys = await tx.$queryRaw<SurveyRecord[]>`
      SELECT id, questions, blocks, endings
      FROM "Survey"
      WHERE jsonb_array_length(questions) > 0
    `;

    if (surveys.length === 0) {
      logger.info("No surveys found that need migration");
      return;
    }

    logger.info(`Found ${surveys.length.toString()} surveys to migrate`);

    // 2. Process each survey
    const updates: { id: string; blocks: Block[] }[] = [];

    for (const survey of surveys) {
      try {
        const migrated = migrateQuestionsSurveyToBlocks(survey, createId, ctaStats);
        updates.push({
          id: migrated.id,
          blocks: migrated.blocks,
        });
      } catch (error) {
        logger.error(error, `Failed to migrate survey ${survey.id}`);
        throw new Error(
          `Migration failed for survey ${survey.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    logger.info(`Successfully processed ${updates.length.toString()} surveys`);

    // 3. Update surveys individually for safety (avoids SQL injection risks with complex JSONB arrays)
    let updatedCount = 0;

    for (const update of updates) {
      try {
        // PostgreSQL requires proper array format for jsonb[]
        // We need to convert the JSON array to a PostgreSQL jsonb array using array_to_json
        // The trick is to use jsonb_array_elements to convert the JSON array into rows, then array_agg to collect them back
        await tx.$executeRawUnsafe(
          `UPDATE "Survey" 
           SET blocks = (
             SELECT array_agg(elem)
             FROM jsonb_array_elements($1::jsonb) AS elem
           ), 
           questions = '[]'::jsonb 
           WHERE id = $2`,
          JSON.stringify(update.blocks),
          update.id
        );

        updatedCount++;

        // Log progress every 10000 surveys
        if (updatedCount % 10000 === 0) {
          logger.info(`Progress: ${updatedCount.toString()}/${updates.length.toString()} surveys updated`);
        }
      } catch (error) {
        logger.error(error, `Failed to update survey ${update.id} in database`);
        throw new Error(
          `Database update failed for survey ${update.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    logger.info(`Migration complete: ${updatedCount.toString()} surveys migrated to blocks`);

    // 4. Log CTA migration statistics
    if (ctaStats.totalCTAElements > 0) {
      logger.info(
        `CTA elements processed: ${ctaStats.totalCTAElements.toString()} total (${ctaStats.ctaWithExternalLink.toString()} with external link, ${ctaStats.ctaWithoutExternalLink.toString()} without)`
      );
    }

    logger.info("Migration completed successfully");
  },
};
