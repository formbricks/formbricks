import { prisma } from "@formbricks/database";
import type { DashboardUncheckedCreateInput, Prisma } from "@formbricks/database/prisma";

/**
 * Dashboards and widgets as the integration suites seed them. Every dashboard has a page (ENG-7480) and
 * every widget sits on one, so a dashboard is created with its "Overview" page, and the widgets a suite
 * lists go on that page unless they name another.
 */

type TSeedWidget = {
  chartId: string;
  layout: Prisma.InputJsonValue;
  order?: number;
  pageId?: string;
};

type TSeedDashboardData = Omit<DashboardUncheckedCreateInput, "widgets" | "pages"> & {
  widgets?: { create: TSeedWidget | TSeedWidget[] };
};

/** The first page of a dashboard, by order. */
export const firstPageId = async (dashboardId: string): Promise<string> =>
  (
    await prisma.dashboardPage.findFirstOrThrow({
      where: { dashboardId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    })
  ).id;

type TSeedWidgetRow = TSeedWidget & { dashboardId: string; id?: string };

/** `prisma.dashboardWidget.create` for a suite: a chart widget on its dashboard's first page, or `pageId`. */
export const createTestWidget = async ({ data }: { data: TSeedWidgetRow }) =>
  prisma.dashboardWidget.create({
    data: { ...data, kind: "chart", pageId: data.pageId ?? (await firstPageId(data.dashboardId)) },
  });

/** `prisma.dashboardWidget.createMany` for a suite, each widget on its dashboard's first page. */
export const createTestWidgetMany = async ({ data }: { data: TSeedWidgetRow[] }) => {
  const pages = new Map<string, string>();
  for (const { dashboardId } of data) {
    if (!pages.has(dashboardId)) pages.set(dashboardId, await firstPageId(dashboardId));
  }
  return prisma.dashboardWidget.createMany({
    data: data.map((widget) => ({
      ...widget,
      kind: "chart" as const,
      pageId: widget.pageId ?? (pages.get(widget.dashboardId) as string),
    })),
  });
};

/** Creates widgets on a dashboard, each on its first page unless it names one. */
export const createTestWidgets = async (
  widgets: (TSeedWidget & { dashboardId: string; id?: string })[]
): Promise<void> => {
  for (const widget of widgets) {
    await prisma.dashboardWidget.create({
      data: {
        ...widget,
        order: widget.order ?? 0,
        kind: "chart",
        pageId: widget.pageId ?? (await firstPageId(widget.dashboardId)),
      },
    });
  }
};

/**
 * `prisma.dashboard.create` for a suite: the dashboard with its first page, and the `widgets` it lists on
 * that page. Answers the whole dashboard with its pages and its widgets in order, whatever `select` or
 * `include` the call names (kept so a suite reads as the create it replaces).
 */
export const createTestDashboard = async ({
  data: { widgets, ...data },
}: {
  data: TSeedDashboardData;
  select?: unknown;
  include?: unknown;
}) => {
  const dashboard = await prisma.dashboard.create({
    data: { ...data, pages: { create: { name: "Overview", order: 0 } } },
    select: { id: true, updatedAt: true },
  });
  const listed = widgets ? [widgets.create].flat() : [];
  await createTestWidgets(listed.map((widget) => ({ ...widget, dashboardId: dashboard.id })));
  // Adding the widgets is seeding, not an edit: the dashboard keeps the `updatedAt` it was created with.
  await prisma.dashboard.update({ where: { id: dashboard.id }, data: { updatedAt: dashboard.updatedAt } });
  return prisma.dashboard.findUniqueOrThrow({
    where: { id: dashboard.id },
    include: {
      pages: { orderBy: { order: "asc" } },
      widgets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });
};
