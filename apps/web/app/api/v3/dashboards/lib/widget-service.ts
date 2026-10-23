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
import { type TLockedDashboard, lockDashboard, nextDashboardUpdatedAt } from "./dashboard-lock";
import {
  type TDashboardResourceRow,
  type TWidgetResourceRow,
  selectDashboardResource,
  selectWidgetResource,
} from "./service";

/**
 * Persistence for a dashboard's widgets. Every write runs in one transaction that first locks the dashboard
 * row, then reads its widgets, checks the rules against that read — a chart at most once, no overlaps —
 * writes, and moves the dashboard's `updatedAt`, so an editor holding the dashboard from before is told on
 * save. The lock queues concurrent writes to one dashboard instead of letting them race: each reads the
 * widgets only after the one before it committed, so adding several charts at once places every one of
 * them. (Serializable isolation failed the losers instead, and a handful of parallel adds ran out of
 * retries.)
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
  dashboardId: string,
  run: (tx: Prisma.TransactionClient, locked: TLockedDashboard) => Promise<TWidgetWriteResult>
): Promise<TWidgetWriteResult> =>
  // Retried only for a deadlock, which the lock makes unlikely but cannot rule out.
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      const locked = await lockDashboard(tx, dashboardId);
      return locked ? run(tx, locked) : { kind: "gone" };
    })
  );

export const siblingsOf = (tx: Prisma.TransactionClient, dashboardId: string) =>
  tx.dashboardWidget.findMany({
    where: { dashboardId },
    select: { id: true, chartId: true, layout: true, order: true },
  });

/** Moves the locked dashboard's `updatedAt` (`nextDashboardUpdatedAt`); false when it no longer exists. */
export const touchDashboard = async (
  tx: Prisma.TransactionClient,
  dashboardId: string,
  locked: TLockedDashboard
): Promise<boolean> =>
  (
    await tx.dashboard.updateMany({
      where: { id: dashboardId },
      data: { updatedAt: nextDashboardUpdatedAt(locked) },
    })
  ).count > 0;

/**
 * Where a new widget goes among `siblings`: exactly at `layout` when one is given and nothing is there,
 * otherwise the first open slot at the chart type's default size. Also the next `order`.
 */
