import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";
import type {
  Block,
  CTAMigrationStats,
  IntegrationConfig,
  IntegrationMigrationStats,
  MigratedIntegration,
  SurveyRecord,
} from "./types";
import { migrateIntegrationConfig, migrateQuestionsSurveyToBlocks } from "./utils";

type MigrationTx = DataMigrationContext["tx"];

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Converts one survey's questions to blocks, failing the migration with the survey's id. */
const migrateSurveyOrThrow = (
  survey: SurveyRecord,
  ctaStats: CTAMigrationStats
): { id: string; blocks: Block[] } => {
  try {
    const migrated = migrateQuestionsSurveyToBlocks(survey, createId, ctaStats);
    return {
      id: migrated.id,
      blocks: migrated.blocks,
    };
  } catch (error) {
    logger.error(error, `Failed to migrate survey ${survey.id}`);
    throw new Error(`Migration failed for survey ${survey.id}: ${errorMessage(error)}`);
  }
};

/** Writes one batch of migrated surveys, using UNNEST to update them in a single query. */
const updateSurveyBatch = async (
  tx: MigrationTx,
  batch: { id: string; blocks: Block[] }[],
  startIndex: number
): Promise<void> => {
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
         ),
         questions = '[]'::jsonb
       FROM (
         SELECT
           unnest($1::text[]) AS id,
           unnest($2::text[]) AS blocks_json
       ) AS data
       WHERE s.id = data.id`,
      ids,
      blocksJsonStrings
    );
  } catch (error) {
    logger.error(error, `Failed to update survey batch starting at index ${startIndex.toString()}`);
    throw new Error(`Database batch update failed at index ${startIndex.toString()}: ${errorMessage(error)}`);
  }
};

/** Steps 1–4: converts every survey that still has questions to blocks. */
const migrateSurveys = async (tx: MigrationTx): Promise<void> => {
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
  const updates = surveys.map((survey) => migrateSurveyOrThrow(survey, ctaStats));

  logger.info(`Successfully processed ${updates.length.toString()} surveys`);

  // 3. Update surveys in batches using UNNEST for performance
  // Batch size of 150 balances performance with query size safety (~7.5MB per batch)
  const SURVEY_BATCH_SIZE = 150;
  let updatedCount = 0;

  for (let i = 0; i < updates.length; i += SURVEY_BATCH_SIZE) {
    const batch = updates.slice(i, i + SURVEY_BATCH_SIZE);
    await updateSurveyBatch(tx, batch, i);
    updatedCount += batch.length;

    // Log progress
    logger.info(`Progress: ${updatedCount.toString()}/${updates.length.toString()} surveys updated`);
  }

  logger.info(`Migration complete: ${updatedCount.toString()} surveys migrated to blocks`);

  // 4. Log CTA migration statistics
  if (ctaStats.totalCTAElements > 0) {
    logger.info(
      `CTA elements processed: ${ctaStats.totalCTAElements.toString()} total (${ctaStats.ctaWithExternalLink.toString()} with external link, ${ctaStats.ctaWithoutExternalLink.toString()} without)`
    );
  }
};

/**
 * Migrates one integration's config in memory and counts it; the config to write, or undefined
 * when it is skipped.
 */
const migrateIntegrationOrThrow = (
  integration: { id: string; type: string; config: IntegrationConfig },
  integrationStats: IntegrationMigrationStats
): MigratedIntegration | undefined => {
  try {
    // Config is JSON from database - cast to IntegrationConfig for runtime processing
    const result = migrateIntegrationConfig(integration.type, integration.config);

    // Track statistics
    const typeStats = integrationStats[integration.type as keyof typeof integrationStats];
    if (typeStats && typeof typeStats === "object" && "processed" in typeStats) {
      if (result.migrated) {
        typeStats.processed++;
        return {
          id: integration.id,
          config: result.config,
        };
      }
      typeStats.skipped++;
    } else if (integration.type === "n8n") {
      integrationStats.n8n.skipped++;
    }
    return undefined;
  } catch (error) {
    integrationStats.errors++;
    logger.error(error, `Failed to migrate integration ${integration.id} (type: ${integration.type})`);
    throw new Error(`Migration failed for integration ${integration.id}: ${errorMessage(error)}`);
  }
};

/** Writes the migrated integration configs, in parallel per batch for better throughput. */
const updateIntegrations = async (
  tx: MigrationTx,
  integrationUpdates: MigratedIntegration[]
): Promise<void> => {
  if (integrationUpdates.length === 0) {
    logger.info("No integrations needed updating (all already migrated or skipped)");
    return;
  }

  // Batch size of 150 provides good parallelization (~750KB per batch)
  const INTEGRATION_BATCH_SIZE = 150;
  let integrationUpdatedCount = 0;

  for (let i = 0; i < integrationUpdates.length; i += INTEGRATION_BATCH_SIZE) {
    const batch = integrationUpdates.slice(i, i + INTEGRATION_BATCH_SIZE);

    try {
      // Execute all updates in parallel for this batch
      await Promise.all(
        batch.map((update) =>
          tx.$executeRawUnsafe(
            `UPDATE "Integration"
             SET config = $1::jsonb
             WHERE id = $2`,
            JSON.stringify(update.config),
            update.id
          )
        )
      );

      integrationUpdatedCount += batch.length;

      // Log progress
      logger.info(
        `Integration progress: ${integrationUpdatedCount.toString()}/${integrationUpdates.length.toString()} updated`
      );
    } catch (error) {
      logger.error(error, `Failed to update integration batch starting at index ${i.toString()}`);
      throw new Error(
        `Database update failed for integration batch at index ${i.toString()}: ${errorMessage(error)}`
      );
    }
  }

  logger.info(`Integration migration complete: ${integrationUpdatedCount.toString()} integrations updated`);
};

/** Step 5: migrates the integration configs that name questions. */
const migrateIntegrations = async (tx: MigrationTx): Promise<void> => {
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
  const integrations = await tx.$queryRaw<{ id: string; type: string; config: IntegrationConfig }[]>`
    SELECT id, type, config
    FROM "Integration"
  `;

  integrationStats.totalIntegrations = integrations.length;

  if (integrations.length === 0) {
    logger.info("No integrations found to migrate");
    return;
  }
  logger.info(`Found ${integrations.length.toString()} integrations to process`);

  // Process integrations in memory
  const integrationUpdates: MigratedIntegration[] = [];
  for (const integration of integrations) {
    const update = migrateIntegrationOrThrow(integration, integrationStats);
    if (update) integrationUpdates.push(update);
  }

  logger.info(
    `Processed ${integrations.length.toString()} integrations: ${integrationUpdates.length.toString()} to update, ${(integrations.length - integrationUpdates.length).toString()} skipped`
  );

  await updateIntegrations(tx, integrationUpdates);

  // Log detailed statistics
  logger.info(
    `Integration statistics: ` +
      `GoogleSheets: ${integrationStats.googleSheets.processed.toString()} migrated, ${integrationStats.googleSheets.skipped.toString()} skipped | ` +
      `Airtable: ${integrationStats.airtable.processed.toString()} migrated, ${integrationStats.airtable.skipped.toString()} skipped | ` +
      `Slack: ${integrationStats.slack.processed.toString()} migrated, ${integrationStats.slack.skipped.toString()} skipped | ` +
      `Notion: ${integrationStats.notion.processed.toString()} migrated, ${integrationStats.notion.skipped.toString()} skipped | ` +
      `n8n: ${integrationStats.n8n.skipped.toString()} skipped`
  );
};

export const migrateQuestionsToBlocks: MigrationScript = {
  type: "data",
  id: "wsm6h7c8jt086g96ob7wda14",
  name: "20251118032116_migrate_questions_to_blocks",
  run: async ({ tx }) => {
    await migrateSurveys(tx);

    // 5. Migrate Integration configs
    await migrateIntegrations(tx);

    logger.info("Migration completed successfully");
  },
};
