import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type {
  RetentionEntity,
  RetentionRunItemAction,
  RetentionSkipReason,
  RetentionTargetType,
} from "@formbricks/database/prisma";
import { type TKeysetCursor, keysetOrderBy, keysetPagePredicate } from "@/app/api/v3/lib/keyset-cursor";

/** One History row: a sweep of one policy for one organisation. */
export type TRetentionRunRow = {
  id: string;
  entity: RetentionEntity;
  startedAt: Date;
  finishedAt: Date | null;
  notifiedCount: number;
  archivedCount: number;
  deletedCount: number;
  skippedCount: number;
  hasChanges: boolean;
};

export type TRetentionRunItemRow = {
  id: string;
  runId: string;
  targetType: RetentionTargetType;
  targetId: string;
  targetName: string | null;
  action: RetentionRunItemAction;
  count: number;
  recipient: string | null;
  skipReason: RetentionSkipReason | null;
};

// Identifiers can't be bound parameters, so they're built from literals, inside functions: a
// module-scope `Prisma.raw` breaks under the Prisma test mock.
const runSortColumn = () => Prisma.raw(`r."startedAt"`);
const runIdColumn = () => Prisma.raw(`r."id"`);

/**
 * A History page, newest first, keyset-paged on `(startedAt, id)` over
 * `RetentionRun(organizationId, startedAt, id)`. Fetches `limit + 1` rows so the caller can tell a last
 * page from a full one (`buildKeysetPage`). Runs that changed nothing are left out unless asked for.
 */
export async function listRetentionRunKeysetPage({
  organizationId,
  includeEmpty,
  limit,
  cursor,
}: {
  organizationId: string;
  includeEmpty: boolean;
  limit: number;
  cursor: Pick<TKeysetCursor, "value" | "id"> | null;
}): Promise<TRetentionRunRow[]> {
  const clauses = [Prisma.sql`r."organizationId" = ${organizationId}`];
  if (!includeEmpty) {
    clauses.push(Prisma.sql`r."hasChanges" = true`);
  }
  if (cursor) {
    clauses.push(
      keysetPagePredicate({ sortColumn: runSortColumn(), idColumn: runIdColumn(), direction: "desc", cursor })
    );
  }

  return prisma.$queryRaw<TRetentionRunRow[]>`
    SELECT r."id", r."entity", r."startedAt", r."finishedAt", r."notifiedCount", r."archivedCount",
           r."deletedCount", r."skippedCount", r."hasChanges"
    FROM "RetentionRun" r
    WHERE ${Prisma.join(clauses, " AND ")}
    ${keysetOrderBy({ sortColumn: runSortColumn(), idColumn: runIdColumn(), direction: "desc" })}
    LIMIT ${limit + 1}
  `;
}

export type TRetentionExportRange = {
  organizationId: string;
  /** Inclusive lower bound on `startedAt`. */
  from: Date | null;
  /** Exclusive upper bound on `startedAt`. */
  to: Date | null;
};

const exportRangeClauses = ({ organizationId, from, to }: TRetentionExportRange): Prisma.Sql[] => {
  const clauses = [Prisma.sql`r."organizationId" = ${organizationId}`];
  if (from) clauses.push(Prisma.sql`r."startedAt" >= ${from}`);
  if (to) clauses.push(Prisma.sql`r."startedAt" < ${to}`);
  return clauses;
};

/**
 * How many CSV rows an export would write: one per run item, plus one for each run with no items. Counts
 * at most `cap + 1`, so checking a huge range costs no more than the cap.
 */
export async function countRetentionExportRows(range: TRetentionExportRange, cap: number): Promise<number> {
  const [result] = await prisma.$queryRaw<{ rows: number }[]>`
    SELECT count(*)::int AS "rows"
    FROM (
      SELECT 1
      FROM "RetentionRun" r
      LEFT JOIN "RetentionRunItem" i ON i."runId" = r."id"
      WHERE ${Prisma.join(exportRangeClauses(range), " AND ")}
      LIMIT ${cap + 1}
    ) capped
  `;
  return result?.rows ?? 0;
}

/** One CSV row: a run, with one of its items, or none for a run that has no items. */
export type TRetentionExportRow = { run: TRetentionRunRow; item: TRetentionRunItemRow | null };

/**
 * Every run in the range, oldest first, each followed by its items. Runs come in keyset batches on
 * `(startedAt, id)`, each knowing whether it has items (one index probe per run, in the same query), and
 * each run's items come in keyset pages on `RetentionRunItem(runId, id)`, yielded as they arrive. The
 * consumer pulls rows, so the database is read only as fast as the client downloads, and at most one batch
 * of runs and one page of items are held at a time, however large the export. Queries: one per batch of
 * runs, plus one per page of items of each run that has any (most runs change nothing and have none).
 */
export async function* iterateRetentionExportRows(
  range: TRetentionExportRange,
  { runBatchSize = 100, itemBatchSize = 1000 }: { runBatchSize?: number; itemBatchSize?: number } = {}
): AsyncGenerator<TRetentionExportRow> {
  let runCursor: Pick<TKeysetCursor, "value" | "id"> | null = null;

  for (;;) {
    const clauses = exportRangeClauses(range);
    if (runCursor) {
      clauses.push(
        keysetPagePredicate({
          sortColumn: runSortColumn(),
          idColumn: runIdColumn(),
          direction: "asc",
          cursor: runCursor,
        })
      );
    }

    const runs = await prisma.$queryRaw<(TRetentionRunRow & { hasItems: boolean })[]>`
      SELECT r."id", r."entity", r."startedAt", r."finishedAt", r."notifiedCount", r."archivedCount",
             r."deletedCount", r."skippedCount", r."hasChanges",
             EXISTS (SELECT 1 FROM "RetentionRunItem" i WHERE i."runId" = r."id") AS "hasItems"
      FROM "RetentionRun" r
      WHERE ${Prisma.join(clauses, " AND ")}
      ${keysetOrderBy({ sortColumn: runSortColumn(), idColumn: runIdColumn(), direction: "asc" })}
      LIMIT ${runBatchSize}
    `;
    if (runs.length === 0) return;

    for (const { hasItems, ...run } of runs) {
      if (!hasItems) {
        yield { run, item: null };
        continue;
      }
      for await (const item of iterateRunItems(run.id, itemBatchSize)) {
        yield { run, item };
      }
    }

    const last = runs.at(-1);
    if (!last || runs.length < runBatchSize) return;
    runCursor = { value: last.startedAt.toISOString(), id: last.id };
  }
}

/** One run's items in id order, a keyset page at a time over `RetentionRunItem(runId, id)`. */
async function* iterateRunItems(runId: string, batchSize: number): AsyncGenerator<TRetentionRunItemRow> {
  let afterId: string | null = null;

  for (;;) {
    const page: TRetentionRunItemRow[] = await prisma.$queryRaw<TRetentionRunItemRow[]>`
      SELECT i."id", i."runId", i."targetType", i."targetId", i."targetName", i."action", i."count",
             i."recipient", i."skipReason"
      FROM "RetentionRunItem" i
      WHERE i."runId" = ${runId}
        ${afterId ? Prisma.sql`AND i."id" > ${afterId}` : Prisma.empty}
      ORDER BY i."id" ASC
      LIMIT ${batchSize}
    `;
    yield* page;

    const last = page.at(-1);
    if (!last || page.length < batchSize) return;
    afterId = last.id;
  }
}
