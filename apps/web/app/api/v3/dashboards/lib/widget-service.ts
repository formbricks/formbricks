import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TDashboardWidgetKind, type TWidgetLayout, ZWidgetLayout } from "@formbricks/types/analysis";
import { retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import {
  DEFAULT_IMAGE_CONTENT,
  EMPTY_TEXT_CONTENT,
  parseWidgetContent,
} from "@/modules/ee/analysis/dashboards/lib/widget-blocks";
import {
  MAX_WIDGET_Y,
  findOverlappingWidget,
  resolveWidgetPosition,
} from "@/modules/ee/analysis/dashboards/lib/widget-placement";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";
import { type TLockedDashboard, lockDashboard, nextDashboardUpdatedAt } from "./dashboard-lock";
import { MAX_DASHBOARD_WIDGETS, MAX_WIDGET_ORDER } from "./schemas";
import { PAGE_READ_ORDER, type TWidgetResourceRow, selectWidgetResource } from "./service";

/**
 * Persistence for a dashboard's widgets. Every write runs in one transaction that first locks the dashboard
 * row, then reads the widgets of the page it writes to, checks the rules against that read — a chart at
 * most once per page, no overlaps on a page — writes, and moves the dashboard's `updatedAt`, so an editor
 * holding the dashboard from before is told on save. The lock queues concurrent writes to one dashboard
 * instead of letting them race: each reads the widgets only after the one before it committed, so adding
 * several charts at once places every one of them. (Serializable isolation failed the losers instead, and a
 * handful of parallel adds ran out of retries.)
 */

export type TWidgetRemoved = {
  pageId: string;
  kind: TDashboardWidgetKind;
  chartId: string | null;
  layout: unknown;
};

export type TWidgetWriteResult =
  | { kind: "ok"; widget: TWidgetResourceRow; previous?: TWidgetRemoved & { content: unknown } }
  /** The chart is already on that page. */
  | { kind: "duplicate" }
  /** The layout would cover this widget. */
  | { kind: "overlap"; widgetId: string }
  /** The dashboard already holds `MAX_DASHBOARD_WIDGETS` widgets. */
  | { kind: "full" }
  /** The page's grid has no room left: the first open slot is below its last row (`MAX_WIDGET_Y`). */
  | { kind: "noSpace" }
  /** The page named is not a page of this dashboard. */
  | { kind: "unknownPage" }
  /** The change does not fit the widget's kind (a chart for a block, content for a chart), or the content is invalid. */
  | { kind: "invalidWidget"; name: string; reason: string }
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

/** The widgets on one page of a dashboard: what a widget on that page is placed among. */
export const siblingsOf = (tx: Prisma.TransactionClient, dashboardId: string, pageId: string) =>
  tx.dashboardWidget.findMany({
    where: { dashboardId, pageId },
    select: { id: true, chartId: true, layout: true, order: true },
  });

/** How many widgets the dashboard holds, on every page: the `MAX_DASHBOARD_WIDGETS` cap counts them all. */
export const countDashboardWidgets = (tx: Prisma.TransactionClient, dashboardId: string): Promise<number> =>
  tx.dashboardWidget.count({ where: { dashboardId } });

/**
 * The page a write targets: `pageId` when it is a page of this dashboard, the first page (by order) when
 * none is named, or `null` — a page of another dashboard, or none at all.
 */
export const resolveTargetPage = async (
  tx: Prisma.TransactionClient,
  dashboardId: string,
  pageId: string | undefined
): Promise<string | null> => {
  const page = await tx.dashboardPage.findFirst({
    where: { dashboardId, ...(pageId ? { id: pageId } : {}) },
    orderBy: PAGE_READ_ORDER,
    select: { id: true },
  });
  return page?.id ?? null;
};

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
 * Where a new widget goes among the page's `siblings`: exactly at `layout` when one is given and nothing is
 * there, otherwise the first open slot at `size`. Also the next `order`. `widgetCount` is every widget of
 * the dashboard, which the cap counts.
 */
export const planNewWidget = ({
  siblings,
  widgetCount,
  size,
  layout,
}: {
  siblings: { id: string; layout: unknown; order: number }[];
  widgetCount: number;
  size: TWidgetLayout;
  layout?: TWidgetLayout;
}):
  | { kind: "ok"; layout: TWidgetLayout; order: number }
  | { kind: "overlap"; widgetId: string }
  | { kind: "full" }
  | { kind: "noSpace" } => {
  // The cap a whole-dashboard save carries, so an add never makes a dashboard the editor cannot save.
  if (widgetCount >= MAX_DASHBOARD_WIDGETS) return { kind: "full" };
  // After the last widget, but never past the column: a save may set any order up to it, and ties are read
  // back in creation order, so a widget added at the cap still lands last.
  const order = Math.min(
    siblings.reduce((max, widget) => Math.max(max, widget.order), -1) + 1,
    MAX_WIDGET_ORDER
  );
  if (layout) {
    const clash = findOverlappingWidget(layout, siblings);
    return clash ? { kind: "overlap", widgetId: clash.id } : { kind: "ok", layout, order };
  }
  const placed = { ...size, ...resolveWidgetPosition(siblings, size) };
  // A whole-dashboard save must be able to carry this widget, so the auto-placed slot stays within the row
  // bound the API accepts back. Only a grid packed down to its last row gets here: the fallback slot below
  // everything would sit past `MAX_WIDGET_Y`, and the dashboard could then never be saved whole.
  if (placed.y > MAX_WIDGET_Y) return { kind: "noSpace" };
  return { kind: "ok", layout: placed, order };
};

/** Stored JSON for a block's content: `null` becomes the database NULL a chart or separator holds. */
export const toContentInput = (content: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  content ?? Prisma.DbNull;

/**
 * Put a widget on a dashboard page — the first page when `pageId` is omitted. A chart (`chartId`) appears
 * at most once per page; a layout block brings its already checked `content`. Without a `layout` it lands
 * in the first open slot at `size`; with one, exactly there, provided nothing else is.
 */
export const addWidgetRow = ({
  dashboardId,
  pageId,
  kind,
  chartId,
  content,
  size,
  layout,
}: {
  dashboardId: string;
  pageId?: string;
  kind: TDashboardWidgetKind;
  chartId?: string;
  content: unknown;
  size: TWidgetLayout;
  layout?: TWidgetLayout;
}): Promise<TWidgetWriteResult> =>
  writeWidgets(dashboardId, async (tx, locked) => {
    const targetPageId = await resolveTargetPage(tx, dashboardId, pageId);
    if (!targetPageId) return pageId ? { kind: "unknownPage" } : { kind: "gone" };

    const siblings = await siblingsOf(tx, dashboardId, targetPageId);
    if (chartId && siblings.some((widget) => widget.chartId === chartId)) return { kind: "duplicate" };

    const plan = planNewWidget({
      siblings,
      widgetCount: await countDashboardWidgets(tx, dashboardId),
      size,
      layout,
    });
    if (plan.kind !== "ok") return plan;

    if (!(await touchDashboard(tx, dashboardId, locked))) return { kind: "gone" };
    const widget = await tx.dashboardWidget.create({
      data: {
        dashboardId,
        pageId: targetPageId,
        kind,
        chartId: kind === "chart" ? (chartId ?? null) : null,
        content: toContentInput(content),
        layout: plan.layout,
        order: plan.order,
      },
      select: selectWidgetResource,
    });
    return { kind: "ok", widget };
  });

/**
 * A block's content after an update: the parts sent replace the stored ones and the rest stay, so an image
 * keeps its file when only its settings change. A chart or separator has no content to merge into, and
 * refuses any.
 */
const mergeWidgetContent = (
  current: { kind: TDashboardWidgetKind; content: unknown },
  content: unknown,
  workspaceId: string
): ReturnType<typeof parseWidgetContent> => {
  if (current.kind !== "image" && current.kind !== "text") {
    return parseWidgetContent(current.kind, content, workspaceId);
  }
  const stored = typeof current.content === "object" && current.content !== null ? current.content : {};
  return parseWidgetContent(
    current.kind,
    {
      ...(current.kind === "image" ? DEFAULT_IMAGE_CONTENT : EMPTY_TEXT_CONTENT),
      ...stored,
      ...(content as object),
    },
    workspaceId
  );
};

/**
 * Whether an update fits the widget's kind — a chart only for a chart widget, content only for a block —
 * and the content it writes; `null` when it sends none.
 */
const checkWidgetChange = (
  current: { kind: TDashboardWidgetKind; content: unknown },
  { chartId, content }: { chartId?: string; content?: unknown },
  workspaceId: string
): { kind: "invalidWidget"; name: string; reason: string } | { kind: "content"; content: unknown } | null => {
  if (chartId && current.kind !== "chart") {
    return { kind: "invalidWidget", name: "chartId", reason: `A ${current.kind} widget shows no chart.` };
  }
  if (content === undefined) return null;
  const merged = mergeWidgetContent(current, content, workspaceId);
  return merged.ok
    ? { kind: "content", content: merged.content }
    : { kind: "invalidWidget", name: "content", reason: merged.reason };
};

/**
 * Where an updated widget goes: exactly at a sent `layout` if nothing else is there; for a move to another
 * page without one, its size in the first open slot there; otherwise where it is (`layout` undefined).
 */
const placeUpdatedWidget = ({
  layout,
  others,
  current,
  movesPage,
}: {
  layout?: TWidgetLayout;
  others: { id: string; layout: unknown; order: number }[];
  current: { layout: unknown };
  movesPage: boolean;
}):
  | { kind: "ok"; layout?: TWidgetLayout }
  | { kind: "overlap"; widgetId: string }
  | { kind: "full" }
  | { kind: "noSpace" } => {
  if (layout) {
    const clash = findOverlappingWidget(layout, others);
    return clash ? { kind: "overlap", widgetId: clash.id } : { kind: "ok", layout };
  }
  if (!movesPage) return { kind: "ok" };
  const parsed = ZWidgetLayout.safeParse(current.layout);
  const plan = planNewWidget({
    siblings: others,
    widgetCount: 0,
    size: parsed.success ? parsed.data : { x: 0, y: 0, w: 4, h: 4 },
  });
  return plan.kind === "ok" ? { kind: "ok", layout: plan.layout } : plan;
};

/**
 * Move or resize a widget, on its page or onto another (`pageId`), point a chart widget at another chart,
 * or replace a block's content — each checked against the widget's kind. `workspaceId` is the one the
 * dashboard lives in, which an image block's file must come from.
 */
export const updateWidgetRow = ({
  dashboardId,
  workspaceId,
  widgetId,
  layout,
  chartId,
  content,
  pageId,
}: {
  dashboardId: string;
  workspaceId: string;
  widgetId: string;
  layout?: TWidgetLayout;
  chartId?: string;
  content?: unknown;
  pageId?: string;
}): Promise<TWidgetWriteResult> =>
  writeWidgets(dashboardId, async (tx, locked) => {
    const current = await tx.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
      select: { pageId: true, kind: true, chartId: true, layout: true, content: true },
    });
    if (!current) return { kind: "gone" };

    const nextContent = checkWidgetChange(current, { chartId, content }, workspaceId);
    if (nextContent?.kind === "invalidWidget") return nextContent;

    const targetPageId = pageId ? await resolveTargetPage(tx, dashboardId, pageId) : current.pageId;
    if (!targetPageId) return { kind: "unknownPage" };

    const others = (await siblingsOf(tx, dashboardId, targetPageId)).filter(
      (widget) => widget.id !== widgetId
    );
    const nextChartId = chartId ?? current.chartId;
    if (nextChartId && others.some((widget) => widget.chartId === nextChartId)) return { kind: "duplicate" };
    const placement = placeUpdatedWidget({
      layout,
      others,
      current,
      movesPage: targetPageId !== current.pageId,
    });
    if (placement.kind !== "ok") return placement;
    const placedLayout = placement.layout;

    if (!(await touchDashboard(tx, dashboardId, locked))) return { kind: "gone" };
    const widget = await tx.dashboardWidget.update({
      where: { id: widgetId },
      data: {
        ...(placedLayout ? { layout: placedLayout } : {}),
        ...(chartId ? { chartId } : {}),
        ...(nextContent?.kind === "content" ? { content: toContentInput(nextContent.content) } : {}),
        ...(targetPageId === current.pageId ? {} : { pageId: targetPageId }),
      },
      select: selectWidgetResource,
    });
    return { kind: "ok", widget, previous: current };
  });

/** Take a widget off its dashboard; a chart stays. Returns what was removed, or null if nothing was. */
export const deleteWidgetRow = (dashboardId: string, widgetId: string): Promise<TWidgetRemoved | null> =>
  // Retried only for a deadlock, like every other widget write.
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      const locked = await lockDashboard(tx, dashboardId);
      if (!locked) return null;
      const widget = await tx.dashboardWidget.findFirst({
        where: { id: widgetId, dashboardId },
        select: { pageId: true, kind: true, chartId: true, layout: true },
      });
      if (!widget) return null;

      const { count } = await tx.dashboardWidget.deleteMany({ where: { id: widgetId, dashboardId } });
      if (count === 0) return null;
      await touchDashboard(tx, dashboardId, locked);
      return widget;
    })
  );
