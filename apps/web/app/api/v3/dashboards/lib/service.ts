import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { selectChartResource } from "@/app/api/v3/charts/lib/service";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import { copyNamePrefix, nextCopyName } from "@/modules/ee/analysis/lib/copy-name";

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

export const createDashboardRow = (data: {
  workspaceId: string;
  name: string;
  createdBy: string | null;
}): Promise<TDashboardResourceRow> => prisma.dashboard.create({ data, select: selectDashboardResource });

/** Rename an authorized dashboard; `@updatedAt` moves, so an editor holding the old one sees the change. */
export const renameDashboardRow = (dashboardId: string, name: string): Promise<TDashboardResourceRow> =>
  prisma.dashboard.update({ where: { id: dashboardId }, data: { name }, select: selectDashboardResource });

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
        widgets: { select: { chartId: true, layout: true, order: true } },
      },
    });
    if (!source) return null;

    const resolvedName =
      name ??
      nextCopyName(
        source.name,
        (
          await tx.dashboard.findMany({
            where: { workspaceId: source.workspaceId, name: { startsWith: copyNamePrefix(source.name) } },
            select: { name: true },
          })
        ).map((dashboard) => dashboard.name)
      );

    return tx.dashboard.create({
      data: {
        name: resolvedName,
        workspaceId: source.workspaceId,
        createdBy,
        widgets: {
          create: source.widgets.map((widget) => ({
            chartId: widget.chartId,
            layout: (widget.layout ?? {}) as Prisma.InputJsonValue,
            order: widget.order,
          })),
        },
      },
      select: selectDashboardResource,
    });
  });
