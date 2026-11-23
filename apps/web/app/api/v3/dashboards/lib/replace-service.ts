import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type { TDashboardWidgetKind, TWidgetLayout } from "@formbricks/types/analysis";
import { retryOnTransactionConflict } from "@/lib/utils/prisma-error";
import type { TDashboardFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { parseWidgetContent } from "@/modules/ee/analysis/dashboards/lib/widget-blocks";
import { findOverlappingWidget } from "@/modules/ee/analysis/dashboards/lib/widget-placement";
import { lockDashboard, nextDashboardUpdatedAt } from "./dashboard-lock";
import { findIneligiblePageTeams, sameTeamLimit } from "./page-access";
import { MAX_DASHBOARD_WIDGETS } from "./schemas";
import { PAGE_READ_ORDER, type TDashboardResourceRow, selectDashboardResource } from "./service";
import { toContentInput } from "./widget-service";

/**
 * A whole-dashboard write: the app's save (`PUT /api/v3/dashboards/{dashboardId}`), the MCP rearrange
 * and the MCP filters write. Every check runs against the transaction's own read, under the dashboard's
 * lock, before anything is written, so a refused write changes nothing.
 */

export type TReplacePageInput = {
  pageId?: string;
  key?: string;
  name: string;
  order: number;
  teamIds?: string[] | null;
};

export type TReplaceWidgetInput = {
  widgetId?: string;
  kind?: TDashboardWidgetKind;
  chartId?: string;
  pageId?: string;
  pageKey?: string;
  content?: unknown;
  layout: TWidgetLayout;
  order?: number;
};

type TPreviousPage = { id: string; name: string; order: number; teamIds: string[] };
type TPreviousWidget = { id: string; pageId: string; layout: unknown; order: number };

export type TDashboardReplaceResult =
  | {
      kind: "ok";
      row: TDashboardResourceRow;
      previous: {
        name: string;
        filters?: unknown;
        pages: TPreviousPage[];
        widgets: TPreviousWidget[];
      };
    }
  | { kind: "gone" }
  /** The dashboard changed after the caller's read. */
  | { kind: "stale"; currentUpdatedAt: Date }
  /** Widgets the caller named that are not on the dashboard. */
  | { kind: "unknownWidgets"; widgetIds: string[] }
  /** Current widgets the caller left out, where leaving one out is not allowed. */
  | { kind: "missingWidgets"; widgetIds: string[] }
  /** Pages the caller named that are not pages of the dashboard. */
  | { kind: "unknownPages"; pageIds: string[] }
  | { kind: "overlap"; widgetIds: [string, string] }
  /** A chart sent twice on one page. */
  | { kind: "duplicateChart"; chartId: string }
  /** A widget that does not fit its kind, an invalid block content, or a chart not in the workspace. */
  | { kind: "invalidWidget"; index: number; name: string; reason: string }
  /** New widgets would take the dashboard past `MAX_DASHBOARD_WIDGETS`. */
  | { kind: "full" }
  /** A page team limit change by a caller who may not make one. */
  | { kind: "accessDenied" }
  /** Teams a page of this dashboard cannot be limited to. */
  | { kind: "ineligibleTeams"; teamIds: string[] };

type TRefusal = Exclude<TDashboardReplaceResult, { kind: "ok" | "gone" | "stale" }>;

/**
 * A whole-dashboard write may carry up to `MAX_WIDGETS_PER_WRITE` widgets and reads the dashboard back with
 * every chart, so it gets more than Prisma's default five seconds.
 */
const REPLACE_TRANSACTION_OPTIONS = { timeout: 15_000 };

type TCurrent = {
  pages: { id: string; teamIds: string[] }[];
  widgets: { id: string; pageId: string; kind: TDashboardWidgetKind; chartId: string | null }[];
};

/** A page reference of the save resolved to its final page: an id, or a new page's key. */
type TPageRef = { id: string } | { key: string };

const pageRefKey = (ref: TPageRef): string => ("id" in ref ? `id:${ref.id}` : `key:${ref.key}`);

/** The pages a save leaves: the ones it sends, or the current ones when it sends none. */
const planPages = (
  current: TCurrent,
  pages: TReplacePageInput[] | undefined,
  canManageAccess: boolean
):
  | TRefusal
  | {
      kind: "ok";
      final: TPageRef[];
      removed: string[];
      /** Team ids each page's limit gains, to be checked against the options. */
      added: string[];
    } => {
  if (!pages) return { kind: "ok", final: current.pages.map(({ id }) => ({ id })), removed: [], added: [] };

  const currentById = new Map(current.pages.map((page) => [page.id, page]));
  const unknown = pages.flatMap((page) =>
    page.pageId !== undefined && !currentById.has(page.pageId) ? [page.pageId] : []
  );
  if (unknown.length > 0) return { kind: "unknownPages", pageIds: unknown };

  const added: string[] = [];
  for (const page of pages) {
    if (page.teamIds === undefined) continue;
    const before = page.pageId ? (currentById.get(page.pageId)?.teamIds ?? []) : [];
    if (sameTeamLimit(before, page.teamIds)) continue;
    if (!canManageAccess) return { kind: "accessDenied" };
    added.push(...(page.teamIds ?? []).filter((teamId) => !before.includes(teamId)));
  }

  const kept = new Set(pages.flatMap((page) => (page.pageId ? [page.pageId] : [])));
  return {
    kind: "ok",
    final: pages.map((page) => (page.pageId ? { id: page.pageId } : { key: page.key as string })),
    removed: current.pages.filter((page) => !kept.has(page.id)).map(({ id }) => id),
    added: [...new Set(added)],
  };
};

type TPlannedWidget = TReplaceWidgetInput & {
  page: TPageRef;
  kind: TDashboardWidgetKind;
  chartId?: string;
  /** The content to write: `undefined` keeps an existing block's content. */
  nextContent?: unknown;
};

type TCurrentWidget = TCurrent["widgets"][number];

/** The page a widget of the save ends up on: the one it names, else where it is, else the first page. */
const pageOfWidget = (
  widget: TReplaceWidgetInput,
  existing: TCurrentWidget | undefined,
  firstPage: TPageRef
): TPageRef => {
  if (widget.pageKey) return { key: widget.pageKey };
  if (widget.pageId) return { id: widget.pageId };
  return existing ? { id: existing.pageId } : firstPage;
};

/** One widget of the save as it will be written, or why it cannot be. */
const planWidget = (
  widget: TReplaceWidgetInput,
  index: number,
  existing: TCurrentWidget | undefined,
  { finalKeys, firstPage, workspaceId }: { finalKeys: Set<string>; firstPage: TPageRef; workspaceId: string }
): TRefusal | TPlannedWidget => {
  if (existing && widget.kind !== undefined && widget.kind !== existing.kind) {
    return { kind: "invalidWidget", index, name: "kind", reason: `This widget is a ${existing.kind}.` };
  }
  // A new widget always names its kind: the request schema refuses one without.
  const kind = existing?.kind ?? widget.kind ?? "chart";
  const page = pageOfWidget(widget, existing, firstPage);
  if (!finalKeys.has(pageRefKey(page))) {
    return {
      kind: "invalidWidget",
      index,
      name: "pageId",
      reason: "The widget's page is not a page this save keeps.",
    };
  }
  let nextContent: unknown = undefined;
  if (widget.content !== undefined || !existing) {
    const parsed = parseWidgetContent(kind, widget.content, workspaceId);
    if (!parsed.ok) return { kind: "invalidWidget", index, name: "content", reason: parsed.reason };
    nextContent = parsed.content;
  }
  return {
    ...widget,
    page,
    kind,
    chartId: existing ? (existing.chartId ?? undefined) : widget.chartId,
    nextContent,
  };
};

/** On each page, a chart at most once and no two widgets overlapping. */
const checkPagePlacement = (planned: TPlannedWidget[]): TRefusal | null => {
  const byPage = new Map<string, { id: string; layout: TWidgetLayout; chartId?: string }[]>();
  for (const [index, widget] of planned.entries()) {
    const key = pageRefKey(widget.page);
    const placed = byPage.get(key) ?? [];
    const id = widget.widgetId ?? `new widget ${index.toString()}`;
    if (widget.chartId && placed.some((other) => other.chartId === widget.chartId)) {
      return { kind: "duplicateChart", chartId: widget.chartId };
    }
    const clash = findOverlappingWidget(widget.layout, placed);
    if (clash) return { kind: "overlap", widgetIds: [id, clash.id] };
    placed.push({ id, layout: widget.layout, chartId: widget.chartId });
    byPage.set(key, placed);
  }
  return null;
};

/**
 * Where every widget of the save ends up, and whether that is allowed: each existing widget one of the
 * dashboard's, every one listed when `requireEveryWidget` is set, each on a page the save keeps, a chart at
 * most once per page, no two overlapping on a page, and block content valid for its kind.
 */
const planWidgets = ({
  current,
  widgets,
  finalPages,
  removedPages,
  requireEveryWidget,
  workspaceId,
}: {
  current: TCurrent;
  widgets: TReplaceWidgetInput[];
  finalPages: TPageRef[];
  removedPages: ReadonlySet<string>;
  requireEveryWidget: boolean;
  workspaceId: string;
}): TRefusal | { kind: "ok"; planned: TPlannedWidget[]; omitted: string[] } => {
  const currentById = new Map(current.widgets.map((widget) => [widget.id, widget]));
  const unknown = widgets.flatMap((widget) =>
    widget.widgetId !== undefined && !currentById.has(widget.widgetId) ? [widget.widgetId] : []
  );
  if (unknown.length > 0) return { kind: "unknownWidgets", widgetIds: unknown };
  const sent = new Set(widgets.flatMap((widget) => (widget.widgetId ? [widget.widgetId] : [])));
  const omitted = current.widgets
    .filter((widget) => !sent.has(widget.id) && !removedPages.has(widget.pageId))
    .map(({ id }) => id);
  if (requireEveryWidget && omitted.length > 0) return { kind: "missingWidgets", widgetIds: omitted };

  const context = { finalKeys: new Set(finalPages.map(pageRefKey)), firstPage: finalPages[0], workspaceId };
  const planned: TPlannedWidget[] = [];
  for (const [index, widget] of widgets.entries()) {
    const existing = widget.widgetId ? currentById.get(widget.widgetId) : undefined;
    const plan = planWidget(widget, index, existing, context);
    if ("page" in plan) planned.push(plan);
    else return plan;
  }

  return checkPagePlacement(planned) ?? { kind: "ok", planned, omitted };
};

/**
 * The cap on new widgets, and that each new chart widget shows a chart of this workspace, like the widget
 * add. Only new widgets are capped: a dashboard that grew past the cap before it existed can still be
 * saved, and shrunk.
 */
const checkNewWidgets = async (
  tx: Prisma.TransactionClient,
  planned: TPlannedWidget[],
  workspaceId: string
): Promise<TRefusal | null> => {
  const fresh = planned.filter((widget) => !widget.widgetId);
  if (fresh.length > 0 && planned.length > MAX_DASHBOARD_WIDGETS) return { kind: "full" };

  const newChartIds = [...new Set(fresh.flatMap((widget) => (widget.chartId ? [widget.chartId] : [])))];
  if (newChartIds.length === 0) return null;
  const rows = await tx.chart.findMany({
    where: { id: { in: newChartIds }, workspaceId },
    select: { id: true },
  });
  const found = new Set(rows.map(({ id }) => id));
  const index = planned.findIndex(
    (widget) => !widget.widgetId && widget.chartId && !found.has(widget.chartId)
  );
  return index >= 0
    ? { kind: "invalidWidget", index, name: "chartId", reason: "Not a chart of this workspace." }
    : null;
};

/**
 * Every existing widget's page, layout, and order where one is given, in one statement: a save of a large
 * dashboard is one round trip, not one per widget, while it holds the dashboard's lock. Only this
 * dashboard's widgets can match.
 */
const writeWidgetPlaces = async (
  tx: Prisma.TransactionClient,
  dashboardId: string,
  widgets: { widgetId: string; pageId: string; layout: TWidgetLayout; order?: number }[]
): Promise<void> => {
  if (widgets.length === 0) return;
  await tx.$executeRaw`
    UPDATE "DashboardWidget" AS w
    SET "layout" = v."layout"::jsonb, "pageId" = v."pageId", "order" = COALESCE(v."order", w."order"), "updated_at" = NOW() AT TIME ZONE 'UTC'
    FROM unnest(
      ${widgets.map((widget) => widget.widgetId)}::text[],
      ${widgets.map((widget) => widget.pageId)}::text[],
      ${widgets.map((widget) => JSON.stringify(widget.layout))}::text[],
      ${widgets.map((widget) => widget.order ?? null)}::int[]
    ) AS v("id", "pageId", "layout", "order")
    WHERE w."id" = v."id" AND w."dashboardId" = ${dashboardId}
  `;
};

/** Replaces a kept page's team limit with `teamIds`. */
const writePageTeams = async (tx: Prisma.TransactionClient, pageId: string, teamIds: string[]) => {
  await tx.dashboardPageTeam.deleteMany({ where: { pageId } });
  if (teamIds.length > 0) {
    await tx.dashboardPageTeam.createMany({ data: teamIds.map((teamId) => ({ pageId, teamId })) });
  }
};

/** Writes the save's pages: new ones created, kept ones renamed and reordered, limits replaced. */
const writePages = async (
  tx: Prisma.TransactionClient,
  dashboardId: string,
  pages: TReplacePageInput[],
  current: TCurrent
): Promise<Map<string, string>> => {
  const idByKey = new Map<string, string>();
  const currentTeams = new Map(current.pages.map((page) => [page.id, page.teamIds]));
  for (const page of pages) {
    const teamIds = page.teamIds ?? [];
    if (page.pageId) {
      await tx.dashboardPage.update({
        where: { id: page.pageId },
        data: { name: page.name, order: page.order },
        select: { id: true },
      });
      if (page.teamIds !== undefined && !sameTeamLimit(currentTeams.get(page.pageId) ?? [], teamIds)) {
        await writePageTeams(tx, page.pageId, teamIds);
      }
      continue;
    }
    const created = await tx.dashboardPage.create({
      data: {
        dashboardId,
        name: page.name,
        order: page.order,
        teamLimits: { create: teamIds.map((teamId) => ({ teamId })) },
      },
      select: { id: true },
    });
    if (page.key) idByKey.set(page.key, created.id);
  }
  return idByKey;
};

/** Writes the planned widgets: removes the omitted, places and updates the kept, creates the new. */
const writeWidgets = async (
  tx: Prisma.TransactionClient,
  dashboardId: string,
  { planned, omitted }: { planned: TPlannedWidget[]; omitted: string[] },
  resolvePage: (ref: TPageRef) => string
): Promise<void> => {
  if (omitted.length > 0) {
    await tx.dashboardWidget.deleteMany({ where: { dashboardId, id: { in: omitted } } });
  }
  const existing = planned.flatMap((widget) =>
    widget.widgetId ? [{ ...widget, widgetId: widget.widgetId }] : []
  );
  await writeWidgetPlaces(
    tx,
    dashboardId,
    existing.map((widget) => ({
      widgetId: widget.widgetId,
      pageId: resolvePage(widget.page),
      layout: widget.layout,
      order: widget.order,
    }))
  );
  for (const widget of existing) {
    if (widget.nextContent === undefined) continue;
    await tx.dashboardWidget.update({
      where: { id: widget.widgetId },
      data: { content: toContentInput(widget.nextContent) },
      select: { id: true },
    });
  }
  const fresh = planned.filter((widget) => !widget.widgetId);
  if (fresh.length === 0) return;
  await tx.dashboardWidget.createMany({
    data: fresh.map((widget) => ({
      dashboardId,
      pageId: resolvePage(widget.page),
      kind: widget.kind,
      chartId: widget.kind === "chart" ? (widget.chartId ?? null) : null,
      content: toContentInput(widget.nextContent),
      layout: widget.layout,
      order: widget.order ?? 0,
    })),
  });
};

const selectStoredDashboard = {
  name: true,
  updatedAt: true,
  filters: true,
  pages: {
    orderBy: PAGE_READ_ORDER,
    select: { id: true, name: true, order: true, teamLimits: { select: { teamId: true } } },
  },
  widgets: {
    select: { id: true, pageId: true, kind: true, chartId: true, layout: true, order: true },
  },
} satisfies Prisma.DashboardSelect;

/** A stored page as the save reads it, its team limit as ids. */
const toPreviousPage = (page: {
  id: string;
  name: string;
  order: number;
  teamLimits: { teamId: string }[];
}): TPreviousPage => ({
  id: page.id,
  name: page.name,
  order: page.order,
  teamIds: page.teamLimits.map(({ teamId }) => teamId),
});

type TReplaceInput = {
  dashboardId: string;
  workspaceId: string;
  expectedUpdatedAt: Date;
  /** Kept as it is when omitted. */
  name?: string;
  /** Kept as they are when omitted. */
  filters?: TDashboardFilter[];
  /** Kept as they are when omitted. */
  pages?: TReplacePageInput[];
  /** Every widget is kept as it is when `widgets` is omitted. */
  widgets?: TReplaceWidgetInput[];
  requireEveryWidget?: boolean;
  canManageAccess?: boolean;
};

/** Checks the whole save against the transaction's read: the pages, their team limits, then the widgets. */
const planReplace = async (
  tx: Prisma.TransactionClient,
  current: TCurrent,
  {
    dashboardId,
    workspaceId,
    pages,
    widgets,
    requireEveryWidget = false,
    canManageAccess = false,
  }: TReplaceInput
): Promise<
  | TRefusal
  | {
      kind: "ok";
      removedPages: string[];
      widgetPlan: { planned: TPlannedWidget[]; omitted: string[] } | null;
    }
> => {
  const pagePlan = planPages(current, pages, canManageAccess);
  if (pagePlan.kind !== "ok") return pagePlan;
  if (pagePlan.added.length > 0) {
    const ineligible = await findIneligiblePageTeams(tx, {
      dashboardId,
      workspaceId,
      teamIds: pagePlan.added,
    });
    if (ineligible.length > 0) return { kind: "ineligibleTeams", teamIds: ineligible };
  }
  if (!widgets) return { kind: "ok", removedPages: pagePlan.removed, widgetPlan: null };

  const widgetPlan = planWidgets({
    current,
    widgets,
    finalPages: pagePlan.final,
    removedPages: new Set(pagePlan.removed),
    requireEveryWidget,
    workspaceId,
  });
  if (widgetPlan.kind !== "ok") return widgetPlan;
  const refused = await checkNewWidgets(tx, widgetPlan.planned, workspaceId);
  return refused ?? { kind: "ok", removedPages: pagePlan.removed, widgetPlan };
};

/**
 * Replace a dashboard's name, filters, pages and its widgets' places in one transaction, provided it is
 * still the version the caller read (`expectedUpdatedAt`).
 *
 * A widget left out of `widgets` is removed — unless `requireEveryWidget` is set, which refuses instead:
 * the agent rearrange, which may move widgets but never remove one by omission. A page left out of `pages`
 * is removed with its widgets. A team limit that changes needs `canManageAccess`.
 */
export const replaceDashboardRow = (input: TReplaceInput): Promise<TDashboardReplaceResult> =>
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx): Promise<TDashboardReplaceResult> => {
      const { dashboardId, expectedUpdatedAt, name, filters, pages } = input;
      const locked = await lockDashboard(tx, dashboardId);
      if (!locked) return { kind: "gone" };
      const stored = await tx.dashboard.findUnique({
        where: { id: dashboardId },
        select: selectStoredDashboard,
      });
      if (!stored) return { kind: "gone" };
      if (stored.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        return { kind: "stale", currentUpdatedAt: stored.updatedAt };
      }
      const previousPages = stored.pages.map(toPreviousPage);
      const current: TCurrent = { pages: previousPages, widgets: stored.widgets };

      const plan = await planReplace(tx, current, input);
      if (plan.kind !== "ok") return plan;

      // Everything is checked: write. Pages first, so widgets can move onto new ones; removed pages last,
      // after the widgets moved off them, taking the rest of their widgets with them.
      const idByKey = pages ? await writePages(tx, dashboardId, pages, current) : new Map<string, string>();
      const resolvePage = (ref: TPageRef): string => ("id" in ref ? ref.id : (idByKey.get(ref.key) ?? ""));
      if (plan.widgetPlan) await writeWidgets(tx, dashboardId, plan.widgetPlan, resolvePage);
      if (plan.removedPages.length > 0) {
        await tx.dashboardPage.deleteMany({ where: { dashboardId, id: { in: plan.removedPages } } });
      }

      const row = await tx.dashboard.update({
        where: { id: dashboardId },
        data: {
          ...(name === undefined ? {} : { name }),
          ...(filters === undefined ? {} : { filters: filters }),
          updatedAt: nextDashboardUpdatedAt(locked),
        },
        select: selectDashboardResource,
      });

      return {
        kind: "ok",
        row,
        previous: {
          name: stored.name,
          filters: stored.filters,
          pages: previousPages,
          widgets: stored.widgets.map(({ id, pageId, layout, order }) => ({ id, pageId, layout, order })),
        },
      };
    }, REPLACE_TRANSACTION_OPTIONS)
  );
