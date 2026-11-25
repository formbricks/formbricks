import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { V3_NAME_MAX_LENGTH } from "@/app/api/v3/charts/lib/schemas";
import { selectChartResource } from "@/app/api/v3/charts/lib/service";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import { copyNamePrefix, nextCopyName } from "@/modules/ee/analysis/lib/copy-name";
import { lockDashboard, nextDashboardUpdatedAt } from "./dashboard-lock";
import { DEFAULT_DASHBOARD_PAGE_NAME } from "./schemas";

/**
 * Persistence for the v3 dashboard operations. Like the chart service, every read is scoped by the
 * caller's authorized workspace, or returns the row's own workspace for the operation to authorize.
 */

const selectDashboardBase = {
  id: true,
  workspaceId: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { name: true } },
} satisfies Prisma.DashboardSelect;

/** A dashboard as a list shows it: its widgets counted, not loaded. */
export const selectDashboardListItem = {
  ...selectDashboardBase,
  _count: { select: { widgets: true } },
} satisfies Prisma.DashboardSelect;

export type TDashboardListRow = Prisma.DashboardGetPayload<{ select: typeof selectDashboardListItem }>;

/**
 * A dashboard with every widget and the widget's full chart, in one query: the charts, and the
 * dashboards each of them sits on, are batched relation reads rather than a query per widget.
 */
/** A widget with its full chart — what a dashboard read embeds and a widget write answers with. */
export const selectWidgetResource = {
  id: true,
  pageId: true,
  kind: true,
  chartId: true,
  content: true,
  layout: true,
  order: true,
  chart: { select: selectChartResource },
} satisfies Prisma.DashboardWidgetSelect;

export type TWidgetResourceRow = Prisma.DashboardWidgetGetPayload<{ select: typeof selectWidgetResource }>;

