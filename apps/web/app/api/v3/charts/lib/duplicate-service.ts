import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type { TWidgetLayout } from "@formbricks/types/analysis";
import { V3_NAME_MAX_LENGTH } from "@/app/api/v3/charts/lib/schemas";
import { lockDashboard } from "@/app/api/v3/dashboards/lib/dashboard-lock";
import {
  countDashboardWidgets,
  planNewWidget,
  resolveTargetPage,
  siblingsOf,
  touchDashboard,
} from "@/app/api/v3/dashboards/lib/widget-service";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import { retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import { getDefaultWidgetLayout } from "@/modules/ee/analysis/dashboards/lib/widget-placement";
import { copyNamePrefix, nextCopyName } from "@/modules/ee/analysis/lib/copy-name";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import { type TChartResourceRow, selectChartResource } from "./service";

export type TChartDuplicateResult =
  | { kind: "ok"; row: TChartResourceRow; widgetId?: string }
  /** The source chart or the target dashboard is gone — deleted after it was authorized. */
  | { kind: "gone" }
  /** The requested layout would cover this widget on the target dashboard. */
  | { kind: "overlap"; widgetId: string }
  /** The target dashboard already holds `MAX_DASHBOARD_WIDGETS` widgets. */
  | { kind: "full" }
  /** The target dashboard's grid has no room left above its last row. */
  | { kind: "noSpace" }
  /** The page named is not a page of the target dashboard. */
  | { kind: "unknownPage" };

type TCopyPlacement = { kind: "ok"; layout: TWidgetLayout; order: number; pageId: string };

/**
 * Where the copy goes on the dashboard's page `pageId` (its first page without one), moving the
 * dashboard's `updatedAt`. Takes the same lock every widget write takes, so the copy's slot is chosen
 * against the latest widgets.
 */
const placeCopy = async (
  tx: Prisma.TransactionClient,
  {
    dashboardId,
    pageId,
    chartType,
    layout,
  }: { dashboardId: string; pageId?: string; chartType: TChartType; layout?: TWidgetLayout }
): Promise<TCopyPlacement | Exclude<TChartDuplicateResult, { kind: "ok" }>> => {
  const locked = await lockDashboard(tx, dashboardId);
  if (!locked) return { kind: "gone" };
  const targetPageId = await resolveTargetPage(tx, dashboardId, pageId);
  if (!targetPageId) return pageId ? { kind: "unknownPage" } : { kind: "gone" };
  const plan = planNewWidget({
    siblings: await siblingsOf(tx, dashboardId, targetPageId),
    widgetCount: await countDashboardWidgets(tx, dashboardId),
    size: getDefaultWidgetLayout(chartType),
    layout,
  });
  if (plan.kind !== "ok") return plan;
  if (!(await touchDashboard(tx, dashboardId, locked))) return { kind: "gone" };
  return { ...plan, pageId: targetPageId };
};

/**
 * Copy a chart — same Feedback Dataset, type, query and display settings — and, given a `dashboardId`,
 * put the copy on that dashboard's page `pageId` (its first page without one), all in one transaction: if
 * placing it fails, there is no copy. Placement takes the dashboard's lock, like every widget write.
 * Without a `name`, the copy takes the first free "(copy)" name, read in the same transaction.
 */
export const duplicateChartRow = ({
  sourceId,
  name,
  createdBy,
  dashboardId,
  pageId,
  layout,
}: {
  sourceId: string;
  name?: string;
  createdBy: string | null;
  dashboardId?: string;
  pageId?: string;
  layout?: TWidgetLayout;
}): Promise<TChartDuplicateResult> =>
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx): Promise<TChartDuplicateResult> => {
      const source = await tx.chart.findUnique({
        where: { id: sourceId },
        select: {
          name: true,
          type: true,
          query: true,
          config: true,
          workspaceId: true,
          feedbackDirectoryId: true,
        },
      });
      if (!source) return { kind: "gone" };

      let placement: TCopyPlacement | null = null;
      if (dashboardId) {
        const placed = await placeCopy(tx, { dashboardId, pageId, chartType: source.type, layout });
        if (placed.kind !== "ok") return placed;
        placement = placed;
      }

      const resolvedName =
        name ??
        nextCopyName(
          source.name,
          (
            await tx.chart.findMany({
              where: {
                workspaceId: source.workspaceId,
                name: { startsWith: escapeLikePattern(copyNamePrefix(source.name, V3_NAME_MAX_LENGTH)) },
              },
              select: { name: true },
            })
          ).map((chart) => chart.name),
          V3_NAME_MAX_LENGTH
        );

      const copy = await tx.chart.create({
        data: {
          name: resolvedName,
          type: source.type,
          query: source.query as Prisma.InputJsonValue,
          config: (source.config ?? {}) as Prisma.InputJsonValue,
          workspaceId: source.workspaceId,
          feedbackDirectoryId: source.feedbackDirectoryId,
          createdBy,
        },
        select: { id: true },
      });

      const widget =
        dashboardId && placement
          ? await tx.dashboardWidget.create({
              data: {
                dashboardId,
                pageId: placement.pageId,
                kind: "chart",
                chartId: copy.id,
                layout: placement.layout,
                order: placement.order,
              },
              select: { id: true },
            })
          : null;

      // Read back last, so the copy's embedded `dashboards` already includes the one it was put on.
      const row = await tx.chart.findUniqueOrThrow({ where: { id: copy.id }, select: selectChartResource });
      return { kind: "ok", row, ...(widget ? { widgetId: widget.id } : {}) };
    })
  );
