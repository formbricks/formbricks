import { logger } from "@formbricks/logger";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";
import {
  type TMatrixIdsPlan,
  type TQuotaMatrixRow,
  type TSurveyMatrixRow,
  planQuotaMatrixIds,
  planSurveyMatrixIds,
} from "./utils";

const BATCH_SIZE = 150;
const MAX_RACE_RETRIES = 3;
const PROGRESS_LOG_EVERY_BATCHES = 20;

type TPrismaHandle = DataMigrationContext["prisma"];

export interface TMatrixIdsBackfillStats {
  scanned: number;
  updated: number;
  /** Candidates whose sync changed nothing (an id or position that names no row or column). */
  unchanged: number;
  /** Rows an old pod edited while the migration ran; each was re-read and planned again. */
  raceRetries: number;
  skipped: string[];
}

// jsonpath for "a matrix row condition still lacks an id". Only a candidate predicate: the planner
// decides exactly, and a false positive costs one read, a false negative would leave a condition on
// positions, so every clause errs towards matching. A row condition is one with `meta.row`; it is a
// candidate when it has no `rowId`, or a static right operand with neither `columnId` nor `columnIds`.
const NEEDS_IDS = `(exists(@.leftOperand.meta.row) && (!exists(@.leftOperand.meta.rowId) || exists(@.rightOperand ? (@.type == "static" && !exists(@.columnId) && !exists(@.columnIds)))))`;
// `.**` reaches every condition at any depth: block logic, block, question and option show-if.
const BLOCKS_PATH = `$[*].** ? ${NEEDS_IDS}`;
const QUOTA_PATH = `$.conditions[*] ? ${NEEDS_IDS}`;

type TTarget<TRow> = {
  /** The log label. */
  label: string;
  select: string;
  candidate: string;
  /** `"<table>" AS x SET <assignment from d."value">` for the compare-and-set UPDATE. */
  table: string;
  assignment: string;
  plan: (row: TRow) => TMatrixIdsPlan;
};

const SURVEYS: TTarget<TSurveyMatrixRow> = {
  label: "surveys",
  select: `SELECT x."id", x."updated_at"::text AS "updatedAt", to_jsonb(x."blocks") AS "blocks" FROM "Survey" x`,
  candidate: `COALESCE(cardinality(x."blocks"), 0) > 0 AND jsonb_path_exists(to_jsonb(x."blocks"), '${BLOCKS_PATH}')`,
  table: `"Survey"`,
  // `blocks` is a `jsonb[]`, rebuilt by ordinality so block order survives the round trip.
  assignment: `"blocks" = COALESCE((SELECT array_agg(elem ORDER BY ord) FROM jsonb_array_elements(d."value") WITH ORDINALITY AS t(elem, ord)), ARRAY[]::jsonb[])`,
  plan: planSurveyMatrixIds,
};

const QUOTAS: TTarget<TQuotaMatrixRow> = {
  label: "quotas",
  select: `SELECT x."id", x."updated_at"::text AS "updatedAt", x."logic", to_jsonb(s."blocks") AS "blocks" FROM "SurveyQuota" x JOIN "Survey" s ON s."id" = x."surveyId"`,
  candidate: `jsonb_typeof(x."logic") = 'object' AND jsonb_path_exists(x."logic", '${QUOTA_PATH}')`,
  table: `"SurveyQuota"`,
  assignment: `"logic" = d."value"`,
  plan: planQuotaMatrixIds,
};

const fetchPage = <TRow>(prisma: TPrismaHandle, target: TTarget<TRow>, cursor: string): Promise<TRow[]> =>
  prisma.$queryRawUnsafe<TRow[]>(
    `${target.select} WHERE x."id" > $1 AND ${target.candidate} ORDER BY x."id" LIMIT $2`,
    cursor,
    BATCH_SIZE
  );

const fetchByIds = <TRow>(prisma: TPrismaHandle, target: TTarget<TRow>, ids: string[]): Promise<TRow[]> =>
  prisma.$queryRawUnsafe<TRow[]>(
    `${target.select} WHERE x."id" = ANY($1::text[]) AND ${target.candidate}`,
    ids
  );

/**
 * One UPDATE for every planned row. Raw SQL on purpose: Prisma's `@updatedAt` is set by the client, so
 * this leaves `updated_at` alone and a v3 caller's `expectedUpdatedAt` stays valid. The
 * `updated_at = ...` condition is the online-upgrade guard: an old pod that saved the row since it was
 * read has moved the token, the row is not updated, and the caller re-reads it instead of overwriting.
 */