/** How a dashboard's pages read back: by `order`, then the order they were added, then id. */
export const PAGE_READ_ORDER = [
  { order: "asc" as const },
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

/** A page with the teams it is limited to. */
export const selectPageResource = {
  id: true,
  name: true,
  order: true,
  teamLimits: { orderBy: { teamId: "asc" as const }, select: { teamId: true } },
} satisfies Prisma.DashboardPageSelect;

export type TPageResourceRow = Prisma.DashboardPageGetPayload<{ select: typeof selectPageResource }>;

/**
 * How a dashboard's widgets read back: by `order`, then the order they were added, then id. Orders may tie
 * (a widget added at the order column's cap, a save that sends the same order twice), so the tail keeps
 * every read the same.
 */
export const WIDGET_READ_ORDER = [
  { order: "asc" as const },
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

export const selectDashboardResource = {
  ...selectDashboardBase,
  filters: true,
  pages: { orderBy: PAGE_READ_ORDER, select: selectPageResource },
  widgets: { orderBy: WIDGET_READ_ORDER, select: selectWidgetResource },
} satisfies Prisma.DashboardSelect;

export type TDashboardResourceRow = Prisma.DashboardGetPayload<{ select: typeof selectDashboardResource }>;

export const getDashboardResourceRow = (dashboardId: string): Promise<TDashboardResourceRow | null> =>
  prisma.dashboard.findUnique({ where: { id: dashboardId }, select: selectDashboardResource });

/** One widget on one dashboard, as the widget resource serializes it. */
export const getWidgetResourceRow = (
  dashboardId: string,
  widgetId: string
): Promise<TWidgetResourceRow | null> =>
  prisma.dashboardWidget.findFirst({ where: { id: widgetId, dashboardId }, select: selectWidgetResource });

/** Just enough of a dashboard to authorize a write to its widgets. */
export const getDashboardWorkspaceRow = (
  dashboardId: string
): Promise<{ id: string; workspaceId: string } | null> =>
  prisma.dashboard.findUnique({ where: { id: dashboardId }, select: { id: true, workspaceId: true } });

export type TDashboardListFilter = {
  workspaceId: string;
  nameContains?: string;
  chartId?: string;
  /** Only these dashboards: a Dashboard Viewer's readable ones (ENG-7472). Absent, every one. */
  ids?: readonly string[];
};

/**
 * One keyset page of a workspace's dashboards, newest first with the id as tie-break, `limit + 1` rows.
 * `chartId` narrows to the dashboards holding that chart — the same relation a chart's embedded
 * `dashboards` is read from.
 */
export const listDashboardRows = ({
  filter,
  cursor,
  limit,
}: {
  filter: TDashboardListFilter;
  cursor: { value: string; id: string } | null;
  limit: number;
}): Promise<TDashboardListRow[]> => {
  const after = cursor ? new Date(cursor.value) : null;

  return prisma.dashboard.findMany({
    where: {
      workspaceId: filter.workspaceId,
      ...(filter.ids ? { id: { in: [...filter.ids] } } : {}),
      ...(filter.nameContains
        ? { name: { contains: escapeLikePattern(filter.nameContains), mode: "insensitive" } }
        : {}),
      ...(filter.chartId ? { widgets: { some: { chartId: filter.chartId } } } : {}),
      ...(after && cursor
        ? { OR: [{ createdAt: { lt: after } }, { createdAt: after, id: { lt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: selectDashboardListItem,
  });
};

/** Candidates read per round while filling a Dashboard Viewer's list page. */
const READABLE_SCAN_BATCH = 100;

/**
 * A list page for a caller who may not open every dashboard (a Dashboard Viewer): walks candidate rows
 * in list order, a batch at a time, and keeps the ones `readable` allows until the page (plus one, for
 * the next cursor) is full or the candidates run out. Each round is one bounded query and one bounded
 * bulk check, so no request builds an ID set of the whole workspace.
 */
export const listReadableDashboardRows = async ({
  filter,
  cursor,
  limit,
  readable,
}: {
  filter: TDashboardListFilter;
  cursor: { value: string; id: string } | null;
  limit: number;
  readable: (ids: readonly string[]) => Promise<ReadonlySet<string>>;
}): Promise<TDashboardListRow[]> => {
  const kept: TDashboardListRow[] = [];
  let scanCursor = cursor;
  for (;;) {
    // `listDashboardRows` reads `limit + 1`; one more than the batch tells whether candidates remain.
    const batch = await listDashboardRows({ filter, cursor: scanCursor, limit: READABLE_SCAN_BATCH - 1 });
    if (batch.length === 0) return kept;
    const allowed = await readable(batch.map(({ id }) => id));
    for (const row of batch) {
      if (allowed.has(row.id)) kept.push(row);
      if (kept.length > limit) return kept;
    }
    if (batch.length < READABLE_SCAN_BATCH) return kept;
    const last = batch[batch.length - 1];
    scanCursor = { value: last.createdAt.toISOString(), id: last.id };
  }
};

/** A new dashboard, with its first page ("Overview"): every dashboard has at least one. */
export const createDashboardRow = (data: {
  workspaceId: string;
  name: string;
  createdBy: string | null;
}): Promise<TDashboardResourceRow> =>
  prisma.dashboard.create({
    data: { ...data, pages: { create: { name: DEFAULT_DASHBOARD_PAGE_NAME, order: 0 } } },
    select: selectDashboardResource,
  });

/**
 * Rename an authorized dashboard under its row lock, moving `updatedAt` like every other write so an editor
 * holding the old one is told on save. A dashboard deleted meanwhile throws Prisma's not-found error, as
 * an update would.
 */
export const renameDashboardRow = (dashboardId: string, name: string): Promise<TDashboardResourceRow> =>
  prisma.$transaction(async (tx) => {
    const locked = await lockDashboard(tx, dashboardId);
    return tx.dashboard.update({
      where: { id: dashboardId },
      data: { name, ...(locked ? { updatedAt: nextDashboardUpdatedAt(locked) } : {}) },
      select: selectDashboardResource,
    });
  });

/** Delete an authorized dashboard. Its widgets go with it; the charts they showed stay. */
export const deleteDashboardRow = (dashboardId: string): Promise<unknown> =>
  prisma.dashboard.delete({ where: { id: dashboardId }, select: { id: true } });

/**
 * Copy a dashboard in one transaction: a new dashboard whose widgets point at the **same** charts, in the
 * same layout and order, read inside the transaction that writes the copy. Without a `name`, the copy
 * takes the first free "(copy)" name, read there too.
 */
export const duplicateDashboardRow = ({
  sourceId,
  name,
  createdBy,
}: {
  sourceId: string;
  name?: string;
  createdBy: string | null;
}): Promise<TDashboardResourceRow | null> =>
  prisma.$transaction(async (tx) => {
    const source = await tx.dashboard.findUnique({
      where: { id: sourceId },
      select: {
        name: true,
        workspaceId: true,
        filters: true,
        // In the order the source shows them, so the copy can number them plainly: orders may tie.
        pages: {
          orderBy: PAGE_READ_ORDER,
          select: {
            name: true,
            teamLimits: { select: { teamId: true } },
            widgets: {
              orderBy: WIDGET_READ_ORDER,
              select: { kind: true, chartId: true, content: true, layout: true },
            },
          },
        },
      },
    });
    if (!source) return null;

    const resolvedName =
      name ??
      nextCopyName(
        source.name,
        (
          await tx.dashboard.findMany({
            where: {
              workspaceId: source.workspaceId,
              name: { startsWith: escapeLikePattern(copyNamePrefix(source.name, V3_NAME_MAX_LENGTH)) },
            },
            select: { name: true },
          })
        ).map((dashboard) => dashboard.name),
        V3_NAME_MAX_LENGTH
      );

    const copy = await tx.dashboard.create({
      data: {
        name: resolvedName,
        workspaceId: source.workspaceId,
        createdBy,
        // The copy keeps the filter bar: its filters say how the shared charts are meant to be sliced.
        filters: source.filters ?? [],
      },
      select: { id: true },
    });

    // Every page, in order and with its team limit, and each page's widgets on the copied page. A
    // dashboard always has a page; one that somehow has none still gets the first page a dashboard needs.
    const pages =
      source.pages.length > 0
        ? source.pages
        : [{ name: DEFAULT_DASHBOARD_PAGE_NAME, teamLimits: [], widgets: [] }];
    for (const [pageOrder, page] of pages.entries()) {
      await tx.dashboardPage.create({
        data: {
          dashboardId: copy.id,
          name: page.name,
          order: pageOrder,
          teamLimits: { create: page.teamLimits.map(({ teamId }) => ({ teamId })) },
          widgets: {
            create: page.widgets.map((widget, order) => ({
              dashboardId: copy.id,
              kind: widget.kind,
              chartId: widget.chartId,
              content: widget.content ?? Prisma.DbNull,
              layout: (widget.layout ?? {}) as Prisma.InputJsonValue,
              order,
            })),
          },
        },
        select: { id: true },
      });
    }

    return tx.dashboard.findUniqueOrThrow({ where: { id: copy.id }, select: selectDashboardResource });
  });

const selectDashboardChart = {
  id: true,
  type: true,
  query: true,
  feedbackDirectoryId: true,
  updatedAt: true,
} satisfies Prisma.ChartSelect;

/**
 * A dashboard with what a dashboard-bound read needs: its workspace, version and filters, and each chart
 * on it, once, with its query and Feedback Dataset — `chartId` narrows them to that chart. A chart may sit
 * on several pages of a dashboard, so the chart widgets are read and each chart kept once, in the order
 * its first widget shows. Layout blocks carry no chart and are left out.
 */
export const getDashboardChartsRow = async (dashboardId: string, { chartId }: { chartId?: string } = {}) => {
  const row = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: {
      id: true,
      workspaceId: true,
      updatedAt: true,
      filters: true,
      widgets: {
        where: chartId ? { chartId } : { chartId: { not: null } },
        orderBy: WIDGET_READ_ORDER,
        select: { pageId: true, chart: { select: selectDashboardChart } },
      },
    },
  });
  if (!row) return null;
  // One entry per chart, with every page it sits on: a Dashboard Viewer reads a chart through any page
  // of the dashboard they can open (ENG-7472).
  const byChart = new Map<
    string,
    { chart: Prisma.ChartGetPayload<{ select: typeof selectDashboardChart }>; pageIds: string[] }
  >();
  for (const widget of row.widgets) {
    if (!widget.chart) continue;
    const entry = byChart.get(widget.chart.id);
    if (entry) entry.pageIds.push(widget.pageId);
    else byChart.set(widget.chart.id, { chart: widget.chart, pageIds: [widget.pageId] });
  }
  return { ...row, widgets: [...byChart.values()] };
};

/** The row with only the charts that sit on at least one of `pageIds`. */
export const keepChartsOnPages = <TRow extends { widgets: { pageIds: string[] }[] }>(
  row: TRow,
  pageIds: ReadonlySet<string>
): TRow => ({
  ...row,
  widgets: row.widgets.filter((widget) => widget.pageIds.some((id) => pageIds.has(id))),
});

export type TDashboardChartsRow = NonNullable<Awaited<ReturnType<typeof getDashboardChartsRow>>>;
