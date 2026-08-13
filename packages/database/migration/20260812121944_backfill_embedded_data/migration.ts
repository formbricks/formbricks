import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import { Prisma } from "../../src/prisma";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";
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
  skippedSurveys: { surveyId: string; reason: string; detail: string[] }[];
}

/**
 * Prisma distinguishes a JSON `null` from a SQL `NULL` on a nullable Json column, so "this field has
 * no default" has to be spelled out. The ENG-1978 write bridge does the same thing at its own write
 * site — without this, a backfilled row and a bridge-created row hold different values in
 * `defaultValue` for the same logical state, and a later `WHERE "defaultValue" IS NULL` sees only one
 * of them.
 */
const toStoredDefaultValue = (
  defaultValue: TEmbeddedDataInsert["defaultValue"]
): TEmbeddedDataInsert["defaultValue"] | typeof Prisma.DbNull => defaultValue ?? Prisma.DbNull;

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
 *
 * A skipped survey is not stranded. It keeps resolving through ENG-1836's `deriveLegacyEmbeddedData`,
 * which serves a survey with no rows straight from its legacy JSON, and it migrates itself the next
 * time someone saves it in the editor — the write bridge runs the same mapping. Fixing the offending
 * declaration and saving is the whole recovery path; this migration will not run a second time.
 */
export const backfillEmbeddedDataRows = async (
  tx: DataMigrationContext["tx"]
): Promise<TEmbeddedDataBackfillStats> => {
  const stats: TEmbeddedDataBackfillStats = { migratedSurveys: 0, migratedFields: 0, skippedSurveys: [] };
  let cursor = "";

  for (;;) {
    // Candidate selection runs in SQL so the walk only carries surveys that actually need work:
    // those with at least one declaration and no links yet. The `jsonb_typeof` guards keep
    // `jsonb_array_length` off a non-array, which would raise; `planSurveyBackfill` re-checks the
    // same shapes in JS, because these two branches are OR'd and a row can qualify on one while the
    // other column is malformed.
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
        stats.skippedSurveys.push({ surveyId: survey.id, reason: plan.reason, detail: plan.detail });
        // Logged here rather than after the walk: if a later batch throws, the transaction takes the
        // accumulated list with it, and this is exactly the run where knowing which surveys were
        // involved matters most.
        logger.warn(
          { surveyId: survey.id, reason: plan.reason, detail: plan.detail },
          "Skipped survey during Embedded Data backfill"
        );
        continue;
      }
      fields.push(...plan.fields);
      links.push(...plan.links);
      stats.migratedSurveys += 1;
      stats.migratedFields += plan.fields.length;
    }

    if (fields.length > 0) {
      // Rows before links: the link's foreign key points at the row it was planned alongside.
      await tx.embeddedData.createMany({
        data: fields.map((field) => ({ ...field, defaultValue: toStoredDefaultValue(field.defaultValue) })),
      });
      await tx.surveyEmbeddedData.createMany({ data: links });
    }

    logger.info(
      `Embedded Data backfill progress: ${stats.migratedSurveys.toString()} surveys, ${stats.migratedFields.toString()} fields`
    );
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
