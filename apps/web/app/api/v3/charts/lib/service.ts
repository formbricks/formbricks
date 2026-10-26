import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import { retryOnTransactionConflict } from "@/lib/utils/prisma-error";

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
/** Whether a Feedback Dataset is still assigned to a workspace; an unassigned one grants nobody access there. */
export const isFeedbackDatasetAssigned = async (datasetId: string, workspaceId: string): Promise<boolean> =>
  (await prisma.feedbackDirectoryWorkspace.findUnique({
    where: { feedbackDirectoryId_workspaceId: { feedbackDirectoryId: datasetId, workspaceId } },
    select: { workspaceId: true },
  })) !== null;

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

export type TChartWrite = {
  name: string;
  type: TChartResourceRow["type"];
  query: Prisma.InputJsonValue;
  config: Prisma.InputJsonValue;
};

/** Create a chart; a name already used in the workspace surfaces as Prisma's unique-constraint error. */
export const createChartRow = (
  data: TChartWrite & { workspaceId: string; datasetId: string; createdBy: string | null }
): Promise<TChartResourceRow> =>
  prisma.chart.create({
    data: {
      name: data.name,
      type: data.type,
      query: data.query,
      config: data.config,
      workspaceId: data.workspaceId,
      feedbackDirectoryId: data.datasetId,
      createdBy: data.createdBy,
    },
    select: selectChartResource,
  });

/** Update an authorized chart in place. Its workspace and Feedback Dataset never change. */
export const updateChartRow = (chartId: string, data: Partial<TChartWrite>): Promise<TChartResourceRow> =>
  prisma.chart.update({ where: { id: chartId }, data, select: selectChartResource });

export type TChartDeleteResult =
  | { kind: "deleted" }
  | { kind: "gone" }
  /** The chart is on these dashboards, so it was not deleted. */
  | { kind: "inUse"; dashboards: { id: string; name: string }[] };

/**
 * Delete a chart that sits on no dashboard. Deleting a chart cascades to its widgets, so a widget added
 * between the check and the delete would vanish from its dashboard. The chart row is locked first: a
 * widget insert needs a key-share lock on the chart it points at, so an add either commits before the
 * lock — and the check below, a fresh read under read committed, sees its widget — or waits for the delete
 * and then fails on the missing chart.
 */
export const deleteChartRow = (chartId: string): Promise<TChartDeleteResult> =>
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx): Promise<TChartDeleteResult> => {
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Chart" WHERE id = ${chartId} FOR UPDATE`;
      if (locked.length === 0) return { kind: "gone" };

      const widgets = await tx.dashboardWidget.findMany({
        where: { chartId },
        orderBy: { dashboard: { name: "asc" } },
        select: { dashboard: { select: { id: true, name: true } } },
      });
      if (widgets.length > 0) {
        return { kind: "inUse", dashboards: widgets.map((widget) => widget.dashboard) };
      }

      await tx.chart.delete({ where: { id: chartId } });
      return { kind: "deleted" };
    })
  );