const writePlans = async <TRow extends { id: string; updatedAt: string }>(
  prisma: TPrismaHandle,
  target: TTarget<TRow>,
  plans: { row: TRow; value: unknown }[]
): Promise<Set<string>> => {
  if (plans.length === 0) return new Set();
  const written = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE ${target.table} AS x SET ${target.assignment}
     FROM (
       SELECT unnest($1::text[]) AS "id", unnest($2::text[]) AS "updatedAt", unnest($3::text[])::jsonb AS "value"
     ) AS d
     WHERE x."id" = d."id" AND x."updated_at" = d."updatedAt"::timestamp
     RETURNING x."id"`,
    plans.map(({ row }) => row.id),
    plans.map(({ row }) => row.updatedAt),
    plans.map(({ value }) => JSON.stringify(value))
  );
  return new Set(written.map((row) => row.id));
};

/** Plans and writes one page. Returns the ids of rows an old pod edited in the meantime. */
const processRows = async <TRow extends { id: string; updatedAt: string }>(
  prisma: TPrismaHandle,
  target: TTarget<TRow>,
  rows: TRow[],
  stats: TMatrixIdsBackfillStats
): Promise<string[]> => {
  const plans: { row: TRow; value: unknown }[] = [];
  for (const row of rows) {
    const plan = target.plan(row);
    if (plan.status === "unchanged") stats.unchanged += 1;
    else plans.push({ row, value: plan.value });
  }
  const written = await writePlans(prisma, target, plans);
  stats.updated += written.size;
  return plans.filter(({ row }) => !written.has(row.id)).map(({ row }) => row.id);
};

/**
 * Backfills one table in committed chunks of 150 on the autocommit handle, so no transaction or lock
 * outlives a chunk and the runner's 30-minute transaction never carries the whole table.
 *
 * Idempotent: a synced row is not a candidate (SQL) and plans to "unchanged" (JS), so a second run
 * writes nothing. Walks by keyset on `id`, not OFFSET: a row that was just synced leaves the candidate
 * set, so an offset would step over unprocessed rows.
 */
const backfillTable = async <TRow extends { id: string; updatedAt: string }>(
  prisma: TPrismaHandle,
  target: TTarget<TRow>
): Promise<TMatrixIdsBackfillStats> => {
  const stats: TMatrixIdsBackfillStats = {
    scanned: 0,
    updated: 0,
    unchanged: 0,
    raceRetries: 0,
    skipped: [],
  };
  let cursor = "";
  let batches = 0;

  for (;;) {
    const rows = await fetchPage(prisma, target, cursor);
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    stats.scanned += rows.length;

    let lost = await processRows(prisma, target, rows, stats);
    for (let attempt = 1; lost.length > 0 && attempt <= MAX_RACE_RETRIES; attempt++) {
      stats.raceRetries += lost.length;
      lost = await processRows(prisma, target, await fetchByIds(prisma, target, lost), stats);
    }
    if (lost.length > 0) {
      stats.skipped.push(...lost);
      logger.warn({ ids: lost }, `Skipped ${target.label} that kept changing during the matrix id backfill`);
    }

    batches += 1;
    if (batches % PROGRESS_LOG_EVERY_BATCHES === 0) {
      logger.info(
        `Matrix id backfill (${target.label}) progress: ${stats.scanned.toString()} scanned, ${stats.updated.toString()} updated`
      );
    }
  }

  logger.info(
    `Matrix id backfill (${target.label}) complete: ${stats.scanned.toString()} scanned, ${stats.updated.toString()} updated, ${stats.unchanged.toString()} unchanged, ${stats.raceRetries.toString()} race retries, ${stats.skipped.length.toString()} skipped`
  );
  return stats;
};

/**
 * Adds row and column ids next to the positions of every stored matrix condition: survey blocks
 * (logic and show-if) first, then quota conditions. Follow-ups store no conditions.
 */
export const backfillMatrixConditionIdRows = async (
  prisma: TPrismaHandle
): Promise<{ surveys: TMatrixIdsBackfillStats; quotas: TMatrixIdsBackfillStats }> => ({
  surveys: await backfillTable(prisma, SURVEYS),
  quotas: await backfillTable(prisma, QUOTAS),
});

/**
 * Matrix conditions by id (ENG-6934, ADR 0026): stores `meta.rowId` and `columnId` / `columnIds` next to
 * the positions of every existing matrix condition, so reordering rows or columns on a live survey no
 * longer points a condition at another cell. Positions stay: the previous release's pods read them
 * while the upgrade rolls out. Conditions saved by old pods during the rollout get their ids on the
 * next save (the write path fills them, ENG-6934).
 *
 * Fresh databases baseline data migrations without running them, so this never sees an empty install.
 */
export const backfillMatrixConditionIds: MigrationScript = {
  type: "data",
  id: "diyvexi9jr9xxok2ytz7qli8",
  name: "20261103130000_backfill_matrix_condition_ids",
  // `tx` is deliberately unused: the work commits in chunks on `prisma` (see backfillTable).
  run: async ({ prisma }) => {
    await backfillMatrixConditionIdRows(prisma);
  },
};
