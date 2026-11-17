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
import { logger } from "@formbricks/logger";
import { Prisma } from "../../src/prisma";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";
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

type MigrationTx = DataMigrationContext["tx"];

/** How a JSON column is written, given its `$n` parameter. */
type ColumnSql = (param: string) => string;

const SURVEY_COLUMNS: [keyof SurveyRecord, ColumnSql][] = [
  ["welcomeCard", (param) => `"welcomeCard" = ${param}::jsonb`],
  ["questions", (param) => `questions = ${param}::jsonb`],
  [
    "blocks",
    (param) => `blocks = (SELECT array_agg(elem) FROM jsonb_array_elements(${param}::jsonb) AS elem)`,
  ],
  [
    "endings",
    (param) => `endings = (SELECT array_agg(elem) FROM jsonb_array_elements(${param}::jsonb) AS elem)`,
  ],
  ["styling", (param) => `styling = ${param}::jsonb`],
  ["metadata", (param) => `metadata = ${param}::jsonb`],
];

const PROJECT_COLUMNS: [keyof ProjectRecord, ColumnSql][] = [
  ["styling", (param) => `styling = ${param}::jsonb`],
  ["logo", (param) => `logo = ${param}::jsonb`],
];

/**
 * The columns of a record that contain absolute storage URLs, with those URLs made relative, or
 * undefined when none does.
 */
const transformRecordColumns = <T extends object>(
  record: T,
  columns: [keyof T, ColumnSql][]
): Partial<T> | undefined => {
  const updates: Partial<T> = {};
  let hasChanges = false;

  // Transform each JSON column if it contains absolute storage URLs
  for (const [column] of columns) {
    if (containsAbsoluteStorageUrl(record[column])) {
      updates[column] = transformJsonUrls(JSON.parse(JSON.stringify(record[column]))) as T[keyof T];
      hasChanges = true;
    }
  }
  return hasChanges ? updates : undefined;
};

/** Writes the transformed columns of one row (and its updated_at). */
const updateRecordColumns = async <T extends object>(
  tx: MigrationTx,
  table: string,
  id: string,
  data: Partial<T>,
  columns: [keyof T, ColumnSql][]
): Promise<void> => {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [column, toSql] of columns) {
    if (data[column] !== undefined) {
      setClauses.push(toSql(`$${String(values.length + 1)}`));
      values.push(JSON.stringify(data[column]));
    }
  }

  values.push(id);

  if (setClauses.length > 0) {
    await tx.$executeRawUnsafe(
      `UPDATE "${table}" SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${String(values.length)}`,
      ...values
    );
  }
};

const migrateSurveys = async (tx: MigrationTx, stats: MigrationStats): Promise<void> => {
  logger.info("Starting Survey migration...");

  // Use '%http%/storage/%' to match absolute URLs anywhere in the JSON text
  // This won't match already-migrated relative paths like /storage/... (no 'http' before it)
  const surveyQuery = Prisma.sql`
    SELECT id, "welcomeCard", questions, blocks, endings, styling, metadata
    FROM "Survey"
    WHERE "welcomeCard"::text LIKE '%http%/storage/%'
       OR questions::text LIKE '%http%/storage/%'
       OR blocks::text LIKE '%http%/storage/%'
       OR endings::text LIKE '%http%/storage/%'
       OR styling::text LIKE '%http%/storage/%'
       OR metadata::text LIKE '%http%/storage/%'
  `;

  const surveysToMigrate: SurveyRecord[] = await tx.$queryRaw(surveyQuery);
  logger.info(`Found ${surveysToMigrate.length} surveys with storage URLs`);

  const surveyUpdates: { id: string; data: Partial<SurveyRecord> }[] = [];

  for (const survey of surveysToMigrate) {
    stats.surveysProcessed++;

    const updates = transformRecordColumns(survey, SURVEY_COLUMNS);
    if (updates) {
      surveyUpdates.push({ id: survey.id, data: updates });
      stats.surveysUpdated++;
    }
  }

  // Batch update surveys
  for (let i = 0; i < surveyUpdates.length; i += BATCH_SIZE) {
    const batch = surveyUpdates.slice(i, i + BATCH_SIZE);

    for (const update of batch) {
      await updateRecordColumns(tx, "Survey", update.id, update.data, SURVEY_COLUMNS);
    }

    logger.info(`Survey progress: ${Math.min(i + BATCH_SIZE, surveyUpdates.length)}/${surveyUpdates.length}`);
  }

  logger.info(`Surveys migration complete: ${stats.surveysUpdated}/${stats.surveysProcessed} updated`);
};

const migrateProjects = async (tx: MigrationTx, stats: MigrationStats): Promise<void> => {
  logger.info("Starting Project migration...");

  // Use '%http%/storage/%' to match absolute URLs anywhere in the JSON text
  const projectQuery = Prisma.sql`
    SELECT id, styling, logo
    FROM "Project"
    WHERE styling::text LIKE '%http%/storage/%'
       OR logo::text LIKE '%http%/storage/%'
  `;

  const projectsToMigrate: ProjectRecord[] = await tx.$queryRaw(projectQuery);
  logger.info(`Found ${projectsToMigrate.length} projects with storage URLs`);

  for (const project of projectsToMigrate) {
    stats.projectsProcessed++;

    const updates = transformRecordColumns(project, PROJECT_COLUMNS);
    if (updates) {
      await updateRecordColumns(tx, "Project", project.id, updates, PROJECT_COLUMNS);
      stats.projectsUpdated++;
    }
  }

  logger.info(`Projects migration complete: ${stats.projectsUpdated}/${stats.projectsProcessed} updated`);
};

const migrateOrganizations = async (tx: MigrationTx, stats: MigrationStats): Promise<void> => {
  logger.info("Starting Organization migration...");

  // Use '%http%/storage/%' to match absolute URLs anywhere in the JSON text
  const orgQuery = Prisma.sql`
    SELECT id, whitelabel
    FROM "Organization"
    WHERE whitelabel::text LIKE '%http%/storage/%'
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
};

/** The next page of responses with absolute storage URLs, after `lastId` (cursor pagination). */
const fetchResponseBatch = async (tx: MigrationTx, lastId: string | null): Promise<ResponseRecord[]> => {
  // Use '%http%/storage/%' to match absolute URLs anywhere in the JSON text
  const responseQuery = lastId
    ? Prisma.sql`
        SELECT id, data
        FROM "Response"
        WHERE data::text LIKE '%http%/storage/%'
          AND id > ${lastId}
        ORDER BY id
        LIMIT ${BATCH_SIZE}
      `
    : Prisma.sql`
        SELECT id, data
        FROM "Response"
        WHERE data::text LIKE '%http%/storage/%'
        ORDER BY id
        LIMIT ${BATCH_SIZE}
      `;

  return tx.$queryRaw(responseQuery);
};

const migrateResponses = async (tx: MigrationTx, stats: MigrationStats): Promise<void> => {
  logger.info("Starting Response migration...");

  // Responses can be numerous, so we process in batches using cursor pagination
  let lastId: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const responseBatch = await fetchResponseBatch(tx, lastId);

    if (responseBatch.length === 0) break;

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

  logger.info(`Responses migration complete: ${stats.responsesUpdated}/${stats.responsesProcessed} updated`);
};

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

    await migrateSurveys(tx, stats);
    await migrateProjects(tx, stats);
    await migrateOrganizations(tx, stats);
    await migrateResponses(tx, stats);

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
