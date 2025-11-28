import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import type {
  Block,
  CTAMigrationStats,
  IntegrationMigrationStats,
  MigratedIntegration,
  SurveyRecord,
} from "./types";
import { migrateIntegrationConfig, migrateQuestionsSurveyToBlocks } from "./utils";

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

    // 5. Migrate Integration configs
    logger.info("Starting integration config migration");

    // Initialize integration statistics
    const integrationStats: IntegrationMigrationStats = {
      totalIntegrations: 0,
      googleSheets: { processed: 0, skipped: 0 },
      airtable: { processed: 0, skipped: 0 },
      slack: { processed: 0, skipped: 0 },
      notion: { processed: 0, skipped: 0 },
      n8n: { skipped: 0 },
      errors: 0,
    };

    // Query all integrations
    const integrations = await tx.$queryRaw<{ id: string; type: string; config: unknown }[]>`
      SELECT id, type, config
      FROM "Integration"
    `;

    integrationStats.totalIntegrations = integrations.length;

    if (integrations.length === 0) {
      logger.info("No integrations found to migrate");
    } else {
      logger.info(`Found ${integrations.length.toString()} integrations to process`);

      // Process integrations in memory
      const integrationUpdates: MigratedIntegration[] = [];

      for (const integration of integrations) {
        try {
          // Config is JSON from database, needs runtime validation
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = migrateIntegrationConfig(integration.type, integration.config as any);

          // Track statistics
          const typeStats = integrationStats[integration.type as keyof typeof integrationStats];
          if (typeStats && typeof typeStats === "object" && "processed" in typeStats) {
            if (result.migrated) {
              typeStats.processed++;
              integrationUpdates.push({
                id: integration.id,
                config: result.config,
              });
            } else {
              typeStats.skipped++;
            }
          } else if (integration.type === "n8n") {
            integrationStats.n8n.skipped++;
          }
        } catch (error) {
          integrationStats.errors++;
          logger.error(error, `Failed to migrate integration ${integration.id} (type: ${integration.type})`);
          throw new Error(
            `Migration failed for integration ${integration.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      logger.info(
        `Processed ${integrations.length.toString()} integrations: ${integrationUpdates.length.toString()} to update, ${(integrations.length - integrationUpdates.length).toString()} skipped`
      );

      // Update integrations individually
      if (integrationUpdates.length > 0) {
        let integrationUpdatedCount = 0;

        for (const update of integrationUpdates) {
          try {
            // Config is migrated JSON data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await tx.$executeRawUnsafe(
              `UPDATE "Integration" 
               SET config = $1::jsonb 
               WHERE id = $2`,
              JSON.stringify(update.config as any),
              update.id
            );

            integrationUpdatedCount++;

            // Log progress every 1000 integrations
            if (integrationUpdatedCount % 1000 === 0) {
              logger.info(
                `Integration progress: ${integrationUpdatedCount.toString()}/${integrationUpdates.length.toString()} updated`
              );
            }
          } catch (error) {
            logger.error(error, `Failed to update integration ${update.id} in database`);
            throw new Error(
              `Database update failed for integration ${update.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        logger.info(
          `Integration migration complete: ${integrationUpdatedCount.toString()} integrations updated`
        );
      } else {
        logger.info("No integrations needed updating (all already migrated or skipped)");
      }

      // Log detailed statistics
      logger.info(
        `Integration statistics: ` +
          `GoogleSheets: ${integrationStats.googleSheets.processed.toString()} migrated, ${integrationStats.googleSheets.skipped.toString()} skipped | ` +
          `Airtable: ${integrationStats.airtable.processed.toString()} migrated, ${integrationStats.airtable.skipped.toString()} skipped | ` +
          `Slack: ${integrationStats.slack.processed.toString()} migrated, ${integrationStats.slack.skipped.toString()} skipped | ` +
          `Notion: ${integrationStats.notion.processed.toString()} migrated, ${integrationStats.notion.skipped.toString()} skipped | ` +
          `n8n: ${integrationStats.n8n.skipped.toString()} skipped`
      );
    }

    logger.info("Migration completed successfully");
  },
};
