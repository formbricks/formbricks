import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type { TWidgetLayout } from "@formbricks/types/analysis";
import { planNewWidget, siblingsOf, touchDashboard } from "@/app/api/v3/dashboards/lib/widget-service";
import { retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import { copyNamePrefix, nextCopyName } from "@/modules/ee/analysis/lib/copy-name";
import { type TChartResourceRow, selectChartResource } from "./service";

export type TChartDuplicateResult =
  | { kind: "ok"; row: TChartResourceRow; widgetId?: string }
  /** The source chart or the target dashboard is gone — deleted after it was authorized. */
  | { kind: "gone" }
  /** The requested layout would cover this widget on the target dashboard. */
  | { kind: "overlap"; widgetId: string };

/**
 * Copy a chart — same Feedback Dataset, type, query and display settings — and, given a `dashboardId`,
 * put the copy on that dashboard, all in one transaction: if placing it fails, there is no copy. Without
 * a `name`, the copy takes the first free "(copy)" name, read in the same transaction.
 */
export const duplicateChartRow = ({
  sourceId,
  name,
  createdBy,
  dashboardId,
  layout,
}: {
  sourceId: string;
  name?: string;
  createdBy: string | null;
  dashboardId?: string;
  layout?: TWidgetLayout;
}): Promise<TChartDuplicateResult> =>
  retryOnTransactionConflict(() =>
    prisma.$transaction(
      async (tx): Promise<TChartDuplicateResult> => {
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

        let placement: { layout: TWidgetLayout; order: number } | null = null;
        if (dashboardId) {
          const plan = planNewWidget(await siblingsOf(tx, dashboardId), source.type, layout);
          if (plan.kind !== "ok") return plan;
          if (!(await touchDashboard(tx, dashboardId))) return { kind: "gone" };
          placement = plan;
        }

        const resolvedName =
          name ??
          nextCopyName(
            source.name,
            (
              await tx.chart.findMany({
                where: { workspaceId: source.workspaceId, name: { startsWith: copyNamePrefix(source.name) } },
                select: { name: true },
              })
            ).map((chart) => chart.name)
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
                data: { dashboardId, chartId: copy.id, layout: placement.layout, order: placement.order },
                select: { id: true },
              })
            : null;

        // Read back last, so the copy's embedded `dashboards` already includes the one it was put on.
        const row = await tx.chart.findUniqueOrThrow({ where: { id: copy.id }, select: selectChartResource });
        return { kind: "ok", row, ...(widget ? { widgetId: widget.id } : {}) };
      },
      { isolationLevel: "Serializable" }
    )
  );
