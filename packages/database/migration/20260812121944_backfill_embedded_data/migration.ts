import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import {
  type TEmbeddedDataInsert,
  type TLegacySurveyRow,
  type TSurveyEmbeddedDataInsert,
  planSurveyBackfill,
} from "./utils";

const SURVEY_BATCH_SIZE = 200;

export interface TEmbeddedDataBackfillStats {
  migratedSurveys: number;
  migratedFields: number;
  skippedSurveys: { surveyId: string; duplicateStorageKeys: string[] }[];
}

/** Only the client surface this backfill needs, so a test can pass the real prisma client. */
interface TMigrationTx {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: readonly unknown[]) => Promise<T>;
  embeddedData: { createMany: (args: { data: TEmbeddedDataInsert[] }) => Promise<unknown> };
  surveyEmbeddedData: { createMany: (args: { data: TSurveyEmbeddedDataInsert[] }) => Promise<unknown> };
}

/**
 * Moves every survey's legacy `variables` and `hiddenFields` into `EmbeddedData` rows plus
 * `SurveyEmbeddedData` links (migration spec §8), preserving each field's existing address so recall
 * tokens, logic operands and stored responses keep resolving untouched.
 *
 * **No `Response` row is read or written.** A response is already keyed by the same `storageKey` a
 * definition moves under, which is the whole reason this migration can exist without touching the
 * largest table in the database.
 *
 * Idempotent by construction: a survey that already has links is not a candidate, so re-running does
 * nothing. That also covers the survey the ENG-1978 write bridge migrated on its own when someone
 * edited it — in local development that is the normal state, since the bridge merged before this.
 */
export const backfillEmbeddedDataRows = async (tx: TMigrationTx): Promise<TEmbeddedDataBackfillStats> => {
  const stats: TEmbeddedDataBackfillStats = { migratedSurveys: 0, migratedFields: 0, skippedSurveys: [] };
  let cursor = "";

  for (;;) {
    // Candidate selection runs in SQL so the walk only carries surveys that actually need work:
    // those with at least one declaration and no links yet. `jsonb_typeof` guards the array
    // accessors — `jsonb_array_length` raises on a non-array, and one malformed row would abort the
    // whole migration, since the runner wraps this in a single transaction.
    //
    // Keyset pagination on `id`, not OFFSET: inserting links removes a survey from the candidate
    // set, so an offset would step over unprocessed rows. Walking forward past the last id also
    // means a skipped survey is passed once rather than re-read forever.
    const batch = await tx.$queryRaw<TLegacySurveyRow[]>`
      SELECT s."id", s."workspaceId", s."variables", s."hiddenFields"
      FROM "Survey" s
      WHERE s."id" > ${cursor}
        AND NOT EXISTS (
          SELECT 1 FROM "SurveyEmbeddedData" l WHERE l."surveyId" = s."id"
        )
        AND (
          (jsonb_typeof(s."variables") = 'array' AND jsonb_array_length(s."variables") > 0)
          OR (
            jsonb_typeof(s."hiddenFields" -> 'fieldIds') = 'array'
            AND jsonb_array_length(s."hiddenFields" -> 'fieldIds') > 0
          )
        )
      ORDER BY s."id"
      LIMIT ${SURVEY_BATCH_SIZE}
    `;

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    const fields: TEmbeddedDataInsert[] = [];
    const links: TSurveyEmbeddedDataInsert[] = [];

    for (const survey of batch) {
      const plan = planSurveyBackfill(survey, createId);
      if (plan.status === "skipped") {
        stats.skippedSurveys.push({
          surveyId: survey.id,
          duplicateStorageKeys: plan.duplicateStorageKeys,
        });
        continue;
      }
      fields.push(...plan.fields);
      links.push(...plan.links);
      stats.migratedSurveys += 1;
      stats.migratedFields += plan.fields.length;
    }

    if (fields.length > 0) {
      // Rows before links: the link's foreign key points at the row it was planned alongside.
      await tx.embeddedData.createMany({ data: fields });
      await tx.surveyEmbeddedData.createMany({ data: links });
    }

    logger.info(
      `Embedded Data backfill progress: ${stats.migratedSurveys.toString()} surveys, ${stats.migratedFields.toString()} fields`
    );
  }

  for (const survey of stats.skippedSurveys) {
    // Not a failure of the migration: these surveys declare the same address twice, which the unique
    // constraint has always forbidden and which nothing could have written through the editor. They
    // keep working on their legacy JSON until someone renames the collision.
    logger.warn(survey, "Skipped survey with duplicate embedded data storage keys");
  }

  logger.info(
    `Embedded Data backfill complete: ${stats.migratedSurveys.toString()} surveys migrated, ${stats.migratedFields.toString()} fields created, ${stats.skippedSurveys.length.toString()} surveys skipped`
  );

  return stats;
};

export const backfillEmbeddedData: MigrationScript = {
  type: "data",
  id: "mv42pcg1tvmglvvpzdk5vsc6",
  name: "20260812121944_backfill_embedded_data",
  run: async ({ tx }) => {
    await backfillEmbeddedDataRows(tx);
  },
};
