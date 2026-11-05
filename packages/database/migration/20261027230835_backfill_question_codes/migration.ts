import { logger } from "@formbricks/logger";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";
import { type TSurveyCodesPlan, type TSurveyCodesRow, planSurveyCodes } from "./utils";

const SURVEY_BATCH_SIZE = 150;
const MAX_RACE_RETRIES = 3;
const PROGRESS_LOG_EVERY_BATCHES = 20;

type TPrismaHandle = DataMigrationContext["prisma"];

export interface TQuestionCodesBackfillStats {
  scannedSurveys: number;
  updatedSurveys: number;
  /** Candidates whose fill changed nothing (malformed content the planner cannot code). */
  unchangedSurveys: number;
  /** Rows an old pod edited while the migration ran; each was re-read and planned again. */
  raceRetries: number;
  skippedSurveys: string[];
}

// jsonpath for "this element still needs a code". It is only a candidate predicate: `planSurveyCodes`
// decides exactly, and a false positive costs one read, a false negative would leave a survey uncoded,
// so every clause errs towards matching. `exists(...)` is used everywhere because it is never SQL-null,
// unlike a comparison against a missing key, which a `!` would not flip.
const NO_CODE = `!exists(@.code ? (@.type() == "string"))`;
const OPTION_WITHOUT_CODE = (key: string) => `exists(@.${key}[*] ? (${NO_CODE}))`;
const ELEMENT_NEEDS_CODE = `!exists(@ ? (@.type == "cta")) && (${NO_CODE} || ${OPTION_WITHOUT_CODE("choices")} || ${OPTION_WITHOUT_CODE("rows")} || ${OPTION_WITHOUT_CODE("columns")})`;
const BLOCKS_PATH = `$[*].elements[*] ? (${ELEMENT_NEEDS_CODE})`;
const QUESTIONS_PATH = `$[*] ? (${ELEMENT_NEEDS_CODE})`;

// Same shape guards as the Embedded Data backfill: `jsonb_typeof` keeps `jsonb_array_length` off a
// non-array, which would raise. The legacy branch is only taken when `blocks` is empty, as in the planner.
const CANDIDATE_PREDICATE = `(
  (COALESCE(cardinality(s."blocks"), 0) > 0 AND jsonb_path_exists(to_jsonb(s."blocks"), '${BLOCKS_PATH}'))
  OR (
    COALESCE(cardinality(s."blocks"), 0) = 0
    AND jsonb_typeof(s."questions") = 'array'
    AND jsonb_array_length(s."questions") > 0
    AND jsonb_path_exists(s."questions", '${QUESTIONS_PATH}')
  )
)`;

// The names a question code must not take. For a survey with links that is its Embedded Data rows
// (a computed field answers to its library key or name, an ingested one to its storage key, matching
// `collectDeclaredFieldNames`); null when it has none, which sends the planner to the legacy columns.
const SELECT_SURVEYS = `
  SELECT s."id", s."updated_at"::text AS "updatedAt", to_jsonb(s."blocks") AS "blocks", s."questions",
    s."variables", s."hiddenFields",
    (
      SELECT array_agg(CASE WHEN e."source" = 'computed' THEN COALESCE(e."key", e."name") ELSE l."storageKey" END)
      FROM "SurveyEmbeddedData" l
      JOIN "EmbeddedData" e ON e."id" = l."embeddedDataId" AND e."workspaceId" = l."workspaceId"
      WHERE l."surveyId" = s."id"
    ) AS "linkedNames"
  FROM "Survey" s`;

const fetchPage = (prisma: TPrismaHandle, cursor: string): Promise<TSurveyCodesRow[]> =>
  prisma.$queryRawUnsafe<TSurveyCodesRow[]>(
    `${SELECT_SURVEYS} WHERE s."id" > $1 AND ${CANDIDATE_PREDICATE} ORDER BY s."id" LIMIT $2`,
    cursor,
    SURVEY_BATCH_SIZE
  );

const fetchByIds = (prisma: TPrismaHandle, ids: string[]): Promise<TSurveyCodesRow[]> =>
  prisma.$queryRawUnsafe<TSurveyCodesRow[]>(
    `${SELECT_SURVEYS} WHERE s."id" = ANY($1::text[]) AND ${CANDIDATE_PREDICATE}`,
    ids
  );

type TUpdatePlan = Extract<TSurveyCodesPlan, { status: "update" }>;

/**
 * One UPDATE for every planned survey of one column. Raw SQL on purpose: Prisma's `@updatedAt` is set by
 * the client, so this leaves `updated_at` alone and a v3 caller's `expectedUpdatedAt` stays valid. The
 * `updated_at = ...` condition is the online-upgrade guard: an old pod that saved the survey since it was
 * read has moved the token, the row is not updated, and the caller re-reads it instead of overwriting.
 * `blocks` is a `jsonb[]`, rebuilt by ordinality so block order survives the round trip.
 */
