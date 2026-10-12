import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import { Prisma } from "../../src/prisma";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";
import { type TEmbeddedDataInsert, type TLegacySurveyRow, planSurveySalvage } from "./utils";

const SURVEY_BATCH_SIZE = 200;

export interface TRemainingEmbeddedDataBackfillStats {
  backfilledSurveys: number;
  backfilledFields: number;
  /** Surveys that lost at least one declaration, with what was lost. */
  lossySurveys: { surveyId: string; lost: string[] }[];
}

/** Same spelling of "no default" as the reconcile and the first backfill: SQL NULL, not JSON null. */
const toStoredDefaultValue = (
  defaultValue: TEmbeddedDataInsert["defaultValue"]
): TEmbeddedDataInsert["defaultValue"] | typeof Prisma.DbNull => defaultValue ?? Prisma.DbNull;

/**
 * The last read of `Survey.variables` / `Survey.hiddenFields` before the next migration drops them
 * (ENG-2404): gives every survey that still has **no** Embedded Data links the rows its columns
 * describe.
 *
 * Who is left by now: surveys the ENG-1835 backfill skipped (a malformed or duplicated declaration),
 * surveys created on a path that wrote the columns but not the rows, and — on an instance that went
 * straight from a fresh install past ENG-1835 — nothing at all. Until this ran they were served off
 * the columns by the zero-row fallback in `inlineSurveyEmbeddedFields`, which goes with the columns.
 *
 * **A survey with at least one link is not touched.** Its rows have been authoritative since
 * ENG-2412 and may have been edited in the Embedded Data panel since; repairing them from the
 * columns would revert those edits to whatever the columns last said.
 *
 * **Nothing is silently lost.** Every declaration that cannot become a row is logged against its
 * survey — there is no fallback left to serve it and no later save to migrate it.
 *
 * **No `Response` row is read or written.** A response is already keyed by the storage key a
 * definition moves under.
 */
export const backfillRemainingEmbeddedDataRows = async (
  tx: DataMigrationContext["tx"]
): Promise<TRemainingEmbeddedDataBackfillStats> => {
  const stats: TRemainingEmbeddedDataBackfillStats = {
    backfilledSurveys: 0,
    backfilledFields: 0,
    lossySurveys: [],
  };
  let cursor = "";

  for (;;) {
    // Candidates: no links, and either column holds anything but its empty value — including a
    // malformed one, so a survey whose only declarations are unreadable is still logged. `CASE`
    // rather than `AND`/`OR` because Postgres does not promise to short-circuit those, and
    // `jsonb_array_length` raises on a non-array.
    //
    // Keyset pagination on `id`: a backfilled survey leaves the candidate set, so an OFFSET would
    // step over unprocessed rows, and a survey nothing could be salvaged from is passed once.
    const batch = await tx.$queryRaw<TLegacySurveyRow[]>`
      SELECT s."id", s."workspaceId", s."variables", s."hiddenFields"
      FROM "Survey" s
      WHERE s."id" > ${cursor}
        AND NOT EXISTS (
          SELECT 1 FROM "SurveyEmbeddedData" l WHERE l."surveyId" = s."id"
        )
        AND (
          CASE
            WHEN s."variables" IS NULL OR jsonb_typeof(s."variables") = 'null' THEN false
            WHEN jsonb_typeof(s."variables") = 'array' THEN jsonb_array_length(s."variables") > 0
            ELSE true
          END
          OR CASE
            WHEN s."hiddenFields" IS NULL OR jsonb_typeof(s."hiddenFields") = 'null' THEN false
            WHEN jsonb_typeof(s."hiddenFields") <> 'object' THEN true
            WHEN jsonb_typeof(s."hiddenFields" -> 'fieldIds') IS NULL
              OR jsonb_typeof(s."hiddenFields" -> 'fieldIds') = 'null' THEN false
            WHEN jsonb_typeof(s."hiddenFields" -> 'fieldIds') = 'array'
              THEN jsonb_array_length(s."hiddenFields" -> 'fieldIds') > 0
            ELSE true
          END
        )
      ORDER BY s."id"
      LIMIT ${SURVEY_BATCH_SIZE}
    `;

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    const fields: TEmbeddedDataInsert[] = [];
    const links: ReturnType<typeof planSurveySalvage>["links"] = [];

    for (const survey of batch) {
      const plan = planSurveySalvage(survey, createId);
      if (plan.lost.length > 0) {
        stats.lossySurveys.push({ surveyId: survey.id, lost: plan.lost });
        // Logged as it happens: if a later batch throws, the runner's transaction takes the stats
        // with it, and that is the run where knowing which surveys were involved matters most.
        logger.warn(
          { surveyId: survey.id, kept: plan.fields.length, lost: plan.lost },
          "Embedded Data final backfill could not keep every declaration of a survey"
        );
      }
      if (plan.fields.length === 0) continue;

      fields.push(...plan.fields);
      links.push(...plan.links);
      stats.backfilledSurveys += 1;
      stats.backfilledFields += plan.fields.length;
    }

    if (fields.length > 0) {
      // Rows before links: each link's foreign key points at the row planned alongside it.
      await tx.embeddedData.createMany({
        data: fields.map((field) => ({ ...field, defaultValue: toStoredDefaultValue(field.defaultValue) })),
      });
      await tx.surveyEmbeddedData.createMany({ data: links });
    }
  }

  // Logged either way, so a run that found nothing says so rather than saying nothing.
  logger.info(
    `Embedded Data final backfill complete: ${stats.backfilledSurveys.toString()} surveys needed backfill, ${stats.backfilledFields.toString()} fields created, ${stats.lossySurveys.length.toString()} surveys lost declarations`
  );

  return stats;
};

export const backfillRemainingEmbeddedData: MigrationScript = {
  type: "data",
  id: "q8unn95h57h1c9tuz292j97c",
  name: "20260928120000_eng_2404_backfill_remaining_embedded_data",
  run: async ({ tx }) => {
    await backfillRemainingEmbeddedDataRows(tx);
  },
};
