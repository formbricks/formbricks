import { prisma } from "@formbricks/database";

/**
 * The two `Survey` columns ENG-2404 dropped, restored for the migrations that read them.
 *
 * The integration database is a copy of the dev schema, which has already dropped `variables` and
 * `hiddenFields` — but the two Embedded Data backfills run *before* that drop in the migration
 * sequence, and reading those columns is their whole job. Restoring them (same types and defaults
 * as the schema that last had them) is what lets their tests keep exercising real SQL against real
 * data. The Prisma client no longer knows the columns, so rows are seeded through raw SQL.
 */
export const restoreLegacySurveyColumns = (): Promise<unknown> =>
  prisma.$executeRawUnsafe(
    `ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "variables" JSONB NOT NULL DEFAULT '[]', ADD COLUMN IF NOT EXISTS "hiddenFields" JSONB NOT NULL DEFAULT '{"enabled": false}'`
  );

/** Puts the schema back the way the migrations leave it, so later test files see the real shape. */
export const dropLegacySurveyColumns = (): Promise<unknown> =>
  prisma.$executeRawUnsafe(
    `ALTER TABLE "Survey" DROP COLUMN IF EXISTS "variables", DROP COLUMN IF EXISTS "hiddenFields"`
  );

/**
 * Writes raw JSON into the restored columns. Deliberately untyped: the backfills exist to cope with
 * whatever those columns hold, malformed shapes included.
 */
export const setLegacySurveyColumns = (
  surveyId: string,
  legacy: { variables?: unknown; hiddenFields?: unknown }
): Promise<unknown> =>
  prisma.$executeRaw`
    UPDATE "Survey"
    SET "variables" = ${JSON.stringify(legacy.variables ?? [])}::jsonb,
        "hiddenFields" = ${JSON.stringify(legacy.hiddenFields ?? { enabled: false })}::jsonb
    WHERE "id" = ${surveyId}
  `;