export const planNewWidget = (
  siblings: { id: string; layout: unknown; order: number }[],
  chartType: TChartType,
  layout?: TWidgetLayout
): { kind: "ok"; layout: TWidgetLayout; order: number } | { kind: "overlap"; widgetId: string } => {
  const order = siblings.reduce((max, widget) => Math.max(max, widget.order), -1) + 1;
  if (layout) {
    const clash = findOverlappingWidget(layout, siblings);
    return clash ? { kind: "overlap", widgetId: clash.id } : { kind: "ok", layout, order };
  }
  const size = getDefaultWidgetLayout(chartType);
  return { kind: "ok", layout: { ...size, ...resolveWidgetPosition(siblings, size) }, order };
};

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
  writeWidgets(dashboardId, async (tx, locked) => {
    const siblings = await siblingsOf(tx, dashboardId);
    if (siblings.some((widget) => widget.chartId === chartId)) return { kind: "duplicate" };

    const plan = planNewWidget(siblings, chartType, layout);
    if (plan.kind !== "ok") return plan;

    if (!(await touchDashboard(tx, dashboardId, locked))) return { kind: "gone" };
    const widget = await tx.dashboardWidget.create({
      data: { dashboardId, chartId, layout: plan.layout, order: plan.order },
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
  writeWidgets(dashboardId, async (tx, locked) => {
    const siblings = await siblingsOf(tx, dashboardId);
    const current = siblings.find((widget) => widget.id === widgetId);
    if (!current) return { kind: "gone" };

    const others = siblings.filter((widget) => widget.id !== widgetId);
    if (chartId && others.some((widget) => widget.chartId === chartId)) return { kind: "duplicate" };
    if (layout) {
      const clash = findOverlappingWidget(layout, others);
      if (clash) return { kind: "overlap", widgetId: clash.id };
    }

    if (!(await touchDashboard(tx, dashboardId, locked))) return { kind: "gone" };
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
  // Retried only for a deadlock, like every other widget write.
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      const locked = await lockDashboard(tx, dashboardId);
      if (!locked) return null;
      const widget = await tx.dashboardWidget.findFirst({
        where: { id: widgetId, dashboardId },
        select: { chartId: true, layout: true },
      });
      if (!widget) return null;

      const { count } = await tx.dashboardWidget.deleteMany({ where: { id: widgetId, dashboardId } });
      if (count === 0) return null;
      await touchDashboard(tx, dashboardId, locked);
      return widget;
    })
  );

export type TDashboardReplaceResult =
  | {
      kind: "ok";
      row: TDashboardResourceRow;
      previous: { name: string; widgets: { id: string; layout: unknown; order: number }[] };
    }
  | { kind: "gone" }
  /** The dashboard changed after the caller's read. */
  | { kind: "stale"; currentUpdatedAt: Date }
  /** Widgets the caller named that are not on the dashboard. */
  | { kind: "unknownWidgets"; widgetIds: string[] }
  /** Current widgets the caller left out, where leaving one out is not allowed. */
  | { kind: "missingWidgets"; widgetIds: string[] }
  | { kind: "overlap"; widgetIds: [string, string] };

/**
 * Replace a dashboard's name and its widgets' places in one transaction, provided it is still the
 * version the caller read (`expectedUpdatedAt`). Every check runs against the transaction's own read,
 * before anything is written, so a refused write changes nothing.
 *
 * A widget left out of `widgets` is removed — unless `requireEveryWidget` is set, which refuses instead:
 * the agent rearrange, which may move widgets but never remove one by omission.
 */
export const replaceDashboardRow = ({
  dashboardId,
  expectedUpdatedAt,
  name,
  widgets,
  requireEveryWidget = false,
}: {
  dashboardId: string;
  expectedUpdatedAt: Date;
  /** Kept as it is when omitted. */
  name?: string;
  /** `order` is kept as it is when omitted. */
  widgets: { widgetId: string; layout: TWidgetLayout; order?: number }[];
  requireEveryWidget?: boolean;
}): Promise<TDashboardReplaceResult> =>
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx): Promise<TDashboardReplaceResult> => {
      const locked = await lockDashboard(tx, dashboardId);
      if (!locked) return { kind: "gone" };
      const current = await tx.dashboard.findUnique({
        where: { id: dashboardId },
        select: {
          name: true,
          updatedAt: true,
          widgets: { select: { id: true, layout: true, order: true } },
        },
      });
      if (!current) return { kind: "gone" };
      if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        return { kind: "stale", currentUpdatedAt: current.updatedAt };
      }

      const currentIds = new Set(current.widgets.map((widget) => widget.id));
      const sentIds = new Set(widgets.map((widget) => widget.widgetId));
      const unknown = [...sentIds].filter((id) => !currentIds.has(id));
      if (unknown.length > 0) return { kind: "unknownWidgets", widgetIds: unknown };
      const omitted = [...currentIds].filter((id) => !sentIds.has(id));
      if (requireEveryWidget && omitted.length > 0) return { kind: "missingWidgets", widgetIds: omitted };

      const placed: { id: string; layout: TWidgetLayout }[] = [];
      for (const widget of widgets) {
        const clash = findOverlappingWidget(widget.layout, placed);
        if (clash) return { kind: "overlap", widgetIds: [widget.widgetId, clash.id] };
        placed.push({ id: widget.widgetId, layout: widget.layout });
      }

      if (omitted.length > 0) {
        await tx.dashboardWidget.deleteMany({ where: { dashboardId, id: { in: omitted } } });
      }
      for (const widget of widgets) {
        await tx.dashboardWidget.update({
          where: { id: widget.widgetId },
          data: { layout: widget.layout, ...(widget.order === undefined ? {} : { order: widget.order }) },
        });
      }
      const row = await tx.dashboard.update({
        where: { id: dashboardId },
        data: { ...(name === undefined ? {} : { name }), updatedAt: nextDashboardUpdatedAt(locked) },
        select: selectDashboardResource,
      });

      return { kind: "ok", row, previous: { name: current.name, widgets: current.widgets } };
    })
  );
