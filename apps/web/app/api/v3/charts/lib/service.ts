import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { escapeLikePattern } from "@/lib/utils/like-pattern";

/**
 * Persistence for the v3 chart operations. Every read is scoped by the caller's authorized workspace or
 * returns the row's own workspace for the operation to authorize — a chart is never handed back on its
 * id alone.
 */

/**
 * The chart as the public resource needs it, embedded `dashboards` included. Those come from the chart's
 * widgets in the same query (Prisma batches the relation read), so neither a page of charts nor one chart
 * costs a query per dashboard.
 */
export const selectChartResource = {
  id: true,
  workspaceId: true,
  feedbackDirectoryId: true,
  name: true,
  type: true,
  query: true,
  config: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { name: true } },
  widgets: {
    orderBy: { dashboard: { name: "asc" } },
    select: { dashboard: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ChartSelect;

export type TChartResourceRow = Prisma.ChartGetPayload<{ select: typeof selectChartResource }>;

/** One chart with what its resource embeds, or `null`. The caller authorizes `workspaceId` before use. */
export const getChartResourceRow = (chartId: string): Promise<TChartResourceRow | null> =>
  prisma.chart.findUnique({ where: { id: chartId }, select: selectChartResource });

export type TChartListFilter = {
  workspaceId: string;
  nameContains?: string;
  datasetId?: string;
};

/**
 * One keyset page of a workspace's charts, newest first with the id as tie-break, `limit + 1` rows so
 * the caller can tell whether another page follows.
 *
 * The page condition is the `OR` form rather than a row constructor: a workspace holds charts in the
 * hundreds, not the hundreds of thousands the raw-SQL predicate in `keyset-cursor.ts` exists for, and
 * the `(workspaceId, createdAt)` index still bounds the scan.
 */
export const listChartResourceRows = ({
  filter,
  cursor,
  limit,
}: {
  filter: TChartListFilter;
  cursor: { value: string; id: string } | null;
  limit: number;
}): Promise<TChartResourceRow[]> => {
  const after = cursor ? new Date(cursor.value) : null;

  return prisma.chart.findMany({
    where: {
      workspaceId: filter.workspaceId,
      ...(filter.nameContains
        ? { name: { contains: escapeLikePattern(filter.nameContains), mode: "insensitive" } }
        : {}),
      ...(filter.datasetId ? { feedbackDirectoryId: filter.datasetId } : {}),
      ...(after && cursor
        ? { OR: [{ createdAt: { lt: after } }, { createdAt: after, id: { lt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: selectChartResource,
  });
};
