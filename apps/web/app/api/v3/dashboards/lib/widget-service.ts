import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type { TWidgetLayout } from "@formbricks/types/analysis";
import { retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import {
  findOverlappingWidget,
  getDefaultWidgetLayout,
  resolveWidgetPosition,
} from "@/modules/ee/analysis/dashboards/lib/widget-placement";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import { type TWidgetResourceRow, selectWidgetResource } from "./service";

/**
 * Persistence for a dashboard's widgets. Every write runs in one serializable transaction that reads the
 * dashboard's widgets, checks the rules against that read — a chart at most once, no overlaps — writes,
 * and moves the dashboard's `updatedAt`, so an editor holding the dashboard from before is told on save.
 * Two concurrent writes cannot both pass their checks against the same stale read: one is retried.
 */

export type TWidgetWriteResult =
  | { kind: "ok"; widget: TWidgetResourceRow; previous?: { chartId: string; layout: unknown } }
  /** The chart is already on the dashboard. */
  | { kind: "duplicate" }
  /** The layout would cover this widget. */
  | { kind: "overlap"; widgetId: string }
  /** The dashboard or widget is gone — deleted after it was authorized. */
  | { kind: "gone" };

/** A chart's type, if it lives in `workspaceId`: a widget never shows a chart from another workspace. */
export const getChartTypeInWorkspace = async (
  chartId: string,
  workspaceId: string
): Promise<TChartType | null> =>
  (await prisma.chart.findFirst({ where: { id: chartId, workspaceId }, select: { type: true } }))?.type ??
  null;

const writeWidgets = (
  run: (tx: Prisma.TransactionClient) => Promise<TWidgetWriteResult>
): Promise<TWidgetWriteResult> =>
  retryOnTransactionConflict(() => prisma.$transaction(run, { isolationLevel: "Serializable" }));

const siblingsOf = (tx: Prisma.TransactionClient, dashboardId: string) =>
  tx.dashboardWidget.findMany({
    where: { dashboardId },
    select: { id: true, chartId: true, layout: true, order: true },
  });

/** Moves `updatedAt`; false when the dashboard no longer exists. */
const touchDashboard = async (tx: Prisma.TransactionClient, dashboardId: string): Promise<boolean> =>
  (await tx.dashboard.updateMany({ where: { id: dashboardId }, data: { updatedAt: new Date() } })).count > 0;

/**
 * Put a chart on a dashboard. Without a `layout` it lands in the first open slot at its type's default
 * size; with one, exactly there, provided nothing else is.
 */
export const addWidgetRow = ({
  dashboardId,
  chartId,
  chartType,
  layout,
}: {
  dashboardId: string;
  chartId: string;
  chartType: TChartType;
  layout?: TWidgetLayout;
}): Promise<TWidgetWriteResult> =>
  writeWidgets(async (tx) => {
    const siblings = await siblingsOf(tx, dashboardId);
    if (siblings.some((widget) => widget.chartId === chartId)) return { kind: "duplicate" };

    let placed: TWidgetLayout;
    if (layout) {
      const clash = findOverlappingWidget(layout, siblings);
      if (clash) return { kind: "overlap", widgetId: clash.id };
      placed = layout;
    } else {
      const size = getDefaultWidgetLayout(chartType);
      placed = { ...size, ...resolveWidgetPosition(siblings, size) };
    }

    if (!(await touchDashboard(tx, dashboardId))) return { kind: "gone" };
    const widget = await tx.dashboardWidget.create({
      data: {
        dashboardId,
        chartId,
        layout: placed,
        order: siblings.reduce((max, widget) => Math.max(max, widget.order), -1) + 1,
      },
      select: selectWidgetResource,
    });
    return { kind: "ok", widget };
  });

/** Move or resize a widget, point it at another chart, or both. */
export const updateWidgetRow = ({
  dashboardId,
  widgetId,
  layout,
  chartId,
}: {
  dashboardId: string;
  widgetId: string;
  layout?: TWidgetLayout;
  chartId?: string;
}): Promise<TWidgetWriteResult> =>
  writeWidgets(async (tx) => {
    const siblings = await siblingsOf(tx, dashboardId);
    const current = siblings.find((widget) => widget.id === widgetId);
    if (!current) return { kind: "gone" };

    const others = siblings.filter((widget) => widget.id !== widgetId);
    if (chartId && others.some((widget) => widget.chartId === chartId)) return { kind: "duplicate" };
    if (layout) {
      const clash = findOverlappingWidget(layout, others);
      if (clash) return { kind: "overlap", widgetId: clash.id };
    }

    if (!(await touchDashboard(tx, dashboardId))) return { kind: "gone" };
    const widget = await tx.dashboardWidget.update({
      where: { id: widgetId },
      data: { ...(layout ? { layout } : {}), ...(chartId ? { chartId } : {}) },
      select: selectWidgetResource,
    });
    return { kind: "ok", widget, previous: { chartId: current.chartId, layout: current.layout } };
  });

/** Take a widget off its dashboard; the chart stays. Returns what was removed, or null if nothing was. */
export const deleteWidgetRow = (
  dashboardId: string,
  widgetId: string
): Promise<{ chartId: string; layout: unknown } | null> =>
  prisma.$transaction(async (tx) => {
    const widget = await tx.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
      select: { chartId: true, layout: true },
    });
    if (!widget) return null;

    const { count } = await tx.dashboardWidget.deleteMany({ where: { id: widgetId, dashboardId } });
    if (count === 0) return null;
    await touchDashboard(tx, dashboardId);
    return widget;
  });
