/**
 * Data Migration: Convert absolute storage URLs to relative paths
 *
 * This migration converts URLs like:
 *   http://localhost:3000/storage/env123/public/image.png
 *   https://app.formbricks.com/storage/env123/public/image.png
 *
 * To relative paths:
 *   /storage/env123/public/image.png
 *
 * This is needed because:
 * 1. Next.js 16+ blocks image optimization for private IPs
 * 2. Relative paths work with the new streaming endpoint
 * 3. Self-hosted users can change their domain without breaking images
 *
 * Tables affected:
 * - Survey: welcomeCard, questions, blocks, endings, styling, metadata
 * - Project: styling, logo
 * - Organization: whitelabel
 * - Response: data (file upload responses)
 */
import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import type {
  MigrationStats,
  OrganizationRecord,
  ProjectRecord,
  ResponseRecord,
  SurveyRecord,
} from "./types";
import {
  containsAbsoluteStorageUrl,
  getUrlConversionCount,
  resetUrlConversionCount,
  transformJsonUrls,
} from "./utils";

const BATCH_SIZE = 500;

export const migrateStorageUrlsToRelative: MigrationScript = {
  type: "data",
  id: "cm6xq8k2n0001l508storage01",
  name: "20260204174943_migrate_storage_urls_to_relative",
  run: async ({ tx }) => {
    const stats: MigrationStats = {
      surveysProcessed: 0,
      surveysUpdated: 0,
      projectsProcessed: 0,
      projectsUpdated: 0,
      organizationsProcessed: 0,
      organizationsUpdated: 0,
      responsesProcessed: 0,
      responsesUpdated: 0,
      urlsConverted: 0,
      errors: 0,
    };

    resetUrlConversionCount();

    // ==================== MIGRATE SURVEYS ====================
    logger.info("Starting Survey migration...");

    // Use 'http%/storage/%' to only match absolute URLs, not already-migrated relative paths
    const surveyQuery = Prisma.sql`
      SELECT id, "welcomeCard", questions, blocks, endings, styling, metadata
      FROM "Survey"
      WHERE "welcomeCard"::text LIKE 'http%/storage/%'
         OR questions::text LIKE 'http%/storage/%'
         OR blocks::text LIKE 'http%/storage/%'
         OR endings::text LIKE 'http%/storage/%'
         OR styling::text LIKE 'http%/storage/%'
         OR metadata::text LIKE 'http%/storage/%'
    `;

    const surveysToMigrate: SurveyRecord[] = await tx.$queryRaw(surveyQuery);
    logger.info(`Found ${surveysToMigrate.length} surveys with storage URLs`);

    const surveyUpdates: { id: string; data: Partial<SurveyRecord> }[] = [];

    for (const survey of surveysToMigrate) {
      stats.surveysProcessed++;

      const updates: Partial<SurveyRecord> = {};
      let hasChanges = false;

      // Transform each JSON column if it contains absolute storage URLs
      if (containsAbsoluteStorageUrl(survey.welcomeCard)) {
        updates.welcomeCard = transformJsonUrls(JSON.parse(JSON.stringify(survey.welcomeCard)));
        hasChanges = true;
      }

      if (containsAbsoluteStorageUrl(survey.questions)) {
        updates.questions = transformJsonUrls(JSON.parse(JSON.stringify(survey.questions)));
        hasChanges = true;
      }

      if (containsAbsoluteStorageUrl(survey.blocks)) {
        updates.blocks = transformJsonUrls(JSON.parse(JSON.stringify(survey.blocks))) as unknown[];
        hasChanges = true;
      }

      if (containsAbsoluteStorageUrl(survey.endings)) {
        updates.endings = transformJsonUrls(JSON.parse(JSON.stringify(survey.endings))) as unknown[];
        hasChanges = true;
      }

      if (containsAbsoluteStorageUrl(survey.styling)) {
        updates.styling = transformJsonUrls(JSON.parse(JSON.stringify(survey.styling)));
        hasChanges = true;
      }

      if (containsAbsoluteStorageUrl(survey.metadata)) {
        updates.metadata = transformJsonUrls(JSON.parse(JSON.stringify(survey.metadata)));
        hasChanges = true;
      }

      if (hasChanges) {
        surveyUpdates.push({ id: survey.id, data: updates });
        stats.surveysUpdated++;
      }
    }

    // Batch update surveys
    for (let i = 0; i < surveyUpdates.length; i += BATCH_SIZE) {
      const batch = surveyUpdates.slice(i, i + BATCH_SIZE);

      for (const update of batch) {
        const setClauses: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (update.data.welcomeCard !== undefined) {
          setClauses.push(`"welcomeCard" = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(update.data.welcomeCard));
          paramIndex++;
        }
        if (update.data.questions !== undefined) {
          setClauses.push(`questions = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(update.data.questions));
          paramIndex++;
        }
        if (update.data.blocks !== undefined) {
          setClauses.push(
            `blocks = (SELECT array_agg(elem) FROM jsonb_array_elements($${paramIndex}::jsonb) AS elem)`
          );
          values.push(JSON.stringify(update.data.blocks));
          paramIndex++;
        }
        if (update.data.endings !== undefined) {
          setClauses.push(
            `endings = (SELECT array_agg(elem) FROM jsonb_array_elements($${paramIndex}::jsonb) AS elem)`
          );
          values.push(JSON.stringify(update.data.endings));
          paramIndex++;
        }
        if (update.data.styling !== undefined) {
          setClauses.push(`styling = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(update.data.styling));
          paramIndex++;
        }
        if (update.data.metadata !== undefined) {
          setClauses.push(`metadata = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(update.data.metadata));
          paramIndex++;
        }

        values.push(update.id);

        if (setClauses.length > 0) {
          await tx.$executeRawUnsafe(
            `UPDATE "Survey" SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${paramIndex}`,
            ...values
          );
        }
      }

      logger.info(
        `Survey progress: ${Math.min(i + BATCH_SIZE, surveyUpdates.length)}/${surveyUpdates.length}`
      );
    }

    logger.info(`Surveys migration complete: ${stats.surveysUpdated}/${stats.surveysProcessed} updated`);

    // ==================== MIGRATE PROJECTS ====================
    logger.info("Starting Project migration...");

    // Use 'http%/storage/%' to only match absolute URLs
    const projectQuery = Prisma.sql`
      SELECT id, styling, logo
      FROM "Project"
      WHERE styling::text LIKE 'http%/storage/%'
         OR logo::text LIKE 'http%/storage/%'
    `;

    const projectsToMigrate: ProjectRecord[] = await tx.$queryRaw(projectQuery);
    logger.info(`Found ${projectsToMigrate.length} projects with storage URLs`);

    for (const project of projectsToMigrate) {
      stats.projectsProcessed++;

      const updates: Partial<ProjectRecord> = {};
      let hasChanges = false;

      if (containsAbsoluteStorageUrl(project.styling)) {
        updates.styling = transformJsonUrls(JSON.parse(JSON.stringify(project.styling)));
        hasChanges = true;
      }

      if (containsAbsoluteStorageUrl(project.logo)) {
        updates.logo = transformJsonUrls(JSON.parse(JSON.stringify(project.logo)));
        hasChanges = true;
      }

      if (hasChanges) {
        const setClauses: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (updates.styling !== undefined) {
          setClauses.push(`styling = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(updates.styling));
          paramIndex++;
        }
        if (updates.logo !== undefined) {
          setClauses.push(`logo = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(updates.logo));
          paramIndex++;
        }

        values.push(project.id);

        await tx.$executeRawUnsafe(
          `UPDATE "Project" SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${paramIndex}`,
          ...values
        );

        stats.projectsUpdated++;
      }
    }

    logger.info(`Projects migration complete: ${stats.projectsUpdated}/${stats.projectsProcessed} updated`);

    // ==================== MIGRATE ORGANIZATIONS ====================
    logger.info("Starting Organization migration...");

    // Use 'http%/storage/%' to only match absolute URLs
    const orgQuery = Prisma.sql`
      SELECT id, whitelabel
      FROM "Organization"
      WHERE whitelabel::text LIKE 'http%/storage/%'
    `;

    const orgsToMigrate: OrganizationRecord[] = await tx.$queryRaw(orgQuery);
    logger.info(`Found ${orgsToMigrate.length} organizations with storage URLs`);

    for (const org of orgsToMigrate) {
      stats.organizationsProcessed++;

      if (containsAbsoluteStorageUrl(org.whitelabel)) {
        const updatedWhitelabel = transformJsonUrls(JSON.parse(JSON.stringify(org.whitelabel)));

        await tx.$executeRawUnsafe(
          `UPDATE "Organization" SET whitelabel = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          JSON.stringify(updatedWhitelabel),
          org.id
        );

        stats.organizationsUpdated++;
      }
    }

    logger.info(
      `Organizations migration complete: ${stats.organizationsUpdated}/${stats.organizationsProcessed} updated`
    );

    // ==================== MIGRATE RESPONSES ====================
    logger.info("Starting Response migration...");

    // Responses can be numerous, so we process in batches using cursor pagination
    let lastId: string | null = null;
    let hasMore = true;

    while (hasMore) {
      // Use 'http%/storage/%' to only match absolute URLs
      const responseQuery = lastId
        ? Prisma.sql`
            SELECT id, data
            FROM "Response"
            WHERE data::text LIKE 'http%/storage/%'
              AND id > ${lastId}
            ORDER BY id
            LIMIT ${BATCH_SIZE}
          `
        : Prisma.sql`
            SELECT id, data
            FROM "Response"
            WHERE data::text LIKE 'http%/storage/%'
            ORDER BY id
            LIMIT ${BATCH_SIZE}
          `;

      const responseBatch: ResponseRecord[] = await tx.$queryRaw(responseQuery);

      if (responseBatch.length === 0) {
        hasMore = false;
        break;
      }

      for (const response of responseBatch) {
        stats.responsesProcessed++;

        if (containsAbsoluteStorageUrl(response.data)) {
          const updatedData = transformJsonUrls(JSON.parse(JSON.stringify(response.data)));

          await tx.$executeRawUnsafe(
            `UPDATE "Response" SET data = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            JSON.stringify(updatedData),
            response.id
          );

          stats.responsesUpdated++;
        }

        lastId = response.id;
      }

      logger.info(
        `Response progress: ${stats.responsesProcessed} processed, ${stats.responsesUpdated} updated`
      );

      if (responseBatch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    logger.info(
      `Responses migration complete: ${stats.responsesUpdated}/${stats.responsesProcessed} updated`
    );

    // ==================== FINAL STATS ====================
    stats.urlsConverted = getUrlConversionCount();

    logger.info("=== Migration Complete ===");
    logger.info(`Surveys: ${stats.surveysUpdated}/${stats.surveysProcessed} updated`);
    logger.info(`Projects: ${stats.projectsUpdated}/${stats.projectsProcessed} updated`);
    logger.info(`Organizations: ${stats.organizationsUpdated}/${stats.organizationsProcessed} updated`);
    logger.info(`Responses: ${stats.responsesUpdated}/${stats.responsesProcessed} updated`);
    logger.info(`Total URLs converted: ${stats.urlsConverted}`);

    if (stats.errors > 0) {
      logger.warn(`Errors encountered: ${stats.errors}`);
    }
  },
};