const writePlans = async (
  prisma: TPrismaHandle,
  column: TUpdatePlan["column"],
  plans: { row: TSurveyCodesRow; plan: TUpdatePlan }[]
): Promise<Set<string>> => {
  if (plans.length === 0) return new Set();
  const assignment =
    column === "blocks"
      ? `"blocks" = COALESCE((SELECT array_agg(elem ORDER BY ord) FROM jsonb_array_elements(d."value") WITH ORDINALITY AS t(elem, ord)), ARRAY[]::jsonb[])`
      : `"questions" = d."value"`;
  const written = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "Survey" AS s SET ${assignment}
     FROM (
       SELECT unnest($1::text[]) AS "id", unnest($2::text[]) AS "updatedAt", unnest($3::text[])::jsonb AS "value"
     ) AS d
     WHERE s."id" = d."id" AND s."updated_at" = d."updatedAt"::timestamp
     RETURNING s."id"`,
    plans.map(({ row }) => row.id),
    plans.map(({ row }) => row.updatedAt),
    plans.map(({ plan }) => JSON.stringify(plan.value))
  );
  return new Set(written.map((row) => row.id));
};

/**
 * Plans and writes one page of surveys. Returns the ids of rows an old pod edited in the meantime.
 */
const processRows = async (
  prisma: TPrismaHandle,
  rows: TSurveyCodesRow[],
  stats: TQuestionCodesBackfillStats
): Promise<string[]> => {
  const byColumn: Record<TUpdatePlan["column"], { row: TSurveyCodesRow; plan: TUpdatePlan }[]> = {
    blocks: [],
    questions: [],
  };
  for (const row of rows) {
    const plan = planSurveyCodes(row);
    if (plan.status === "unchanged") stats.unchangedSurveys += 1;
    else byColumn[plan.column].push({ row, plan });
  }

  const lost: string[] = [];
  for (const column of ["blocks", "questions"] as const) {
    const written = await writePlans(prisma, column, byColumn[column]);
    stats.updatedSurveys += written.size;
    for (const { row } of byColumn[column]) if (!written.has(row.id)) lost.push(row.id);
  }
  return lost;
};

/**
 * Writes `code` into every survey that lacks codes, in committed chunks of 150 on the autocommit handle,
 * so no transaction or lock outlives a chunk and the runner's 30-minute transaction never carries the
 * whole table. Every status is covered, archived included.
 *
 * Idempotent: a coded survey is not a candidate (SQL) and plans to "unchanged" (JS), so a second run, or
 * a run on a database that is already coded, writes nothing. An empty table yields an empty first page.
 *
 * Walks by keyset on `id`, not OFFSET: a survey that was just coded leaves the candidate set, so an
 * offset would step over unprocessed rows.
 */
export const backfillQuestionCodeRows = async (
  prisma: TPrismaHandle
): Promise<TQuestionCodesBackfillStats> => {
  const stats: TQuestionCodesBackfillStats = {
    scannedSurveys: 0,
    updatedSurveys: 0,
    unchangedSurveys: 0,
    raceRetries: 0,
    skippedSurveys: [],
  };
  let cursor = "";
  let batches = 0;

  for (;;) {
    const rows = await fetchPage(prisma, cursor);
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    stats.scannedSurveys += rows.length;

    let lost = await processRows(prisma, rows, stats);
    for (let attempt = 1; lost.length > 0 && attempt <= MAX_RACE_RETRIES; attempt++) {
      stats.raceRetries += lost.length;
      lost = await processRows(prisma, await fetchByIds(prisma, lost), stats);
    }
    if (lost.length > 0) {
      stats.skippedSurveys.push(...lost);
      logger.warn(
        { surveyIds: lost },
        "Skipped surveys that kept changing during the question code backfill"
      );
    }

    batches += 1;
    if (batches % PROGRESS_LOG_EVERY_BATCHES === 0) {
      logger.info(
        `Question code backfill progress: ${stats.scannedSurveys.toString()} scanned, ${stats.updatedSurveys.toString()} updated`
      );
    }
  }

  logger.info(
    `Question code backfill complete: ${stats.scannedSurveys.toString()} scanned, ${stats.updatedSurveys.toString()} updated, ${stats.unchangedSurveys.toString()} unchanged, ${stats.raceRetries.toString()} race retries, ${stats.skippedSurveys.length.toString()} skipped`
  );
  return stats;
};

/**
 * Stores `code` on every question, option, row and column of every existing survey (ENG-6788), in
 * today's order, so block reordering after publish can no longer shift the codes an export uses.
 * Surveys saved by old pods during an online upgrade are covered by the write-time fill (ENG-6782).
 *
 * Fresh databases baseline data migrations without running them, so this never sees an empty install.
 */
export const backfillQuestionCodes: MigrationScript = {
  type: "data",
  id: "lmpn5v2xlk1770ky5k6b51lm",
  name: "20261027230835_backfill_question_codes",
  // `tx` is deliberately unused: the work commits in chunks on `prisma` (see backfillQuestionCodeRows).
  run: async ({ prisma }) => {
    await backfillQuestionCodeRows(prisma);
  },
};
