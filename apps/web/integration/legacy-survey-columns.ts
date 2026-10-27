import { prisma } from "@formbricks/database";

/**
 * The two legacy `Survey` columns the Embedded Data backfills read, made sure to exist.
 *
 * The migrations keep `variables` and `hiddenFields` until Formbricks 7, so on a database built from
 * them this is a no-op. A local integration database copied from a dev schema that once applied the
 * withdrawn ENG-2404 drop lacks them, and reading those columns is the backfills' whole job — so they
 * are restored with the same types and defaults. Raw SQL seeds malformed legacy values that the
 * typed Prisma client deliberately does not accept.
 */
export const restoreLegacySurveyColumns = (): Promise<unknown> =>
  prisma.$executeRawUnsafe(
    `ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "variables" JSONB NOT NULL DEFAULT '[]', ADD COLUMN IF NOT EXISTS "hiddenFields" JSONB NOT NULL DEFAULT '{"enabled": false}'`
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
