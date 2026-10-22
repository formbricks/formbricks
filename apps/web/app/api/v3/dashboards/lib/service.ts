import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { selectChartResource } from "@/app/api/v3/charts/lib/service";
import { escapeLikePattern } from "@/lib/utils/like-pattern";

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
export const selectDashboardResource = {
  ...selectDashboardBase,
  widgets: {
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, chartId: true, layout: true, order: true, chart: { select: selectChartResource } },
  },
} satisfies Prisma.DashboardSelect;

export type TDashboardResourceRow = Prisma.DashboardGetPayload<{ select: typeof selectDashboardResource }>;

export const getDashboardResourceRow = (dashboardId: string): Promise<TDashboardResourceRow | null> =>
  prisma.dashboard.findUnique({ where: { id: dashboardId }, select: selectDashboardResource });

export type TDashboardListFilter = {
  workspaceId: string;
  nameContains?: string;
  chartId?: string;
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
